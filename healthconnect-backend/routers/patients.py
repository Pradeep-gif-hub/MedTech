from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/patients", tags=["Patients"])

# Example schema
class Patient(BaseModel):
    id: int
    name: str
    age: int
    condition: str

# Mock DB
patients_db = []

@router.post("/")
def create_patient(patient: Patient):
    patients_db.append(patient)
    return {"message": "Patient added", "patient": patient}

@router.get("/")
def get_patients():
    return patients_db
