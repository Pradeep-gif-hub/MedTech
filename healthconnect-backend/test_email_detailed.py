#!/usr/bin/env python3
"""
Detailed SMTP diagnostic test to identify email configuration issues
"""
import os
import sys
import smtplib
import socket
from email.message import EmailMessage
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

print("=" * 70)
print("DETAILED SMTP DIAGNOSTIC TEST")
print("=" * 70)

# Load config
host = os.getenv("SMTP_HOST", "").strip()
port_str = os.getenv("SMTP_PORT", "587").strip()
user = os.getenv("SMTP_USER", "").strip()
password = os.getenv("SMTP_PASS", "").strip()
from_email = os.getenv("FROM_EMAIL", user or "no-reply@localhost").strip()

try:
    port = int(port_str)
except ValueError:
    port = 587

print(f"\nCONFIGURATION:")
print(f"  SMTP_HOST:   {host or '(not set)'}")
print(f"  SMTP_PORT:   {port}")
print(f"  SMTP_USER:   {user or '(not set)'}")
print(f"  SMTP_PASS:   {'(set)' if password else '(not set)'}")
print(f"  FROM_EMAIL:  {from_email}")

if not all([host, port, user, password]):
    print("\nERROR: Missing SMTP configuration!")
    sys.exit(1)

print("\n" + "=" * 70)
print("STEP 1: DNS Resolution")
print("=" * 70)
try:
    ip = socket.gethostbyname(host)
    print(f"OK: {host} resolves to: {ip}")
except socket.gaierror as e:
    print(f"FAIL: Could not resolve {host}: {e}")
    sys.exit(1)

print("\n" + "=" * 70)
print("STEP 2: TCP Connection")
print("=" * 70)
try:
    sock = socket.create_connection((host, port), timeout=5)
    print(f"OK: Connected to {host}:{port}")
    sock.close()
except socket.timeout:
    print(f"FAIL: Connection timeout to {host}:{port}")
    sys.exit(1)
except socket.error as e:
    print(f"FAIL: Could not connect to {host}:{port}: {e}")
    sys.exit(1)

print("\n" + "=" * 70)
print("STEP 3: SMTP Protocol Handshake")
print("=" * 70)
try:
    server = smtplib.SMTP(host, port, timeout=5)
    print(f"OK: SMTP connection established")
except Exception as e:
    print(f"FAIL: Could not establish SMTP connection: {e}")
    sys.exit(1)

print("\n" + "=" * 70)
print("STEP 4: STARTTLS Negotiation")
print("=" * 70)
try:
    server.starttls()
    print(f"OK: STARTTLS successful - connection upgraded to TLS")
except smtplib.SMTPNotSupportedError:
    print(f"WARNING: Server doesn't support STARTTLS, continuing anyway...")
except smtplib.SMTPServerDisconnected:
    print(f"FAIL: Server disconnected during STARTTLS")
    sys.exit(1)
except socket.timeout:
    print(f"WARNING: STARTTLS timeout - trying without TLS")
except Exception as e:
    print(f"WARNING: STARTTLS failed: {e}")
    print(f"   Attempting to continue anyway...")

print("\n" + "=" * 70)
print("STEP 5: Authentication")
print("=" * 70)
try:
    server.login(user, password)
    print(f"OK: Successfully authenticated as {user}")
except smtplib.SMTPAuthenticationError as e:
    print(f"FAIL: Authentication failed: {e}")
    print(f"   Check your SMTP_USER and SMTP_PASS credentials")
    server.quit()
    sys.exit(1)
except Exception as e:
    print(f"FAIL: Login error: {e}")
    server.quit()
    sys.exit(1)

print("\n" + "=" * 70)
print("STEP 6: Sending Test Email")
print("=" * 70)
try:
    to_email = user  # Send to self
    msg = EmailMessage()
    msg["Subject"] = "MedTech SMTP Test Email"
    msg["From"] = from_email
    msg["To"] = to_email
    msg.set_content(
        f"""This is a test email from MedTech SMTP diagnostic.

Sent at: {datetime.now().isoformat()}
From: {from_email}
To: {to_email}

If you received this, SMTP is working correctly!
"""
    )
    
    server.send_message(msg)
    print(f"OK: Email sent successfully to {to_email}")
    print(f"   Check {to_email} inbox for the test email")
    
except Exception as e:
    print(f"FAIL: Could not send email: {e}")
    server.quit()
    sys.exit(1)

print("\n" + "=" * 70)
print("SUCCESS: ALL TESTS PASSED")
print("=" * 70)
print("SMTP is properly configured and working!\n")

server.quit()
