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
    success: bool
    message: str

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


# Doctor Profile Schemas
class DoctorProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    specialization: Optional[str] = None
    years_of_experience: Optional[int] = None
    languages_spoken: Optional[list[str]] = None
    license_number: Optional[str] = None
    registration_number: Optional[str] = None
    hospital_name: Optional[str] = None
    profile_photo: Optional[str] = None
    abha_id: Optional[str] = None
    emergency_contact: Optional[str] = None
    license_status: Optional[str] = None
    license_valid_till: Optional[str] = None

    model_config = {"populate_by_name": True}


class DoctorProfileResponse(BaseModel):
    id: int
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    specialization: Optional[str] = None
    years_of_experience: Optional[int] = None
    languages_spoken: Optional[list[str]] = None
    license_number: Optional[str] = None
    registration_number: Optional[str] = None
    hospital_name: Optional[str] = None
    profile_photo: Optional[str] = None
    abha_id: Optional[str] = None
    emergency_contact: Optional[str] = None
    license_status: Optional[str] = None
    license_valid_till: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
    
    @field_serializer('created_at', 'updated_at')
    def serialize_datetime(self, value: Optional[datetime]) -> Optional[str]:
        return value.isoformat() if value else None


# Pharmacy Schemas
class PharmacyPrescriptionResponse(BaseModel):
    id: int
    patient_id: int
    patient_name: str
    doctor_id: int
    doctor_name: str
    date: Optional[str] = None
    diagnosis: str
    medicines: list[dict]
    pharmacy_status: str  # pending / approved / rejected
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
    
    @field_serializer('created_at')
    def serialize_created_at(self, value: Optional[datetime]) -> Optional[str]:
        return value.isoformat() if value else None


class InventoryBase(BaseModel):
    medicine_name: str
    category: str
    current_stock: int
    min_stock: int
    price: float


class InventoryCreate(InventoryBase):
    pass


class InventoryUpdate(BaseModel):
    medicine_name: Optional[str] = None
    category: Optional[str] = None
    current_stock: Optional[int] = None
    min_stock: Optional[int] = None
    price: Optional[float] = None


class InventoryResponse(InventoryBase):
    id: int
    pharmacy_id: int
    status: str  # in-stock / low-stock / out-of-stock (computed)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
    
    @field_serializer('created_at', 'updated_at')
    def serialize_datetime(self, value: Optional[datetime]) -> Optional[str]:
        return value.isoformat() if value else None


class InventoryStatsResponse(BaseModel):
    total_items: int
    low_stock_count: int
    out_of_stock_count: int
    inventory_value: float


class OrderItemResponse(BaseModel):
    medicine_name: str
    quantity: int
    price: float
    total: float


class OrderResponse(BaseModel):
    id: int
    order_id: str
    pharmacy_id: int
    prescription_id: Optional[int] = None
    patient_name: Optional[str] = None
    total_items: int
    total_amount: float
    status: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @field_serializer('created_at')
    def serialize_created_at(self, value: Optional[datetime]) -> Optional[str]:
        return value.isoformat() if value else None


class OrderCreateFromPrescriptionResponse(BaseModel):
    message: str
    order: OrderResponse
    items: list[OrderItemResponse]


class OrderStatusUpdate(BaseModel):
    status: str


class AnalyticsTopMedicine(BaseModel):
    medicine_name: str
    total_sold: int


class PharmacyAnalyticsResponse(BaseModel):
    monthly_revenue: float
    total_orders: int
    average_order_value: float
    completed_orders: int
    top_selling_medicines: list[AnalyticsTopMedicine]
