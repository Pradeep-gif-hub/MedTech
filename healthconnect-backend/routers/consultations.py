from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime
from database import SessionLocal
from models import Consultation, User
from disease_specialization_map import DISEASE_SPECIALIZATION_MAP

router = APIRouter(tags=["Consultations"], prefix="/api")

SPECIALIZATION_ALIASES = {
    "General Medicine": ["general medicine", "general physician", "family medicine", "internal medicine"],
    "Cardiology": ["cardiology", "cardiologist", "heart specialist"],
    "Respiratory": ["respiratory", "pulmonology", "pulmonologist", "chest specialist"],
    "Neurology": ["neurology", "neurologist", "brain specialist"],
    "Dermatology": ["dermatology", "dermatologist", "skin specialist"],
}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _normalize_text(value: str | None) -> str:
    return " ".join((value or "").strip().lower().replace("&", " and ").split())


def _match_specialization(condition: str | None) -> str | None:
    if not condition:
        return None

    if condition in DISEASE_SPECIALIZATION_MAP:
        return DISEASE_SPECIALIZATION_MAP[condition]

    normalized_condition = _normalize_text(condition)

    for disease, specialization in DISEASE_SPECIALIZATION_MAP.items():
        if _normalize_text(disease) == normalized_condition:
            return specialization

    keyword_rules = [
        ("heart", "Cardiology"),
        ("card", "Cardiology"),
        ("hypert", "Cardiology"),
        ("asthma", "Respiratory"),
        ("respir", "Respiratory"),
        ("lung", "Respiratory"),
        ("skin", "Dermatology"),
        ("derma", "Dermatology"),
        ("rash", "Dermatology"),
        ("neuro", "Neurology"),
        ("migraine", "Neurology"),
        ("mental", "General Medicine"),
        ("fever", "General Medicine"),
        ("cold", "General Medicine"),
        ("cough", "General Medicine"),
        ("diabet", "General Medicine"),
    ]
    for keyword, specialization in keyword_rules:
        if keyword in normalized_condition:
            return specialization

    return "General Medicine"


def _is_specialization_match(doctor_specialization: str | None, target_specialization: str | None) -> bool:
    doctor_norm = _normalize_text(doctor_specialization)
    target_norm = _normalize_text(target_specialization)
    if not doctor_norm or not target_norm:
        return False

    if doctor_norm == target_norm:
        return True

    target_aliases = [_normalize_text(x) for x in SPECIALIZATION_ALIASES.get(target_specialization or "", [])]
    if doctor_norm in target_aliases:
        return True

    for canonical, aliases in SPECIALIZATION_ALIASES.items():
        alias_norms = [_normalize_text(x) for x in aliases]
        if doctor_norm in alias_norms and target_norm == _normalize_text(canonical):
            return True

    return False


def _find_doctor_for_specialization(db: Session, specialization: str | None) -> User | None:
    if not specialization:
        return None

    doctors = db.query(User).filter(User.role == "doctor").all()
    if not doctors:
        return None

    matched_doctors = [d for d in doctors if _is_specialization_match(d.specialization, specialization)]
    if not matched_doctors:
        return None

    # Basic load balancing: doctor with least active consultations is picked.
    def active_count(doctor_id: int) -> int:
        return db.query(Consultation).filter(
            Consultation.doctor_id == doctor_id,
            Consultation.status.in_(["waiting", "in-progress"]),
        ).count()

    matched_doctors.sort(key=lambda doctor: (active_count(doctor.id), doctor.id))
    return matched_doctors[0]


async def resolve_current_patient(request: Request, db: Session) -> User:
    auth_header = request.headers.get("Authorization") or ""
    user = None

    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        if token.startswith("local:"):
            raw_user_id = token.replace("local:", "", 1)
            if raw_user_id.isdigit():
                user = db.query(User).filter(User.id == int(raw_user_id)).first()

    if not user:
        user_id_header = request.headers.get("X-User-Id")
        if user_id_header and str(user_id_header).isdigit():
            user = db.query(User).filter(User.id == int(user_id_header)).first()

    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if user.role != "patient":
        raise HTTPException(status_code=403, detail="Access restricted to patients only")

    return user


def _serialize_doctor(doctor: User | None) -> dict | None:
    if not doctor:
        return None

    display_name = (doctor.full_name or doctor.name or "Doctor").strip()
    if not display_name.lower().startswith("dr"):
        display_name = f"Dr. {display_name}"

    return {
        "id": doctor.id,
        "name": display_name,
        "specialization": doctor.specialization or "General Medicine",
        "avatar": doctor.profile_picture_url,
        "email": doctor.email,
    }


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
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Verify user is a doctor
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="Access restricted to doctors only")

    return user


@router.post("/consultations", response_model=dict)
@router.post("/consultation", response_model=dict)
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
        patient_id = consultation_data.get("patient_id") or consultation_data.get("patientId")
        disease = consultation_data.get("disease") or consultation_data.get("condition")
        symptoms = consultation_data.get("symptoms")
        duration = consultation_data.get("duration")
        appointment_time = consultation_data.get("appointment_time")

        if not patient_id:
            raise HTTPException(status_code=400, detail="patient_id is required")

        if not disease:
            raise HTTPException(status_code=400, detail="condition/disease is required")

        # Validate patient exists
        patient = db.query(User).filter(User.id == patient_id, User.role == "patient").first()
        if not patient:
            raise HTTPException(status_code=400, detail="Invalid patient ID")

        specialization = _match_specialization(disease)
        matching_doctor = _find_doctor_for_specialization(db, specialization)
        print(f"[CONSULTATION] Requested condition={disease}, mapped_specialization={specialization}")
        print("Assigned doctor:", {
            "id": matching_doctor.id,
            "name": matching_doctor.full_name or matching_doctor.name,
            "specialization": matching_doctor.specialization,
        } if matching_doctor else None)

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
            "status": "assigned" if matching_doctor else "pending",
            "room_id": f"consultation-{new_consultation.id}",
            "doctor": _serialize_doctor(matching_doctor),
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
                    "patient_email": patient.email,
                    "age": patient.age,
                    "appointment_time": consultation.appointment_time,
                    "disease": consultation.disease,
                    "symptoms": consultation.symptoms,
                    "duration": consultation.duration,
                    "status": consultation.status,
                    "room_id": f"consultation-{consultation.id}",
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

        return {
            "id": consultation.id,
            "patient_id": consultation.patient_id,
            "patient_name": patient.full_name or patient.name if patient else None,
            "doctor_id": consultation.doctor_id,
            "doctor_name": doctor.full_name or doctor.name if doctor else None,
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


@router.get("/consultation/current", response_model=dict)
@router.get("/consultations/current", response_model=dict)
async def get_current_patient_consultation(request: Request, db: Session = Depends(get_db)):
    patient = await resolve_current_patient(request, db)

    consultation = db.query(Consultation).filter(
        Consultation.patient_id == patient.id,
        Consultation.status.in_(["waiting", "in-progress"]),
    ).order_by(Consultation.created_at.desc()).first()

    if not consultation:
        return {
            "status": "none",
            "consultation_id": None,
            "doctor": None,
            "room_id": None,
        }

    doctor = db.query(User).filter(User.id == consultation.doctor_id).first() if consultation.doctor_id else None
    payload = {
        "status": "assigned" if doctor else "pending",
        "consultation_id": consultation.id,
        "condition": consultation.disease,
        "symptoms": consultation.symptoms,
        "duration": consultation.duration,
        "doctor": _serialize_doctor(doctor),
        "room_id": f"consultation-{consultation.id}",
        "created_at": consultation.created_at.isoformat() if consultation.created_at else None,
    }
    print("Consultation:", payload)
    return payload
