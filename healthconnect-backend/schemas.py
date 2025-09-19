
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
    name: str
    email: str
    role: str
    allergies: str = ""
    medications: str = ""
    surgeries: str = ""

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int

    class Config:
        orm_mode = True

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
