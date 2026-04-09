import os
import smtplib
import ssl
import socket
import json
from html import escape
from urllib import request as urllib_request
from urllib import error as urllib_error
from email.message import EmailMessage
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

_LAST_EMAIL_ERROR = ""


def _set_last_email_error(message: str) -> None:
    global _LAST_EMAIL_ERROR
    _LAST_EMAIL_ERROR = (message or "")[:1000]


def get_last_email_error() -> str:
    return _LAST_EMAIL_ERROR


def _write_fallback_log(to_address: str, subject: str, body: str, error: str) -> None:
    try:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        log_path = os.path.join(project_root, "sent_otps.log")
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(
                f"---\nTime: {datetime.utcnow().isoformat()} UTC\nSMTP FAILED: {error}\n"
                f"To: {to_address}\nSubject: {subject}\n\n{body}\n"
            )
    except Exception as e2:
        print(f"[EMAIL] Failed to write fallback log: {e2}")


def _post_json(url: str, payload: dict, headers: dict, timeout: int = 10) -> tuple[bool, str]:
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib_request.Request(url=url, data=data, headers=headers, method="POST")
        with urllib_request.urlopen(req, timeout=timeout) as resp:
            status = getattr(resp, "status", 200)
            content = resp.read().decode("utf-8", errors="ignore")
            if 200 <= int(status) < 300:
                return True, content[:500]
            return False, f"http_status={status} body={content[:500]}"
    except urllib_error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", errors="ignore")
        except Exception:
            body = ""
        return False, f"http_error={e.code} body={body[:500]}"
    except Exception as e:
        return False, str(e)


def _send_via_resend(to_address: str, subject: str, body: str, html_body: str | None, from_email: str) -> tuple[bool, str]:
    api_key = (os.getenv("RESEND_API_KEY") or "").strip()
    if not api_key:
        return False, "resend_not_configured"

    resend_from = (os.getenv("RESEND_FROM_EMAIL") or "onboarding@resend.dev").strip()

    payload = {
        "from": resend_from,
        "to": [to_address],
        "subject": subject,
        "text": body,
        "html": html_body or f"<pre>{escape(body)}</pre>",
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    ok, detail = _post_json("https://api.resend.com/emails", payload, headers)
    return ok, f"resend:{detail}"


def _send_via_brevo(to_address: str, subject: str, body: str, html_body: str | None, from_email: str) -> tuple[bool, str]:
    api_key = (os.getenv("BREVO_API_KEY") or "").strip()
    if not api_key:
        return False, "brevo_not_configured"

    brevo_from = (os.getenv("BREVO_FROM_EMAIL") or from_email).strip()
    brevo_sender_name = (os.getenv("BREVO_SENDER_NAME") or "MedTech").strip()

    payload = {
        "sender": {"email": brevo_from, "name": brevo_sender_name},
        "to": [{"email": to_address}],
        "subject": subject,
        "textContent": body,
        "htmlContent": html_body or f"<pre>{escape(body)}</pre>",
    }
    headers = {
        "api-key": api_key,
        "Content-Type": "application/json",
    }
    ok, detail = _post_json("https://api.brevo.com/v3/smtp/email", payload, headers)
    return ok, f"brevo:{detail}"


def get_smtp_health() -> dict:
    """
    Returns a non-destructive SMTP health snapshot for production diagnostics.
    Does not send any email.
    """
    host = (os.getenv("SMTP_HOST") or "smtp.gmail.com").strip()
    port = int((os.getenv("SMTP_PORT", "587") or "587").strip())
    user = (os.getenv("SMTP_USER") or "").strip()
    password = (os.getenv("SMTP_PASS") or "").strip().replace(" ", "")
    sender = os.getenv("SENDER_EMAIL") or os.getenv("FROM_EMAIL") or user or ""

    health = {
        "configured": bool(host and port and user and password and sender),
        "host": host,
        "port": port,
        "user_configured": bool(user),
        "password_configured": bool(password),
        "sender": sender,
        "resend_configured": bool((os.getenv("RESEND_API_KEY") or "").strip()),
        "resend_from": (os.getenv("RESEND_FROM_EMAIL") or "onboarding@resend.dev").strip(),
        "brevo_configured": bool((os.getenv("BREVO_API_KEY") or "").strip()),
        "brevo_from": (os.getenv("BREVO_FROM_EMAIL") or sender).strip(),
        "last_error": get_last_email_error(),
        "can_connect": False,
        "tls_ok": False,
        "auth_ok": False,
    }

    if not health["configured"]:
        return health

    try:
        with smtplib.SMTP(host, port, timeout=7) as server:
            server.ehlo()
            health["can_connect"] = True
            server.starttls(context=ssl.create_default_context())
            server.ehlo()
            health["tls_ok"] = True
            server.login(user, password)
            health["auth_ok"] = True
        _set_last_email_error("")
        return health
    except Exception as e:
        _set_last_email_error(f"smtp_health_check_failed: {e}")
        health["last_error"] = get_last_email_error()
        return health

def send_email(to_address: str, subject: str, body: str, html_body: str | None = None) -> bool:
    """
    Send email using SMTP if environment variables are set:
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SENDER_EMAIL/FROM_EMAIL

    Returns True if an SMTP send was attempted/succeeded, False if falling back to local log/console.
    """
    host = (os.getenv("SMTP_HOST") or "smtp.gmail.com").strip()
    port = int((os.getenv("SMTP_PORT", "587") or "587").strip())
    user = (os.getenv("SMTP_USER") or "").strip()
    password = (os.getenv("SMTP_PASS") or "").strip().replace(" ", "")
    from_email = os.getenv("SENDER_EMAIL") or os.getenv("FROM_EMAIL") or user or "no-reply@localhost"
    
    print(f"[EMAIL] Config: SMTP_HOST={host}, SMTP_PORT={port}, SMTP_USER={user}, FROM_EMAIL={from_email}")

    # If SMTP not configured, fallback to logging the email to a file and console
    if not host or not port or not user or not password:
        _set_last_email_error("smtp_not_configured")
        log_line = f"---\nTime: {datetime.utcnow().isoformat()} UTC\nTo: {to_address}\nSubject: {subject}\n\n{body}\n"
        try:
            project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            log_path = os.path.join(project_root, "sent_otps.log")
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(log_line)
        except Exception as e:
            # best-effort: still print to console
            print(f"[EMAIL-DRYRUN] Failed to write OTP log file: {e}")

        print(f"[EMAIL-DRYRUN] To: {to_address}\nSubject: {subject}\n\n{body}")
        return False

    # SMTP configured: attempt to send
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_address
    msg.set_content(body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    tls_error = None
    try:
        print(f"[EMAIL] Attempting to connect to SMTP server {host}:{port}")
        with smtplib.SMTP(host, port, timeout=5) as server:
            print("[EMAIL] Connected to SMTP server")
            server.ehlo()
            try:
                # STARTTLS negotiation - required for Gmail
                tls_context = ssl.create_default_context()
                server.starttls(context=tls_context)
                print("[EMAIL] STARTTLS successful - connection is now encrypted")
                server.ehlo()
            except smtplib.SMTPNotSupportedError:
                print(f"[EMAIL] WARNING: STARTTLS not supported by server")
                tls_error = "STARTTLS not supported"
            except smtplib.SMTPServerDisconnected:
                print(f"[EMAIL] CRITICAL: Server disconnected during STARTTLS")
                tls_error = "Server disconnected during STARTTLS"
                raise
            except Exception as e:
                print(f"[EMAIL] WARNING: STARTTLS error: {e}")
                tls_error = str(e)
                raise
            
            print(f"[EMAIL] Attempting login with user: {user}")
            server.login(user, password)
            print("[EMAIL] Login successful")
            print(f"[EMAIL] Sending email to: {to_address}")
            server.send_message(msg)
            print("[EMAIL] Email sent successfully")
        _set_last_email_error("")
        return True
    except smtplib.SMTPAuthenticationError as e:
        print(f"[EMAIL] CRITICAL: Authentication failed: {e}")
        print("[EMAIL] Verify SMTP_USER and SMTP_PASS in .env")
        _set_last_email_error(f"smtp_auth_failed: {e}")
        _write_fallback_log(to_address, subject, body, str(e))
        return False
    except Exception as e:
        print(f"[EMAIL] STARTTLS/SMTP send failed on {host}:{port}: {e}")
        if host != "smtp.gmail.com":
            print("[EMAIL] Retrying with fallback host smtp.gmail.com:587")
            try:
                with smtplib.SMTP("smtp.gmail.com", 587, timeout=7) as server:
                    server.ehlo()
                    server.starttls(context=ssl.create_default_context())
                    server.ehlo()
                    server.login(user, password)
                    server.send_message(msg)
                print("[EMAIL] Fallback send successful")
                return True
            except Exception as fallback_exc:
                print(f"[EMAIL] Fallback smtp.gmail.com failed: {fallback_exc}")
                _set_last_email_error(f"smtp_fallback_failed: {fallback_exc}")

        # Some cloud runtimes fail IPv6 routing for smtp.gmail.com.
        # Retry with direct IPv4 endpoint before giving up.
        print("[EMAIL] Retrying via direct IPv4 smtp.gmail.com:587")
        try:
            ipv4_host = socket.gethostbyname("smtp.gmail.com")
            tls_context = ssl.create_default_context()
            tls_context.check_hostname = False
            with smtplib.SMTP(ipv4_host, 587, timeout=7) as server:
                server.ehlo()
                server.starttls(context=tls_context)
                server.ehlo()
                server.login(user, password)
                server.send_message(msg)
            print("[EMAIL] Direct IPv4 send successful")
            _set_last_email_error("")
            return True
        except Exception as ipv4_exc:
            print(f"[EMAIL] Direct IPv4 fallback failed: {ipv4_exc}")
            _set_last_email_error(f"smtp_ipv4_fallback_failed: {ipv4_exc}")

        print("[EMAIL] Retrying via SMTP_SSL smtp.gmail.com:465")
        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=7, context=ssl.create_default_context()) as server:
                server.login(user, password)
                server.send_message(msg)
            print("[EMAIL] SMTP_SSL send successful")
            return True
        except Exception as ssl_exc:
            combined_error = f"primary={e}; tls={tls_error}; smtp_ssl={ssl_exc}"
            print(f"[EMAIL] SMTP delivery failed: {combined_error}; trying HTTPS providers")

            # HTTPS provider fallback (works when SMTP ports are blocked).
            resend_ok, resend_detail = _send_via_resend(to_address, subject, body, html_body, from_email)
            if resend_ok:
                print("[EMAIL] Sent via Resend HTTPS API")
                _set_last_email_error("")
                return True

            brevo_ok, brevo_detail = _send_via_brevo(to_address, subject, body, html_body, from_email)
            if brevo_ok:
                print("[EMAIL] Sent via Brevo HTTPS API")
                _set_last_email_error("")
                return True

            final_error = f"{combined_error}; {resend_detail}; {brevo_detail}"
            print(f"[EMAIL] All transports failed: {final_error}; falling back to local log")
            _set_last_email_error(final_error)
            _write_fallback_log(to_address, subject, body, final_error)
            print(f"[EMAIL-DRYRUN] To: {to_address}\nSubject: {subject}\n\n{body}")
            return False
