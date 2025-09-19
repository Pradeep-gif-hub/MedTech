from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from database import SessionLocal
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
        allergies=user.allergies,
        medications=user.medications,
        surgeries=user.surgeries
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    print(f"User created: {new_user}")  # Debug print
    return new_user


# Login
@router.post("/login")
def login(
    data: dict = Body(...),
    db: Session = Depends(get_db)
):
    email = data.get("email")
    password = data.get("password")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not pwd_context.verify(password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # Ensure all required fields are present and not None
    return {
        "message": f"Welcome {getattr(user, 'name', '')}!",
        "role": getattr(user, 'role', ''),
        "user_id": getattr(user, 'id', ''),
        "name": getattr(user, 'name', ''),
        "token": "dummy-token"
    }

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
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    db_user.password = pwd_context.hash(user.password)
    db_user.role = user.role
    db_user.allergies = user.allergies
    db_user.medications = user.medications
    db_user.surgeries = user.surgeries
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
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    db_user.password = pwd_context.hash(user.password)
    db_user.role = user.role
    db_user.allergies = user.allergies
    db_user.medications = user.medications
    db_user.surgeries = user.surgeries
    try:
        db.commit()
        db.refresh(db_user)
        print(f"[DEBUG] update_user_by_email: Success for email={email}")
        return db_user
    except Exception as e:
        print(f"[DEBUG] update_user_by_email: Exception: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
