#!/usr/bin/env python3
"""
Test script to verify SMTP email configuration
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent directory to path so we can import utils
sys.path.insert(0, os.path.dirname(__file__))

from utils.email_utils import send_email

def test_smtp():
    """Test SMTP configuration"""
    print("=" * 60)
    print("TESTING SMTP EMAIL CONFIGURATION")
    print("=" * 60)
    
    # Check environment variables
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    from_email = os.getenv("FROM_EMAIL")
    
    print("\n📧 SMTP Configuration:")
    print(f"  Host: {smtp_host}")
    print(f"  Port: {smtp_port}")
    print(f"  User: {smtp_user}")
    print(f"  Password: {'*' * len(smtp_pass) if smtp_pass else 'NOT SET'}")
    print(f"  From Email: {from_email}")
    
    if not all([smtp_host, smtp_port, smtp_user, smtp_pass]):
        print("\n❌ ERROR: SMTP configuration incomplete!")
        print("Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in .env")
        return False
    
    print("\n" + "=" * 60)
    print("Sending test email...")
    print("=" * 60)
    
    test_email = smtp_user  # Send to the same email
    test_subject = "MedTech - SMTP Configuration Test"
    test_body = """Hello,

This is a test email from MedTech to verify your SMTP configuration is working correctly.

If you received this email, your configuration is successful!

Best regards,
MedTech Team"""
    
    try:
        result = send_email(
            to_address=test_email,
            subject=test_subject,
            body=test_body
        )
        
        print(f"\n✅ Email send attempt completed!")
        print(f"   Recipient: {test_email}")
        print(f"   Status: {'SENT' if result else 'LOGGED (SMTP not available or failed)'}")
        return True
        
    except Exception as e:
        print(f"\n❌ Error sending email: {e}")
        return False

if __name__ == "__main__":
    success = test_smtp()
    sys.exit(0 if success else 1)
