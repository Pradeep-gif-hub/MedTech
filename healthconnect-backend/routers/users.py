from fastapi import APIRouter, Depends, HTTPException, Body, Request
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from database import SessionLocal
from utils.auth import verify_google_token
import models, schemas

router = APIRouter(tags=["Users"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Sign Up
@router.post("/signup", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    print(f"Received signup: {user}")  # Debug print
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = pwd_context.hash(user.password)
    new_user = models.User(
        name=user.name,
        email=user.email,
        password=hashed_password,
        role=user.role,
        # legacy fields
        allergies=user.allergies,
        medications=user.medications,
        surgeries=user.surgeries,
        # NEW profile fields
        age=user.age,
        gender=user.gender,
        bloodgroup=user.bloodgroup,
        allergy=user.allergy
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    print(f"User created: {new_user}")  # Debug print
    return new_user


# Login
@router.post("/login")
async def login(
    request: Request,
    data: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Robust login handler: validates payload, checks credentials, returns user info.
    Returns 400 for bad payload, 401 for invalid credentials, 500 for unexpected errors.
    """
    try:
        if not isinstance(data, dict):
            raise HTTPException(status_code=400, detail="Invalid payload")

        email = (data.get("email") or "").strip()
        password = data.get("password") or ""

        # Check if this is a Google OAuth login
        google_token = data.get("googleToken")
        if google_token:
            try:
                token_payload = await verify_google_token(request)
                if not token_payload:
                    raise HTTPException(status_code=401, detail="Invalid Google token")
                    
                # Get email from Google token
                email = token_payload.get("email")
                
                # Check if user exists, if not create a new user
                user = db.query(models.User).filter(models.User.email == email).first()
                if not user:
                    user = models.User(
                        email=email,
                        name=token_payload.get("name"),
                        password="",  # No password for Google users
                        role="patient",  # Default role
                        profile_picture_url=token_payload.get("picture")
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                else:
                    # Update profile picture if changed
                    new_picture = token_payload.get("picture")
                    if new_picture and new_picture != user.profile_picture_url:
                        user.profile_picture_url = new_picture
                        db.commit()
                        db.refresh(user)
                        
                return {
                    "message": f"Welcome {user.name}!",
                    "role": user.role,
                    "user_id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "age": user.age,
                    "gender": user.gender,
                    "bloodgroup": user.bloodgroup,
                    "allergy": user.allergy,
                    "profile_picture_url": user.profile_picture_url,
                    "token": google_token
                }
                
            except Exception as e:
                raise HTTPException(status_code=401, detail=str(e))
        
        # Regular email/password login
        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password required")

        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            # do not reveal whether email exists
            raise HTTPException(status_code=401, detail="Invalid credentials")

        stored_hash = getattr(user, "password", "") or ""
        try:
            verified = pwd_context.verify(password, stored_hash)
        except Exception as e:
            # if verification fails unexpectedly, treat as invalid credentials but log
            print(f"[LOGIN] password verify error for {email}: {e}")
            verified = False

        if not verified:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Successful login: return stable JSON (no sensitive data)
        return {
            "message": f"Welcome {getattr(user, 'name', '')}!",
            "role": getattr(user, 'role', '') or '',
            "user_id": getattr(user, 'id', ''),
            "name": getattr(user, 'name', ''),
            "email": getattr(user, 'email', ''),
            "age": getattr(user, 'age', None),
            "gender": getattr(user, 'gender', None),
            "bloodgroup": getattr(user, 'bloodgroup', None),
            "allergy": getattr(user, 'allergy', None),
            "profile_picture_url": getattr(user, 'profile_picture_url', None),
            "token": "dummy-token"
        }
    except HTTPException:
        # re-raise known HTTP exceptions
        raise
    except Exception as exc:
        # unexpected server error
        print(f"[LOGIN] unexpected error: {exc}")
        raise HTTPException(status_code=500, detail="Internal server error")

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
    db_user.password = pwd_ctx.hash(user.password)
    db_user.role = user.role
    db_user.allergies = user.allergies
    db_user.medications = user.medications
    db_user.surgeries = user.surgeries

    # NEW fields
    db_user.age = user.age
    db_user.gender = user.gender
    db_user.bloodgroup = user.bloodgroup
    db_user.allergy = user.allergy

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
    db_user.password = pwd_ctx.hash(user.password)
    db_user.role = user.role
    db_user.allergies = user.allergies
    db_user.medications = user.medications
    db_user.surgeries = user.surgeries

    # NEW fields
    db_user.age = user.age
    db_user.gender = user.gender
    db_user.bloodgroup = user.bloodgroup
    db_user.allergy = user.allergy

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
            "name", "age", "gender", "bloodgroup", "allergy",
            "allergies", "medications", "surgeries", "phone", "emergencyContact"
        ]

        # Apply updates if present
        for key in updatable:
            if key in payload:
                setattr(db_user, key, payload.get(key))

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
