from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
import schemas
from models import Prescription, User


router = APIRouter(tags=["Prescriptions"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



@router.post("/")
def create_prescription(
    prescription: schemas.PrescriptionCreate,
    db: Session = Depends(get_db)
):
    # Validate users
    patient = db.query(User).filter(User.id == prescription.patient_id, User.role == "patient").first()
    doctor = db.query(User).filter(User.id == prescription.doctor_id, User.role == "doctor").first()
    if not patient or not doctor:
        raise HTTPException(status_code=400, detail="Invalid patient or doctor ID")

    # Store medications as JSON string
    import json
    medications_json = json.dumps(prescription.medications)

    new_prescription = Prescription(
        patient_id=prescription.patient_id,
        doctor_id=prescription.doctor_id,
        diagnosis=prescription.diagnosis,
        instruction=prescription.instruction or "",
        medications=medications_json
    )
    db.add(new_prescription)
    db.commit()
    db.refresh(new_prescription)
    return {"message": "Prescription created", "prescription_id": new_prescription.id}
@router.get("/{patient_id}")
def get_prescriptions(patient_id: int, db: Session = Depends(get_db)):
    prescriptions = db.query(Prescription).filter(
        Prescription.patient_id == patient_id
    ).all()
    return prescriptions
