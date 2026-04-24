from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from config import settings
import datetime
import json
import os

from database import SessionLocal
from models import Prescription, User, Visitor, VisitorCounter

# Backend deployment fix - reverted to stable version
# required routers
from routers import users
from routers import otp as otp_router
from routers import auth as auth_router
from routers import auth_debug as auth_debug_router
from routers import admin_routes as admin_router

# optional routers - import if available to avoid import errors during startup
doctors = None
consultations = None
try:
    from routers import doctors
except Exception:
    doctors = None
try:
    from routers import consultations
except Exception:
    consultations = None
prescriptions = None
appointments = None
webrtc = None
analytics = None
pharmacy = None
orders = None
try:
    from routers import prescriptions
except Exception:
    prescriptions = None
notifications = None
try:
    from routers import notifications
except Exception:
    notifications = None
try:
    from routers import appointments
except Exception:
    appointments = None
try:
    from routers import analytics
except Exception:
    analytics = None
try:
    from routers import pharmacy
    print("[STARTUP] Pharmacy router imported successfully")
except Exception as e:
    print(f"[STARTUP] Pharmacy router import failed: {e}")
    pharmacy = None
try:
    from routers import orders
    print("[STARTUP] Orders router imported successfully")
except Exception as e:
    print(f"[STARTUP] Orders router import failed: {e}")
    orders = None
try:
    from routers import webrtc
    print("[STARTUP] WebRTC router imported successfully")
except Exception as e:
    print(f"[STARTUP] WebRTC router import failed: {e}")
    webrtc = None

app = FastAPI(title="HealthConnect")


def _safe_str(value, fallback: str = "N/A") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def _normalize_medicines(raw_medicines) -> list[dict]:
    medicines_data = raw_medicines

    if isinstance(medicines_data, str):
        try:
            medicines_data = json.loads(medicines_data)
        except Exception:
            medicines_data = [line.strip() for line in medicines_data.split("\n") if line.strip()]

    if not isinstance(medicines_data, list):
        medicines_data = [medicines_data] if medicines_data else []

    normalized: list[dict] = []
    for item in medicines_data:
        if isinstance(item, dict):
            normalized.append({
                "name": _safe_str(item.get("name") or item.get("medicine"), ""),
                "dose": _safe_str(item.get("dose") or item.get("dosage"), ""),
                "frequency": _safe_str(item.get("frequency"), ""),
                "duration": _safe_str(item.get("duration") or item.get("days"), ""),
            })
            continue

        raw_text = _safe_str(item, "")
        if not raw_text:
            continue
        parts = [p.strip() for p in raw_text.split("|")]
        normalized.append({
            "name": parts[0] if len(parts) > 0 else raw_text,
            "dose": parts[1] if len(parts) > 1 else "",
            "frequency": parts[2] if len(parts) > 2 else "",
            "duration": parts[3] if len(parts) > 3 else "",
        })

    return normalized

# CORS configuration - CRITICAL: Must be first middleware
# Allow all origins in development, restrict in production
cors_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "https://medtech-4rjc.onrender.com",
    "https://medtech-hcmo.onrender.com",
]

print("[STARTUP] Configuring CORS with origins:", cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods including OPTIONS
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],
    max_age=3600  # Cache preflight requests for 1 hour
)

# Health check endpoint - tests CORS and general connectivity
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "backend": "FastAPI",
        "cors_enabled": True,
        "timestamp": str(datetime.datetime.now(datetime.timezone.utc))
    }


@app.get("/api/prescription/{prescription_id}")
async def get_prescription_payload(prescription_id: int):
    db = SessionLocal()
    try:
        prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
        if not prescription:
            raise HTTPException(status_code=404, detail="Prescription not found")

        patient = db.query(User).filter(User.id == prescription.patient_id).first() if prescription.patient_id else None
        doctor = db.query(User).filter(User.id == prescription.doctor_id).first() if prescription.doctor_id else None

        prescription_date = None
        if prescription.created_at:
            prescription_date = prescription.created_at.isoformat()
        elif prescription.date:
            prescription_date = str(prescription.date)

        response = {
            "patient": {
                "id": _safe_str(patient.id if patient else prescription.patient_id, "N/A"),
                "name": _safe_str((patient.full_name if patient and patient.full_name else None) or (patient.name if patient else None), "N/A"),
                "age": patient.age if patient and patient.age is not None else None,
                "gender": _safe_str(patient.gender if patient else None, ""),
            },
            "doctor": {
                "name": _safe_str((doctor.full_name if doctor and doctor.full_name else None) or (doctor.name if doctor else None), "N/A"),
                "specialization": _safe_str(doctor.specialization if doctor else None, ""),
                "hospital": _safe_str(doctor.hospital_name if doctor else None, ""),
            },
            "prescription": {
                "id": prescription.id,
                "reportId": f"RX-{prescription.id}",
                "diagnosis": _safe_str(prescription.diagnosis, ""),
                "notes": _safe_str(prescription.instruction, ""),
                "date": prescription_date,
            },
            "medicines": _normalize_medicines(prescription.medications),
        }

        return response
    finally:
        db.close()

# mount users router at both common prefixes to handle frontend path differences
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(users.router, prefix="/users", tags=["Users"])

# admin routes for dashboard, users and analytics
app.include_router(admin_router.router)

# dedicated auth routes
app.include_router(auth_router.router, prefix="/auth", tags=["Auth"])
app.include_router(auth_router.router, prefix="/api/auth", tags=["Auth"])

# debug auth routes
app.include_router(auth_debug_router.router, prefix="/auth-debug", tags=["Auth-Debug"])
app.include_router(auth_debug_router.router, prefix="/api/auth-debug", tags=["Auth-Debug"])

# mount doctors router
if doctors and hasattr(doctors, "router"):
    app.include_router(doctors.router)

# mount consultations router
if consultations and hasattr(consultations, "router"):
    app.include_router(consultations.router, tags=["Consultations"])

# Ensure OTP endpoints are available at /api and root.
app.include_router(otp_router.router, prefix="/api", tags=["OTP"])
app.include_router(otp_router.router, prefix="", tags=["OTP"])

# mount optional routers if available
if prescriptions and hasattr(prescriptions, "router"):
    app.include_router(prescriptions.router, prefix="/prescriptions", tags=["Prescriptions"])
    app.include_router(prescriptions.router, prefix="/api/prescriptions", tags=["Prescriptions"])
if notifications and hasattr(notifications, "router"):
    app.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
    app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
if appointments and hasattr(appointments, "router"):
    app.include_router(appointments.router, prefix="/appointments", tags=["Appointments"])
if pharmacy and hasattr(pharmacy, "router"):
    app.include_router(pharmacy.router)
    print("[STARTUP] Pharmacy router mounted at /api/pharmacy/*")
if orders and hasattr(orders, "router"):
    app.include_router(orders.router)
    print("[STARTUP] Orders router mounted at /api/orders, /api/analytics")
if analytics and hasattr(analytics, "router"):
    app.include_router(analytics.router, tags=["Analytics"])
if webrtc and hasattr(webrtc, "router"):
    app.include_router(webrtc.router, prefix="/webrtc", tags=["WebRTC"])
    print("[STARTUP] WebRTC route mounted at /webrtc/ws/live-consultation/{role}")
else:
    print("[STARTUP] WebRTC router NOT mounted")

# optional: root health-check
@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/test-email")
def test_email(email: str):
    try:
        from utils.email_utils import send_test_email, get_last_email_error

        sent = send_test_email(email)
        if sent:
            return {
                "success": True,
                "message": "Test email sent successfully",
                "provider": "brevo_smtp",
                "to": email,
            }

        return {
            "success": False,
            "message": "Failed to send test email",
            "provider": "brevo_smtp",
            "to": email,
            "error": get_last_email_error() or "Email delivery failed",
        }
    except Exception as e:
        return {
            "success": False,
            "message": "Failed to send test email",
            "provider": "brevo_smtp",
            "to": email,
            "error": str(e),
        }


def _extract_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host.strip()
    return "unknown"


@app.post("/api/track-visitor")
def track_visitor(request: Request):
    ip_address = _extract_client_ip(request)

    if ip_address in {"127.0.0.1", "::1", "localhost", "unknown"}:
        return {"message": "skipped-local"}

    db = SessionLocal()
    try:
        exists = db.query(Visitor).filter(Visitor.ip_address == ip_address).first()
        if not exists:
            db.add(Visitor(ip_address=ip_address))
            db.commit()
        return {"message": "tracked"}
    finally:
        db.close()


@app.post("/api/track-visit")
def track_visit():
    """
    Track total page visits. Increments global visitor counter.
    Called on every page load/refresh from frontend.
    """
    db = SessionLocal()
    try:
        counter = db.query(VisitorCounter).first()
        if not counter:
            counter = VisitorCounter(total_visits=0)
            db.add(counter)

        counter.total_visits += 1
        db.commit()
        db.refresh(counter)

        return {"totalVisitors": counter.total_visits}
    except Exception as e:
        print(f"[TRACK-VISIT] Error incrementing counter: {e}")
        return {"totalVisitors": 0}
    finally:
        db.close()


@app.on_event("startup")
def log_email_config_startup():
    print("SMTP_SERVER loaded:", bool(settings.SMTP_SERVER))
    print("SMTP_PORT:", (settings.SMTP_PORT or "").strip() or "not set")
    print("SMTP_USER loaded:", bool(settings.SMTP_USER))
    print("SMTP_PASS loaded:", bool(settings.SMTP_PASS))
    print("FROM_EMAIL loaded:", bool(settings.FROM_EMAIL))

# NEW: create DB tables/columns at startup for local dev (runs once on app start)
# This uses the same Base/engine as your models; it's convenient for development.
try:
    # import here to avoid circular import at module load time
    from database import engine, Base
    import models  # ensure models are imported so metadata contains all tables
    from sqlalchemy import text

    @app.on_event("startup")
    def create_tables_on_startup():
        print("\n" + "="*70)
        print("🚀 DATABASE STARTUP SEQUENCE")
        print("="*70)
        
        # Verify PostgreSQL is being used
        dialect_name = engine.dialect.name
        print(f"📍 Database Dialect: {dialect_name.upper()}")
        if dialect_name != "postgresql":
            raise Exception(f"❌ CRITICAL: Expected PostgreSQL, got {dialect_name}! SQLite fallback detected!")
        
        # Create all tables
        print("[startup] Creating database tables...")
        try:
            Base.metadata.create_all(bind=engine)
            print("✅ Tables created/verified in PostgreSQL")
        except Exception as e:
            print(f"❌ create_all failed: {e}")
            raise

        # Ensure required columns exist in existing PostgreSQL tables (create_all does not alter tables)
        print("[startup] Verifying critical prescription and user columns...")
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'pending'"))
                conn.execute(text("ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pharmacy_status VARCHAR DEFAULT 'pending'"))
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR"))
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS license_number VARCHAR"))
            print("✅ Database columns verified (status, pharmacy_status, vehicle_number, license_number)")
        except Exception as e:
            print(f"⚠️  Failed to verify database columns: {e}")

        # Sync PostgreSQL sequences with max(id) to prevent duplicate key errors after migrations/imports
        print("[startup] Verifying PostgreSQL sequences...")
        try:
            with engine.begin() as conn:
                for table_name in ["users", "prescriptions", "inventory", "notifications", "visitors", "visitor_counter", "orders", "order_items"]:
                    conn.execute(
                        text(
                            """
                            SELECT setval(
                                pg_get_serial_sequence(:table_name, 'id'),
                                COALESCE((SELECT MAX(id) FROM public.""" + table_name + """), 0) + 1,
                                false
                            )
                            """
                        ),
                        {"table_name": f"public.{table_name}"},
                    )
            print("✅ PostgreSQL sequences synced")
        except Exception as e:
            print(f"⚠️  Failed to sync PostgreSQL sequences: {e}")

        # Force activate selected users for admin recovery scenarios
        print("[startup] Configuring admin accounts...")
        try:
            force_activate_emails = [
                "pradeepkumarawasthi67@gmail.com",
                "pradeepka.ic.24@nitj.ac.in",
                "pawasthi063@gmail.com",
            ]
            db = SessionLocal()
            try:
                for email in force_activate_emails:
                    user = db.query(User).filter(User.email == email).first()
                    if user and hasattr(user, "status"):
                        user.status = "active"
                db.commit()
                print("✅ Admin accounts configured")
            finally:
                db.close()
        except Exception as e:
            print(f"⚠️  Failed to configure admin accounts: {e}")

        # Initialize visitor counter if not exists
        print("[startup] Initializing visitor counter...")
        try:
            db = SessionLocal()
            try:
                counter = db.query(VisitorCounter).first()
                if not counter:
                    counter = VisitorCounter(total_visits=0)
                    db.add(counter)
                    db.commit()
                    print("✅ VisitorCounter initialized (total_visits=0)")
                else:
                    print(f"✅ VisitorCounter exists (total_visits={counter.total_visits})")
            finally:
                db.close()
        except Exception as e:
            print(f"⚠️  Failed to initialize VisitorCounter: {e}")

        # Enforce single trusted admin account at startup
        print("[startup] Enforcing admin policy...")
        try:
            trusted_admin_email = (os.getenv("ADMIN_EMAIL") or "").strip().lower()
            if not trusted_admin_email:
                print("[startup] ADMIN_EMAIL not configured; skipping enforcement")
            else:
                db = SessionLocal()
                try:
                    admins = db.query(User).filter(User.role == "admin").all()
                    updated = 0
                    for admin in admins:
                        if (admin.email or "").strip().lower() != trusted_admin_email:
                            admin.role = "patient"
                            updated += 1
                    if updated:
                        db.commit()
                    print(f"✅ Single-admin enforcement completed (adjusted={updated})")
                finally:
                    db.close()
        except Exception as e:
            print(f"⚠️  Failed to enforce admin policy: {e}")
        
        print("="*70)
        print("🚀 DATABASE STARTUP COMPLETE - POSTGRESQL ACTIVE")
        print("="*70 + "\n")

except Exception as e:
    print(f"[startup] Warning: create_all failed or skipped: {e}")

# If you run main directly for local dev
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
