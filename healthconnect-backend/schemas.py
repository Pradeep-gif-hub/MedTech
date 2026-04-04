from pydantic import BaseModel, Field, field_serializer
from typing import Optional
from datetime import datetime

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
    dob: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None

class UserCreate(UserBase):
    password: Optional[str] = None
    allergies: Optional[str] = None
    medications: Optional[str] = None
    surgeries: Optional[str] = None

    # new fields
    age: Optional[int] = None
    gender: Optional[str] = None
    bloodgroup: Optional[str] = None
    abha_id: Optional[str] = None
    allergy: Optional[str] = None
    emergency_contact: Optional[str] = None
    picture: Optional[str] = None
    profile_picture_url: Optional[str] = None

class UserResponse(UserBase):
    id: Optional[int] = None
    user_id: Optional[int] = None
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    dob: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    allergies: Optional[str] = None
    medications: Optional[str] = None
    surgeries: Optional[str] = None

    age: Optional[int] = None
    gender: Optional[str] = None
    bloodgroup: Optional[str] = None
    abha_id: Optional[str] = None
    allergy: Optional[str] = None
    picture: Optional[str] = None
    profile_picture_url: Optional[str] = None
    token: Optional[str] = None

    # Pydantic v2: use model_config to enable from_attributes (replacement for orm_mode)
    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    bloodgroup: Optional[str] = None
    abha_id: Optional[str] = None
    age: Optional[int] = None
    emergency_contact: Optional[str] = None
    emergencyContact: Optional[str] = Field(default=None, alias="emergencyContact")
    role: Optional[str] = None
    allergy: Optional[str] = None
    allergies: Optional[str] = None
    medications: Optional[str] = None
    surgeries: Optional[str] = None
    picture: Optional[str] = None
    profile_picture_url: Optional[str] = None

    model_config = {"populate_by_name": True}

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
    patient_id: Optional[int] = None
    patient_email: Optional[str] = None
    doctor_id: Optional[int] = None
    doctor_email: Optional[str] = None
    date: Optional[str] = None
    diagnosis: str
    instruction: Optional[str] = None
    medications: list[dict]

class PrescriptionCreate(PrescriptionBase):
    pass

class PrescriptionResponse(PrescriptionBase):
    id: int
    doctor_name: str = "Unknown"
    created_at: Optional[datetime] = None
    pdf_url: Optional[str] = None

    model_config = {"from_attributes": True}
    
    @field_serializer('created_at')
    def serialize_created_at(self, value: Optional[datetime]) -> Optional[str]:
        return value.isoformat() if value else None

class NotificationBase(BaseModel):
    user_id: int
    type: Optional[str] = "prescription"
    message: str
    related_prescription_id: Optional[int] = None

class NotificationCreate(NotificationBase):
    pass

class NotificationResponse(NotificationBase):
    id: int
    is_read: bool = False
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class FeedbackCreate(BaseModel):
    prescription_id: int
    rating: int  # 1-5 stars
    feedback_text: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: int
    prescription_id: int
    patient_id: int
    doctor_id: int
    rating: int
    feedback_text: Optional[str] = None
    created_at: Optional[datetime] = None
    patient_name: Optional[str] = None

    model_config = {"from_attributes": True}
    
    @field_serializer('created_at')
    def serialize_created_at(self, value: Optional[datetime]) -> Optional[str]:
        return value.isoformat() if value else None
