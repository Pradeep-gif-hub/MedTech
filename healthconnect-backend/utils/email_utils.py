import os
import re
from datetime import datetime
from html import escape

import resend

from config import settings

_LAST_EMAIL_ERROR = ""
_DEFAULT_FRONTEND_URL = "https://medtech-4rjc.onrender.com"


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
        return raw

    name = raw.replace(extracted, "").replace("<", "").replace(">", "").strip()
    name = name.replace("[", "").replace("]", "").replace("(mailto:", "").replace(")", "").strip()
    if not name:
        return extracted
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


def _init_resend_client() -> None:
    if not settings.RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY not configured")
    resend.api_key = settings.RESEND_API_KEY


def _send_via_resend(to_address: str, subject: str, html_body: str, text_body: str | None = None) -> bool:
    from_email = _normalize_from_email(settings.FROM_EMAIL)

    if not from_email:
        _set_last_email_error("FROM_EMAIL missing")
        return False

    try:
        _init_resend_client()

        params = {
            "from": from_email,
            "to": to_address,
            "subject": subject,
            "html": html_body,
        }
        if text_body:
            params["text"] = text_body

        resend.Emails.send(params)
        _set_last_email_error("")
        return True
    except RuntimeError as exc:
        _set_last_email_error(str(exc))
        return False
    except Exception:
        _set_last_email_error("Email delivery failed")
        return False


def get_email_health() -> dict:
    from_email = _normalize_from_email(settings.FROM_EMAIL)

    if not settings.RESEND_API_KEY:
        return {
            "provider": "resend",
            "configured": False,
            "error": "RESEND_API_KEY missing",
        }

    return {
        "provider": "resend",
        "configured": bool(from_email),
    }


def get_smtp_health() -> dict:
    # Backward-compatible alias kept for older imports.
    return get_email_health()


def send_reset_email(email: str, token: str) -> bool:
    reset_link = f"{_get_frontend_url()}/reset-password?token={token}&email={email}"

    html_template = f"""
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

    sent = _send_via_resend(
        to_address=email,
        subject="Reset your MedTech password",
        html_body=html_template,
        text_body=text,
    )
    if not sent:
        _write_fallback_log(email, "Reset your MedTech password", text, get_last_email_error())
    return sent


def send_email(to_address: str, subject: str, body: str, html_body: str | None = None) -> bool:
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
