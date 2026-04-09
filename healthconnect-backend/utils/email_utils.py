import os
import smtplib
import ssl
from email.message import EmailMessage
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


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
        return True
    except smtplib.SMTPAuthenticationError as e:
        print(f"[EMAIL] CRITICAL: Authentication failed: {e}")
        print("[EMAIL] Verify SMTP_USER and SMTP_PASS in .env")
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

        print("[EMAIL] Retrying via SMTP_SSL smtp.gmail.com:465")
        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=7, context=ssl.create_default_context()) as server:
                server.login(user, password)
                server.send_message(msg)
            print("[EMAIL] SMTP_SSL send successful")
            return True
        except Exception as ssl_exc:
            combined_error = f"primary={e}; tls={tls_error}; smtp_ssl={ssl_exc}"
            print(f"[EMAIL] SMTP delivery failed: {combined_error}; falling back to local log")
            _write_fallback_log(to_address, subject, body, combined_error)
            print(f"[EMAIL-DRYRUN] To: {to_address}\nSubject: {subject}\n\n{body}")
            return False
