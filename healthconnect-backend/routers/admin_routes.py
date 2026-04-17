from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import User, Consultation, Feedback as Review
import time

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()

    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "location": getattr(u, "location", ""),
            "status": getattr(u, "status", "active"),
            "created_at": u.created_at,
            "profile_pic": getattr(u, "profile_pic", None)
            or getattr(u, "profile_picture_url", None),
        }
        for u in users
    ]


@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    total_users = db.query(func.count(User.id)).scalar()

    active_doctors_query = db.query(func.count(User.id)).filter(User.role == "doctor")
    if hasattr(User, "status"):
        active_doctors_query = active_doctors_query.filter(User.status == "active")
    active_doctors = active_doctors_query.scalar()

    daily_consultations = db.query(func.count(Consultation.id)).filter(
        func.date(Consultation.created_at) == func.current_date()
    ).scalar()

    return {
        "totalUsers": total_users or 0,
        "activeDoctors": active_doctors or 0,
        "dailyConsultations": daily_consultations or 0,
        "uptime": time.time(),
    }


@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    total_consultations = db.query(func.count(Consultation.id)).scalar()

    if hasattr(Consultation, "fee"):
        revenue = db.query(func.sum(Consultation.fee)).scalar()
    else:
        revenue = 0

    satisfaction = db.query(func.avg(Review.rating)).scalar()

    return {
        "totalConsultations": total_consultations or 0,
        "revenue": revenue or 0,
        "satisfaction": satisfaction or 0,
    }
