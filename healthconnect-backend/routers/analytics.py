from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract
from database import SessionLocal
from datetime import datetime, timedelta
import schemas
from models import Prescription, User, Feedback, Notification

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/doctor/{doctor_id}")
def get_doctor_analytics(doctor_id: int, db: Session = Depends(get_db)):
    """Get analytics dashboard for a doctor"""
    doctor = db.query(User).filter(User.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Get current month (to reset ratings monthly)
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Total patients this month
    total_patients_query = db.query(func.count(func.distinct(Prescription.patient_id))).filter(
        and_(
            Prescription.doctor_id == doctor_id,
            Prescription.created_at >= month_start
        )
    )
    total_patients = total_patients_query.scalar() or 0
    
    # Prescriptions issued this month
    prescriptions_count = db.query(func.count(Prescription.id)).filter(
        and_(
            Prescription.doctor_id == doctor_id,
            Prescription.created_at >= month_start
        )
    ).scalar() or 0
    
    # Avg consultation time (placeholder - not storing actual consultation time in this model)
    avg_consultation_time = 15  # Static for now
    
    # Patient satisfaction (average rating from feedback this month)
    avg_rating = db.query(func.avg(Feedback.rating)).filter(
        and_(
            Feedback.doctor_id == doctor_id,
            Feedback.created_at >= month_start
        )
    ).scalar()
    patient_satisfaction = round(avg_rating, 1) if avg_rating else 0
    
    # Common diagnoses this month
    diagnoses = db.query(
        Prescription.diagnosis,
        func.count(Prescription.id).label("count")
    ).filter(
        and_(
            Prescription.doctor_id == doctor_id,
            Prescription.created_at >= month_start
        )
    ).group_by(Prescription.diagnosis).order_by(
        func.count(Prescription.id).desc()
    ).limit(5).all()
    
    common_diagnoses = []
    total_diagnosis_count = sum(d[1] for d in diagnoses) if diagnoses else 1
    for diagnosis, count in diagnoses:
        percentage = round((count / total_diagnosis_count * 100)) if total_diagnosis_count > 0 else 0
        common_diagnoses.append({
            "diagnosis": diagnosis,
            "cases": count,
            "percentage": percentage
        })
    
    # Patient feedback (with names and ratings) this month
    feedback_records = db.query(Feedback, User).filter(
        and_(
            Feedback.doctor_id == doctor_id,
            Feedback.created_at >= month_start,
            Feedback.patient_id == User.id
        )
    ).order_by(Feedback.created_at.desc()).limit(10).all()
    
    patient_feedback = []
    for feedback, patient in feedback_records:
        patient_feedback.append({
            "patient_name": patient.name or "Anonymous",
            "rating": feedback.rating,
            "feedback_text": feedback.feedback_text or "",
            "created_at": feedback.created_at.isoformat() if feedback.created_at else None
        })
    
    # Calculate month-over-month changes
    prev_month_start = month_start - timedelta(days=1)
    prev_month_start = prev_month_start.replace(day=1)
    
    prev_patients = db.query(func.count(func.distinct(Prescription.patient_id))).filter(
        and_(
            Prescription.doctor_id == doctor_id,
            Prescription.created_at >= prev_month_start,
            Prescription.created_at < month_start
        )
    ).scalar() or 0
    
    prev_prescriptions = db.query(func.count(Prescription.id)).filter(
        and_(
            Prescription.doctor_id == doctor_id,
            Prescription.created_at >= prev_month_start,
            Prescription.created_at < month_start
        )
    ).scalar() or 0
    
    prev_avg_rating = db.query(func.avg(Feedback.rating)).filter(
        and_(
            Feedback.doctor_id == doctor_id,
            Feedback.created_at >= prev_month_start,
            Feedback.created_at < month_start
        )
    ).scalar()
    prev_patient_satisfaction = round(prev_avg_rating, 1) if prev_avg_rating else 0
    
    # Calculate percentage changes
    patient_change = ((total_patients - prev_patients) / prev_patients * 100) if prev_patients > 0 else 0
    prescription_change = ((prescriptions_count - prev_prescriptions) / prev_prescriptions * 100) if prev_prescriptions > 0 else 0
    satisfaction_change = patient_satisfaction - prev_patient_satisfaction
    
    return {
        "doctor_id": doctor_id,
        "doctor_name": doctor.name,
        "total_patients_this_month": total_patients,
        "patient_change_percent": round(patient_change, 1),
        "avg_consultation_time": f"{avg_consultation_time}min",
        "consultation_time_change": "+2min",  # Static for now
        "patient_satisfaction": f"{patient_satisfaction}/5",
        "satisfaction_change": round(satisfaction_change, 1),
        "prescriptions_issued": prescriptions_count,
        "prescription_change_percent": round(prescription_change, 1),
        "common_diagnoses": common_diagnoses,
        "patient_feedback": patient_feedback,        # Add metadata for debugging
        "_metadata": {
            "month": month_start.strftime("%B %Y"),
            "total_feedback_count": len(feedback_records),
            "avg_rating_raw": avg_rating,
            "prev_month_patients": prev_patients,
            "prev_month_prescriptions": prev_prescriptions,
        }    }


@router.post("/feedback", response_model=dict)
def submit_feedback(feedback: schemas.FeedbackCreate, db: Session = Depends(get_db)):
    """Submit feedback for a prescription"""
    prescription = db.query(Prescription).filter(Prescription.id == feedback.prescription_id).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    # Validate rating
    if feedback.rating < 1 or feedback.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    try:
        # Create feedback record
        new_feedback = Feedback(
            prescription_id=feedback.prescription_id,
            patient_id=prescription.patient_id,
            doctor_id=prescription.doctor_id,
            rating=feedback.rating,
            feedback_text=feedback.feedback_text or ""
        )
        db.add(new_feedback)
        db.commit()
        db.refresh(new_feedback)
        
        return {
            "success": True,
            "message": "Feedback submitted successfully",
            "feedback_id": new_feedback.id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error submitting feedback: {str(e)}")
