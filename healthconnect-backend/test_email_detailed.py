#!/usr/bin/env python3
"""
Detailed email provider diagnostics.
Reports centralized Brevo SMTP configuration state.
"""

from config import settings
from utils.email_utils import get_email_health


def main() -> int:
    print("SMTP_SERVER loaded:", bool(settings.SMTP_SERVER))
    print("SMTP_PORT:", (settings.SMTP_PORT or "").strip() or "not set")
    print("SMTP_USER loaded:", bool(settings.SMTP_USER))
    print("SMTP_PASS loaded:", bool(settings.SMTP_PASS))
    print("FROM_EMAIL loaded:", bool(settings.FROM_EMAIL))
    print("FRONTEND_URL loaded:", bool(settings.FRONTEND_URL))
    print("Health payload:", get_email_health())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
