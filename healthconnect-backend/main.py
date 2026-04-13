from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from config import settings
import datetime

# Backend deployment fix - reverted to stable version
# required routers
from routers import users
from routers import otp as otp_router
from routers import auth as auth_router
from routers import auth_debug as auth_debug_router

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
    from routers import webrtc
    print("[STARTUP] WebRTC router imported successfully")
except Exception as e:
    print(f"[STARTUP] WebRTC router import failed: {e}")
    webrtc = None

app = FastAPI(title="HealthConnect")

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

# mount users router at both common prefixes to handle frontend path differences
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(users.router, prefix="/users", tags=["Users"])

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
        print("[startup] Ensuring database tables exist (create_all)...")
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            print(f"[startup] create_all failed: {e}")

        # If using SQLite (common in dev), add missing columns with ALTER TABLE (create_all won't alter existing tables)
        try:
            dialect_name = engine.dialect.name
            print(f"[startup] DB dialect: {dialect_name}")
            if dialect_name == "sqlite":
                with engine.connect() as conn:
                    # get existing column names for users table
                    pragma = conn.execute(text("PRAGMA table_info('users')"))
                    existing = {row['name'] for row in pragma.mappings()}
                    added = []
                    if 'age' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN age INTEGER"))
                        added.append('age')
                    if 'gender' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN gender VARCHAR"))
                        added.append('gender')
                    if 'bloodgroup' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN bloodgroup VARCHAR"))
                        added.append('bloodgroup')
                    if 'allergy' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN allergy VARCHAR"))
                        added.append('allergy')
                    if 'abha_id' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN abha_id VARCHAR"))
                        added.append('abha_id')
                    if 'dob' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN dob VARCHAR"))
                        added.append('dob')
                    if 'phone' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR"))
                        added.append('phone')
                    if 'emergency_contact' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN emergency_contact VARCHAR"))
                        added.append('emergency_contact')
                    if 'profile_picture_url' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR"))
                        added.append('profile_picture_url')
                    if 'reset_token' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN reset_token VARCHAR"))
                        added.append('reset_token')
                    if 'reset_token_expiry' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN reset_token_expiry DATETIME"))
                        added.append('reset_token_expiry')
                    # New doctor profile fields
                    if 'full_name' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR"))
                        added.append('full_name')
                    if 'specialization' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN specialization VARCHAR"))
                        added.append('specialization')
                    if 'years_of_experience' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN years_of_experience INTEGER"))
                        added.append('years_of_experience')
                    if 'languages_spoken' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN languages_spoken VARCHAR"))
                        added.append('languages_spoken')
                    if 'license_number' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN license_number VARCHAR"))
                        added.append('license_number')
                    if 'registration_number' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN registration_number VARCHAR"))
                        added.append('registration_number')
                    if 'hospital_name' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN hospital_name VARCHAR"))
                        added.append('hospital_name')
                    if 'license_status' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN license_status VARCHAR"))
                        added.append('license_status')
                    if 'license_valid_till' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN license_valid_till VARCHAR"))
                        added.append('license_valid_till')
                    if 'date_of_birth' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN date_of_birth VARCHAR"))
                        added.append('date_of_birth')
                    if 'blood_group' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN blood_group VARCHAR"))
                        added.append('blood_group')
                    if 'created_at' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN created_at DATETIME"))
                        added.append('created_at')
                    if 'updated_at' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN updated_at DATETIME"))
                        added.append('updated_at')
                    conn.commit()
                    if added:
                        print(f"[startup] Added missing user columns: {added}")
                    else:
                        print("[startup] No missing user columns")
                    # Ensure prescription table has latest columns
                    pragma_presc = conn.execute(text("PRAGMA table_info('prescriptions')"))
                    existing_presc = {row['name'] for row in pragma_presc.mappings()}
                    presc_added = []
                    if 'pdf_url' not in existing_presc:
                        conn.execute(text("ALTER TABLE prescriptions ADD COLUMN pdf_url VARCHAR"))
                        presc_added.append('pdf_url')
                    if 'created_at' not in existing_presc:
                        conn.execute(text("ALTER TABLE prescriptions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
                        presc_added.append('created_at')
                    if presc_added:
                        print(f"[startup] Added missing prescription columns: {presc_added}")
            elif dialect_name in ("postgresql", "postgres"):
                with engine.connect() as conn:
                    rows = conn.execute(
                        text(
                            "SELECT column_name FROM information_schema.columns "
                            "WHERE table_name = 'users'"
                        )
                    ).fetchall()
                    existing = {row[0] for row in rows}
                    added = []
                    if 'reset_token' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN reset_token VARCHAR"))
                        added.append('reset_token')
                    if 'reset_token_expiry' not in existing:
                        conn.execute(text("ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMP"))
                        added.append('reset_token_expiry')
                    conn.commit()
                    if added:
                        print(f"[startup] Added missing user reset columns (postgres): {added}")
                    else:
                        print("[startup] Postgres reset columns already present")
            else:
                print("[startup] Non-sqlite/non-postgres DB detected — run Alembic migrations to update schema if needed.")
        except Exception as e:
            print(f"[startup] Failed to ensure user columns: {e}")

except Exception as e:
    print(f"[startup] Warning: create_all failed or skipped: {e}")

# If you run main directly for local dev
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
