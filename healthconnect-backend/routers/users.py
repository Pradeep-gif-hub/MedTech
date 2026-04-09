from fastapi import APIRouter, Depends, HTTPException, Body, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from passlib.context import CryptContext
from database import SessionLocal
from utils.auth import verify_google_token
import models, schemas
import os

router = APIRouter(tags=["Users"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
LOCAL_TOKEN_PREFIX = "local:"

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def build_local_token(user_id: int) -> str:
    return f"{LOCAL_TOKEN_PREFIX}{user_id}"


async def resolve_current_user(request: Request, db: Session) -> models.User:
    auth_header = request.headers.get("Authorization") or ""
    user = None

    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()

        if token.startswith(LOCAL_TOKEN_PREFIX):
            raw_user_id = token.replace(LOCAL_TOKEN_PREFIX, "", 1)
            if raw_user_id.isdigit():
                user = db.query(models.User).filter(models.User.id == int(raw_user_id)).first()
        else:
            # Support Google token for compatibility.
            try:
                token_payload = await verify_google_token(request)
                email = token_payload.get("email") if token_payload else None
                if email:
                    user = db.query(models.User).filter(models.User.email == email).first()
            except HTTPException:
                user = None

    if not user:
        # Fallback for legacy clients sending explicit user id header.
        user_id_header = request.headers.get("X-User-Id")
        if user_id_header and str(user_id_header).isdigit():
            user = db.query(models.User).filter(models.User.id == int(user_id_header)).first()

    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    return user


def serialize_user(user: models.User) -> dict:
    return {
        "id": user.id,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "dob": user.dob,
        "phone": user.phone,
        "emergency_contact": user.emergency_contact,
        "allergies": user.allergies,
        "medications": user.medications,
        "surgeries": user.surgeries,
        "age": user.age,
        "gender": user.gender,
        "bloodgroup": user.bloodgroup,
        "abha_id": user.abha_id,
        "allergy": user.allergy,
        "profile_picture_url": user.profile_picture_url,
        "picture": user.profile_picture_url,
        "token": build_local_token(user.id),
    }

# Sign Up
@router.post("/signup", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    print(f"Received signup: {user}")  # Debug print
    if not user.email:
        raise HTTPException(status_code=400, detail="Email is required")
    if not user.name:
        raise HTTPException(status_code=400, detail="Name is required")
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = pwd_context.hash(user.password) if user.password else ""
    new_user = models.User(
        name=user.name,
        email=user.email,
        password=hashed_password,
        role=user.role or "patient",
        dob=user.dob,
        phone=user.phone,
        emergency_contact=user.emergency_contact,
        # legacy fields
        allergies=user.allergies,
        medications=user.medications,
        surgeries=user.surgeries,
        # NEW profile fields
        age=user.age,
        gender=user.gender,
        bloodgroup=user.bloodgroup,
        abha_id=user.abha_id,
        allergy=user.allergy,
        profile_picture_url=user.profile_picture_url or user.picture,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    print(f"User created: {new_user}")  # Debug print
    return serialize_user(new_user)


# Google Login - dedicated endpoint for Google OAuth
@router.post("/google-login")
async def google_login(
    request: Request,
    data: dict = Body(None),
    db: Session = Depends(get_db)
):
    """
    Google OAuth login endpoint.
    Expects Authorization: Bearer <google_id_token> header.
    
    For existing users: Returns user data with is_new_user=false
    For new users: Returns temporary user info with is_new_user=true
                   Frontend redirects to /complete-profile
    """
    try:
        data = data or {}

        # Verify Google token from Authorization header
        try:
            token_payload = await verify_google_token(request)
        except HTTPException as he:
            print(f"[GOOGLE_LOGIN] Token verification failed: {he.detail}")
            raise he
        
        if not token_payload:
            print("[GOOGLE_LOGIN] Token payload is empty")
            raise HTTPException(status_code=401, detail="Invalid Google token")
        
        # Extract user information from Google token
        email = token_payload.get("email")
        name = token_payload.get("name")
        google_id = token_payload.get("google_id")
        picture = token_payload.get("picture")
        
        print(f"[GOOGLE_LOGIN] Extracted email={email}, name={name}, google_id={google_id}")
        
        # Check if user exists
        user = db.query(models.User).filter(models.User.email == email).first()
        is_new_user = False
        
        if not user:
            print(f"[GOOGLE_LOGIN] New user detected: {email}")
            is_new_user = True
            temp_role = data.get("role") or "patient"
            if temp_role not in ["patient", "doctor", "pharmacy", "admin"]:
                temp_role = "patient"

            # Persist a temporary Google user so profile completion can update this exact record.
            user = models.User(
                email=email,
                name=name,
                password="",
                role=temp_role,
                profile_picture_url=picture,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            local_token = build_local_token(user.id)
            response = {
                "user": {
                    "user_id": user.id,
                    "id": user.id,
                    "email": email,
                    "name": name,
                    "role": temp_role,
                    "dob": None,
                    "phone": None,
                    "age": None,
                    "gender": None,
                    "bloodgroup": None,
                    "abha_id": None,
                    "allergy": None,
                    "profile_picture_url": picture,
                    "google_id": google_id,
                    "picture": picture,
                    "email_verified": token_payload.get("email_verified"),
                    "token": local_token,
                },
                "is_new_user": True,
                "token": local_token,
                "message": "Please complete your profile"
            }
            print(f"[GOOGLE_LOGIN] Response: is_new_user=True, email={email}")
            return response
        else:
            print(f"[GOOGLE_LOGIN] Existing user: {user.id}")
            # Update profile picture if changed
            if picture and picture != user.profile_picture_url:
                user.profile_picture_url = picture
                db.commit()
                db.refresh(user)
                print(f"[GOOGLE_LOGIN] Profile picture updated")
        
        # Return response
        local_token = build_local_token(user.id)
        response = {
            "user": {
                "user_id": user.id,
            "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "dob": user.dob,
                "phone": user.phone,
                "emergency_contact": user.emergency_contact,
                "age": user.age,
                "gender": user.gender,
                "bloodgroup": user.bloodgroup,
                "abha_id": user.abha_id,
                "allergy": user.allergy,
                "profile_picture_url": user.profile_picture_url,
                "google_id": google_id,
                "picture": picture or user.profile_picture_url,
                "email_verified": token_payload.get("email_verified"),
                "token": local_token,
            },
            "is_new_user": is_new_user,
            "token": local_token,
            "message": "Login successful" if not is_new_user else "Please complete your profile"
        }
        
        print(f"[GOOGLE_LOGIN] Response: is_new_user={is_new_user}, email={email}")
        return response
        
    except HTTPException as he:
        print(f"[GOOGLE_LOGIN] HTTPException: {he.status_code} - {he.detail}")
        raise he
    except Exception as e:
        print(f"[GOOGLE_LOGIN_ERROR] Unexpected error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

# Complete Profile - for new users after Google signup
@router.post("/complete-profile")
async def complete_profile(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Complete user profile after Google signup.
    Can accept user_id (if user exists) or create new user.
    Accepts: user_id (optional), name, age, gender, bloodgroup, allergy, role, password
    """
    try:
        user_id = payload.get("user_id")
        email = payload.get("email") or ""
        name = payload.get("name") or ""
        age = payload.get("age")
        gender = payload.get("gender")
        bloodgroup = payload.get("bloodgroup")
        allergy = payload.get("allergy")
        role = payload.get("role", "patient")
        password = payload.get("password") or ""
        phone = payload.get("phone") or ""
        dob = payload.get("dob") or ""
        picture = payload.get("picture") or payload.get("profile_picture_url") or ""
        
        # Validate role
        if role not in ["patient", "doctor", "pharmacy", "admin"]:
            role = "patient"
        
        # Find or create user
        user = None
        if user_id:
            user = db.query(models.User).filter(models.User.id == user_id).first()
        elif email:
            user = db.query(models.User).filter(models.User.email == email).first()
        
        requires_password = (not user) or (not (getattr(user, "password", "") or "").strip())
        if requires_password and not password:
            raise HTTPException(status_code=400, detail="password is required to complete profile")

        if not user:
            # Create new user (for Google signup flow)
            if not email:
                raise HTTPException(status_code=400, detail="email is required for new users")
            if not name:
                raise HTTPException(status_code=400, detail="name is required")
            
            # Hash password for new user
            hashed_password = pwd_context.hash(password[:72])  # Bcrypt limit
            
            user = models.User(
                email=email,
                name=name,
                password=hashed_password,
                role=role,
                age=age,
                gender=gender,
                bloodgroup=bloodgroup,
                allergy=allergy,
                phone=phone,
                dob=dob,
                profile_picture_url=picture
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"[COMPLETE_PROFILE] Created new user: {user.id}, email={email}")
        else:
            # Update existing user
            user.name = name or user.name
            if age:
                user.age = age
            if gender:
                user.gender = gender
            if bloodgroup:
                user.bloodgroup = bloodgroup
            if allergy:
                user.allergy = allergy
            if phone:
                user.phone = phone
            if dob:
                user.dob = dob
            if picture:
                user.profile_picture_url = picture
            
            # Update password if provided
            if password:
                user.password = pwd_context.hash(password[:72])
            
            user.role = role
            db.commit()
            db.refresh(user)
            print(f"[COMPLETE_PROFILE] Updated user: {user.id}, role={role}")
        
        return {
            "success": True,
            "message": "Profile completed successfully",
            "user_id": user.id,
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "age": user.age,
            "gender": user.gender,
            "bloodgroup": user.bloodgroup,
            "allergy": user.allergy,
            "phone": user.phone,
            "dob": user.dob,
            "profile_picture_url": user.profile_picture_url,
            "token": build_local_token(user.id),
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[COMPLETE_PROFILE_ERROR] {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to complete profile: {str(e)}")


# Login - email and password authentication only
@router.post("/login")
async def login(
    data: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Email and password login endpoint.
    Requires email and password in request body.
    For Google OAuth, use /google-login instead.
    """
    try:
        if not isinstance(data, dict):
            raise HTTPException(status_code=400, detail="Invalid payload")
        
        # Extract email and password
        email = (data.get("email") or "").strip()
        password = data.get("password") or ""
        
        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password required")

        # Find user by email
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            # Do not reveal whether email exists
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Verify password
        stored_hash = getattr(user, "password", "") or ""
        try:
            verified = pwd_context.verify(password, stored_hash)
        except Exception as e:
            # If verification fails unexpectedly, treat as invalid credentials
            print(f"[LOGIN] password verify error for {email}: {e}")
            verified = False

        if not verified:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Successful login: return user data
        return {
            "message": f"Welcome {getattr(user, 'name', '')}!",
            "role": getattr(user, 'role', '') or '',
            "user_id": getattr(user, 'id', ''),
            "id": getattr(user, 'id', ''),
            "name": getattr(user, 'name', ''),
            "email": getattr(user, 'email', ''),
            "age": getattr(user, 'age', None),
            "gender": getattr(user, 'gender', None),
            "bloodgroup": getattr(user, 'bloodgroup', None),
            "abha_id": getattr(user, 'abha_id', None),
            "allergy": getattr(user, 'allergy', None),
            "dob": getattr(user, 'dob', None),
            "phone": getattr(user, 'phone', None),
            "emergency_contact": getattr(user, 'emergency_contact', None),
            "profile_picture_url": getattr(user, 'profile_picture_url', None),
            "picture": getattr(user, 'profile_picture_url', None),
            "token": build_local_token(getattr(user, 'id', 0))
        }
    except HTTPException:
        # Re-raise known HTTP exceptions
        raise
    except Exception as exc:
        # Unexpected server error
        print(f"[LOGIN] unexpected error: {exc}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/me")
async def get_current_user_profile(request: Request, db: Session = Depends(get_db)):
    user = await resolve_current_user(request, db)
    return serialize_user(user)


@router.put("/update-profile")
async def update_profile(
    request: Request,
    payload: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
):
    user = await resolve_current_user(request, db)

    body = payload.model_dump(exclude_unset=True, by_alias=True)

    # Map canonical profile fields requested by the frontend.
    direct_fields = [
        "name",
        "phone",
        "dob",
        "gender",
        "bloodgroup",
        "abha_id",
        "age",
        "role",
        "allergy",
        "allergies",
        "medications",
        "surgeries",
        "emergency_contact",
    ]

    for key in direct_fields:
        if key in body:
            setattr(user, key, body.get(key))

    # Support camelCase alias sent by some clients.
    if "emergencyContact" in body and body.get("emergencyContact") is not None:
        user.emergency_contact = body.get("emergencyContact")

    if body.get("picture"):
        user.profile_picture_url = body.get("picture")
    if body.get("profile_picture_url"):
        user.profile_picture_url = body.get("profile_picture_url")

    try:
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {e}")

    return serialize_user(user)

# Update User
@router.put("/update/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: int, user: schemas.UserCreate, db: Session = Depends(get_db)):
    print(f"[DEBUG] update_user: user_id={user_id}, user={user}")
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        print("[DEBUG] update_user: User not found")
        raise HTTPException(status_code=404, detail="User not found")
    db_user.name = user.name
    db_user.email = user.email
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    if user.password:
        db_user.password = pwd_ctx.hash(user.password)
    db_user.role = user.role
    db_user.emergency_contact = user.emergency_contact
    db_user.allergies = user.allergies
    db_user.medications = user.medications
    db_user.surgeries = user.surgeries

    # NEW fields
    db_user.dob = user.dob
    db_user.phone = user.phone
    db_user.age = user.age
    db_user.gender = user.gender
    db_user.bloodgroup = user.bloodgroup
    db_user.allergy = user.allergy
    db_user.profile_picture_url = user.profile_picture_url or user.picture

    try:
        db.commit()
        db.refresh(db_user)
        print(f"[DEBUG] update_user: Success for user_id={user_id}")
        return db_user
    except Exception as e:
        print(f"[DEBUG] update_user: Exception: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Update User by Email
@router.put("/update/email/{email}", response_model=schemas.UserResponse)
def update_user_by_email(email: str, user: schemas.UserCreate, db: Session = Depends(get_db)):
    print(f"[DEBUG] update_user_by_email: email={email}, user={user}")
    db_user = db.query(models.User).filter(models.User.email == email).first()
    if not db_user:
        print("[DEBUG] update_user_by_email: User not found")
        raise HTTPException(status_code=404, detail="User not found")
    db_user.name = user.name
    db_user.email = user.email
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    if user.password:
        db_user.password = pwd_ctx.hash(user.password)
    db_user.role = user.role
    db_user.emergency_contact = user.emergency_contact
    db_user.allergies = user.allergies
    db_user.medications = user.medications
    db_user.surgeries = user.surgeries

    # NEW fields
    db_user.dob = user.dob
    db_user.phone = user.phone
    db_user.age = user.age
    db_user.gender = user.gender
    db_user.bloodgroup = user.bloodgroup
    db_user.allergy = user.allergy
    db_user.profile_picture_url = user.profile_picture_url or user.picture

    try:
        db.commit()
        db.refresh(db_user)
        print(f"[DEBUG] update_user_by_email: Success for email={email}")
        return db_user
    except Exception as e:
        print(f"[DEBUG] update_user_by_email: Exception: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# NEW: Partial update for the currently-known user (dev: identify by email or user_id)
@router.patch("/me", response_model=schemas.UserResponse)
def update_me(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Partial update of a user's profile.
    Expects JSON with either 'email' or 'user_id' to locate the user, and any of the updatable fields:
    name, age, gender, bloodgroup, allergy, allergies, medications, surgeries, phone, emergencyContact, password.
    """
    try:
        identifier_email = (payload.get("email") or payload.get("user_email") or "").strip()
        identifier_id = payload.get("user_id") or payload.get("id") or None

        if not identifier_email and not identifier_id:
            raise HTTPException(status_code=400, detail="Provide 'email' or 'user_id' to identify the account")

        if identifier_id:
            db_user = db.query(models.User).filter(models.User.id == int(identifier_id)).first()
        else:
            db_user = db.query(models.User).filter(models.User.email == identifier_email).first()

        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        # Allowed updatable fields
        updatable = [
            "name", "age", "gender", "bloodgroup", "abha_id", "allergy",
            "allergies", "medications", "surgeries", "phone", "dob", "role", "emergency_contact", "profile_picture_url"
        ]

        # Apply updates if present
        for key in updatable:
            if key in payload:
                setattr(db_user, key, payload.get(key))

        if "emergencyContact" in payload and payload.get("emergencyContact") is not None:
            db_user.emergency_contact = payload.get("emergencyContact")

        if "picture" in payload and payload.get("picture"):
            db_user.profile_picture_url = payload.get("picture")

        # Handle password separately (hash)
        if "password" in payload and payload.get("password"):
            db_user.password = pwd_context.hash(payload.get("password"))

        try:
            db.commit()
            db.refresh(db_user)
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to update user: {e}")

        return db_user
    except HTTPException:
        raise
    except Exception as e:
        print(f"[UPDATE_ME] unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Forgot Password Endpoint
@router.post("/forgot-password")
def forgot_password(data: dict = Body(...), db: Session = Depends(get_db)):
    """
    Forgot password endpoint.
    Sends a professional HTML password reset email.
    Always returns 200 status for security (not revealing if email exists).
    """
    try:
        email = (data.get("email") or "").strip()

        if not email:
            raise HTTPException(status_code=400, detail="Email is required")

        # Find user by email
        email_normalized = email.lower()
        user = db.query(models.User).filter(func.lower(models.User.email) == email_normalized).first()

        # Always return success for security (don't reveal if email exists)
        if user:
            try:
                from utils.email_utils import send_email
                import uuid

                reset_token = str(uuid.uuid4())
                frontend_url = (os.getenv("FRONTEND_URL") or "https://medtech-4rjc.onrender.com").rstrip("/")
                reset_link = f"{frontend_url}/reset-password?token={reset_token}&email={email}"

                email_body = f"""MedTech - Password Reset Request

Hello {user.name or 'User'},

We received a request to reset your MedTech password.
Use this link to reset your password:
{reset_link}

Security notice:
- This link expires in 1 hour
- Do not share this link with anyone

If you did not request this reset, you can safely ignore this email.

MedTech Team
"""

                html_email_body = f"""
<!doctype html>
<html>
  <body style=\"margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;\">
    <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#f3f4f6;padding:24px 0;\">
      <tr>
        <td align=\"center\">
          <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:640px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;\">
            <tr>
              <td style=\"background:#10b981;padding:20px 24px;text-align:center;color:#ffffff;font-size:34px;font-weight:700;\">MedTech</td>
            </tr>
            <tr>
              <td style=\"padding:28px 28px 8px 28px;\">
                <h2 style=\"margin:0 0 16px 0;font-size:28px;line-height:1.3;color:#111827;\">Password Reset Request</h2>
                <p style=\"margin:0 0 14px 0;font-size:22px;line-height:1.5;\">Hello {user.name or 'User'},</p>
                <p style=\"margin:0 0 18px 0;font-size:22px;line-height:1.6;\">We received a request to reset your MedTech password. Click the button below to create a new password.</p>
              </td>
            </tr>
            <tr>
              <td align=\"center\" style=\"padding:8px 28px 20px 28px;\">
                <a href=\"{reset_link}\" style=\"display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-size:22px;font-weight:700;padding:14px 26px;border-radius:8px;\">Reset Password</a>
              </td>
            </tr>
            <tr>
              <td style=\"padding:0 28px 8px 28px;\">
                <p style=\"margin:0 0 10px 0;font-size:20px;font-weight:700;color:#374151;\">Or copy this link:</p>
                <p style=\"margin:0 0 16px 0;font-size:18px;line-height:1.5;word-break:break-all;\"><a href=\"{reset_link}\" style=\"color:#2563eb;\">{reset_link}</a></p>
                <div style=\"background:#fef2f2;border-left:4px solid #ef4444;padding:14px;border-radius:8px;\">
                  <p style=\"margin:0;font-size:18px;color:#991b1b;\"><strong>Security Notice:</strong> This link expires in 1 hour. Do not share it with anyone.</p>
                </div>
                <p style=\"margin:16px 0 0 0;font-size:18px;color:#6b7280;line-height:1.5;\">If you did not request this, please ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style=\"padding:20px 28px 26px 28px;color:#6b7280;font-size:16px;text-align:center;border-top:1px solid #e5e7eb;\">MedTech Team</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""

                sent = send_email(
                    to_address=email,
                    subject="MedTech - Reset Your Password",
                    body=email_body,
                    html_body=html_email_body,
                )
                if sent:
                    print(f"[FORGOT_PASSWORD] Email sent to: {email}")
                else:
                    print(f"[FORGOT_PASSWORD] Email send reported failure for: {email}")
                    return {
                        "success": False,
                        "message": "Email service is temporarily unavailable. Please try again in a few minutes.",
                        "email": email,
                        "detail": "Could not dispatch reset email from server."
                    }
            except Exception as e:
                print(f"[FORGOT_PASSWORD] Email sending failed: {e}")
                return {
                    "success": False,
                    "message": "Email service is temporarily unavailable. Please try again in a few minutes.",
                    "email": email,
                    "detail": "Reset request accepted but delivery failed."
                }
        else:
            print(f"[FORGOT_PASSWORD] Email not found: {email}")

        return {
            "success": True,
            "message": "Password reset link has been sent to your email.",
            "email": email,
            "detail": "Check your inbox and spam folder for the reset link. It will expire in 1 hour."
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FORGOT_PASSWORD] error: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")
