import json
import os
import smtplib
import socket
import ssl
from datetime import datetime
from email.message import EmailMessage
from html import escape
from urllib import error as urllib_error
from urllib import request as urllib_request

from dotenv import load_dotenv

# Load environment variables from .env file.
load_dotenv()

_LAST_EMAIL_ERROR = ""
_HTTP_TIMEOUT_SECONDS = 10
_SMTP_TIMEOUT_SECONDS = 4


def _env_first(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name)
        if value is not None and str(value).strip():
            return str(value).strip()
    return default


def _safe_int(value: str, fallback: int) -> int:
    try:
        return int((value or "").strip())
    except Exception:
        return fallback


def _smtp_config() -> dict:
    host = _env_first("SMTP_HOST", "EMAIL_HOST", "MAIL_HOST", default="smtp.gmail.com")
    port = _safe_int(_env_first("SMTP_PORT", "EMAIL_PORT", "MAIL_PORT", default="587"), 587)
    user = _env_first("SMTP_USER", "SMTP_USERNAME", "EMAIL_HOST_USER", "MAIL_USERNAME")
    password = _env_first("SMTP_PASS", "SMTP_PASSWORD", "EMAIL_HOST_PASSWORD", "MAIL_PASSWORD").replace(" ", "")
    from_email = _env_first("SENDER_EMAIL", "FROM_EMAIL", "DEFAULT_FROM_EMAIL", "SMTP_FROM_EMAIL", default=user or "no-reply@localhost")
    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "from_email": from_email,
    }


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
                f"---\nTime: {datetime.utcnow().isoformat()} UTC\nEMAIL FAILED: {error}\n"
                f"To: {to_address}\nSubject: {subject}\n\n{body}\n"
            )
    except Exception as e2:
        print(f"[EMAIL] Failed to write fallback log: {e2}")


def _post_json(url: str, payload: dict, headers: dict, timeout: int = _HTTP_TIMEOUT_SECONDS) -> tuple[bool, str]:
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
    api_key = _env_first("RESEND_API_KEY", "RESEND_KEY")
    if not api_key:
        return False, "resend_not_configured"

    resend_from = _env_first("RESEND_FROM_EMAIL", "RESEND_FROM", default="onboarding@resend.dev")
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
    api_key = _env_first("BREVO_API_KEY", "SENDINBLUE_API_KEY", "BREVO_KEY", "SENDINBLUE_KEY")
    if not api_key:
        return False, "brevo_not_configured"

    brevo_from = _env_first("BREVO_FROM_EMAIL", "SENDINBLUE_FROM_EMAIL", default=from_email)
    brevo_sender_name = _env_first("BREVO_SENDER_NAME", "SENDINBLUE_SENDER_NAME", default="MedTech")
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


def _send_via_sendgrid(to_address: str, subject: str, body: str, html_body: str | None, from_email: str) -> tuple[bool, str]:
    api_key = _env_first("SENDGRID_API_KEY", "SEND_GRID_API_KEY")
    if not api_key:
        return False, "sendgrid_not_configured"

    sendgrid_from = _env_first("SENDGRID_FROM_EMAIL", "SENDGRID_SENDER_EMAIL", default=from_email)
    sendgrid_from_name = _env_first("SENDGRID_SENDER_NAME", default="MedTech")
    payload = {
        "personalizations": [{"to": [{"email": to_address}]}],
        "from": {"email": sendgrid_from, "name": sendgrid_from_name},
        "subject": subject,
        "content": [
            {"type": "text/plain", "value": body},
            {"type": "text/html", "value": html_body or f"<pre>{escape(body)}</pre>"},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    ok, detail = _post_json("https://api.sendgrid.com/v3/mail/send", payload, headers)
    return ok, f"sendgrid:{detail}"


def _send_via_postmark(to_address: str, subject: str, body: str, html_body: str | None, from_email: str) -> tuple[bool, str]:
    api_key = _env_first("POSTMARK_SERVER_TOKEN", "POSTMARK_API_KEY")
    if not api_key:
        return False, "postmark_not_configured"

    postmark_from = _env_first("POSTMARK_FROM_EMAIL", "POSTMARK_SENDER_EMAIL", default=from_email)
    payload = {
        "From": postmark_from,
        "To": to_address,
        "Subject": subject,
        "TextBody": body,
        "HtmlBody": html_body or f"<pre>{escape(body)}</pre>",
        "MessageStream": _env_first("POSTMARK_MESSAGE_STREAM", default="outbound"),
    }
    headers = {
        "X-Postmark-Server-Token": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    ok, detail = _post_json("https://api.postmarkapp.com/email", payload, headers)
    return ok, f"postmark:{detail}"


def _try_https_providers(to_address: str, subject: str, body: str, html_body: str | None, from_email: str) -> tuple[bool, str]:
    attempts = []
    for sender in (_send_via_resend, _send_via_brevo, _send_via_sendgrid, _send_via_postmark):
        ok, detail = sender(to_address, subject, body, html_body, from_email)
        attempts.append(detail)
        if ok:
            return True, detail
    return False, "; ".join(attempts)


def _resolve_ipv4_hosts(host: str) -> list[str]:
    addresses: list[str] = []
    if not host:
        return addresses

    try:
        infos = socket.getaddrinfo(host, None, socket.AF_INET, socket.SOCK_STREAM)
        for info in infos:
            ip = info[4][0]
            if ip and ip not in addresses:
                addresses.append(ip)
    except Exception:
        pass

    try:
        ip = socket.gethostbyname(host)
        if ip and ip not in addresses:
            addresses.append(ip)
    except Exception:
        pass

    return addresses


def _smtp_send_once(
    host: str,
    port: int,
    user: str,
    password: str,
    msg: EmailMessage,
    use_ssl: bool,
    allow_hostname_mismatch: bool,
) -> None:
    tls_context = ssl.create_default_context()
    if allow_hostname_mismatch:
        tls_context.check_hostname = False

    if use_ssl:
        with smtplib.SMTP_SSL(host, port, timeout=_SMTP_TIMEOUT_SECONDS, context=tls_context) as server:
            server.login(user, password)
            server.send_message(msg)
        return

    with smtplib.SMTP(host, port, timeout=_SMTP_TIMEOUT_SECONDS) as server:
        server.ehlo()
        server.starttls(context=tls_context)
        server.ehlo()
        server.login(user, password)
        server.send_message(msg)


def _smtp_targets(host: str, port: int) -> list[tuple[str, int, bool, bool, str]]:
    targets: list[tuple[str, int, bool, bool, str]] = []
    seen = set()

    def add_target(target_host: str, target_port: int, use_ssl: bool, allow_hostname_mismatch: bool, label: str) -> None:
        key = (target_host, target_port, use_ssl)
        if target_host and target_port and key not in seen:
            seen.add(key)
            targets.append((target_host, target_port, use_ssl, allow_hostname_mismatch, label))

    # Primary target from env.
    add_target(host, port, use_ssl=(port == 465), allow_hostname_mismatch=False, label="primary")

    # Useful alternates for common providers.
    if port != 587:
        add_target(host, 587, use_ssl=False, allow_hostname_mismatch=False, label="starttls_587")
    if port != 465:
        add_target(host, 465, use_ssl=True, allow_hostname_mismatch=False, label="smtp_ssl_465")

    # Retry all resolved IPv4 addresses for environments with broken IPv6/routing.
    for ip in _resolve_ipv4_hosts(host):
        add_target(ip, port, use_ssl=(port == 465), allow_hostname_mismatch=True, label="ipv4_primary")
        if port != 587:
            add_target(ip, 587, use_ssl=False, allow_hostname_mismatch=True, label="ipv4_starttls_587")
        if port != 465:
            add_target(ip, 465, use_ssl=True, allow_hostname_mismatch=True, label="ipv4_smtp_ssl_465")

    return targets


def get_smtp_health() -> dict:
    """
    Returns a non-destructive email health snapshot for production diagnostics.
    Does not send any email.
    """
    smtp = _smtp_config()
    host = smtp["host"]
    port = smtp["port"]
    user = smtp["user"]
    password = smtp["password"]
    sender = smtp["from_email"]

    health = {
        "configured": bool(host and port and user and password and sender),
        "host": host,
        "port": port,
        "user_configured": bool(user),
        "password_configured": bool(password),
        "sender": sender,
        "resend_configured": bool(_env_first("RESEND_API_KEY", "RESEND_KEY")),
        "resend_from": _env_first("RESEND_FROM_EMAIL", "RESEND_FROM", default="onboarding@resend.dev"),
        "brevo_configured": bool(_env_first("BREVO_API_KEY", "SENDINBLUE_API_KEY", "BREVO_KEY", "SENDINBLUE_KEY")),
        "brevo_from": _env_first("BREVO_FROM_EMAIL", "SENDINBLUE_FROM_EMAIL", default=sender),
        "sendgrid_configured": bool(_env_first("SENDGRID_API_KEY", "SEND_GRID_API_KEY")),
        "sendgrid_from": _env_first("SENDGRID_FROM_EMAIL", "SENDGRID_SENDER_EMAIL", default=sender),
        "postmark_configured": bool(_env_first("POSTMARK_SERVER_TOKEN", "POSTMARK_API_KEY")),
        "postmark_from": _env_first("POSTMARK_FROM_EMAIL", "POSTMARK_SENDER_EMAIL", default=sender),
        "last_error": get_last_email_error(),
        "can_connect": False,
        "tls_ok": False,
        "auth_ok": False,
    }

    if not health["configured"]:
        return health

    try:
        with smtplib.SMTP(host, port, timeout=_SMTP_TIMEOUT_SECONDS) as server:
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
    Send email through SMTP first, then HTTPS providers (Resend/Brevo/SendGrid/Postmark).

    SMTP env aliases supported:
    SMTP_HOST/EMAIL_HOST/MAIL_HOST
    SMTP_PORT/EMAIL_PORT/MAIL_PORT
    SMTP_USER/SMTP_USERNAME/EMAIL_HOST_USER/MAIL_USERNAME
    SMTP_PASS/SMTP_PASSWORD/EMAIL_HOST_PASSWORD/MAIL_PASSWORD

    Returns True on successful delivery, False on complete transport failure.
    """
    smtp = _smtp_config()
    host = smtp["host"]
    port = smtp["port"]
    user = smtp["user"]
    password = smtp["password"]
    from_email = smtp["from_email"]

    print(f"[EMAIL] Config: SMTP_HOST={host}, SMTP_PORT={port}, SMTP_USER={user}, FROM_EMAIL={from_email}")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_address
    msg.set_content(body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    smtp_errors = []
    smtp_configured = bool(host and port and user and password)
    if smtp_configured:
        for target_host, target_port, use_ssl, allow_hostname_mismatch, label in _smtp_targets(host, port):
            try:
                print(f"[EMAIL] SMTP attempt ({label}): host={target_host} port={target_port} ssl={use_ssl}")
                _smtp_send_once(
                    host=target_host,
                    port=target_port,
                    user=user,
                    password=password,
                    msg=msg,
                    use_ssl=use_ssl,
                    allow_hostname_mismatch=allow_hostname_mismatch,
                )
                print(f"[EMAIL] SMTP send successful via {label}")
                _set_last_email_error("")
                return True
            except Exception as smtp_exc:
                error_text = f"{label}@{target_host}:{target_port} => {smtp_exc}"
                smtp_errors.append(error_text)
                print(f"[EMAIL] SMTP attempt failed: {error_text}")
    else:
        smtp_errors.append("smtp_not_configured")

    print("[EMAIL] SMTP delivery failed or unavailable; trying HTTPS providers")
    https_ok, https_detail = _try_https_providers(to_address, subject, body, html_body, from_email)
    if https_ok:
        print(f"[EMAIL] Sent via HTTPS provider: {https_detail}")
        _set_last_email_error("")
        return True

    smtp_error_text = " | ".join(smtp_errors[:6])
    final_error = f"smtp={smtp_error_text}; providers={https_detail}"
    print(f"[EMAIL] All transports failed: {final_error}; falling back to local log")
    _set_last_email_error(final_error)
    _write_fallback_log(to_address, subject, body, final_error)
    print(f"[EMAIL-DRYRUN] To: {to_address}\nSubject: {subject}\n\n{body}")
    return False
