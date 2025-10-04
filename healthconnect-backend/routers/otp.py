from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random
import os
import importlib.util
from database import SessionLocal
import models, schemas

router = APIRouter(tags=["OTP"])

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
    # fallback printer
    def _printer(to_address: str, subject: str, body: str) -> bool:
        print(f"[EMAIL-DRYRUN] To: {to_address}\nSubject: {subject}\n\n{body}")
        return False
    return _printer

send_email = _load_send_email()

def generate_otp(length: int = 6) -> str:
    return ''.join(str(random.randint(0, 9)) for _ in range(length))

@router.api_route("/send-otp", methods=["POST", "OPTIONS"])
async def send_otp(request: Request, db: Session = Depends(get_db)):
    # handle CORS preflight
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_200_OK)
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    print(f"[OTP] /send-otp called. Body={payload}")

    try:
        req = schemas.OTPRequest(**payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

    code = generate_otp()
    expires = datetime.utcnow() + timedelta(minutes=10)
    otp_entry = models.OTP(email=req.email, code=code, expires_at=expires, verified=False)

    try:
        db.add(otp_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[OTP] DB error creating OTP: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to store OTP: {e}")

    # Attempt to send email. send_email should return True if SMTP send attempted/succeeded, False if dry-run.
    try:
        email_body = f"""Hi {req.name or 'User'},

Here's your OTP to verify your account: {code}

Enter it to continue your journey with us.

Cheering you on,
Team HealthConnect"""
        sent_flag = bool(send_email(to_address=req.email, subject="Welcome to HealthConnect - Verify Your Account", body=email_body))
    except Exception as e:
        print(f"[OTP] send_email exception: {e}")
        sent_flag = False

    # If SMTP isn't configured (sent_flag == False) include the OTP in the JSON response for local debugging.
    # Also allow forcing debug with OTP_DEBUG=1.
    debug_enabled = os.getenv("OTP_DEBUG", "0") == "1"
    debug_otp = code if (debug_enabled or not sent_flag) else None

    response = schemas.OTPResponse(
        email=req.email,
        sent=sent_flag,
        expires_at=expires.isoformat(),
        debug_otp=debug_otp,
    )
    print(f"[OTP] OTP created for {req.email}; emailed={sent_flag}; debug={debug_enabled}")
    return response

@router.api_route("/verify-otp", methods=["POST", "OPTIONS"])
async def verify_otp(request: Request, db: Session = Depends(get_db)):
    if request.method == "OPTIONS":
        return Response(status_code=status.HTTP_200_OK)
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    print(f"[OTP] /verify-otp called. Body={payload}")

    try:
        req = schemas.OTPVerify(**payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

    now = datetime.utcnow()
    provided_code = str(req.otp).strip()

    # First try exact query
    otp_row = (
        db.query(models.OTP)
        .filter(models.OTP.email == req.email, models.OTP.code == provided_code)
        .order_by(models.OTP.created_at.desc())
        .first()
    )

    # If not found, fetch latest few OTPs for this email and log them for debugging,
    # then attempt a tolerant match against the latest (trimmed) code.
    if not otp_row:
        recent = db.query(models.OTP).filter(models.OTP.email == req.email).order_by(models.OTP.created_at.desc()).limit(5).all()
        print(f"[OTP] Recent OTP rows for {req.email}: {[{'code': r.code, 'expires_at': r.expires_at, 'verified': r.verified, 'created_at': r.created_at} for r in recent]}")
        if recent:
            latest = recent[0]
            if str(latest.code).strip() == provided_code:
                otp_row = latest

    if not otp_row:
        raise HTTPException(status_code=404, detail="OTP not found or does not match")

    if otp_row.verified:
        return {"verified": True, "message": "OTP already verified"}
    if otp_row.expires_at < now:
        raise HTTPException(status_code=400, detail="OTP expired")

    try:
        otp_row.verified = True
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[OTP] DB error verifying OTP: {e}")
        raise HTTPException(status_code=500, detail="Failed to update OTP")

    return {"verified": True, "message": "OTP verified"}

