from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
import schemas
from models import Appointment, User

router = APIRouter(tags=["Appointments"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=schemas.AppointmentResponse)
def create_appointment(appointment: schemas.AppointmentCreate, db: Session = Depends(get_db)):
    # Validate patient
    patient = db.query(User).filter(User.id == appointment.patient_id, User.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=400, detail="Invalid patient ID")
    new_appointment = Appointment(
        patient_id=appointment.patient_id,
        date=appointment.date,
        time=appointment.time,
        reason=appointment.reason or ""
    )
    db.add(new_appointment)
    db.commit()
    db.refresh(new_appointment)
    return new_appointment

@router.get("/patient/{patient_id}", response_model=list[schemas.AppointmentResponse])
def get_appointments_for_patient(patient_id: int, db: Session = Depends(get_db)):
    return db.query(Appointment).filter(Appointment.patient_id == patient_id).all()
