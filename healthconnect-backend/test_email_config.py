#!/usr/bin/env python3
"""
Email Configuration Diagnostic and Test Script
This script verifies all email configuration and sends a test email.
"""

import os
import sys
import smtplib
from email.message import EmailMessage
from pathlib import Path

# Add parent directory to path to import config
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import settings

def print_header(text):
    """Print a formatted header"""
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70)

def print_section(text):
    """Print a formatted section"""
    print(f"\n{'─' * 70}")
    print(f"  {text}")
    print(f"{'─' * 70}")

def check_env_variables():
    """Check and display all email-related environment variables"""
    print_section("1. ENVIRONMENT VARIABLES CHECK")
    
    env_vars = {
        'SMTP_SERVER': settings.SMTP_SERVER,
        'SMTP_PORT': settings.SMTP_PORT,
        'SMTP_USER': settings.SMTP_USER,
        'SMTP_PASS': '***' + settings.SMTP_PASS[-10:] if settings.SMTP_PASS else '[MISSING]',
        'FROM_EMAIL': settings.FROM_EMAIL,
        'FROM_NAME': settings.FROM_NAME,
        'FRONTEND_URL': settings.FRONTEND_URL,
    }
    
    for key, value in env_vars.items():
        status = "✅" if value and value != '[MISSING]' else "❌"
        print(f"{status} {key:20s} = {value}")
    
    return all(
        settings.SMTP_SERVER and 
        settings.SMTP_PORT and 
        settings.SMTP_USER and 
        settings.SMTP_PASS and 
        settings.FROM_EMAIL
    )

def validate_config():
    """Validate the SMTP configuration"""
    print_section("2. CONFIGURATION VALIDATION")
    
    errors = []
    
    if not settings.SMTP_SERVER:
        errors.append("SMTP_SERVER is missing")
    else:
        print(f"✅ SMTP_SERVER: {settings.SMTP_SERVER}")
    
    if not settings.SMTP_PORT:
        errors.append("SMTP_PORT is missing")
    else:
        try:
            port = int(settings.SMTP_PORT)
            print(f"✅ SMTP_PORT: {port}")
        except ValueError:
            errors.append(f"SMTP_PORT is not a valid number: {settings.SMTP_PORT}")
    
    if not settings.SMTP_USER:
        errors.append("SMTP_USER is missing")
    else:
        print(f"✅ SMTP_USER: {settings.SMTP_USER}")
    
    if not settings.SMTP_PASS:
        errors.append("SMTP_PASS is missing")
    else:
        print(f"✅ SMTP_PASS: configured ({len(settings.SMTP_PASS)} chars)")
    
    if not settings.FROM_EMAIL:
        errors.append("FROM_EMAIL is missing")
    else:
        print(f"✅ FROM_EMAIL: {settings.FROM_EMAIL}")
    
    if errors:
        print(f"\n❌ Configuration has {len(errors)} error(s):")
        for error in errors:
            print(f"   - {error}")
        return False
    else:
        print("\n✅ All SMTP configuration is valid!")
        return True

def test_smtp_connection():
    """Test SMTP connection and authentication"""
    print_section("3. SMTP CONNECTION TEST")
    
    try:
        print(f"Connecting to {settings.SMTP_SERVER}:{settings.SMTP_PORT}...")
        
        with smtplib.SMTP(settings.SMTP_SERVER, int(settings.SMTP_PORT), timeout=10) as smtp:
            print("✅ Connected to SMTP server")
            
            print("Sending EHLO...")
            smtp.ehlo()
            print("✅ EHLO successful")
            
            print("Starting TLS...")
            smtp.starttls()
            print("✅ TLS started")
            
            print("Sending EHLO after TLS...")
            smtp.ehlo()
            print("✅ EHLO after TLS successful")
            
            print(f"Authenticating as {settings.SMTP_USER}...")
            smtp.login(settings.SMTP_USER, settings.SMTP_PASS)
            print("✅ Authentication successful")
            
            return True
    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ SMTP Authentication Failed: {e}")
        return False
    except Exception as e:
        print(f"❌ SMTP Connection Failed: {type(e).__name__}: {e}")
        return False

def send_test_email(recipient_email):
    """Send a test email"""
    print_section(f"4. SENDING TEST EMAIL TO: {recipient_email}")
    
    try:
        subject = "🧪 MedTech Email Configuration Test"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; 
                    border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
            <div style="background: #10b981; padding: 20px; color: white; text-align: center;">
                <h1 style="margin: 0;">🧪 Email Test</h1>
            </div>
            
            <div style="padding: 30px;">
                <p>Hello,</p>
                
                <p>This is a test email from <strong>MedTech</strong> email configuration verification.</p>
                
                <h3>Email Details:</h3>
                <ul style="background: #f3f4f6; padding: 15px; border-radius: 5px;">
                    <li><strong>From:</strong> {settings.FROM_EMAIL}</li>
                    <li><strong>From Name:</strong> {settings.FROM_NAME}</li>
                    <li><strong>To:</strong> {recipient_email}</li>
                    <li><strong>SMTP Server:</strong> {settings.SMTP_SERVER}:{settings.SMTP_PORT}</li>
                    <li><strong>SMTP User:</strong> {settings.SMTP_USER}</li>
                </ul>
                
                <p style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin-top: 20px;">
                    ✅ <strong>If you received this email, your SMTP configuration is working correctly!</strong>
                </p>
                
                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                    This email was sent at {os.popen('date').read().strip()}
                </p>
            </div>
        </div>
        """
        
        text_content = f"""
        Email Test
        ===========
        
        This is a test email from MedTech.
        
        Email Details:
        - From: {settings.FROM_EMAIL}
        - From Name: {settings.FROM_NAME}
        - To: {recipient_email}
        - SMTP Server: {settings.SMTP_SERVER}:{settings.SMTP_PORT}
        - SMTP User: {settings.SMTP_USER}
        
        If you received this email, your SMTP configuration is working correctly!
        """
        
        # Create email message
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = f"{settings.FROM_NAME} <{settings.FROM_EMAIL}>"
        msg['To'] = recipient_email
        msg.set_content(text_content)
        msg.add_alternative(html_content, subtype='html')
        
        print(f"Message headers:")
        print(f"  From: {msg['From']}")
        print(f"  To: {msg['To']}")
        print(f"  Subject: {msg['Subject']}")
        
        # Send email
        print("\nConnecting to SMTP server...")
        with smtplib.SMTP(settings.SMTP_SERVER, int(settings.SMTP_PORT), timeout=10) as smtp:
            print("✅ Connected")
            
            print("Starting TLS...")
            smtp.starttls()
            print("✅ TLS started")
            
            print(f"Authenticating as {settings.SMTP_USER}...")
            smtp.login(settings.SMTP_USER, settings.SMTP_PASS)
            print("✅ Authenticated")
            
            print("Sending email...")
            response = smtp.send_message(msg)
            print(f"✅ Email sent! SMTP Response: {response}")
            
        print(f"\n✨ SUCCESS! Test email sent to {recipient_email}")
        print(f"📧 Check {recipient_email} for the test email")
        print(f"📧 Also check Brevo logs: https://app.brevo.com/transactional/email/logs")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ SMTP Authentication Failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Email send failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main test function"""
    print_header("MedTech Email Configuration Diagnostic Tool")
    
    # Step 1: Check environment variables
    if not check_env_variables():
        print("\n❌ Some environment variables are missing!")
        sys.exit(1)
    
    # Step 2: Validate configuration
    if not validate_config():
        print("\n❌ Configuration validation failed!")
        sys.exit(1)
    
    # Step 3: Test SMTP connection
    if not test_smtp_connection():
        print("\n❌ SMTP connection test failed!")
        sys.exit(1)
    
    # Step 4: Send test email
    recipient = input("\n📧 Enter recipient email address for test email: ").strip()
    if not recipient or '@' not in recipient:
        print("❌ Invalid email address")
        sys.exit(1)
    
    if send_test_email(recipient):
        print_header("✅ EMAIL TEST COMPLETE - ALL SYSTEMS OPERATIONAL")
        sys.exit(0)
    else:
        print_header("❌ EMAIL TEST FAILED - CHECK ERRORS ABOVE")
        sys.exit(1)

if __name__ == '__main__':
    main()
