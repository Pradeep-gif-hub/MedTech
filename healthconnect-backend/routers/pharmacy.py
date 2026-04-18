"""
Pharmacy Integration Router
Handles real-time prescription flow and inventory management for pharmacy users.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import SessionLocal
import schemas
from models import Prescription, Inventory, User, Notification
import json
from datetime import datetime

router = APIRouter(prefix="/api/pharmacy", tags=["Pharmacy"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user_id(user_id: int = Query(...)) -> int:
    """Extract user_id from query parameter (to be enhanced with real JWT later)"""
    if user_id is None:
        raise HTTPException(status_code=401, detail="User ID required")
    return user_id


def _compute_inventory_status(current_stock: int, min_stock: int) -> str:
    """Compute inventory status based on stock levels"""
    if current_stock == 0:
        return "out-of-stock"
    elif current_stock < min_stock:
        return "low-stock"
    else:
        return "in-stock"


# ============================================================================
# PRESCRIPTION ROUTES - Real-time prescription flow from doctors to pharmacies
# ============================================================================

@router.get("/prescriptions", response_model=list[schemas.PharmacyPrescriptionResponse])
def get_pharmacy_prescriptions(
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get all pending and approved prescriptions for pharmacy dashboard.
    Prescriptions are visible to all pharmacies (they don't see each other's inventory, but can see all prescriptions).
    
    Query params:
    - user_id: ID of pharmacy user (for auth verification)
    """
    # Verify user is a pharmacy
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "pharmacy":
        raise HTTPException(status_code=403, detail="Only pharmacy users can access prescriptions")
    
    # Get all prescriptions with status pending or approved
    prescriptions = db.query(Prescription).filter(
        Prescription.pharmacy_status.in_(["pending", "approved"])
    ).order_by(Prescription.created_at.desc()).all()
    
    # Fetch all patients and doctors for efficiency
    patient_ids = {p.patient_id for p in prescriptions}
    doctor_ids = {p.doctor_id for p in prescriptions}
    
    patients = {u.id: u for u in db.query(User).filter(User.id.in_(patient_ids)).all()} if patient_ids else {}
    doctors = {u.id: u for u in db.query(User).filter(User.id.in_(doctor_ids)).all()} if doctor_ids else {}
    
    result = []
    for p in prescriptions:
        try:
            medicines = json.loads(p.medications or '[]')
        except Exception:
            medicines = []
        
        patient = patients.get(p.patient_id)
        doctor = doctors.get(p.doctor_id)
        
        result.append({
            "id": p.id,
            "patient_id": p.patient_id,
            "patient_name": patient.name if patient else "Unknown",
            "doctor_id": p.doctor_id,
            "doctor_name": f"Dr. {doctor.name}" if doctor else "Unknown",
            "date": p.date.isoformat() if p.date else None,
            "diagnosis": p.diagnosis,
            "medicines": medicines,
            "pharmacy_status": p.pharmacy_status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    
    return result


@router.post("/prescriptions/{prescription_id}/approve")
def approve_prescription(
    prescription_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Approve a prescription.
    Updates pharmacy_status to 'approved'.
    """
    # Verify user is a pharmacy
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "pharmacy":
        raise HTTPException(status_code=403, detail="Only pharmacy users can approve prescriptions")
    
    prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    if prescription.pharmacy_status == "approved":
        raise HTTPException(status_code=400, detail="Prescription already approved")
    
    prescription.pharmacy_status = "approved"
    db.commit()
    
    return {
        "message": "Prescription approved",
        "prescription_id": prescription_id,
        "status": prescription.pharmacy_status
    }


@router.post("/prescriptions/{prescription_id}/reject")
def reject_prescription(
    prescription_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Reject a prescription.
    Updates pharmacy_status to 'rejected'.
    """
    # Verify user is a pharmacy
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "pharmacy":
        raise HTTPException(status_code=403, detail="Only pharmacy users can reject prescriptions")
    
    prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    if prescription.pharmacy_status == "rejected":
        raise HTTPException(status_code=400, detail="Prescription already rejected")
    
    prescription.pharmacy_status = "rejected"
    db.commit()
    
    return {
        "message": "Prescription rejected",
        "prescription_id": prescription_id,
        "status": prescription.pharmacy_status
    }


# ============================================================================
# INVENTORY ROUTES - Per-pharmacy inventory management
# ============================================================================

@router.get("/inventory", response_model=list[schemas.InventoryResponse])
def get_pharmacy_inventory(
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get inventory for the logged-in pharmacy user.
    Each pharmacy only sees their own inventory.
    """
    print(f"\n📦 [GET INVENTORY] User {user_id} requesting inventory")
    
    # Verify user is a pharmacy
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "pharmacy":
        print(f"❌ Access denied - User {user_id} is not a pharmacy user")
        raise HTTPException(status_code=403, detail="Only pharmacy users can access inventory")
    
    items = db.query(Inventory).filter(Inventory.pharmacy_id == user_id).all()
    print(f"📍 Found {len(items)} items for pharmacy {user_id}")
    
    result = []
    for item in items:
        status = _compute_inventory_status(item.current_stock, item.min_stock)
        result.append({
            "id": item.id,
            "medicine_name": item.medicine_name,
            "category": item.category,
            "current_stock": item.current_stock,
            "min_stock": item.min_stock,
            "price": item.price,
            "pharmacy_id": item.pharmacy_id,
            "status": status,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        })
    
    return result


@router.post("/inventory", response_model=dict)
def create_inventory_item(
    item: schemas.InventoryCreate,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Add a new medicine to pharmacy inventory.
    """
    print("\n" + "="*60)
    print("🔥 [INVENTORY POST] Incoming request")
    print("="*60)
    print(f"📍 User ID: {user_id}")
    print(f"📦 Item data: medicine_name={item.medicine_name}, category={item.category}")
    print(f"   current_stock={item.current_stock}, min_stock={item.min_stock}, price={item.price}")
    
    # Verify user is a pharmacy
    user = db.query(User).filter(User.id == user_id).first()
    print(f"👤 User found: {user is not None}")
    if user:
        print(f"   User role: {user.role}")
    
    if not user or user.role != "pharmacy":
        print(f"❌ Authorization failed - Role check failed")
        raise HTTPException(status_code=403, detail="Only pharmacy users can add inventory")
    
    # Check if medicine already exists for this pharmacy
    existing = db.query(Inventory).filter(
        Inventory.pharmacy_id == user_id,
        Inventory.medicine_name == item.medicine_name
    ).first()
    
    if existing:
        print(f"⚠️  Medicine '{item.medicine_name}' already exists in inventory")
        raise HTTPException(status_code=400, detail="Medicine already exists in inventory")
    
    new_item = Inventory(
        pharmacy_id=user_id,
        medicine_name=item.medicine_name,
        category=item.category,
        current_stock=item.current_stock,
        min_stock=item.min_stock,
        price=item.price,
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    
    status = _compute_inventory_status(new_item.current_stock, new_item.min_stock)
    
    print(f"✅ Item created successfully")
    print(f"   ID: {new_item.id}")
    print(f"   Medicine: {new_item.medicine_name}")
    print(f"   Status: {status}")
    print("="*60 + "\n")
    
    return {
        "message": "Inventory item created",
        "id": new_item.id,
        "medicine_name": new_item.medicine_name,
        "status": status
    }


@router.put("/inventory/{item_id}", response_model=dict)
def update_inventory_item(
    item_id: int,
    update: schemas.InventoryUpdate,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Update inventory item (stock, price, etc).
    """
    # Verify user is a pharmacy
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "pharmacy":
        raise HTTPException(status_code=403, detail="Only pharmacy users can update inventory")
    
    item = db.query(Inventory).filter(
        Inventory.id == item_id,
        Inventory.pharmacy_id == user_id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    # Update fields if provided
    if update.medicine_name is not None:
        item.medicine_name = update.medicine_name
    if update.category is not None:
        item.category = update.category
    if update.current_stock is not None:
        item.current_stock = update.current_stock
    if update.min_stock is not None:
        item.min_stock = update.min_stock
    if update.price is not None:
        item.price = update.price
    
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    
    status = _compute_inventory_status(item.current_stock, item.min_stock)
    
    return {
        "message": "Inventory item updated",
        "id": item.id,
        "medicine_name": item.medicine_name,
        "status": status
    }


@router.delete("/inventory/{item_id}", response_model=dict)
def delete_inventory_item(
    item_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Delete an inventory item.
    """
    # Verify user is a pharmacy
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "pharmacy":
        raise HTTPException(status_code=403, detail="Only pharmacy users can delete inventory")
    
    item = db.query(Inventory).filter(
        Inventory.id == item_id,
        Inventory.pharmacy_id == user_id
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    db.delete(item)
    db.commit()
    
    return {
        "message": "Inventory item deleted",
        "id": item_id
    }


# ============================================================================
# STATISTICS ROUTES - Dashboard cards
# ============================================================================

@router.get("/inventory/stats", response_model=schemas.InventoryStatsResponse)
def get_inventory_stats(
    user_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get inventory statistics for the logged-in pharmacy.
    Returns:
    - total_items: count of all items
    - low_stock_count: items where stock < min_stock
    - out_of_stock_count: items where stock == 0
    - inventory_value: sum(stock * price)
    """
    # Verify user is a pharmacy
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "pharmacy":
        raise HTTPException(status_code=403, detail="Only pharmacy users can access stats")
    
    items = db.query(Inventory).filter(Inventory.pharmacy_id == user_id).all()
    
    total_items = len(items)
    low_stock_count = sum(1 for item in items if item.current_stock < item.min_stock and item.current_stock > 0)
    out_of_stock_count = sum(1 for item in items if item.current_stock == 0)
    inventory_value = sum(item.current_stock * item.price for item in items)
    
    return {
        "total_items": total_items,
        "low_stock_count": low_stock_count,
        "out_of_stock_count": out_of_stock_count,
        "inventory_value": round(inventory_value, 2)
    }
