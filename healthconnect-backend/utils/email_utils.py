import os
import re
import smtplib
import socket
from datetime import datetime
from email.message import EmailMessage
from html import escape
from urllib.parse import quote_plus

import requests

from config import settings

_LAST_EMAIL_ERROR = ""
_DEFAULT_FRONTEND_URL = "https://medtech-4rjc.onrender.com"
_OTP_EXPIRY_MINUTES = 5
_BREVO_SEND_API_URL = "https://api.brevo.com/v3/smtp/email"


def _set_last_email_error(message: str) -> None:
    global _LAST_EMAIL_ERROR
    _LAST_EMAIL_ERROR = (message or "")[:1000]


def get_last_email_error() -> str:
    return _LAST_EMAIL_ERROR


def _get_frontend_url() -> str:
    return (settings.FRONTEND_URL or _DEFAULT_FRONTEND_URL).rstrip("/")


def _extract_first_email(value: str) -> str:
    match = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", value or "")
    return match.group(0) if match else ""


def _normalize_from_email(raw_value: str) -> str:
    raw = (raw_value or "").strip()
    if not raw:
        return ""

    extracted = _extract_first_email(raw)
    if not extracted:
        return raw

    if raw == extracted:
        display_name = (settings.FROM_NAME or "MedTech").strip() or "MedTech"
        return f"{display_name} <{raw}>"

    name = raw.replace(extracted, "").replace("<", "").replace(">", "").strip()
    name = name.replace("[", "").replace("]", "").replace("(mailto:", "").replace(")", "").strip()
    if not name:
        name = (settings.FROM_NAME or "MedTech").strip() or "MedTech"
    return f"{name} <{extracted}>"


def _write_fallback_log(to_address: str, subject: str, body: str, error: str) -> None:
    _ = body
    try:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        log_path = os.path.join(project_root, "sent_otps.log")
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(
                f"---\nTime: {datetime.utcnow().isoformat()} UTC\nEMAIL FAILED: {error}\n"
                f"To: {to_address}\nSubject: {subject}\n\n[sensitive content redacted]\n"
            )
    except Exception as e2:
        print(f"[EMAIL] Failed to write fallback log: {e2}")


def _smtp_port() -> int:
    raw_port = (settings.SMTP_PORT or "").strip()
    if not raw_port:
        return 587

    try:
        return int(raw_port)
    except ValueError:
        print(f"Email error: Invalid SMTP_PORT '{raw_port}', defaulting to 587")
        return 587


def _smtp_timeout_seconds() -> int:
    raw_timeout = (getattr(settings, "SMTP_TIMEOUT_SECONDS", "") or "").strip()
    if not raw_timeout:
        return 20

    try:
        timeout = int(raw_timeout)
        return max(5, timeout)
    except ValueError:
        print(f"Email error: Invalid SMTP_TIMEOUT_SECONDS '{raw_timeout}', defaulting to 20")
        return 20


def _smtp_endpoint_candidates(preferred_port: int) -> list[tuple[str, int]]:
    ordered_ports: list[int] = [preferred_port]
    for fallback_port in (587, 2525, 465):
        if fallback_port not in ordered_ports:
            ordered_ports.append(fallback_port)

    endpoints: list[tuple[str, int]] = []
    for port in ordered_ports:
        mode = "ssl" if port == 465 else "starttls"
        endpoints.append((mode, port))
    return endpoints


def _smtp_config() -> dict:
    raw_from_email = (settings.FROM_EMAIL or settings.SMTP_USER or "").strip()
    normalized_from = _normalize_from_email(raw_from_email)
    config = {
        "server": (settings.SMTP_SERVER or "").strip(),
        "port": _smtp_port(),
        "user": (settings.SMTP_USER or "").strip(),
        "password": (settings.SMTP_PASS or "").strip(),
        "from_header": normalized_from,
        "from_address": _extract_first_email(normalized_from),
    }
    return config


def _missing_smtp_fields(config: dict) -> list[str]:
    missing = []
    if not config["server"]:
        missing.append("SMTP_SERVER")
    if not config["user"]:
        missing.append("SMTP_USER")
    if not config["password"]:
        missing.append("SMTP_PASS")
    if not config["from_address"]:
        missing.append("FROM_EMAIL")
    return missing


def _is_retryable_smtp_error(exc: Exception) -> bool:
    return isinstance(
        exc,
        (
            smtplib.SMTPConnectError,
            smtplib.SMTPServerDisconnected,
            smtplib.SMTPDataError,
            TimeoutError,
            socket.timeout,
            ConnectionError,
            OSError,
        ),
    )


def _build_failure_message(exc: Exception) -> str:
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return "SMTP authentication failed. Check SMTP_USER/SMTP_PASS."
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        return "SMTP rejected the recipient address."
    if isinstance(exc, smtplib.SMTPConnectError):
        return "Could not connect to SMTP server."
    return str(exc) or "Email delivery failed"


def _build_email_message(
    *,
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str | None,
    from_header: str,
) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_header
    msg["To"] = to_email
    msg.set_content(
        text_content
        or "This email contains HTML content. Please use an HTML-capable email client."
    )
    msg.add_alternative(html_content, subtype="html")
    return msg


def _send_via_brevo_api(
    *,
    recipient: str,
    subject: str,
    html_content: str,
    text_content: str | None,
    from_address: str,
) -> bool:
    api_key = (getattr(settings, "BREVO_API_KEY", "") or "").strip()
    if not api_key:
        print("[EMAIL] Step 9a: Brevo API fallback skipped (BREVO_API_KEY missing)")
        return False

    sender_name = (settings.FROM_NAME or "MedTech").strip() or "MedTech"
    payload = {
        "sender": {
            "name": sender_name,
            "email": from_address,
        },
        "to": [{"email": recipient}],
        "subject": subject,
        "htmlContent": html_content,
        "textContent": text_content or "This email contains HTML content.",
    }

    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": api_key,
    }

    try:
        print(f"[EMAIL] Step 9b: Trying Brevo HTTPS API fallback for {recipient}")
        response = requests.post(_BREVO_SEND_API_URL, json=payload, headers=headers, timeout=25)

        if 200 <= response.status_code < 300:
            print(f"[EMAIL] Step 9c: Brevo API send success (status={response.status_code})")
            _set_last_email_error("")
            return True

        error_message = f"Brevo API failed ({response.status_code}): {response.text[:300]}"
        print(f"[EMAIL] ERROR: {error_message}")
        _set_last_email_error(error_message)
        return False
    except Exception as api_exc:
        error_message = f"Brevo API exception: {type(api_exc).__name__}: {api_exc}"
        print(f"[EMAIL] ERROR: {error_message}")
        _set_last_email_error(error_message)
        return False


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
    timeout_seconds = _smtp_timeout_seconds()
    endpoints = _smtp_endpoint_candidates(config["port"])

    print(
        f"[EMAIL] Step 4: Triggered SMTP send to={recipient}, subject='{subject}', "
        f"server={config['server']}:{config['port']}, attempts={total_attempts}, timeout={timeout_seconds}s"
    )
    print(f"[EMAIL] Step 4a: Endpoint candidates = {endpoints}")

    print("[EMAIL] Step 5: Building email message")
    msg = _build_email_message(
        to_email=recipient,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        from_header=config["from_header"],
    )
    print("[EMAIL] Step 5a: Email message built successfully")

    auth_failed = False
    for attempt in range(1, total_attempts + 1):
        for endpoint_index, (mode, port) in enumerate(endpoints, start=1):
            try:
                print(
                    f"[EMAIL] Step 6.{attempt}.{endpoint_index}: Attempt {attempt}/{total_attempts} "
                    f"using mode={mode} port={port}"
                )
                if mode == "ssl":
                    with smtplib.SMTP_SSL(config["server"], port, timeout=timeout_seconds) as smtp:
                        print(f"[EMAIL] Step 6.{attempt}.{endpoint_index}a: SMTP SSL connection established")
                        smtp.ehlo()
                        smtp.login(config["user"], config["password"])
                        print(f"[EMAIL] Step 6.{attempt}.{endpoint_index}b: Authentication successful")
                        smtp_response = smtp.send_message(msg)
                else:
                    with smtplib.SMTP(config["server"], port, timeout=timeout_seconds) as smtp:
                        print(f"[EMAIL] Step 6.{attempt}.{endpoint_index}a: SMTP connection established")
                        smtp.ehlo()
                        smtp.starttls()
                        smtp.ehlo()
                        smtp.login(config["user"], config["password"])
                        print(f"[EMAIL] Step 6.{attempt}.{endpoint_index}b: Authentication successful")
                        smtp_response = smtp.send_message(msg)

                print(f"[EMAIL] Step 6.{attempt}.{endpoint_index}c: Message sent, SMTP response = {smtp_response}")
                if smtp_response:
                    raise smtplib.SMTPRecipientsRefused(smtp_response)

                print(f"[EMAIL] Step 7: SMTP send success to={recipient}")
                _set_last_email_error("")
                return True
            except smtplib.SMTPAuthenticationError as e:
                last_exc = e
                auth_failed = True
                print(f"[EMAIL] ERROR: SMTP authentication failed on port {port}: {e}")
                break
            except Exception as e:
                last_exc = e
                print(f"[EMAIL] SMTP error on mode={mode} port={port}: {type(e).__name__}: {e}")
                if _is_retryable_smtp_error(e):
                    print(f"[EMAIL] Step 6.{attempt}.{endpoint_index}d: retryable, trying next endpoint")
                    continue
                break

        if auth_failed:
            break

    if last_exc is None:
        last_exc = RuntimeError("Email delivery failed")

    # If SMTP paths fail (timeouts/network issues), fallback to Brevo HTTPS API.
    print("[EMAIL] Step 8: SMTP delivery failed, attempting Brevo API fallback...")
    if _send_via_brevo_api(
        recipient=recipient,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        from_address=config["from_address"],
    ):
        print(f"[EMAIL] Step 8a: Fallback delivery succeeded for {recipient}")
        return True

    failure_message = _build_failure_message(last_exc)
    print(f"[EMAIL] ERROR: Final failure message: {failure_message}")
    _set_last_email_error(failure_message)
    print(f"[EMAIL] ERROR: Exception type: {type(last_exc).__name__}")
    print(f"[EMAIL] ERROR: Exception message: {str(last_exc)}")
    _write_fallback_log(recipient, subject, text_content or html_content, failure_message)
    return False


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


def get_smtp_health() -> dict:
    # Backward-compatible alias kept for older imports.
    return get_email_health()


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


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str | None = None,
    retries: int = 1,
) -> bool:
    return _send_via_smtp(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        retries=retries,
    )


def send_otp_email(to_email: str, otp: str) -> bool:
    safe_otp = escape((otp or "").strip())
    subject = "Your MedTech verification code"
    text_content = (
        f"Your MedTech verification code is: {otp}\n"
        f"This code is valid for {_OTP_EXPIRY_MINUTES} minutes."
    )
    html_content = f"""
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:#2563eb;padding:18px 22px;color:white;font-size:22px;font-weight:700">MedTech</div>
  <div style="padding:24px;background:#ffffff;color:#111827">
    <p style="margin:0 0 14px 0;font-size:16px">Hello,</p>
    <p style="margin:0 0 18px 0;font-size:15px">Your MedTech verification code is:</p>
    <div style="margin:0 0 18px 0;padding:14px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center">
      <span style="font-size:34px;font-weight:800;letter-spacing:6px;color:#1d4ed8">{safe_otp}</span>
    </div>
    <p style="margin:0 0 8px 0;font-size:14px">This code is valid for {_OTP_EXPIRY_MINUTES} minutes.</p>
    <p style="margin:0;font-size:14px;color:#374151">If you did not request this code, you can safely ignore this email.</p>
  </div>
</div>
"""

    print("Sending OTP email to:", to_email)
    return send_email(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        retries=1,
    )


def send_test_email(to_email: str) -> bool:
    subject = "MedTech SMTP Test Email"
    text_content = (
        "This is a MedTech SMTP test email from the FastAPI backend.\n"
        "If you received this, Brevo SMTP integration is working."
    )
    html_content = """
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:#0f766e;padding:18px 22px;color:white;font-size:22px;font-weight:700">MedTech</div>
  <div style="padding:24px;background:#ffffff;color:#111827">
    <h2 style="margin:0 0 12px 0">SMTP Integration Test</h2>
    <p style="margin:0 0 10px 0;font-size:15px">This email confirms your Brevo SMTP setup is active.</p>
    <p style="margin:0;font-size:14px;color:#4b5563">You can now monitor delivery inside Brevo Transactional Logs.</p>
  </div>
</div>
"""

    print("Sending test email to:", to_email)
    return send_email(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        retries=1,
    )
