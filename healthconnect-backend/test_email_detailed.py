#!/usr/bin/env python3
"""
Detailed email provider diagnostics.
Reports centralized Resend configuration state.
"""

from config import settings
from utils.email_utils import get_email_health


def main() -> int:
    print("RESEND_API_KEY loaded:", bool(settings.RESEND_API_KEY))
    print("FROM_EMAIL loaded:", bool(settings.FROM_EMAIL))
    print("FRONTEND_URL loaded:", bool(settings.FRONTEND_URL))
    print("Health payload:", get_email_health())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
