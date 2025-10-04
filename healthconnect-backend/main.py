from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# required routers
from routers import users
from routers import otp as otp_router

# optional routers - import if available to avoid import errors during startup
prescriptions = None
appointments = None
webrtc = None
try:
    from routers import prescriptions
except Exception:
    prescriptions = None
try:
    from routers import appointments
except Exception:
    appointments = None
try:
    from routers import webrtc
except Exception:
    webrtc = None

app = FastAPI(title="HealthConnect")

# CORS configuration with secure defaults
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Add your production domain when deploying
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
if appointments and hasattr(appointments, "router"):
    app.include_router(appointments.router, prefix="/appointments", tags=["Appointments"])
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
                    if added:
                        print(f"[startup] Added missing user columns: {added}")
                    else:
                        print("[startup] No missing user columns")
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
