from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# required routers
from routers import users
from routers import otp as otp_router

# optional routers - import if available to avoid import errors during startup
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
except Exception:
    webrtc = None

app = FastAPI(title="HealthConnect")

# CORS configuration with secure defaults
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://medtech-4rjc.onrender.com", "https://medtech-hcmo.onrender.com"],  # Production and local development URLs
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    expose_headers=["Content-Length"],
    max_age=600  # Cache preflight requests for 10 minutes
)

# mount users router at both common prefixes to handle frontend path differences
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(users.router, prefix="/users", tags=["Users"])

# Ensure OTP endpoints available at /api and root (already returning debug_otp when needed)
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

# optional: root health-check
@app.get("/")
def root():
    return {"status": "ok"}

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
            else:
                # Non-SQLite DBs: instruct user to run proper migrations
                print("[startup] Non-sqlite DB detected — run Alembic migrations to update schema if needed.")
        except Exception as e:
            print(f"[startup] Failed to ensure user columns: {e}")

except Exception as e:
    print(f"[startup] Warning: create_all failed or skipped: {e}")

# If you run main directly for local dev
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
