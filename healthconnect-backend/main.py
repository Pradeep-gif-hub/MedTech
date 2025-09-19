from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.orm import Session
from database import Base, engine
from routers import users, prescriptions, appointments, webrtc


# Ensure all tables are created
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Allow frontend (React) to access backend
origins = [
    "http://localhost:5173",  # Vite dev server
    "http://127.0.0.1:5173",
    "http://localhost:3000",  # React default
    "http://127.0.0.1:3000",
    "https://27428d645d7c.ngrok-free.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # allow all methods POST, GET, OPTIONS...
    allow_headers=["*"],
)

# Include routers
app.include_router(users.router, prefix="/users")
app.include_router(prescriptions.router, prefix="/prescriptions")
app.include_router(appointments.router, prefix="/appointments")
app.include_router(webrtc.router)
