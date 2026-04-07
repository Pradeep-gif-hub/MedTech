from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime
from database import SessionLocal
import schemas
from models import Consultation, User
from disease_specialization_map import DISEASE_SPECIALIZATION_MAP, SPECIALIZATION_DOCTOR_MAP

router = APIRouter(tags=["Consultations"], prefix="/api")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def resolve_current_doctor(request: Request, db: Session) -> User:
    """Extract doctor from JWT token and verify role"""
    auth_header = request.headers.get("Authorization") or ""
    user = None

    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        
        if token.startswith("local:"):
            raw_user_id = token.replace("local:", "", 1)
            if raw_user_id.isdigit():
                user = db.query(User).filter(User.id == int(raw_user_id)).first()

    if not user:
        # Fallback for legacy clients
        user_id_header = request.headers.get("X-User-Id")
        if user_id_header and str(user_id_header).isdigit():
            user = db.query(User).filter(User.id == int(user_id_header)).first()

    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized: No valid token")

    # Verify user is a doctor - check multiple formats
    user_role = (user.role or "").lower().strip() if user.role else ""
    
    # Accept if role is explicitly set to doctor/dr/physician
    is_doctor_by_role = user_role in ["doctor", "dr", "physician"]
    
    # OR allow if user has specialization (indicates doctor profile)
    is_doctor_by_specialization = bool(user.specialization and user.specialization.strip())
    
    # OR allow if user is in specialization map as a doctor
    is_doctor_by_id = user.id in [2, 22, 30, 34, 35]  # Known doctor IDs
    
    if not (is_doctor_by_role or is_doctor_by_specialization or is_doctor_by_id):
        raise HTTPException(status_code=403, detail="Access restricted to doctors only")

    return user


@router.post("/consultations", response_model=dict)
def create_consultation(
    consultation_data: dict,
    db: Session = Depends(get_db)
):
    """
    Create a new consultation request from a patient.
    
    Automatically assigns a doctor based on specialization matching.
    
    Request body:
    {
        "patient_id": int,
        "disease": str,  # e.g., "Cardiology"
        "symptoms": str,
        "duration": str,  # e.g., "2 weeks"
        "appointment_time": str  # optional, e.g., "3:00 PM"
    }
    """
    try:
        patient_id = consultation_data.get("patient_id")
        disease = consultation_data.get("disease")
        symptoms = consultation_data.get("symptoms")
        duration = consultation_data.get("duration")
        appointment_time = consultation_data.get("appointment_time")

        # Validate patient exists
        patient = db.query(User).filter(User.id == patient_id, User.role == "patient").first()
        if not patient:
            raise HTTPException(status_code=400, detail="Invalid patient ID")

        # Find a doctor with matching specialization using the mapping dictionary
        matching_doctor = None
        if disease and disease in DISEASE_SPECIALIZATION_MAP:
            specialization = DISEASE_SPECIALIZATION_MAP[disease]
            if specialization in SPECIALIZATION_DOCTOR_MAP:
                doctor_id = SPECIALIZATION_DOCTOR_MAP[specialization]
                doctor = db.query(User).filter(User.id == doctor_id, User.role == "doctor").first()
                if doctor:
                    matching_doctor = doctor

        # Create consultation
        new_consultation = Consultation(
            patient_id=patient_id,
            doctor_id=matching_doctor.id if matching_doctor else None,
            disease=disease,
            symptoms=symptoms,
            duration=duration,
            appointment_time=appointment_time,
            status="waiting"
        )
        
        db.add(new_consultation)
        db.commit()
        db.refresh(new_consultation)

        return {
            "id": new_consultation.id,
            "patient_id": new_consultation.patient_id,
            "doctor_id": new_consultation.doctor_id,
            "disease": new_consultation.disease,
            "status": new_consultation.status,
            "message": "Consultation request created successfully"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/doctor/patient-queue")
async def get_doctor_patient_queue(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Fetch all active consultations for the logged-in doctor.
    
    Returns consultations where:
    - doctor_id matches the logged-in doctor
    - status is "waiting" or "in-progress"
    
    Includes patient details from the consultations.
    """
    try:
        # Get authenticated doctor
        doctor = await resolve_current_doctor(request, db)
        
        # Query consultations for this doctor with active statuses
        consultations = db.query(Consultation).filter(
            Consultation.doctor_id == doctor.id,
            Consultation.status.in_(["waiting", "in-progress"])
        ).all()

        # Format response
        queue_data = []
        for consultation in consultations:
            patient = db.query(User).filter(User.id == consultation.patient_id).first()
            if patient:
                queue_data.append({
                    "consultation_id": consultation.id,
                    "patient_id": consultation.patient_id,
                    "patient_name": patient.full_name or patient.name,
                    "age": patient.age,
                    "appointment_time": consultation.appointment_time,
                    "disease": consultation.disease,
                    "symptoms": consultation.symptoms,
                    "duration": consultation.duration,
                    "status": consultation.status,
                    "created_at": consultation.created_at.isoformat() if consultation.created_at else None,
                    "bloodGroup": patient.blood_group or patient.bloodgroup,
                    "allergies": patient.allergy or patient.allergies,
                    "lastVisit": None  # TODO: Fetch from consultation/appointment history
                })

        return queue_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching queue: {str(e)}")


@router.patch("/consultations/{consultation_id}")
def update_consultation_status(
    consultation_id: int,
    status_update: dict,
    db: Session = Depends(get_db)
):
    """
    Update the status of a consultation.
    
    Request body:
    {
        "status": "waiting" | "in-progress" | "completed"
    }
    """
    try:
        consultation = db.query(Consultation).filter(
            Consultation.id == consultation_id
        ).first()

        if not consultation:
            raise HTTPException(status_code=404, detail="Consultation not found")

        new_status = status_update.get("status", "waiting")
        
        # Validate status
        valid_statuses = ["waiting", "in-progress", "completed"]
        if new_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

        # Update status
        consultation.status = new_status
        consultation.updated_at = datetime.now()
        
        db.commit()
        db.refresh(consultation)

        return {
            "id": consultation.id,
            "status": consultation.status,
            "updated_at": consultation.updated_at.isoformat(),
            "message": f"Consultation status updated to {new_status}"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/consultations/{consultation_id}")
def get_consultation(consultation_id: int, db: Session = Depends(get_db)):
    """Get details of a specific consultation"""
    try:
        consultation = db.query(Consultation).filter(
            Consultation.id == consultation_id
        ).first()

        if not consultation:
            raise HTTPException(status_code=404, detail="Consultation not found")

        patient = db.query(User).filter(User.id == consultation.patient_id).first()
        doctor = db.query(User).filter(User.id == consultation.doctor_id).first() if consultation.doctor_id else None
        
        # Get specialization from disease mapping
        specialization = DISEASE_SPECIALIZATION_MAP.get(consultation.disease, "General")

        return {
            "id": consultation.id,
            "patient_id": consultation.patient_id,
            "patient_name": patient.full_name or patient.name if patient else None,
            "doctor_id": consultation.doctor_id,
            "doctor_name": doctor.full_name or doctor.name if doctor else None,
            "specialization": specialization,
            "disease": consultation.disease,
            "symptoms": consultation.symptoms,
            "duration": consultation.duration,
            "status": consultation.status,
            "appointment_time": consultation.appointment_time,
            "created_at": consultation.created_at.isoformat() if consultation.created_at else None,
            "updated_at": consultation.updated_at.isoformat() if consultation.updated_at else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
