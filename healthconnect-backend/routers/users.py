from datetime import datetime, timedelta, timezone
import secrets
import traceback

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Body, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from passlib.context import CryptContext
from database import SessionLocal
from utils.auth import verify_google_token
import models, schemas

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


def _json_response(success: bool, message: str, status_code: int = 200, **extra):
        payload = {
                "success": success,
                "message": message,
        }
        for key, value in extra.items():
                if value is not None:
                        payload[key] = value
        return JSONResponse(status_code=status_code, content=payload)


def _get_or_create_auth_meta(db: Session, user: models.User) -> models.UserAuthMeta:
        meta = db.query(models.UserAuthMeta).filter(models.UserAuthMeta.user_id == user.id).first()
        if meta:
                return meta

        meta = models.UserAuthMeta(
                user_id=user.id,
                is_google_user=False,
                profile_completed=bool((getattr(user, "password", "") or "").strip()),
        )
        db.add(meta)
        db.flush()
        return meta


def _detect_google_role(email: str, requested_role: str | None = None) -> str:
    role = (requested_role or "").strip().lower()
    if role in ["patient", "doctor", "pharmacy"]:
        return role

    return "patient"


def handle_google_login(user_data: dict, db: Session, requested_role: str | None = None):
    email = (user_data.get("email") or "").strip().lower()
    name = (user_data.get("name") or "").strip()
    picture = user_data.get("picture")
    google_id = user_data.get("google_id") or user_data.get("sub")
    requested_role_normalized = (requested_role or "").strip().lower()

    if not email:
        raise HTTPException(status_code=401, detail="Google account email is unavailable")

    if requested_role_normalized == "admin":
        raise HTTPException(status_code=403, detail="Admin login with Google is not allowed")

    role = _detect_google_role(email, requested_role=requested_role)
    user = db.query(models.User).filter(models.User.email == email).first()
    created_now = False

    if not user:
        print(f"[GOOGLE] Creating NEW user: {email} with role={role}")
        user = models.User(
            name=name or None,
            email=email,
            role=role,
            password="",
            created_at=datetime.now(timezone.utc),
        )

        if hasattr(user, "status"):
            setattr(user, "status", "active")
        if picture and hasattr(user, "profile_picture_url"):
            setattr(user, "profile_picture_url", picture)
        if picture and hasattr(user, "profile_pic"):
            setattr(user, "profile_pic", picture)

        db.add(user)
        db.commit()
        db.refresh(user)
        created_now = True
    else:
        print(f"[GOOGLE] Existing user login: {email}")
        should_commit = False

        # Non-destructive updates only.
        if not (user.name or "").strip() and name:
            user.name = name
            should_commit = True

        if hasattr(user, "status") and not (getattr(user, "status", "") or "").strip():
            setattr(user, "status", "active")
            should_commit = True

        if picture and hasattr(user, "profile_picture_url") and not getattr(user, "profile_picture_url", None):
            setattr(user, "profile_picture_url", picture)
            should_commit = True

        if picture and hasattr(user, "profile_pic") and not getattr(user, "profile_pic", None):
            setattr(user, "profile_pic", picture)
            should_commit = True

        if should_commit:
            db.commit()
            db.refresh(user)

    backfill_changed = False
    if not getattr(user, "created_at", None):
        user.created_at = datetime.now(timezone.utc)
        backfill_changed = True
    if hasattr(user, "status") and not (getattr(user, "status", "") or "").strip():
        setattr(user, "status", "active")
        backfill_changed = True
    if backfill_changed:
        db.commit()
        db.refresh(user)

    return user, created_now, google_id, picture, email, name


@router.get("/email-health")
def email_health():
    """
    Email provider diagnostics endpoint.
    """
    try:
        from utils.email_utils import get_email_health

        return get_email_health()
    except Exception:
        from config import settings

        return {
            "provider": "brevo_smtp",
            "configured": False,
            "from_email": (settings.FROM_EMAIL or "").strip(),
            "error": "Email health check failed",
        }


@router.get("/test-email")
def test_email(email: str):
    """
    Debug endpoint for SMTP integration checks.
    Example: GET /api/users/test-email?email=you@example.com
    """
    try:
        from utils.email_utils import send_test_email, get_last_email_error

        sent = send_test_email(email)
        if sent:
            return {
                "success": True,
                "message": "Test email sent successfully",
                "provider": "brevo_smtp",
                "to": email,
            }

        return {
            "success": False,
            "message": "Failed to send test email",
            "provider": "brevo_smtp",
            "to": email,
            "error": get_last_email_error() or "Email delivery failed",
        }
    except Exception as e:
        return {
            "success": False,
            "message": "Failed to send test email",
            "provider": "brevo_smtp",
            "to": email,
            "error": str(e),
        }


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
        "avatar": user.profile_picture_url,
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
        
        user, created_now, google_id, picture, email, name = handle_google_login(
            token_payload,
            db,
            requested_role=data.get("role"),
        )
        print(f"[GOOGLE_LOGIN] Extracted email={email}, name={name}, google_id={google_id}")

        if str(getattr(user, "status", "active") or "active").lower() in {"inactive", "suspended"}:
            raise HTTPException(status_code=403, detail="Your account is suspended by admin")

        should_commit = False
        meta = _get_or_create_auth_meta(db, user)
        if google_id and meta.google_id != google_id:
            meta.google_id = google_id
            should_commit = True
        if not meta.is_google_user:
            meta.is_google_user = True
            should_commit = True
        if created_now and meta.profile_completed:
            meta.profile_completed = False
            should_commit = True

        # If user already has a password and at least one profile field, treat profile as completed.
        has_password = bool((getattr(user, "password", "") or "").strip())
        has_profile_data = bool(user.phone or user.dob or user.gender or user.age)
        if has_password and has_profile_data and not meta.profile_completed:
            meta.profile_completed = True
            should_commit = True

        if should_commit:
            db.commit()
            db.refresh(user)

        is_new_user = not bool(meta.profile_completed)
        
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
                "is_google_user": True,
                "profile_completed": not is_new_user,
                "picture": picture or user.profile_picture_url,
                "avatar": picture or user.profile_picture_url,
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

        # Track profile completion for Google-based users.
        meta = _get_or_create_auth_meta(db, user)
        incoming_google_id = payload.get("google_id")
        if incoming_google_id and meta.google_id != incoming_google_id:
            meta.google_id = incoming_google_id
        if incoming_google_id or meta.google_id:
            meta.is_google_user = True
        if not meta.profile_completed:
            meta.profile_completed = True
        db.commit()
        db.refresh(user)
        
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
            "profile_completed": True,
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

        if str(getattr(user, "status", "active") or "active").lower() in {"inactive", "suspended"}:
            raise HTTPException(status_code=403, detail="Your account is suspended by admin")

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

        user_changed = False
        if not getattr(user, "created_at", None):
            user.created_at = datetime.now(timezone.utc)
            user_changed = True
        if hasattr(user, "status") and not (getattr(user, "status", "") or "").strip():
            setattr(user, "status", "active")
            user_changed = True
        if user_changed:
            db.commit()
            db.refresh(user)

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
            "avatar": getattr(user, 'profile_picture_url', None),
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


def _create_reset_token(db: Session, user: models.User, email: str) -> tuple[str, datetime]:
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(hours=1)
    token = secrets.token_urlsafe(32)

    # Invalidate any previous active tokens for this user.
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user.id,
        models.PasswordResetToken.used.is_(False),
    ).update(
        {
            models.PasswordResetToken.used: True,
            models.PasswordResetToken.used_at: now_utc,
        },
        synchronize_session=False,
    )

    token_row = models.PasswordResetToken(
        user_id=user.id,
        email=email,
        token=token,
        expires_at=expires_at,
        used=False,
    )
    db.add(token_row)
    db.commit()

    # Best effort: also persist on user columns for legacy compatibility.
    try:
        user.reset_token = token
        user.reset_token_expiry = expires_at.replace(tzinfo=None)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[FORGOT_PASSWORD] Could not store reset token on user row: {e}")

    return token, expires_at


# Forgot Password Endpoint
@router.post("/forgot-password")
def forgot_password(data: dict = Body(...), request: Request = None, db: Session = Depends(get_db)):
    """
    Forgot password endpoint.
    Returns success only when reset email is actually sent.
    """
    print("[FORGOT_PASSWORD] ===== START FORGOT_PASSWORD REQUEST =====")
    
    request_meta = {
        "origin": request.headers.get("origin") if request else "[missing-request]",
        "referer": request.headers.get("referer") if request else "[missing-request]",
        "host": request.headers.get("host") if request else "[missing-request]",
        "x_forwarded_host": request.headers.get("x-forwarded-host") if request else "[missing-request]",
        "x_forwarded_proto": request.headers.get("x-forwarded-proto") if request else "[missing-request]",
        "path": request.url.path if request else "[missing-request]",
        "method": request.method if request else "[missing-request]",
    }

    try:
        from utils.email_utils import send_reset_email, get_last_email_error
        from config import settings
        
        # Log environment variables (safely)
        print(f"[FORGOT_PASSWORD] Env check - FRONTEND_URL is set: {bool(settings.FRONTEND_URL)}")
        print(f"[FORGOT_PASSWORD] Env check - SMTP_SERVER: {settings.SMTP_SERVER}")
        print(f"[FORGOT_PASSWORD] Env check - SMTP_PORT: {settings.SMTP_PORT}")
        print(f"[FORGOT_PASSWORD] Env check - SMTP_USER is set: {bool(settings.SMTP_USER)}")
        print(f"[FORGOT_PASSWORD] Env check - SMTP_PASS is set: {bool(settings.SMTP_PASS)}")
        print(f"[FORGOT_PASSWORD] Env check - FROM_EMAIL: {settings.FROM_EMAIL}")

        print(f"[FORGOT_PASSWORD] Step 1: Request received")
        print(f"[FORGOT_PASSWORD] Step 1a: Request meta: {request_meta}")
        
        email = (data.get("email") or "").strip().lower()
        print(f"[FORGOT_PASSWORD] Step 2: Email extracted from request: {email or '[empty]'}")

        if not email:
            print(f"[FORGOT_PASSWORD] Step 2a: Email validation FAILED - email is empty")
            return _json_response(False, "Email is required", status_code=400)

        print(f"[FORGOT_PASSWORD] Step 2b: Email validation passed")
        
        print(f"[FORGOT_PASSWORD] Step 3: Querying database for user with email: {email}")
        user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
        
        if not user:
            print(f"[FORGOT_PASSWORD] Step 3a: User lookup FAILED - no user found for email: {email}")
            return _json_response(False, "User not found", status_code=404)

        print(f"[FORGOT_PASSWORD] Step 3b: User found - user_id={user.id}, email={user.email}")

        try:
            print(f"[FORGOT_PASSWORD] Step 4: Creating reset token")
            reset_token, expires_at = _create_reset_token(db, user, email)
            print(f"[FORGOT_PASSWORD] Step 4a: Token created successfully")
            print(f"[FORGOT_PASSWORD] Step 4b: Token: {reset_token[:20]}...")
            print(f"[FORGOT_PASSWORD] Step 4c: Expires at: {expires_at}")
            
            print(f"[FORGOT_PASSWORD] Step 5: Calling send_reset_email with email={email}, token={reset_token[:20]}...")
            sent = send_reset_email(
                email=email,
                token=reset_token,
            )
            print(f"[FORGOT_PASSWORD] Step 5a: send_reset_email returned: {sent}")

            if not sent:
                err = get_last_email_error() or "Email delivery failed"
                print(f"[FORGOT_PASSWORD] Step 5b: Email send FAILED")
                print(f"[FORGOT_PASSWORD] Step 5c: Error details: {err}")
                return _json_response(False, "Failed to send reset email", status_code=500, error=err)
            
            print(f"[FORGOT_PASSWORD] Step 6: Email sent successfully")
        except Exception as e:
            print(f"[FORGOT_PASSWORD] Step 5: EXCEPTION during email send")
            print(f"[FORGOT_PASSWORD] Step 5a: Exception type: {type(e).__name__}")
            print(f"[FORGOT_PASSWORD] Step 5b: Exception message: {str(e)}")
            print("[FORGOT_PASSWORD] Step 5c: Full exception stack:")
            print(traceback.format_exc())
            return _json_response(False, "Failed to send reset email", status_code=500, error=str(e))

        print(f"[FORGOT_PASSWORD] Step 7: Returning success response")
        print("[FORGOT_PASSWORD] ===== END FORGOT_PASSWORD REQUEST (SUCCESS) =====")
        return _json_response(True, "Reset email sent successfully", status_code=200)
    except Exception as e:
        print(f"[FORGOT_PASSWORD] UNHANDLED EXCEPTION in forgot_password route")
        print(f"[FORGOT_PASSWORD] Exception type: {type(e).__name__}")
        print(f"[FORGOT_PASSWORD] Exception message: {str(e)}")
        print("[FORGOT_PASSWORD] Full exception stack:")
        print(traceback.format_exc())
        print("[FORGOT_PASSWORD] ===== END FORGOT_PASSWORD REQUEST (UNHANDLED ERROR) =====")
        return _json_response(False, "Error processing reset password request", status_code=500, error=str(e))


@router.post("/reset-password")
def reset_password(data: dict = Body(...), db: Session = Depends(get_db)):
    """
    Reset password endpoint.
    Validates token and expiry, hashes new password, and updates the user password.
    """
    try:
        token = (data.get("token") or "").strip()
        email = (data.get("email") or "").strip().lower()
        new_password = (data.get("new_password") or "").strip()

        if not token or not email or not new_password:
            return _json_response(
                False,
                "token, email and new_password are required",
                status_code=400,
                error="missing_fields",
            )

        if len(new_password) < 8:
            return _json_response(False, "Password must be at least 8 characters", status_code=400, error="weak_password")

        user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
        if not user:
            return _json_response(False, "User not found", status_code=404, error="user_not_found")

        token_row = db.query(models.PasswordResetToken).filter(
            models.PasswordResetToken.user_id == user.id,
            models.PasswordResetToken.email == email,
            models.PasswordResetToken.token == token,
            models.PasswordResetToken.used.is_(False),
        ).first()

        if not token_row:
            return _json_response(False, "Reset link invalid or expired", status_code=400, error="invalid_token")

        now_utc = datetime.now(timezone.utc)
        token_expiry = token_row.expires_at
        if token_expiry and token_expiry.tzinfo is None:
            token_expiry = token_expiry.replace(tzinfo=timezone.utc)

        if not token_expiry or token_expiry < now_utc:
            token_row.used = True
            token_row.used_at = now_utc
            user.reset_token = None
            user.reset_token_expiry = None
            db.commit()
            return _json_response(False, "This reset link has expired. Please request a new one.", status_code=400, error="token_expired")

        # bcrypt.hashpw as requested.
        password_hash = bcrypt.hashpw(new_password[:72].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        user.password = password_hash
        user.reset_token = None
        user.reset_token_expiry = None
        token_row.used = True
        token_row.used_at = now_utc
        db.commit()

        return _json_response(True, "Password updated successfully", status_code=200)
    except Exception as e:
        print(f"[RESET_PASSWORD] error: {e}")
        return _json_response(False, "Error processing reset password request", status_code=500, error=str(e))
