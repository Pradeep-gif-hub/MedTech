from datetime import datetime, timedelta
import random

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import SessionLocal
import models
import schemas
from utils.email_utils import send_otp_email

router = APIRouter(tags=["OTP"])

OTP_EXPIRY_MINUTES = 5
MAX_OTP_ATTEMPTS = 5


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def generate_otp(length: int = 6) -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(length))


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

    try:
        sent_flag = bool(send_otp_email(to_email=email, otp=code))
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
