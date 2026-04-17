from datetime import datetime, timedelta, timezone
from calendar import month_abbr
import os
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import User, Consultation, Feedback as Review, PlatformSettings, Visitor
from passlib.context import CryptContext
import time

router = APIRouter(prefix="/api/admin", tags=["Admin"])

class AdminLoginRequest(BaseModel):
    email: str
    password: str

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
LOCAL_TOKEN_PREFIX = "local:"


def _admin_email() -> str:
    return (os.getenv("ADMIN_EMAIL") or "").strip().lower()


def _admin_password() -> str:
    return (os.getenv("ADMIN_PASSWORD") or "").strip()


def _as_utc_iso(dt: datetime | None) -> str | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _as_ist_iso(dt: datetime | None) -> str | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return dt.astimezone(ist_tz).isoformat()


def _build_local_token(user_id: int) -> str:
    return f"{LOCAL_TOKEN_PREFIX}{user_id}"


def _ensure_single_admin(db: Session) -> None:
    trusted_email = _admin_email()
    if not trusted_email:
        return

    admins = db.query(User).filter(User.role == "admin").all()

    changed = False
    for user in admins:
        if (user.email or "").strip().lower() != trusted_email:
            user.role = "patient"
            changed = True

    if changed:
        db.commit()


def require_admin(request: Request, db: Session = Depends(get_db)) -> User:
    auth_header = request.headers.get("Authorization") or ""
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Admin authentication required")

    token = auth_header.split(" ", 1)[1].strip()
    user = None

    if token.startswith(LOCAL_TOKEN_PREFIX):
        raw_user_id = token.replace(LOCAL_TOKEN_PREFIX, "", 1)
        if raw_user_id.isdigit():
            user = db.query(User).filter(User.id == int(raw_user_id)).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid admin token")

    _ensure_single_admin(db)
    if (user.role or "").strip().lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    return user


@router.post("/login")
def admin_login(request: AdminLoginRequest, db: Session = Depends(get_db)):
    configured_email = _admin_email()
    configured_password = _admin_password()
    if not configured_email or not configured_password:
        raise HTTPException(status_code=500, detail="Admin credentials are not configured")

    email = (request.email or "").strip().lower()
    password = (request.password or "").strip()

    if not secrets.compare_digest(email, configured_email) or not secrets.compare_digest(password, configured_password):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

    _ensure_single_admin(db)

    admin = db.query(User).filter(func.lower(User.email) == configured_email).first()
    if not admin:
        admin = User(
            email=configured_email,
            name="Admin",
            role="admin",
            password=pwd_context.hash(configured_password[:72]),
            status="active",
            created_at=datetime.now(timezone.utc),
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
    else:
        changed = False
        if (admin.role or "").strip().lower() != "admin":
            admin.role = "admin"
            changed = True
        if hasattr(admin, "status") and (admin.status or "").strip().lower() != "active":
            admin.status = "active"
            changed = True
        if changed:
            db.commit()
            db.refresh(admin)

    return {
        "token": _build_local_token(admin.id),
        "admin": {
            "id": admin.id,
            "email": admin.email,
            "name": admin.name or "Admin",
            "role": "admin",
        },
    }


@router.get("/users")
def get_users(
    search: str | None = Query(default=None),
    role: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    query = db.query(User)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter((User.name.ilike(term)) | (User.email.ilike(term)))

    if role:
        query = query.filter(User.role == role)

    if status and hasattr(User, "status"):
        query = query.filter(User.status == status)

    users = query.order_by(User.created_at.desc()).all()

    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "location": getattr(u, "location", ""),
            "status": getattr(u, "status", "active"),
            "created_at": _as_utc_iso(u.created_at),
            "created_at_ist": _as_ist_iso(u.created_at),
            "profile_pic": getattr(u, "profile_pic", None)
            or getattr(u, "profile_picture_url", None),
        }
        for u in users
    ]


def _serialize_user(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "location": getattr(u, "location", ""),
        "status": getattr(u, "status", "active"),
        "created_at": _as_utc_iso(u.created_at),
        "created_at_ist": _as_ist_iso(u.created_at),
        "gender": getattr(u, "gender", None),
        "blood_group": getattr(u, "blood_group", None),
        "bloodgroup": getattr(u, "bloodgroup", None),
        "phone": getattr(u, "phone", None),
        "dob": getattr(u, "dob", None),
        "specialization": getattr(u, "specialization", None),
        "profile_pic": getattr(u, "profile_pic", None)
        or getattr(u, "profile_picture_url", None),
    }


def _get_or_create_settings(db: Session) -> PlatformSettings:
    settings = db.query(PlatformSettings).order_by(PlatformSettings.id.asc()).first()
    if settings:
        return settings

    settings = PlatformSettings(
        platform_name="MedTech",
        support_email="support@healthconnect.com",
        session_timeout=30,
        max_login_attempts=5,
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    settings = _get_or_create_settings(db)
    return {
        "platform_name": settings.platform_name,
        "support_email": settings.support_email,
        "session_timeout": settings.session_timeout,
        "max_login_attempts": settings.max_login_attempts,
        "updated_at": settings.updated_at,
    }


@router.put("/settings")
def update_settings(data: dict, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    settings = _get_or_create_settings(db)

    settings.platform_name = data.get("platform_name", settings.platform_name)
    settings.support_email = data.get("support_email", settings.support_email)

    timeout = data.get("session_timeout", settings.session_timeout)
    attempts = data.get("max_login_attempts", settings.max_login_attempts)

    try:
        settings.session_timeout = max(1, int(timeout))
    except Exception:
        pass

    try:
        settings.max_login_attempts = max(1, int(attempts))
    except Exception:
        pass

    db.commit()
    db.refresh(settings)

    return {
        "message": "Settings updated successfully",
        "settings": {
            "platform_name": settings.platform_name,
            "support_email": settings.support_email,
            "session_timeout": settings.session_timeout,
            "max_login_attempts": settings.max_login_attempts,
            "updated_at": settings.updated_at,
        },
    }


@router.get("/users/{user_id}")
def get_user_by_id(user_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "user": _serialize_user(user)}


@router.put("/users/{user_id}")
def update_user(user_id: int, data: dict, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.name = data.get("name", user.name)
    user.email = data.get("email", user.email)
    requested_role = (data.get("role", user.role) or user.role or "").strip().lower()
    trusted_admin_email = _admin_email()
    user_email = (data.get("email", user.email) or user.email or "").strip().lower()
    if requested_role == "admin" and user_email != trusted_admin_email:
        raise HTTPException(status_code=400, detail="Only the trusted admin account can have admin role")

    user.role = requested_role

    if hasattr(user, "location"):
        setattr(user, "location", data.get("location", getattr(user, "location", "")))
    if hasattr(user, "status"):
        setattr(user, "status", data.get("status", getattr(user, "status", "active")))

    db.commit()
    _ensure_single_admin(db)
    db.refresh(user)
    return {"message": "User updated successfully", "user": _serialize_user(user)}


@router.put("/users/{user_id}/status")
@router.patch("/users/{user_id}/status")
def update_status(
    user_id: int,
    data: dict | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    incoming_status = status or (data or {}).get("status")
    next_status = str(incoming_status or "").strip().lower()
    if next_status not in {"active", "inactive", "pending", "suspended"}:
        raise HTTPException(status_code=400, detail="Invalid status")

    if hasattr(user, "status"):
        setattr(user, "status", next_status)
    db.commit()
    db.refresh(user)
    return {"message": f"User {next_status}", "user": _serialize_user(user)}


@router.get("/recent-users")
def recent_users(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    users = db.query(User).filter(User.created_at >= seven_days_ago).order_by(User.created_at.desc()).all()
    return [_serialize_user(u) for u in users]


@router.get("/specializations")
def get_specializations(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    doctors = db.query(User).filter(User.role == "doctor").all()

    grouped: dict[str, list[dict]] = {}
    for doctor in doctors:
        spec = (getattr(doctor, "specialization", None) or "General").strip() or "General"
        grouped.setdefault(spec, []).append(
            {
                "id": doctor.id,
                "name": doctor.full_name or doctor.name or "Unknown Doctor",
                "email": doctor.email,
            }
        )

    payload = []
    for spec, members in grouped.items():
        payload.append(
            {
                "name": spec,
                "count": len(members),
                "doctors": members,
            }
        )

    payload.sort(key=lambda item: item["count"], reverse=True)
    return payload


@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    total_users = db.query(func.count(User.id)).scalar()

    active_doctors_query = db.query(func.count(User.id)).filter(User.role == "doctor")
    if hasattr(User, "status"):
        active_doctors_query = active_doctors_query.filter(User.status == "active")
    active_doctors = active_doctors_query.scalar()

    daily_consultations = db.query(func.count(Consultation.id)).filter(
        func.date(Consultation.created_at) == func.current_date()
    ).scalar()

    patients = db.query(func.count(User.id)).filter(User.role == "patient").scalar() or 0
    pharmacies = db.query(func.count(User.id)).filter(User.role == "pharmacy").scalar() or 0

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_users = (
        db.query(User)
        .filter(User.created_at >= seven_days_ago)
        .order_by(User.created_at.desc())
        .limit(5)
        .all()
    )

    user_growth = []
    for days_back in range(6, -1, -1):
        day = datetime.now(timezone.utc).date() - timedelta(days=days_back)
        count = (
            db.query(func.count(User.id))
            .filter(func.date(User.created_at) == day)
            .scalar()
            or 0
        )
        user_growth.append({"date": day.isoformat(), "count": int(count)})

    top_specs = (
        db.query(User.specialization, func.count(User.id).label("count"))
        .filter(User.role == "doctor")
        .group_by(User.specialization)
        .order_by(func.count(User.id).desc())
        .limit(5)
        .all()
    )

    alerts = [
        {
            "id": 1,
            "message": "Server restarted successfully",
            "type": "info",
            "created_at": _as_utc_iso(datetime.now(timezone.utc)),
            "created_at_ist": _as_ist_iso(datetime.now(timezone.utc)),
        },
        {
            "id": 2,
            "message": f"High login attempts threshold: {db.query(func.count(User.id)).filter(User.status == 'inactive').scalar() or 0} suspended users",
            "type": "warning",
            "created_at": _as_utc_iso(datetime.now(timezone.utc)),
            "created_at_ist": _as_ist_iso(datetime.now(timezone.utc)),
        },
    ]

    if recent_users:
        latest = recent_users[0]
        alerts.insert(
            0,
            {
                "id": 3,
                "message": f"New {latest.role or 'user'} registered: {latest.name or latest.email}",
                "type": "info",
                "created_at": _as_utc_iso(latest.created_at) or _as_utc_iso(datetime.now(timezone.utc)),
                "created_at_ist": _as_ist_iso(latest.created_at) or _as_ist_iso(datetime.now(timezone.utc)),
            },
        )

    total_visitors = db.query(func.count(Visitor.id)).scalar() or 0

    return {
        "totalUsers": total_users or 0,
        "activeDoctors": active_doctors or 0,
        "patients": patients,
        "pharmacies": pharmacies,
        "dailyConsultations": daily_consultations or 0,
        "totalVisitors": total_visitors,
        "recentUsers": [_serialize_user(u) for u in recent_users],
        "recentRegistrations": [_serialize_user(u) for u in recent_users],
        "userGrowth": user_growth,
        "topSpecializations": [
            {"specialization": spec or "General", "count": int(count)}
            for spec, count in top_specs
        ],
        "alerts": alerts,
        "uptime": time.time(),
        "generated_at": _as_utc_iso(datetime.now(timezone.utc)),
        "generated_at_ist": _as_ist_iso(datetime.now(timezone.utc)),
    }


@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    total_consultations = db.query(func.count(Consultation.id)).scalar()

    if hasattr(Consultation, "fee"):
        revenue = db.query(func.sum(Consultation.fee)).scalar()
    else:
        revenue = 0

    satisfaction = db.query(func.avg(Review.rating)).scalar()

    # Last 7 days consultation counts.
    daily_consultations = []
    for days_back in range(6, -1, -1):
        day = datetime.now(timezone.utc).date() - timedelta(days=days_back)
        count = (
            db.query(func.count(Consultation.id))
            .filter(func.date(Consultation.created_at) == day)
            .scalar()
            or 0
        )
        daily_consultations.append({"date": day.isoformat(), "count": int(count)})

    # Last 6 months consultation volume.
    monthly_growth = []
    now = datetime.now(timezone.utc)
    for months_back in range(5, -1, -1):
        month = (now.month - months_back - 1) % 12 + 1
        year = now.year + ((now.month - months_back - 1) // 12)
        month_count = (
            db.query(func.count(Consultation.id))
            .filter(func.extract("year", Consultation.created_at) == year)
            .filter(func.extract("month", Consultation.created_at) == month)
            .scalar()
            or 0
        )
        monthly_growth.append({"month": f"{month_abbr[month]} {year}", "count": int(month_count)})

    revenue_trend = []
    for item in monthly_growth:
        if hasattr(Consultation, "fee"):
            # Keep month-aligned response shape; fallback to 0 where fee is not populated.
            revenue_value = 0
        else:
            revenue_value = 0
        revenue_trend.append({"month": item["month"], "value": revenue_value})

    return {
        "totalConsultations": total_consultations or 0,
        "revenue": revenue or 0,
        "satisfaction": satisfaction or 0,
        "dailyConsultations": daily_consultations,
        "monthlyGrowth": monthly_growth,
        "revenueTrend": revenue_trend,
    }
