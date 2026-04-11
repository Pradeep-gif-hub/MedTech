# Corrected Code Snippets - Reference

## Complete Corrected Functions

### 1. Enhanced _send_via_smtp() in utils/email_utils.py

```python
def _send_via_smtp(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str | None = None,
    retries: int = 1,
) -> bool:
    print("[EMAIL] Step 1: _send_via_smtp called")
    print(f"[EMAIL] Step 1a: to_email parameter = {to_email}")
    print(f"[EMAIL] Step 1b: subject = {subject}")
    
    recipient = _extract_first_email(to_email)
    print(f"[EMAIL] Step 1c: extracted recipient = {recipient}")
    
    if not recipient:
        message = "Invalid recipient email"
        _set_last_email_error(message)
        print(f"[EMAIL] ERROR: {message}")
        return False

    print("[EMAIL] Step 2: Getting SMTP config")
    config = _smtp_config()
    print(f"[EMAIL] Step 2a: SMTP server = {config['server']}")
    print(f"[EMAIL] Step 2b: SMTP port = {config['port']}")
    print(f"[EMAIL] Step 2c: SMTP user = {config['user']}")
    print(f"[EMAIL] Step 2d: from_header = {config['from_header']}")
    print(f"[EMAIL] Step 2e: from_address = {config['from_address']}")
    
    missing = _missing_smtp_fields(config)
    if missing:
        message = f"Missing SMTP config: {', '.join(missing)}"
        _set_last_email_error(message)
        print(f"[EMAIL] ERROR: {message}")
        return False

    print("[EMAIL] Step 3: SMTP config validated - all fields present")
    
    total_attempts = max(1, int(retries) + 1)
    last_exc: Exception | None = None

    print(
        f"[EMAIL] Step 4: Triggered SMTP send to={recipient}, subject='{subject}', "
        f"server={config['server']}:{config['port']}, attempts={total_attempts}"
    )

    print("[EMAIL] Step 5: Building email message")
    msg = _build_email_message(
        to_email=recipient,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        from_header=config["from_header"],
    )
    print("[EMAIL] Step 5a: Email message built successfully")

    for attempt in range(1, total_attempts + 1):
        try:
            print(f"[EMAIL] Step 6.{attempt}: Attempt {attempt} - Connecting to SMTP server")
            with smtplib.SMTP(config["server"], config["port"], timeout=30) as smtp:
                print(f"[EMAIL] Step 6.{attempt}a: SMTP connection established")
                
                print(f"[EMAIL] Step 6.{attempt}b: Sending EHLO")
                smtp.ehlo()
                
                print(f"[EMAIL] Step 6.{attempt}c: Starting TLS")
                smtp.starttls()
                
                print(f"[EMAIL] Step 6.{attempt}d: Sending EHLO after TLS")
                smtp.ehlo()
                
                print(f"[EMAIL] Step 6.{attempt}e: Authenticating with SMTP user: {config['user']}")
                smtp.login(config["user"], config["password"])
                print(f"[EMAIL] Step 6.{attempt}f: Authentication successful")
                
                print(f"[EMAIL] Step 6.{attempt}g: Sending message")
                smtp_response = smtp.send_message(msg)
                print(f"[EMAIL] Step 6.{attempt}h: Message sent, SMTP response = {smtp_response}")

            if smtp_response:
                print(f"[EMAIL] Step 6.{attempt}i: SMTP returned response code (recipient refused): {smtp_response}")
                raise smtplib.SMTPRecipientsRefused(smtp_response)

            print(f"[EMAIL] Step 7: SMTP send success to={recipient}")
            _set_last_email_error("")
            return True
        except smtplib.SMTPAuthenticationError as e:
            last_exc = e
            message = f"SMTP authentication failed: {str(e)}"
            print(f"[EMAIL] ERROR (Attempt {attempt}): {message}")
            # Bad credentials will not succeed on retry.
            break
        except Exception as e:
            last_exc = e
            error_msg = f"SMTP error (Attempt {attempt}): {type(e).__name__}: {str(e)}"
            print(f"[EMAIL] {error_msg}")
            if attempt < total_attempts and _is_retryable_smtp_error(e):
                print(f"[EMAIL] Step 6.{attempt}i: Retryable error, will attempt {attempt + 1}/{total_attempts}")
                continue
            break

    if last_exc is None:
        last_exc = RuntimeError("Email delivery failed")

    failure_message = _build_failure_message(last_exc)
    print(f"[EMAIL] ERROR: Final failure message: {failure_message}")
    _set_last_email_error(failure_message)
    print(f"[EMAIL] ERROR: Exception type: {type(last_exc).__name__}")
    print(f"[EMAIL] ERROR: Exception message: {str(last_exc)}")
    _write_fallback_log(recipient, subject, text_content or html_content, failure_message)
    return False
```

### 2. Enhanced send_reset_email() in utils/email_utils.py

```python
def send_reset_email(email: str, token: str) -> bool:
    print(f"[RESET_EMAIL] Step 1: send_reset_email called with email={email}, token={token[:20]}...")
    try:
        print("[RESET_EMAIL] Step 2: Preparing reset link")
        safe_token = quote_plus(token)
        safe_email = quote_plus(email)
        print(f"[RESET_EMAIL] Step 2a: safe_token = {safe_token[:20]}...")
        print(f"[RESET_EMAIL] Step 2b: safe_email = {safe_email}")
        
        frontend_url = _get_frontend_url()
        print(f"[RESET_EMAIL] Step 2c: frontend_url = {frontend_url}")
        
        reset_link = f"{frontend_url}/reset-password?token={safe_token}&email={safe_email}"
        print(f"[RESET_EMAIL] Step 2d: reset_link = {reset_link}")
        
        safe_name = "there"

        html_template = f"""
<div style="font-family:Arial;max-width:600px;margin:auto;border:1px solid #eee;border-radius:10px;overflow:hidden">

    <div style="background:#10b981;padding:20px;text-align:center;color:white;font-size:26px;font-weight:bold">
    MedTech
    </div>

    <div style="padding:30px">

    <h2>Password Reset Request</h2>

    <p>Hello {safe_name},</p>

    <p>We received a request to reset your MedTech password.</p>
    <p>Click the button below to create a new password.</p>

    <div style="text-align:center;margin:30px 0">
        <a href="{reset_link}"
           style="background:#10b981;color:white;padding:14px 24px;
           text-decoration:none;border-radius:8px;font-weight:600">
           Reset Password
        </a>
    </div>

    <p>Or copy this link:</p>

    <p>{escape(reset_link)}</p>

    <div style="background:#fee2e2;padding:12px;border-radius:6px;color:#991b1b;margin-top:20px">
    Security Notice: This link expires in 1 hour. Do not share it with anyone.
    </div>

    <p style="margin-top:20px">
    If you did not request this, please ignore this email.
    </p>

    <p>MedTech Team</p>

    </div>
</div>
"""

        text = (
            "MedTech - Password Reset Request\n\n"
            "We received a request to reset your MedTech password.\n"
            f"Reset link: {reset_link}\n\n"
            "This link expires in 1 hour. Do not share it with anyone."
        )

        print(f"[RESET_EMAIL] Step 3: Email content prepared (html_len={len(html_template)}, text_len={len(text)})")

        print(f"[RESET_EMAIL] Step 4: Calling _send_via_smtp to={email}")
        sent = _send_via_smtp(
            to_email=email,
            subject="Reset your MedTech password",
            html_content=html_template,
            text_content=text,
            retries=1,
        )
        print(f"[RESET_EMAIL] Step 5: _send_via_smtp returned {sent}")
        
        if not sent:
            error = get_last_email_error()
            print(f"[RESET_EMAIL] ERROR: Email send failed. Error details: {error}")
        
        return sent
    except Exception as e:
        print(f"[RESET_EMAIL] EXCEPTION in send_reset_email: {type(e).__name__}: {str(e)}")
        print(f"[RESET_EMAIL] Full traceback:")
        import traceback
        print(traceback.format_exc())
        _set_last_email_error("Email delivery failed")
        print(f"[RESET_EMAIL] Reset email exception: {str(e)}")
        return False
```

### 3. Enhanced get_email_health() in utils/email_utils.py

```python
def get_email_health() -> dict:
    print("[EMAIL_HEALTH] Checking SMTP configuration...")
    config = _smtp_config()
    missing = _missing_smtp_fields(config)

    print(f"[EMAIL_HEALTH] SMTP Server: {config['server']}")
    print(f"[EMAIL_HEALTH] SMTP Port: {config['port']}")
    print(f"[EMAIL_HEALTH] SMTP User configured: {bool(config['user'])}")
    print(f"[EMAIL_HEALTH] SMTP Pass configured: {bool(config['password'])}")
    print(f"[EMAIL_HEALTH] From Header: {config['from_header']}")
    print(f"[EMAIL_HEALTH] From Address: {config['from_address']}")
    
    if missing:
        print(f"[EMAIL_HEALTH] Missing fields: {missing}")
    else:
        print(f"[EMAIL_HEALTH] All SMTP fields configured")

    payload = {
        "provider": "brevo_smtp",
        "configured": len(missing) == 0,
        "from_email": config["from_header"],
        "smtp_server": config["server"],
        "smtp_port": config["port"],
        "smtp_user": config["user"],
        "last_error": get_last_email_error(),
    }

    if missing:
        payload["error"] = f"Missing SMTP config: {', '.join(missing)}"

    return payload
```

### 4. Forgot-Password Route in routers/users.py

```python
@router.post("/forgot-password")
def forgot_password(data: dict = Body(...), request: Request = None, db: Session = Depends(get_db)):
    """
    Forgot password endpoint.
    Returns success only when reset email is actually sent.
    """
    print("[FORGOT_PASSWORD] ===== START FORGOT_PASSWORD REQUEST =====")
    
    request_meta = {
        "origin": request.headers.get("origin") if request else "[missing-request]",
        "referer": request.headers.get("referer") if request else "[missing-request]",
        "host": request.headers.get("host") if request else "[missing-request]",
        "x_forwarded_host": request.headers.get("x-forwarded-host") if request else "[missing-request]",
        "x_forwarded_proto": request.headers.get("x-forwarded-proto") if request else "[missing-request]",
        "path": request.url.path if request else "[missing-request]",
        "method": request.method if request else "[missing-request]",
    }

    try:
        from utils.email_utils import send_reset_email, get_last_email_error
        from config import settings
        
        # Log environment variables (safely)
        print(f"[FORGOT_PASSWORD] Env check - FRONTEND_URL is set: {bool(settings.FRONTEND_URL)}")
        print(f"[FORGOT_PASSWORD] Env check - SMTP_SERVER: {settings.SMTP_SERVER}")
        print(f"[FORGOT_PASSWORD] Env check - SMTP_PORT: {settings.SMTP_PORT}")
        print(f"[FORGOT_PASSWORD] Env check - SMTP_USER is set: {bool(settings.SMTP_USER)}")
        print(f"[FORGOT_PASSWORD] Env check - SMTP_PASS is set: {bool(settings.SMTP_PASS)}")
        print(f"[FORGOT_PASSWORD] Env check - FROM_EMAIL: {settings.FROM_EMAIL}")

        print(f"[FORGOT_PASSWORD] Step 1: Request received")
        print(f"[FORGOT_PASSWORD] Step 1a: Request meta: {request_meta}")
        
        email = (data.get("email") or "").strip().lower()
        print(f"[FORGOT_PASSWORD] Step 2: Email extracted from request: {email or '[empty]'}")

        if not email:
            print(f"[FORGOT_PASSWORD] Step 2a: Email validation FAILED - email is empty")
            return _json_response(False, "Email is required", status_code=400)

        print(f"[FORGOT_PASSWORD] Step 2b: Email validation passed")
        
        print(f"[FORGOT_PASSWORD] Step 3: Querying database for user with email: {email}")
        user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
        
        if not user:
            print(f"[FORGOT_PASSWORD] Step 3a: User lookup FAILED - no user found for email: {email}")
            return _json_response(False, "User not found", status_code=404)

        print(f"[FORGOT_PASSWORD] Step 3b: User found - user_id={user.id}, email={user.email}")

        try:
            print(f"[FORGOT_PASSWORD] Step 4: Creating reset token")
            reset_token, expires_at = _create_reset_token(db, user, email)
            print(f"[FORGOT_PASSWORD] Step 4a: Token created successfully")
            print(f"[FORGOT_PASSWORD] Step 4b: Token: {reset_token[:20]}...")
            print(f"[FORGOT_PASSWORD] Step 4c: Expires at: {expires_at}")
            
            print(f"[FORGOT_PASSWORD] Step 5: Calling send_reset_email with email={email}, token={reset_token[:20]}...")
            sent = send_reset_email(
                email=email,
                token=reset_token,
            )
            print(f"[FORGOT_PASSWORD] Step 5a: send_reset_email returned: {sent}")

            if not sent:
                err = get_last_email_error() or "Email delivery failed"
                print(f"[FORGOT_PASSWORD] Step 5b: Email send FAILED")
                print(f"[FORGOT_PASSWORD] Step 5c: Error details: {err}")
                return _json_response(False, "Failed to send reset email", status_code=500, error=err)
            
            print(f"[FORGOT_PASSWORD] Step 6: Email sent successfully")
        except Exception as e:
            print(f"[FORGOT_PASSWORD] Step 5: EXCEPTION during email send")
            print(f"[FORGOT_PASSWORD] Step 5a: Exception type: {type(e).__name__}")
            print(f"[FORGOT_PASSWORD] Step 5b: Exception message: {str(e)}")
            print("[FORGOT_PASSWORD] Step 5c: Full exception stack:")
            print(traceback.format_exc())
            return _json_response(False, "Failed to send reset email", status_code=500, error=str(e))

        print(f"[FORGOT_PASSWORD] Step 7: Returning success response")
        print("[FORGOT_PASSWORD] ===== END FORGOT_PASSWORD REQUEST (SUCCESS) =====")
        return _json_response(True, "Reset email sent successfully", status_code=200)
    except Exception as e:
        print(f"[FORGOT_PASSWORD] UNHANDLED EXCEPTION in forgot_password route")
        print(f"[FORGOT_PASSWORD] Exception type: {type(e).__name__}")
        print(f"[FORGOT_PASSWORD] Exception message: {str(e)}")
        print("[FORGOT_PASSWORD] Full exception stack:")
        print(traceback.format_exc())
        print("[FORGOT_PASSWORD] ===== END FORGOT_PASSWORD REQUEST (UNHANDLED ERROR) =====")
        return _json_response(False, "Error processing reset password request", status_code=500, error=str(e))
```

### 5. Diagnostic Endpoints in routers/auth.py

```python
@router.get("/email-health")
def email_health():
    """
    Diagnostic endpoint to check email/SMTP configuration.
    Returns configuration status, missing fields, and last error.
    """
    from utils.email_utils import get_email_health
    print("[AUTH] GET /email-health - checking SMTP configuration")
    return get_email_health()


@router.post("/test-email")
def test_email(data: dict = Body(...)):
    """
    Diagnostic endpoint to test email sending.
    Request body: {"email": "test@example.com"}
    """
    from utils.email_utils import send_email, get_last_email_error
    import traceback
    
    print("[AUTH] POST /test-email - attempting to send test email")
    
    email = (data.get("email") or "").strip().lower()
    if not email:
        return {"success": False, "error": "email is required"}
    
    print(f"[AUTH] Sending test email to: {email}")
    
    try:
        html_content = """
        <div style="font-family:Arial;max-width:600px;margin:auto">
            <h2>MedTech Test Email</h2>
            <p>This is a test email from MedTech backend.</p>
            <p>If you received this, email delivery is working correctly.</p>
        </div>
        """
        
        text_content = "MedTech Test Email\n\nThis is a test email from MedTech backend.\nIf you received this, email delivery is working correctly."
        
        sent = send_email(
            to_email=email,
            subject="MedTech Test Email",
            html_content=html_content,
            text_content=text_content,
            retries=1,
        )
        
        if sent:
            print(f"[AUTH] Test email sent successfully to: {email}")
            return {
                "success": True,
                "message": "Test email sent successfully",
                "recipient": email,
            }
        else:
            error = get_last_email_error() or "Unknown error"
            print(f"[AUTH] Test email failed: {error}")
            return {
                "success": False,
                "error": error,
                "recipient": email,
            }
    except Exception as e:
        print(f"[AUTH] Test email exception: {str(e)}")
        print(traceback.format_exc())
        return {
            "success": False,
            "error": str(e),
            "recipient": email,
        }
```

## Files to Update

1. `healthconnect-backend/utils/email_utils.py` - Update `_send_via_smtp()`, `send_reset_email()`, `get_email_health()`
2. `healthconnect-backend/routers/users.py` - Update `forgot_password()` function
3. `healthconnect-backend/routers/auth.py` - Add `email_health()` and `test_email()` endpoints

All changes have been implemented in the working codebase.
