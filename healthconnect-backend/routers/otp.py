from datetime import datetime, timedelta
from html import escape
import importlib.util
import os
import random

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import SessionLocal
import models
import schemas

router = APIRouter(tags=["OTP"])

OTP_EXPIRY_MINUTES = 10
MAX_OTP_ATTEMPTS = 5


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Dynamic loader to avoid importing top-level utils.py (which may import extra deps)
def _load_send_email():
    here = os.path.dirname(__file__)
    project_root = os.path.abspath(os.path.join(here, ".."))
    candidates = [
        os.path.join(project_root, "utils", "email_utils.py"),
        os.path.join(project_root, "utils.py"),
    ]

    for path in candidates:
        try:
            if os.path.exists(path):
                spec = importlib.util.spec_from_file_location("hc_email_utils", path)
                module = importlib.util.module_from_spec(spec)
                loader = spec.loader
                if loader and hasattr(loader, "exec_module"):
                    loader.exec_module(module)  # type: ignore
                else:
                    exec(compile(open(path, "rb").read(), path, "exec"), module.__dict__)
                if hasattr(module, "send_email"):
                    return getattr(module, "send_email")
        except Exception as e:
            print(f"[OTP ROUTER] Failed loading email util from {path}: {e}")

    def _printer(to_address: str, subject: str, body: str, html_body: str | None = None) -> bool:
        _ = (to_address, subject, body, html_body)
        return False

    return _printer


send_email = _load_send_email()


def generate_otp(length: int = 6) -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(length))


def _build_otp_email_html(user_name: str, otp_code: str) -> str:
    safe_name = escape(user_name or "User")
    safe_otp = escape(otp_code)

    return f"""
<div style="margin:0;padding:24px;background-color:#F5F8FB;">
  <div style="max-width:560px;margin:0 auto;background-color:#FFFFFF;border-radius:14px;box-shadow:0 8px 24px rgba(31,41,55,0.08);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1F2937;">
    <div style="background-color:#2E7DFF;padding:18px 24px;">
      <div style="font-size:20px;line-height:1.2;font-weight:700;color:#FFFFFF;">HealthConnect</div>
    </div>

    <div style="padding:28px 24px;">
      <p style="margin:0 0 14px 0;font-size:16px;line-height:1.6;color:#1F2937;">Hi {safe_name},</p>

      <p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:#1F2937;">
        Use the following one-time code to verify your account.
      </p>

      <div style="margin:0 0 18px 0;padding:14px 16px;border-radius:12px;background-color:#F5F8FB;border:1px solid #D9E4F2;text-align:center;">
        <span style="display:inline-block;font-size:34px;line-height:1.1;font-weight:800;letter-spacing:8px;color:#2E7DFF;">{safe_otp}</span>
      </div>

      <p style="margin:0 0 10px 0;font-size:14px;line-height:1.7;color:#1F2937;">
        This code expires in 10 minutes.
      </p>

      <p style="margin:0 0 22px 0;font-size:14px;line-height:1.7;color:#1F2937;">
        If you did not request this code, please ignore this email.
      </p>

      <div style="padding-top:14px;border-top:1px solid #E5ECF4;">
        <p style="margin:0;font-size:14px;line-height:1.6;color:#1DBF73;font-weight:600;">HealthConnect Team</p>
      </div>
    </div>
  </div>
</div>
"""


def _purge_otp_and_attempts(db: Session, otp_id: int) -> None:
    db.query(models.OTPVerificationAttempt).filter(
        models.OTPVerificationAttempt.otp_id == otp_id
    ).delete(synchronize_session=False)
    db.query(models.OTP).filter(models.OTP.id == otp_id).delete(synchronize_session=False)


@router.api_route("/send-otp", methods=["POST", "OPTIONS"])
async def send_otp(request: Request, db: Session = Depends(get_db)):
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_200_OK)

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    try:
        req = schemas.OTPRequest(**payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

    email = (req.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    display_name = (req.name or "User").strip() or "User"
    code = generate_otp()
    expires = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)

    try:
        stale_otps = db.query(models.OTP).filter(models.OTP.email == email).all()
        stale_ids = [row.id for row in stale_otps]
        if stale_ids:
            db.query(models.OTPVerificationAttempt).filter(
                models.OTPVerificationAttempt.otp_id.in_(stale_ids)
            ).delete(synchronize_session=False)
            db.query(models.OTP).filter(models.OTP.id.in_(stale_ids)).delete(synchronize_session=False)

        otp_entry = models.OTP(email=email, code=code, expires_at=expires, verified=False)
        db.add(otp_entry)
        db.commit()
        db.refresh(otp_entry)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to store OTP: {e}")

    email_subject = "HealthConnect - Verify Your Account"
    email_text = (
        f"Hi {display_name},\n\n"
        "Use the following one-time code to verify your account.\n\n"
        f"{code}\n\n"
        "This code expires in 10 minutes.\n"
        "If you did not request this code, please ignore this email.\n\n"
        "HealthConnect Team"
    )
    email_html = _build_otp_email_html(display_name, code)

    try:
        sent_flag = bool(
            send_email(
                to_address=email,
                subject=email_subject,
                body=email_text,
                html_body=email_html,
            )
        )
    except Exception:
        sent_flag = False

    if not sent_flag:
        try:
            _purge_otp_and_attempts(db, otp_entry.id)
            db.commit()
        except Exception:
            db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Failed to send OTP email. Please try again."},
        )

    return schemas.OTPResponse(success=True, message="OTP sent to your email")


@router.api_route("/verify-otp", methods=["POST", "OPTIONS"])
async def verify_otp(request: Request, db: Session = Depends(get_db)):
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_200_OK)

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    try:
        req = schemas.OTPVerify(**payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

    email = (req.email or "").strip().lower()
    provided_code = str(req.otp or "").strip()
    if not email or not provided_code:
        return JSONResponse(
            status_code=400,
            content={"verified": False, "message": "Email and OTP are required."},
        )

    now = datetime.utcnow()
    otp_row = (
        db.query(models.OTP)
        .filter(models.OTP.email == email, models.OTP.verified.is_(False))
        .order_by(models.OTP.created_at.desc())
        .first()
    )

    if not otp_row:
        return JSONResponse(
            status_code=404,
            content={"verified": False, "message": "OTP not found. Please request a new code."},
        )

    if otp_row.expires_at < now:
        try:
            _purge_otp_and_attempts(db, otp_row.id)
            db.commit()
        except Exception:
            db.rollback()
        return JSONResponse(
            status_code=400,
            content={"verified": False, "message": "OTP expired. Please request a new code."},
        )

    attempts_count = db.query(models.OTPVerificationAttempt).filter(
        models.OTPVerificationAttempt.otp_id == otp_row.id
    ).count()

    if attempts_count >= MAX_OTP_ATTEMPTS:
        try:
            _purge_otp_and_attempts(db, otp_row.id)
            db.commit()
        except Exception:
            db.rollback()
        return JSONResponse(
            status_code=429,
            content={"verified": False, "message": "Maximum attempts exceeded. Please request a new OTP."},
        )

    if str(otp_row.code).strip() != provided_code:
        next_attempt = attempts_count + 1
        if next_attempt >= MAX_OTP_ATTEMPTS:
            try:
                _purge_otp_and_attempts(db, otp_row.id)
                db.commit()
            except Exception:
                db.rollback()
            return JSONResponse(
                status_code=429,
                content={"verified": False, "message": "Maximum attempts exceeded. Please request a new OTP."},
            )

        try:
            db.add(models.OTPVerificationAttempt(otp_id=otp_row.id, email=email))
            db.commit()
        except Exception:
            db.rollback()
            return JSONResponse(
                status_code=500,
                content={"verified": False, "message": "Failed to verify OTP. Please try again."},
            )

        remaining = MAX_OTP_ATTEMPTS - next_attempt
        return JSONResponse(
            status_code=400,
            content={"verified": False, "message": f"Invalid OTP. {remaining} attempts remaining."},
        )

    try:
        _purge_otp_and_attempts(db, otp_row.id)
        db.commit()
    except Exception:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"verified": False, "message": "Failed to update OTP status."},
        )

    return {"verified": True, "message": "OTP verified"}
