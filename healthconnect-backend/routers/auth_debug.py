"""
Comprehensive Debug & Fix for Forgot-Password Flow
This file replaces the current routers/users.py forgot_password function
with proper error handling, validation, and step-by-step debugging.
"""

import secrets
import traceback
from datetime import datetime, timedelta, timezone
from typing import Tuple

from fastapi import APIRouter, Depends, HTTPException, Body, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import SessionLocal
import models


router = APIRouter(tags=["Auth-Debug"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _json_response(success: bool, message: str, status_code: int = 200, **extra):
    """Structured JSON response helper"""
    payload = {
        "success": success,
        "message": message,
    }
    for key, value in extra.items():
        if value is not None:
            payload[key] = value
    return JSONResponse(status_code=status_code, content=payload)


@router.post("/forgot-password-debug")
def forgot_password_debug(data: dict = Body(...), request: Request = None, db: Session = Depends(get_db)):
    """
    DEBUG VERSION: Multi-level debugging with every possible error case logged.
    Returns exact error location and detailed diagnostics.
    """
    # ===== LEVEL 1: REQUEST VALIDATION =====
    print("\n" + "="*80)
    print("[FP-DEBUG] ===== FORGOT PASSWORD REQUEST STARTED =====")
    print("="*80)
    
    try:
        # Log raw incoming data
        print(f"[FP-DEBUG] L1.1: Raw request body type: {type(data)}")
        print(f"[FP-DEBUG] L1.2: Raw request body keys: {list(data.keys()) if isinstance(data, dict) else 'NOT A DICT'}")
        print(f"[FP-DEBUG] L1.3: Full request body: {data}")
        
        # Extract email
        email_raw = data.get("email") if isinstance(data, dict) else None
        email = str(email_raw or "").strip().lower()
        print(f"[FP-DEBUG] L1.4: Extracted email: '{email}' (type: {type(email)})")
        
        # Validate email
        if not email:
            print(f"[FP-DEBUG] L1.5: EMAIL VALIDATION FAILED - email is empty or missing")
            return _json_response(
                False, 
                "Email is required", 
                status_code=400,
                error="email_missing"
            )
        
        print(f"[FP-DEBUG] L1.6: Email validation PASSED")
        
    except Exception as e:
        print(f"[FP-DEBUG] L1-EXCEPTION: Request validation failed")
        print(f"[FP-DEBUG] L1-ERROR: {type(e).__name__}: {str(e)}")
        print(f"[FP-DEBUG] L1-STACK:\n{traceback.format_exc()}")
        return _json_response(
            False,
            "Request validation error",
            status_code=400,
            error=str(e)
        )
    
    # ===== LEVEL 2: ENVIRONMENT CONFIGURATION =====
    try:
        from config import settings
        
        print(f"\n[FP-DEBUG] L2.1: Checking environment variables")
        print(f"[FP-DEBUG] L2.2: SMTP_SERVER = {settings.SMTP_SERVER or '[MISSING]'}")
        print(f"[FP-DEBUG] L2.3: SMTP_PORT = {settings.SMTP_PORT or '[MISSING]'}")
        print(f"[FP-DEBUG] L2.4: SMTP_USER = {settings.SMTP_USER or '[MISSING]'}")
        print(f"[FP-DEBUG] L2.5: SMTP_PASS set = {bool(settings.SMTP_PASS)}")
        print(f"[FP-DEBUG] L2.6: SMTP_PASS length = {len(settings.SMTP_PASS) if settings.SMTP_PASS else 0}")
        print(f"[FP-DEBUG] L2.7: FROM_EMAIL = {settings.FROM_EMAIL or '[MISSING]'}")
        print(f"[FP-DEBUG] L2.8: FRONTEND_URL = {settings.FRONTEND_URL or '[MISSING]'}")
        
        # Check for missing critical vars
        missing_vars = []
        if not settings.SMTP_USER:
            missing_vars.append("SMTP_USER")
        if not settings.SMTP_PASS:
            missing_vars.append("SMTP_PASS")
        if not settings.FRONTEND_URL:
            missing_vars.append("FRONTEND_URL")
        
        if missing_vars:
            print(f"[FP-DEBUG] L2.9: CRITICAL MISSING ENV VARS: {', '.join(missing_vars)}")
            return _json_response(
                False,
                "Server configuration error",
                status_code=500,
                error=f"Missing env vars: {', '.join(missing_vars)}"
            )
        
        print(f"[FP-DEBUG] L2.10: All critical env vars present")
        
    except Exception as e:
        print(f"[FP-DEBUG] L2-EXCEPTION: Environment check failed")
        print(f"[FP-DEBUG] L2-ERROR: {type(e).__name__}: {str(e)}")
        print(f"[FP-DEBUG] L2-STACK:\n{traceback.format_exc()}")
        return _json_response(
            False,
            "Configuration error",
            status_code=500,
            error=str(e)
        )
    
    # ===== LEVEL 3: DATABASE LOOKUP =====
    try:
        print(f"\n[FP-DEBUG] L3.1: Querying database for user with email: {email}")
        
        user = db.query(models.User).filter(
            func.lower(models.User.email) == email
        ).first()
        
        if not user:
            print(f"[FP-DEBUG] L3.2: USER NOT FOUND in database")
            return _json_response(
                False,
                "User not found",
                status_code=404,
                error="user_not_found"
            )
        
        print(f"[FP-DEBUG] L3.3: USER FOUND")
        print(f"[FP-DEBUG] L3.4: User ID: {user.id}")
        print(f"[FP-DEBUG] L3.5: User email: {user.email}")
        
    except Exception as e:
        print(f"[FP-DEBUG] L3-EXCEPTION: Database lookup failed")
        print(f"[FP-DEBUG] L3-ERROR: {type(e).__name__}: {str(e)}")
        print(f"[FP-DEBUG] L3-STACK:\n{traceback.format_exc()}")
        return _json_response(
            False,
            "Database error",
            status_code=500,
            error=str(e)
        )
    
    # ===== LEVEL 4: TOKEN GENERATION =====
    try:
        print(f"\n[FP-DEBUG] L4.1: Generating reset token")
        
        now_utc = datetime.now(timezone.utc)
        expires_at = now_utc + timedelta(hours=1)
        token = secrets.token_urlsafe(32)
        
        print(f"[FP-DEBUG] L4.2: Token generated: {token[:20]}...")
        print(f"[FP-DEBUG] L4.3: Token length: {len(token)}")
        print(f"[FP-DEBUG] L4.4: Expires at: {expires_at}")
        
        # Invalidate previous tokens
        print(f"[FP-DEBUG] L4.5: Invalidating previous reset tokens for user {user.id}")
        
        db.query(models.PasswordResetToken).filter(
            models.PasswordResetToken.user_id == user.id,
            models.PasswordResetToken.used.is_(False),
        ).update(
            {
                models.PasswordResetToken.used: True,
                models.PasswordResetToken.used_at: now_utc,
            },
            synchronize_session=False,
        )
        print(f"[FP-DEBUG] L4.6: Previous tokens invalidated")
        
        # Create new token record
        print(f"[FP-DEBUG] L4.7: Creating new PasswordResetToken record")
        
        token_row = models.PasswordResetToken(
            user_id=user.id,
            email=email,
            token=token,
            expires_at=expires_at,
            used=False,
        )
        db.add(token_row)
        db.flush()  # Ensure it's written before commit
        
        print(f"[FP-DEBUG] L4.8: PasswordResetToken flushed to DB")
        
        db.commit()
        print(f"[FP-DEBUG] L4.9: PasswordResetToken committed successfully")
        print(f"[FP-DEBUG] L4.10: Token row ID: {token_row.id}")
        
    except Exception as e:
        db.rollback()
        print(f"[FP-DEBUG] L4-EXCEPTION: Token generation/storage failed")
        print(f"[FP-DEBUG] L4-ERROR: {type(e).__name__}: {str(e)}")
        print(f"[FP-DEBUG] L4-STACK:\n{traceback.format_exc()}")
        return _json_response(
            False,
            "Token generation error",
            status_code=500,
            error=str(e)
        )
    
    # ===== LEVEL 5: EMAIL PREPARATION =====
    try:
        print(f"\n[FP-DEBUG] L5.1: Preparing email content")
        
        frontend_url = settings.FRONTEND_URL.rstrip('/')
        reset_link = f"{frontend_url}/reset-password?token={token}&email={email}"
        
        print(f"[FP-DEBUG] L5.2: Frontend URL: {frontend_url}")
        print(f"[FP-DEBUG] L5.3: Reset link prepared: {reset_link[:50]}...")
        
    except Exception as e:
        print(f"[FP-DEBUG] L5-EXCEPTION: Email preparation failed")
        print(f"[FP-DEBUG] L5-ERROR: {type(e).__name__}: {str(e)}")
        print(f"[FP-DEBUG] L5-STACK:\n{traceback.format_exc()}")
        return _json_response(
            False,
            "Email preparation error",
            status_code=500,
            error=str(e)
        )
    
    # ===== LEVEL 6: EMAIL SENDING =====
    try:
        print(f"\n[FP-DEBUG] L6.1: Initializing email sending")
        
        from utils.email_utils import send_reset_email, get_last_email_error
        
        print(f"[FP-DEBUG] L6.2: Calling send_reset_email")
        print(f"[FP-DEBUG] L6.3: Email recipient: {email}")
        print(f"[FP-DEBUG] L6.4: Token: {token[:20]}...")
        
        sent = send_reset_email(email=email, token=token)
        
        print(f"[FP-DEBUG] L6.5: send_reset_email returned: {sent}")
        
        if not sent:
            error = get_last_email_error() or "Unknown email error"
            print(f"[FP-DEBUG] L6.6: EMAIL SEND FAILED")
            print(f"[FP-DEBUG] L6.7: Error: {error}")
            
            return _json_response(
                False,
                "Failed to send password reset email",
                status_code=500,
                error=error
            )
        
        print(f"[FP-DEBUG] L6.8: EMAIL SENT SUCCESSFULLY")
        
    except Exception as e:
        print(f"[FP-DEBUG] L6-EXCEPTION: Email sending failed")
        print(f"[FP-DEBUG] L6-ERROR: {type(e).__name__}: {str(e)}")
        print(f"[FP-DEBUG] L6-STACK:\n{traceback.format_exc()}")
        
        return _json_response(
            False,
            "Failed to send email",
            status_code=500,
            error=str(e)
        )
    
    # ===== SUCCESS =====
    print(f"\n[FP-DEBUG] L7.1: ALL STEPS COMPLETED SUCCESSFULLY")
    print("="*80)
    print("[FP-DEBUG] ===== FORGOT PASSWORD REQUEST COMPLETED =====")
    print("="*80 + "\n")
    
    return _json_response(
        True,
        "Password reset email sent successfully. Check your inbox.",
        status_code=200
    )


@router.get("/smtp-test")
def smtp_test():
    """
    Test SMTP configuration without database logic.
    Just checks if we can connect and authenticate with Brevo.
    """
    print("\n[SMTP-TEST] ===== SMTP DIAGNOSTIC TEST =====")
    
    try:
        from config import settings
        from utils.email_utils import send_email, get_email_health, get_last_email_error
        
        print(f"[SMTP-TEST] 1: Getting email health status")
        health = get_email_health()
        
        print(f"[SMTP-TEST] 2: Health status = {health}")
        
        if not health.get("configured"):
            error = health.get("error")
            print(f"[SMTP-TEST] 3: SMTP NOT CONFIGURED - {error}")
            return {
                "status": "error",
                "configured": False,
                "error": error,
                "health": health
            }
        
        print(f"[SMTP-TEST] 4: SMTP is configured, checking vars")
        print(f"[SMTP-TEST] 5: SMTP_SERVER: {settings.SMTP_SERVER}")
        print(f"[SMTP-TEST] 6: SMTP_PORT: {settings.SMTP_PORT}")
        print(f"[SMTP-TEST] 7: SMTP_USER: {settings.SMTP_USER}")
        print(f"[SMTP-TEST] 8: FROM_EMAIL: {settings.FROM_EMAIL}")
        
        return {
            "status": "ok",
            "configured": True,
            "health": health,
            "message": "SMTP is configured and ready"
        }
        
    except Exception as e:
        print(f"[SMTP-TEST] ERROR: {type(e).__name__}: {str(e)}")
        print(f"[SMTP-TEST] STACK:\n{traceback.format_exc()}")
        return {
            "status": "error",
            "error": str(e),
            "stack": traceback.format_exc()
        }
