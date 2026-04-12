#!/usr/bin/env python3
"""Direct SMTP test - send a real email"""
import os
import smtplib
from email.message import EmailMessage
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

# Get config
SMTP_SERVER = os.environ.get('SMTP_SERVER') or os.environ.get('SMTP_HOST')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASS = os.environ.get('SMTP_PASS', '')
FROM_EMAIL = os.environ.get('FROM_EMAIL', '')
FROM_NAME = os.environ.get('FROM_NAME', 'MedTech')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://medtech-4rjc.onrender.com')

print("\n" + "="*70)
print("TESTING EMAIL SEND WITH CORRECTED CREDENTIALS")
print("="*70)
print(f"\nConfiguration:")
print(f"  SMTP Server: {SMTP_SERVER}")
print(f"  SMTP Port: {SMTP_PORT}")
print(f"  SMTP User: {SMTP_USER}")
print(f"  From Email: {FROM_EMAIL}")
print(f"  From Name: {FROM_NAME}")

# Validate
if not all([SMTP_SERVER, SMTP_USER, SMTP_PASS, FROM_EMAIL]):
    print("\n❌ Missing required configuration!")
    exit(1)

try:
    # Get recipient
    recipient = input("\n📧 Enter test recipient email: ").strip()
    if not recipient:
        recipient = "pawasthi063@gmail.com"
    
    print(f"\nSending test email to: {recipient}")
    print("\nStep 1: Creating SMTP connection...")
    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=15) as smtp:
        print("  ✅ Connected to SMTP server")
        
        print("Step 2: Upgrading to TLS...")
        smtp.starttls()
        print("  ✅ TLS enabled")
        
        print(f"Step 3: Authenticating as {SMTP_USER}...")
        smtp.login(SMTP_USER, SMTP_PASS)
        print("  ✅ Authenticated successfully")
        
        # Create message
        print("\nStep 4: Creating email message...")
        msg = EmailMessage()
        msg['Subject'] = "✅ MedTech Email Configuration Fixed!"
        msg['From'] = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg['To'] = recipient
        
        html_body = f"""
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
            <h2>✅ Email Configuration Fixed!</h2>
            <p>This confirms your MedTech email SMTP configuration is NOW WORKING.</p>
            
            <div style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>Configuration Details:</h3>
                <ul>
                    <li><strong>SMTP Server:</strong> {SMTP_SERVER}</li>
                    <li><strong>SMTP User:</strong> {SMTP_USER}</li>
                    <li><strong>From Email:</strong> {FROM_EMAIL}</li>
                    <li><strong>Display Name:</strong> {FROM_NAME}</li>
                    <li><strong>Recipient:</strong> {recipient}</li>
                </ul>
            </div>
            
            <p style="background: #ecfdf5; padding: 12px; border-left: 4px solid #10b981;">
                ✅ <strong>If you see this email, the configuration is FIXED!</strong>
            </p>
            
            <p>Password reset emails and OTP emails should now work correctly.</p>
        </div>
        """
        
        text_body = f"""
        ✅ MedTech Email Configuration Fixed!
        
        This confirms your email SMTP configuration is working.
        
        SMTP Server: {SMTP_SERVER}
        SMTP User: {SMTP_USER}
        From Email: {FROM_EMAIL}
        """
        
        msg.set_content(text_body)
        msg.add_alternative(html_body, subtype='html')
        
        print(f"  From: {msg['From']}")
        print(f"  To: {msg['To']}")
        print(f"  Subject: {msg['Subject']}")
        
        print("\nStep 5: Sending email...")
        response = smtp.send_message(msg)
        print(f"  ✅ Email sent! Response: {response}")
    
    print("\n" + "="*70)
    print("✅ SUCCESS! EMAIL SENT SUCCESSFULLY")
    print("="*70)
    print(f"\n📧 Check {recipient} for the email")
    print("📧 Check Brevo logs: https://app.brevo.com/transactional/email/logs")
    print("\n✅ Your backend can now send:")
    print("  - Forgot password reset emails ✓")
    print("  - OTP verification emails ✓")
    print("  - Any other transactional emails ✓")
    
except smtplib.SMTPAuthenticationError as e:
    print(f"\n❌ SMTP Authentication Failed!")
    print(f"   Error: {e}")
    print(f"\n   Check your SMTP credentials:")
    print(f"   - SMTP_USER: {SMTP_USER}")
    print(f"   - SMTP_PASS: should be from Brevo account")
    exit(1)
except Exception as e:
    print(f"\n❌ Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
