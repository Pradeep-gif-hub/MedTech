from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import SessionLocal
import models, schemas
import json
from datetime import datetime

router = APIRouter(tags=["Doctors"], prefix="/api/doctors")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def resolve_current_user(request: Request, db: Session) -> models.User:
    auth_header = request.headers.get("Authorization") or ""
    user = None

    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()

        if token.startswith("local:"):
            raw_user_id = token.replace("local:", "", 1)
            if raw_user_id.isdigit():
                user = db.query(models.User).filter(models.User.id == int(raw_user_id)).first()

    if not user:
        user_id_header = request.headers.get("X-User-Id")
        if user_id_header and str(user_id_header).isdigit():
            user = db.query(models.User).filter(models.User.id == int(user_id_header)).first()

    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    return user


async def resolve_current_doctor(request: Request, db: Session) -> models.User:
    """Extract doctor from JWT token and verify role"""
    auth_header = request.headers.get("Authorization") or ""
    user = None

    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        
        if token.startswith("local:"):
            raw_user_id = token.replace("local:", "", 1)
            if raw_user_id.isdigit():
                user = db.query(models.User).filter(models.User.id == int(raw_user_id)).first()

    if not user:
        # Fallback for legacy clients
        user_id_header = request.headers.get("X-User-Id")
        if user_id_header and str(user_id_header).isdigit():
            user = db.query(models.User).filter(models.User.id == int(user_id_header)).first()

    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Verify user is a doctor
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="Access restricted to doctors only")

    return user


def serialize_doctor_profile(user: models.User) -> dict:
    """Serialize doctor profile to response format"""
    # Parse languages_spoken if it's a JSON string
    languages = []
    if user.languages_spoken:
        try:
            languages = json.loads(user.languages_spoken) if isinstance(user.languages_spoken, str) else user.languages_spoken
        except:
            languages = [user.languages_spoken] if user.languages_spoken else []

    return {
        "id": user.id,
        "full_name": user.full_name or user.name,
        "email": user.email,
        "phone_number": user.phone,
        "date_of_birth": user.date_of_birth or user.dob,
        "gender": user.gender,
        "blood_group": user.blood_group or user.bloodgroup,
        "specialization": user.specialization,
        "years_of_experience": user.years_of_experience,
        "languages_spoken": languages,
        "license_number": user.license_number,
        "registration_number": user.registration_number,
        "hospital_name": user.hospital_name,
        "profile_photo": user.profile_picture_url,
        "abha_id": user.abha_id,
        "emergency_contact": user.emergency_contact,
        "license_status": user.license_status,
        "license_valid_till": user.license_valid_till,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


@router.get("/profile")
async def get_doctor_profile(request: Request, db: Session = Depends(get_db)):
    """
    Get the logged-in doctor's profile data.
    Requires JWT token in Authorization header.
    
    Response: Doctor profile with all fields
    """
    try:
        doctor = await resolve_current_doctor(request, db)
        return serialize_doctor_profile(doctor)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[GET_DOCTOR_PROFILE] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {str(e)}")


@router.get("/{doctor_id}")
async def get_doctor_by_id(doctor_id: int, request: Request, db: Session = Depends(get_db)):
    """Return public doctor details for consultation cards."""
    try:
        # Require an authenticated user (patient/doctor/admin/pharmacy).
        await resolve_current_user(request, db)

        doctor = db.query(models.User).filter(
            models.User.id == doctor_id,
            models.User.role == "doctor"
        ).first()

        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found")

        return {
            "id": doctor.id,
            "name": doctor.full_name or doctor.name,
            "full_name": doctor.full_name or doctor.name,
            "specialization": doctor.specialization,
            "email": doctor.email,
            "avatar": doctor.profile_picture_url,
            "profile_picture_url": doctor.profile_picture_url,
            "hospital_name": doctor.hospital_name,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[GET_DOCTOR_BY_ID] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch doctor details: {str(e)}")


@router.put("/profile/update")
async def update_doctor_profile(
    request: Request,
    payload: schemas.DoctorProfileUpdate,
    db: Session = Depends(get_db),
):
    """
    Update doctor profile fields.
    Requires JWT token in Authorization header.
    
    Allowed fields:
    - full_name
    - phone_number
    - date_of_birth
    - gender
    - blood_group
    - specialization
    - years_of_experience
    - languages_spoken (array)
    - license_number
    - registration_number
    - hospital_name
    - profile_photo (URL)
    - abha_id
    - emergency_contact
    - license_status
    - license_valid_till
    
    Response: Updated doctor profile
    """
    try:
        doctor = await resolve_current_doctor(request, db)
        
        # Extract payload data, excluding unset values
        body = payload.model_dump(exclude_unset=True)
        
        # Map frontend field names to database field names
        field_mapping = {
            "full_name": "full_name",
            "phone_number": "phone",
            "date_of_birth": "date_of_birth",
            "gender": "gender",
            "blood_group": "blood_group",
            "specialization": "specialization",
            "years_of_experience": "years_of_experience",
            "license_number": "license_number",
            "registration_number": "registration_number",
            "hospital_name": "hospital_name",
            "profile_photo": "profile_picture_url",
            "abha_id": "abha_id",
            "emergency_contact": "emergency_contact",
            "license_status": "license_status",
            "license_valid_till": "license_valid_till",
        }
        
        # Update fields
        for frontend_field, db_field in field_mapping.items():
            if frontend_field in body and body[frontend_field] is not None:
                value = body[frontend_field]
                
                # Special handling for languages_spoken - convert to JSON string
                if frontend_field == "languages_spoken" and isinstance(value, list):
                    value = json.dumps(value)
                
                setattr(doctor, db_field, value)
        
        # Update also update the name field for compatibility
        if "full_name" in body and body.get("full_name"):
            doctor.name = body["full_name"]
        
        # Update the updated_at timestamp
        doctor.updated_at = datetime.utcnow()
        
        # Commit changes
        db.commit()
        db.refresh(doctor)
        
        print(f"[UPDATE_DOCTOR_PROFILE] Profile updated for doctor: {doctor.id}")
        
        return serialize_doctor_profile(doctor)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[UPDATE_DOCTOR_PROFILE_ERROR] {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")
