#!/usr/bin/env python3
"""Quick SMTP configuration check"""
import os
from pathlib import Path

# Load .env
env_file = Path(__file__).parent / '.env'
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

print("=" * 70)
print("EMAIL CONFIGURATION STATUS")
print("=" * 70)

vars_to_check = {
    'SMTP_SERVER': 'Email Server',
    'SMTP_PORT': 'Email Port',
    'SMTP_USER': 'Email Username',
    'SMTP_PASS': 'Email Password',
    'FROM_EMAIL': 'Sender Email Address',
    'FROM_NAME': 'Sender Display Name',
    'FRONTEND_URL': 'Frontend URL',
}

for env_var, description in vars_to_check.items():
    value = os.environ.get(env_var, '')
    if env_var == 'SMTP_PASS' and value:
        # Mask password
        display_value = '***' + value[-10:] if len(value) > 10 else '***'
    else:
        display_value = value if value else '[NOT SET]'
    
    status = '✅' if value else '❌'
    print(f"{status} {description:25s}: {display_value}")

print("\n" + "=" * 70)
print("FROM_EMAIL is the critical value being used as the email sender")
print("Current value: " + os.environ.get('FROM_EMAIL', '[NOT SET]'))
print("=" * 70)
