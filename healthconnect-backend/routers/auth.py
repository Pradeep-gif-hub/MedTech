from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy.orm import Session

from .users import get_db, forgot_password as users_forgot_password, reset_password as users_reset_password

router = APIRouter(tags=["Auth"])


@router.post("/forgot-password")
def forgot_password(data: dict = Body(...), request: Request = None, db: Session = Depends(get_db)):
    return users_forgot_password(data=data, request=request, db=db)


@router.post("/reset-password")
def reset_password(data: dict = Body(...), db: Session = Depends(get_db)):
    return users_reset_password(data=data, db=db)


@router.get("/email-health")
def email_health():
    """
    Diagnostic endpoint to check email/SMTP configuration.
    Returns configuration status, missing fields, and last error.
    """
    from utils.email_utils import get_email_health
    print("[AUTH] GET /email-health - checking SMTP configuration")
    return get_email_health()


@router.post("/test-email")
def test_email(data: dict = Body(...)):
    """
    Diagnostic endpoint to test email sending.
    Request body: {"email": "test@example.com"}
    """
    from utils.email_utils import send_email, get_last_email_error
    import traceback
    
    print("[AUTH] POST /test-email - attempting to send test email")
    
    email = (data.get("email") or "").strip().lower()
    if not email:
        return {"success": False, "error": "email is required"}
    
    print(f"[AUTH] Sending test email to: {email}")
    
    try:
        html_content = """
        <div style="font-family:Arial;max-width:600px;margin:auto">
            <h2>MedTech Test Email</h2>
            <p>This is a test email from MedTech backend.</p>
            <p>If you received this, email delivery is working correctly.</p>
        </div>
        """
        
        text_content = "MedTech Test Email\n\nThis is a test email from MedTech backend.\nIf you received this, email delivery is working correctly."
        
        sent = send_email(
            to_email=email,
            subject="MedTech Test Email",
            html_content=html_content,
            text_content=text_content,
            retries=1,
        )
        
        if sent:
            print(f"[AUTH] Test email sent successfully to: {email}")
            return {
                "success": True,
                "message": "Test email sent successfully",
                "recipient": email,
            }
        else:
            error = get_last_email_error() or "Unknown error"
            print(f"[AUTH] Test email failed: {error}")
            return {
                "success": False,
                "error": error,
                "recipient": email,
            }
    except Exception as e:
        print(f"[AUTH] Test email exception: {str(e)}")
        print(traceback.format_exc())
        return {
            "success": False,
            "error": str(e),
            "recipient": email,
        }
