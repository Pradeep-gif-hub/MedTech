import os
import re
import smtplib
from datetime import datetime
from email.message import EmailMessage
from html import escape
from urllib.parse import quote_plus

from config import settings

_LAST_EMAIL_ERROR = ""
_DEFAULT_FRONTEND_URL = "https://medtech-4rjc.onrender.com"
_OTP_EXPIRY_MINUTES = 5


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


def _smtp_config() -> dict:
    raw_from_email = (settings.FROM_EMAIL or settings.SMTP_USER or "").strip()
    normalized_from = _normalize_from_email(raw_from_email)
    return {
        "server": (settings.SMTP_SERVER or "").strip(),
        "port": _smtp_port(),
        "user": (settings.SMTP_USER or "").strip(),
        "password": (settings.SMTP_PASS or "").strip(),
        "from_header": normalized_from,
        "from_address": _extract_first_email(normalized_from),
    }


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


def _send_via_smtp(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str | None = None,
    retries: int = 1,
) -> bool:
    recipient = _extract_first_email(to_email)
    if not recipient:
        message = "Invalid recipient email"
        _set_last_email_error(message)
        print("Email error:", message)
        return False

    config = _smtp_config()
    missing = _missing_smtp_fields(config)
    if missing:
        message = f"Missing SMTP config: {', '.join(missing)}"
        _set_last_email_error(message)
        print("Email error:", message)
        return False

    total_attempts = max(1, int(retries) + 1)
    last_exc: Exception | None = None

    print(
        f"[EMAIL] Triggered SMTP send to={recipient}, subject='{subject}', "
        f"server={config['server']}:{config['port']}"
    )

    msg = _build_email_message(
        to_email=recipient,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        from_header=config["from_header"],
    )

    for attempt in range(1, total_attempts + 1):
        try:
            with smtplib.SMTP(config["server"], config["port"], timeout=30) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.ehlo()
                smtp.login(config["user"], config["password"])
                smtp_response = smtp.send_message(msg)

            if smtp_response:
                raise smtplib.SMTPRecipientsRefused(smtp_response)

            print(f"[EMAIL] SMTP send success to={recipient}")
            _set_last_email_error("")
            return True
        except smtplib.SMTPAuthenticationError as e:
            last_exc = e
            # Bad credentials will not succeed on retry.
            break
        except Exception as e:
            last_exc = e
            if attempt < total_attempts and _is_retryable_smtp_error(e):
                print(f"[EMAIL] Attempt {attempt} failed, retrying once more...")
                continue
            break

    if last_exc is None:
        last_exc = RuntimeError("Email delivery failed")

    failure_message = _build_failure_message(last_exc)
    _set_last_email_error(failure_message)
    print("Email error:", failure_message)
    _write_fallback_log(recipient, subject, text_content or html_content, failure_message)
    return False


def get_email_health() -> dict:
    config = _smtp_config()
    missing = _missing_smtp_fields(config)

    payload = {
        "provider": "brevo_smtp",
        "configured": len(missing) == 0,
        "from_email": config["from_header"],
        "smtp_server": config["server"],
        "smtp_port": config["port"],
    }

    if missing:
        payload["error"] = f"Missing SMTP config: {', '.join(missing)}"

    return payload


def get_smtp_health() -> dict:
    # Backward-compatible alias kept for older imports.
    return get_email_health()


def send_reset_email(email: str, token: str) -> bool:
    try:
        safe_token = quote_plus(token)
        safe_email = quote_plus(email)
        reset_link = f"{_get_frontend_url()}/reset-password?token={safe_token}&email={safe_email}"
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

        print("Sending reset email to:", email)

        sent = _send_via_smtp(
            to_email=email,
            subject="Reset your MedTech password",
            html_content=html_template,
            text_content=text,
            retries=1,
        )
        return sent
    except Exception as e:
        _set_last_email_error("Email delivery failed")
        print(f"Reset email error: {str(e)}")
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
