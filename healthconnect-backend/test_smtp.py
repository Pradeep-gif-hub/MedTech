#!/usr/bin/env python3
"""
Legacy utility name retained for compatibility.
This script validates Brevo SMTP email configuration.
"""

from utils.email_utils import get_email_health


def main() -> int:
    health = get_email_health()
    print("Email provider diagnostics:")
    print(health)
    return 0 if health.get("configured") else 1


if __name__ == "__main__":
    raise SystemExit(main())
