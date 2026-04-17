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


class Consultation(Base):
    __tablename__ = "consultations"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    disease = Column(String, nullable=False)  # Specialization/complaint (e.g., "Cardiology")
    symptoms = Column(String, nullable=True)  # Patient's description of symptoms
    duration = Column(String, nullable=True)  # Duration of illness (e.g., "2 weeks")
    status = Column(String, default="waiting", nullable=False)  # waiting, in-progress, completed
    appointment_time = Column(String, nullable=True)  # Scheduled time
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    patient = relationship("User", foreign_keys=[patient_id], backref="consultations_as_patient")
    doctor = relationship("User", foreign_keys=[doctor_id], backref="consultations_as_doctor")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, nullable=True)
    dob = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    emergency_contact = Column(String, nullable=True)

    # legacy fields (kept for backward compatibility)
    allergies = Column(String, nullable=True)
    medications = Column(String, nullable=True)
    surgeries = Column(String, nullable=True)

    # Patient profile fields
    status = Column(String, nullable=True, default="active")
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    bloodgroup = Column(String, nullable=True)
    abha_id = Column(String, nullable=True)
    allergy = Column(String, nullable=True)  # singular allergy field used by frontend
    profile_pic = Column(String, nullable=True)  # Backward-compatible alias used by admin payloads
    profile_picture_url = Column(String, nullable=True)  # URL to user's profile picture

    # Password reset fields used by legacy flows and compatibility checks.
    reset_token = Column(String, nullable=True)
    reset_token_expiry = Column(DateTime, nullable=True)
    
    # Doctor profile fields
    specialization = Column(String, nullable=True)
    years_of_experience = Column(Integer, nullable=True)
    languages_spoken = Column(String, nullable=True)  # JSON string array
    full_name = Column(String, nullable=True)  # Additional field for doctor full name
    license_number = Column(String, nullable=True, unique=True)
    registration_number = Column(String, nullable=True, unique=True)
    hospital_name = Column(String, nullable=True)
    license_status = Column(String, nullable=True)  # e.g., "Active & Verified"
    license_valid_till = Column(String, nullable=True)  # e.g., "2031"
    date_of_birth = Column(String, nullable=True)  # Same as dob, but explicit for doctors
    blood_group = Column(String, nullable=True)  # Alternative to bloodgroup
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=True)


class UserAuthMeta(Base):
    __tablename__ = "user_auth_meta"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    google_id = Column(String, nullable=True, unique=True, index=True)
    is_google_user = Column(Boolean, default=False, nullable=False)
    profile_completed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    email = Column(String, nullable=False, index=True)
    token = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])

class Prescription(Base):
    __tablename__ = "prescriptions"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"))
    doctor_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date, nullable=True)
    diagnosis = Column(String)
    instruction = Column(String)
    medications = Column(String)  # JSON string
    pdf_url = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("User", foreign_keys=[doctor_id])

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False, default="prescription")
    message = Column(String, nullable=False)
    related_prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    prescription = relationship("Prescription", foreign_keys=[related_prescription_id])

class OTP(Base):
    __tablename__ = "otps"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    code = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class OTPVerificationAttempt(Base):
    __tablename__ = "otp_verification_attempts"
    id = Column(Integer, primary_key=True, index=True)
    otp_id = Column(Integer, ForeignKey("otps.id"), nullable=False, index=True)
    email = Column(String, nullable=False, index=True)
    attempted_at = Column(DateTime, server_default=func.now(), nullable=False)


class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5 stars
    feedback_text = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    prescription = relationship("Prescription", foreign_keys=[prescription_id])
    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("User", foreign_keys=[doctor_id])
