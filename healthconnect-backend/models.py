from sqlalchemy import Column, Integer, String, Date, ForeignKey, Boolean, DateTime, func
from sqlalchemy.orm import relationship
from database import Base

class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"))
    date = Column(String)  # Store as ISO string for simplicity
    time = Column(String)  # Store as string (e.g., '14:30')
    reason = Column(String, default="")

    patient = relationship("User", foreign_keys=[patient_id])

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, nullable=True)

    # legacy fields (kept for backward compatibility)
    allergies = Column(String, nullable=True)
    medications = Column(String, nullable=True)
    surgeries = Column(String, nullable=True)

    # NEW profile fields requested
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    bloodgroup = Column(String, nullable=True)
    allergy = Column(String, nullable=True)  # singular allergy field used by frontend
    profile_picture_url = Column(String, nullable=True)  # URL to user's profile picture

class Prescription(Base):
    __tablename__ = "prescriptions"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"))
    doctor_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date)
    diagnosis = Column(String)
    instruction = Column(String)
    medications = Column(String)  # JSON string

    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("User", foreign_keys=[doctor_id])

class OTP(Base):
    __tablename__ = "otps"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    code = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
