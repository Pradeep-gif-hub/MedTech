from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import SessionLocal
import schemas
from models import Prescription, User, Notification
import json
import datetime
import io


router = APIRouter(tags=["Prescriptions"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _serialize_prescription(prescription: Prescription, db: Session = None) -> dict:
    try:
        medications = json.loads(prescription.medications or '[]')
    except Exception:
        medications = []

    return {
        "id": prescription.id,
        "patient_id": prescription.patient_id,
        "doctor_id": prescription.doctor_id,
        "doctor_name": "Unknown",
        "date": prescription.date.isoformat() if prescription.date else None,
        "diagnosis": prescription.diagnosis,
        "instruction": prescription.instruction,
        "medications": medications,
        "pdf_url": prescription.pdf_url,
        "created_at": prescription.created_at.isoformat() if prescription.created_at else None,
    }


def _escape_pdf_text(value: str) -> str:
    return value.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def _build_simple_pdf(lines: list[str]) -> bytes:
    content_lines = ["BT\n/F1 18 Tf\n40 760 Td\n"]
    for line in lines:
        text = _escape_pdf_text(line)
        content_lines.append(f"({text}) Tj\n0 -24 Td\n")
    content_lines.append("ET\n")
    content = ''.join(content_lines)
    content_bytes = content.encode('latin1')

    font_obj = b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    page_obj = (b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]"
                b" /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n")
    stream_obj = (b"4 0 obj\n<< /Length " + str(len(content_bytes)).encode('ascii') + b" >>\nstream\n"
                  + content_bytes + b"endstream\nendobj\n")
    catalog_obj = b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    pages_obj = b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"

    objects = [catalog_obj, pages_obj, page_obj, stream_obj, font_obj]
    pdf = b"%PDF-1.4\n"
    offsets = []
    for obj in objects:
        offsets.append(len(pdf))
        pdf += obj
    xref_offset = len(pdf)
    pdf += b"xref\n0 " + str(len(objects) + 1).encode('ascii') + b"\n0000000000 65535 f \n"
    for offset in offsets:
        pdf += f"{offset:010d} 00000 n \n".encode('ascii')
    pdf += b"trailer\n<< /Size " + str(len(objects) + 1).encode('ascii') + b" /Root 1 0 R >>\nstartxref\n"
    pdf += str(xref_offset).encode('ascii') + b"\n%%EOF\n"
    return pdf


def _build_pdf_for_prescription(prescription: Prescription, patient: User, doctor: User) -> bytes:
    """Build a professional PDF prescription with proper formatting."""
    try:
        created_at = prescription.created_at
        if created_at:
            # Format timestamp as IST (UTC+5:30)
            ist_time = created_at.strftime("%d %B %Y, %I:%M %p IST")
        else:
            ist_time = "N/A"
    except Exception as e:
        ist_time = "N/A"
    
    lines = [
        "",
        "╔════════════════════════════════════════════════════════════════════════════════╗",
        "║                                                                                ║",
        "║                              MedTech HEALTHCARE                               ║",
        "║                        Digital Prescription System                            ║",
        "║                                                                                ║",
        "╚════════════════════════════════════════════════════════════════════════════════╝",
        "",
        "Prescription #" + str(prescription.id).ljust(70),
        "Generated: " + ist_time,
        "",
        "─" * 80,
        "",
        "PATIENT INFORMATION:",
        f"  Name:   {patient.name}",
        f"  Email:  {patient.email}",
        "",
        "DOCTOR INFORMATION:",
        f"  Name:   Dr. {doctor.name}",
        f"  Email:  {doctor.email}",
        "",
        "PRESCRIPTION DATE: " + (prescription.date.isoformat() if prescription.date else 'N/A'),
        "",
        "─" * 80,
        "",
        "DIAGNOSIS:",
        f"  {prescription.diagnosis}",
        "",
        "MEDICATIONS PRESCRIBED:",
    ]
    
    try:
        medications = json.loads(prescription.medications or '[]')
    except Exception:
        medications = []
    
    if medications:
        for idx, med in enumerate(medications, 1):
            if isinstance(med, dict):
                med_name = med.get('name', 'Unknown')
                med_dosage = med.get('dosage', '')
                med_duration = med.get('duration', '')
                label = f"  {idx}. {med_name}"
                if med_dosage:
                    label += f" | {med_dosage}"
                if med_duration:
                    label += f" | {med_duration}"
            else:
                label = f"  {idx}. {med}"
            lines.append(label)
    else:
        lines.append("  (No medications prescribed)")
    
    lines += [
        "",
        "INSTRUCTIONS:",
        f"  {prescription.instruction or 'No specific instructions provided.'}",
        "",
        "─" * 80,
        "",
        "NOTES:",
        "  • This is a digital prescription issued by MedTech Healthcare System",
        "  • Please keep this document for your medical records",
        "  • Present this prescription to your pharmacist",
        "  • Contact your doctor if you have any questions",
        "",
        "═" * 80,
        "This document is valid as per medical regulations and digital prescription norms.",
        "═" * 80,
    ]
    
    return _build_simple_pdf(lines)


@router.post("/", response_model=dict)
@router.post("/create", response_model=dict)
def create_prescription(
    prescription: schemas.PrescriptionCreate,
    db: Session = Depends(get_db)
):
    if not prescription.patient_id and not prescription.patient_email:
        raise HTTPException(status_code=400, detail="Patient ID or patient email is required")

    patient = None
    if prescription.patient_id:
        patient = db.query(User).filter(User.id == prescription.patient_id, User.role == "patient").first()
    if not patient and prescription.patient_email:
        patient = db.query(User).filter(User.email == prescription.patient_email, User.role == "patient").first()

    # Support both doctor_id and doctor_email
    doctor = None
    if prescription.doctor_id:
        doctor = db.query(User).filter(User.id == prescription.doctor_id, User.role == "doctor").first()
    if not doctor and prescription.doctor_email:
        doctor = db.query(User).filter(User.email == prescription.doctor_email, User.role == "doctor").first()
    
    if not patient:
        raise HTTPException(status_code=400, detail="Invalid patient ID or email")
    if not doctor:
        raise HTTPException(status_code=400, detail="Invalid doctor ID or email")

    medications_json = json.dumps(prescription.medications)
    date_value = None
    if prescription.date:
        try:
            date_value = datetime.date.fromisoformat(prescription.date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")

    new_prescription = Prescription(
        patient_id=patient.id,
        doctor_id=doctor.id,
        diagnosis=prescription.diagnosis,
        instruction=prescription.instruction or "",
        medications=medications_json,
        date=date_value,
    )
    db.add(new_prescription)
    db.flush()
    new_prescription.pdf_url = f"/api/prescriptions/pdf/{new_prescription.id}"
    db.commit()
    db.refresh(new_prescription)

    notification = Notification(
        user_id=patient.id,
        type="prescription",
        message=f"New prescription received from Dr. {doctor.name}",
        related_prescription_id=new_prescription.id,
    )
    db.add(notification)
    db.commit()

    return {
        "message": "Prescription created",
        "prescription_id": new_prescription.id,
        "pdf_url": new_prescription.pdf_url,
    }


@router.get("/patient/{patient_id}", response_model=list[schemas.PrescriptionResponse])
def get_prescriptions(patient_id: int, db: Session = Depends(get_db)):
    prescriptions = db.query(Prescription).filter(
        Prescription.patient_id == patient_id
    ).order_by(Prescription.created_at.desc()).all()
    
    # Fetch all doctors at once for efficiency
    doctor_ids = {p.doctor_id for p in prescriptions if p.doctor_id}
    doctors = {d.id: d for d in db.query(User).filter(User.id.in_(doctor_ids)).all()} if doctor_ids else {}
    
    result = []
    for p in prescriptions:
        serialized = _serialize_prescription(p, db)
        doctor = doctors.get(p.doctor_id)
        if doctor:
            serialized['doctor_name'] = doctor.name
        result.append(serialized)
    
    return result


@router.get("/pdf/{prescription_id}")
def prescription_pdf(prescription_id: int, db: Session = Depends(get_db)):
    try:
        prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
        if not prescription:
            raise HTTPException(status_code=404, detail="Prescription not found")

        patient = db.query(User).filter(User.id == prescription.patient_id).first()
        doctor = db.query(User).filter(User.id == prescription.doctor_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found")

        pdf_bytes = _build_pdf_for_prescription(prescription, patient, doctor)
        return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf", headers={
            "Content-Disposition": f"inline; filename=prescription_{prescription.id}.pdf"
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation error: {str(e)}")


@router.get("/{prescription_id}", response_model=schemas.PrescriptionResponse)
def get_prescription_details(prescription_id: int, db: Session = Depends(get_db)):
    prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    serialized = _serialize_prescription(prescription, db)
    
    # Fetch doctor name
    if prescription.doctor_id:
        doctor = db.query(User).filter(User.id == prescription.doctor_id).first()
        if doctor:
            serialized['doctor_name'] = doctor.name
    
    return serialized


@router.delete("/{prescription_id}")
def delete_prescription(prescription_id: int, db: Session = Depends(get_db)):
    """Delete a prescription by ID"""
    prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    db.delete(prescription)
    db.commit()
    
    return {"message": "Prescription deleted successfully", "prescription_id": prescription_id}


@router.put("/{prescription_id}/mark-read")
def mark_prescription_read(prescription_id: int, db: Session = Depends(get_db)):
    """Mark prescription as read by updating associated notification"""
    prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    # Mark notification as read - use related_prescription_id (not prescription_id)
    notification = db.query(Notification).filter(
        Notification.related_prescription_id == prescription_id
    ).first()
    if notification:
        notification.read = True
        db.commit()
    
    return {"message": "Prescription marked as read", "prescription_id": prescription_id}
