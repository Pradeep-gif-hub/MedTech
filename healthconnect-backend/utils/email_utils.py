import os
import smtplib
from email.message import EmailMessage
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def send_email(to_address: str, subject: str, body: str) -> bool:
    """
    Send email using SMTP if environment variables are set:
      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL

    Returns True if an SMTP send was attempted/succeeded, False if falling back to local log/console.
    """
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "0") or 0)
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    from_email = os.getenv("FROM_EMAIL", user or "no-reply@localhost")
    
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

    try:
        print(f"[EMAIL] Attempting to connect to SMTP server {host}:{port}")
        with smtplib.SMTP(host, port, timeout=10) as server:
            print("[EMAIL] Connected to SMTP server")
            try:
                server.starttls()
                print("[EMAIL] STARTTLS successful")
            except Exception as e:
                print(f"[EMAIL] STARTTLS failed: {e}")
                # some SMTP servers don't require starttls; ignore if it fails
                pass
            print(f"[EMAIL] Attempting login with user: {user}")
            server.login(user, password)
            print("[EMAIL] Login successful")
            print(f"[EMAIL] Sending email to: {to_address}")
            server.send_message(msg)
            print("[EMAIL] Email sent successfully")
        return True
    except Exception as e:
        # on failure, fall back to logging so OTP isn't lost
        print(f"[EMAIL] SMTP send failed: {e}; falling back to local log")
        try:
            project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            log_path = os.path.join(project_root, "sent_otps.log")
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(f"---\nTime: {datetime.utcnow().isoformat()} UTC\nSMTP FAILED: {e}\nTo: {to_address}\nSubject: {subject}\n\n{body}\n")
        except Exception as e2:
            print(f"[EMAIL] Failed to write fallback log: {e2}")
        print(f"[EMAIL-DRYRUN] To: {to_address}\nSubject: {subject}\n\n{body}")
        return False
