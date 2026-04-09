import os
from datetime import datetime
from html import escape

import resend
from dotenv import load_dotenv

# Load environment variables from .env file.
load_dotenv()

_LAST_EMAIL_ERROR = ""


def _set_last_email_error(message: str) -> None:
    global _LAST_EMAIL_ERROR
    _LAST_EMAIL_ERROR = (message or "")[:1000]


def get_last_email_error() -> str:
    return _LAST_EMAIL_ERROR


def _get_resend_api_key() -> str:
    return (os.getenv("RESEND_API_KEY") or "").strip()


def _get_from_email() -> str:
    return (os.getenv("FROM_EMAIL") or os.getenv("SENDER_EMAIL") or "").strip()


def _get_frontend_url() -> str:
    return (os.getenv("FRONTEND_URL") or "https://medtech-4rjc.onrender.com").rstrip("/")


def _write_fallback_log(to_address: str, subject: str, body: str, error: str) -> None:
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


def _send_via_resend(to_address: str, subject: str, html_body: str, text_body: str | None = None) -> bool:
    api_key = _get_resend_api_key()
    from_email = _get_from_email()

    if not api_key:
        _set_last_email_error("resend_not_configured")
        return False
    if not from_email:
        _set_last_email_error("from_email_not_configured")
        return False

    try:
        resend.api_key = api_key
        payload = {
            "from": from_email,
            "to": [to_address],
            "subject": subject,
            "html": html_body,
        }
        if text_body:
            payload["text"] = text_body

        resend.Emails.send(payload)
        _set_last_email_error("")
        return True
    except Exception as exc:
        _set_last_email_error(f"resend_send_failed: {exc}")
        return False


def get_smtp_health() -> dict:
    """
    Compatibility helper for existing /email-health route.
    Now reports Resend readiness because SMTP is no longer used.
    """
    resend_configured = bool(_get_resend_api_key())
    from_email = _get_from_email()
    frontend_url = _get_frontend_url()
    return {
        "provider": "resend",
        "configured": bool(resend_configured and from_email and frontend_url),
        "resend_configured": resend_configured,
        "from_email": from_email,
        "frontend_url": frontend_url,
        "last_error": get_last_email_error(),
    }


def send_reset_email(email: str, token: str) -> bool:
    reset_link = f"{_get_frontend_url()}/reset-password?token={token}&email={email}"

    html = f"""
<div style="font-family:Arial;max-width:600px;margin:auto;border:1px solid #eee;border-radius:10px;overflow:hidden">

    <div style="background:#10b981;padding:20px;text-align:center;color:white;font-size:26px;font-weight:bold">
    MedTech
    </div>

    <div style="padding:30px">

    <h2>Password Reset Request</h2>

    <p>Hello,</p>

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

    <p>{reset_link}</p>

    <div style="background:#fee2e2;padding:12px;border-radius:6px;color:#991b1b;margin-top:20px">
    ⚠ Security Notice: This link expires in 1 hour. Do not share it with anyone.
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

    sent = _send_via_resend(
        to_address=email,
        subject="MedTech - Reset Your Password",
        html_body=html,
        text_body=text,
    )
    if not sent:
        _write_fallback_log(email, "MedTech - Reset Your Password", text, get_last_email_error())
    return sent


def send_email(to_address: str, subject: str, body: str, html_body: str | None = None) -> bool:
    """
    Generic email sender used by OTP and legacy flows.
    Delivery is Resend-only (no SMTP fallback).
    """
    safe_html = html_body or (
        "<div style=\"font-family:Arial;max-width:600px;margin:auto;border:1px solid #eee;"
        "border-radius:10px;padding:20px\">"
        f"<pre style=\"white-space:pre-wrap\">{escape(body)}</pre></div>"
    )
    sent = _send_via_resend(
        to_address=to_address,
        subject=subject,
        html_body=safe_html,
        text_body=body,
    )
    if not sent:
        _write_fallback_log(to_address, subject, body, get_last_email_error())
    return sent
