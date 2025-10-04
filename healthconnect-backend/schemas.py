from pydantic import BaseModel
from typing import Optional

# Appointment schemas
class AppointmentBase(BaseModel):
    patient_id: int
    date: str  # ISO format
    time: str  # e.g., '14:30'
    reason: Optional[str] = ""

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentResponse(AppointmentBase):
    id: int

    class Config:
        orm_mode = True

class UserBase(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None   # changed from EmailStr to plain str to avoid email-validator dependency
    role: Optional[str] = None

class UserCreate(UserBase):
    password: str
    allergies: Optional[str] = None
    medications: Optional[str] = None
    surgeries: Optional[str] = None

    # new fields
    age: Optional[int] = None
    gender: Optional[str] = None
    bloodgroup: Optional[str] = None
    allergy: Optional[str] = None
    profile_picture_url: Optional[str] = None

class UserResponse(UserBase):
    user_id: Optional[int] = None
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    allergies: Optional[str] = None
    medications: Optional[str] = None
    surgeries: Optional[str] = None

    age: Optional[int] = None
    gender: Optional[str] = None
    bloodgroup: Optional[str] = None
    allergy: Optional[str] = None
    profile_picture_url: Optional[str] = None

    # Pydantic v2: use model_config to enable from_attributes (replacement for orm_mode)
    model_config = {"from_attributes": True}

# OTP schemas
class OTPRequest(BaseModel):
    email: str   # plain string
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    bloodgroup: Optional[str] = None
    allergy: Optional[str] = None
    role: Optional[str] = None

class OTPVerify(BaseModel):
    email: str
    otp: str

class OTPResponse(BaseModel):
    email: str
    sent: bool
    expires_at: Optional[str] = None
    debug_otp: Optional[str] = None   # NEW: only set when OTP_DEBUG=1 for local debugging

class PrescriptionBase(BaseModel):
    patient_id: int
    doctor_id: int
    diagnosis: str
    instruction: Optional[str] = None
    medications: list[dict]

class PrescriptionCreate(PrescriptionBase):
    pass

class PrescriptionResponse(PrescriptionBase):
    id: int
    date: str

    class Config:
        orm_mode = True
