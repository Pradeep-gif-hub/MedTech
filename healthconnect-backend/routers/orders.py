from __future__ import annotations

import json
import math
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

import schemas
from database import SessionLocal
from models import Inventory, Order, OrderItem, Prescription, User

router = APIRouter(prefix="/api", tags=["Orders", "Analytics"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _verify_pharmacy_user(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.role != "pharmacy":
        raise HTTPException(status_code=403, detail="Only pharmacy users can access this resource")
    return user


def _extract_quantity(medicine: dict) -> int:
    """
    Resolve inventory stock units from prescription.

    Rules:
    - If quantity/qty/count is present, use it as stock units.
    - If missing, assume 10 doses by default, where 10 doses = 1 stock unit.
    """
    raw_value = medicine.get("quantity", medicine.get("qty", medicine.get("count")))
    if raw_value is not None:
        try:
            quantity = int(raw_value)
        except (TypeError, ValueError):
            quantity = 1
        return quantity if quantity > 0 else 1

    dose_value = medicine.get("doses", medicine.get("dose", medicine.get("dosage")))
    inferred_doses = 10
    if isinstance(dose_value, (int, float)):
        inferred_doses = max(1, int(dose_value))
    elif isinstance(dose_value, str):
        digits = "".join(ch for ch in dose_value if ch.isdigit())
        if digits:
            inferred_doses = max(1, int(digits))

    return max(1, math.ceil(inferred_doses / 10))


def _parse_prescription_medicines(raw_medicines: str | None) -> list[dict]:
    if not raw_medicines:
        return []
    try:
        medicines = json.loads(raw_medicines)
    except Exception:
        medicines = []
    return medicines if isinstance(medicines, list) else []


def _next_order_code(db: Session) -> str:
    # Keep behavior aligned with requested logic while ensuring uniqueness.
    order_count = db.query(func.count(Order.id)).scalar() or 0
    next_seq = order_count + 1

    while True:
        candidate = f"ORD{next_seq:03d}"
        exists = db.query(Order.id).filter(Order.order_id == candidate).first()
        if not exists:
            return candidate
        next_seq += 1


def _status_from_stock(items: list[dict]) -> str:
    if not items:
        return "PROCESSING"
    all_in_stock = all(item["available_stock"] >= item["quantity"] for item in items)
    return "READY_FOR_PICKUP" if all_in_stock else "PROCESSING"


@router.get("/orders", response_model=list[schemas.OrderResponse])
def get_orders(
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    _verify_pharmacy_user(db, user_id)

    rows = (
        db.query(Order)
        .join(Prescription, Prescription.id == Order.prescription_id)
        .filter(Order.pharmacy_id == user_id)
        .filter(Prescription.pharmacy_status == "approved")
        .order_by(Order.created_at.desc())
        .all()
    )
    return rows


@router.post("/orders/from-prescription/{prescription_id}", response_model=schemas.OrderCreateFromPrescriptionResponse)
def create_order_from_prescription(
    prescription_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    _verify_pharmacy_user(db, user_id)

    prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")

    existing_order = (
        db.query(Order)
        .filter(Order.pharmacy_id == user_id, Order.prescription_id == prescription_id)
        .first()
    )
    if existing_order:
        order_items = db.query(OrderItem).filter(OrderItem.order_id == existing_order.id).all()
        return {
            "message": "Order already exists for this prescription",
            "order": existing_order,
            "items": order_items,
        }

    medicines = _parse_prescription_medicines(prescription.medications)
    if not medicines:
        raise HTTPException(status_code=400, detail="Prescription has no medicines")

    patient = db.query(User).filter(User.id == prescription.patient_id).first()
    patient_name = (patient.name if patient else None) or "Unknown"

    resolved_items: list[dict] = []
    for medicine in medicines:
        med_name = str(medicine.get("name", "")).strip()
        if not med_name:
            continue

        inv_item = (
            db.query(Inventory)
            .filter(
                Inventory.pharmacy_id == user_id,
                func.lower(Inventory.medicine_name) == med_name.lower(),
            )
            .first()
        )
        if not inv_item:
            raise HTTPException(
                status_code=400,
                detail=f"Medicine not found in inventory: {med_name}",
            )

        quantity = _extract_quantity(medicine)
        line_price = float(inv_item.price or 0.0)
        line_total = round(line_price * quantity, 2)

        resolved_items.append(
            {
                "medicine_name": med_name,
                "quantity": quantity,
                "price": line_price,
                "total": line_total,
                "available_stock": int(inv_item.current_stock or 0),
            }
        )

    if not resolved_items:
        raise HTTPException(status_code=400, detail="No valid medicines found in prescription")

    total_items = len(resolved_items)
    total_amount = round(sum(item["total"] for item in resolved_items), 2)
    order_status = _status_from_stock(resolved_items)

    try:
        order = Order(
            order_id=_next_order_code(db),
            pharmacy_id=user_id,
            prescription_id=prescription_id,
            patient_name=patient_name,
            total_items=total_items,
            total_amount=total_amount,
            status=order_status,
        )
        db.add(order)
        db.flush()

        for item in resolved_items:
            db.add(
                OrderItem(
                    order_id=order.id,
                    medicine_name=item["medicine_name"],
                    quantity=item["quantity"],
                    price=item["price"],
                    total=item["total"],
                )
            )

        # Approved + accepted order should reduce inventory stock by sold units.
        if order_status == "READY_FOR_PICKUP":
            for item in resolved_items:
                inv_item = (
                    db.query(Inventory)
                    .filter(
                        Inventory.pharmacy_id == user_id,
                        func.lower(Inventory.medicine_name) == item["medicine_name"].lower(),
                    )
                    .first()
                )
                if not inv_item:
                    raise HTTPException(status_code=400, detail=f"Inventory item missing during stock update: {item['medicine_name']}")

                available = int(inv_item.current_stock or 0)
                required = int(item["quantity"])
                if available < required:
                    raise HTTPException(status_code=400, detail=f"Insufficient stock for {item['medicine_name']}: need {required}, available {available}")

                inv_item.current_stock = available - required

        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(order)
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()

    return {
        "message": "Order created successfully",
        "order": order,
        "items": items,
    }


@router.patch("/orders/{order_id}/status", response_model=schemas.OrderResponse)
def update_order_status(
    order_id: int,
    payload: schemas.OrderStatusUpdate,
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    _verify_pharmacy_user(db, user_id)

    normalized = str(payload.status or "").strip().upper()
    allowed = {"PROCESSING", "READY_FOR_PICKUP", "COMPLETED"}
    if normalized not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {', '.join(sorted(allowed))}")

    order = db.query(Order).filter(Order.id == order_id, Order.pharmacy_id == user_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = normalized

    # Keep prescription lifecycle aligned when order is completed.
    if normalized == "COMPLETED" and order.prescription_id:
        prescription = db.query(Prescription).filter(Prescription.id == order.prescription_id).first()
        if prescription:
            prescription.status = "dispensed"
            prescription.pharmacy_status = "approved"

    db.commit()
    db.refresh(order)
    return order


@router.get("/analytics", response_model=schemas.PharmacyAnalyticsResponse)
def get_analytics(
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    _verify_pharmacy_user(db, user_id)

    monthly_revenue = (
        db.query(func.coalesce(func.sum(Order.total_amount), 0.0))
        .filter(
            Order.pharmacy_id == user_id,
            func.date_trunc("month", Order.created_at) == func.date_trunc("month", func.current_date()),
        )
        .scalar()
        or 0.0
    )

    total_orders = (
        db.query(func.count(Order.id))
        .filter(Order.pharmacy_id == user_id)
        .scalar()
        or 0
    )

    average_order_value = (
        db.query(func.coalesce(func.avg(Order.total_amount), 0.0))
        .filter(Order.pharmacy_id == user_id)
        .scalar()
        or 0.0
    )

    completed_orders = (
        db.query(func.count(Order.id))
        .filter(Order.pharmacy_id == user_id, Order.status == "COMPLETED")
        .scalar()
        or 0
    )

    top_rows = (
        db.query(
            OrderItem.medicine_name,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("total_sold"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.pharmacy_id == user_id)
        .group_by(OrderItem.medicine_name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
        .all()
    )

    top_selling = [
        {
            "medicine_name": row.medicine_name,
            "total_sold": int(row.total_sold or 0),
        }
        for row in top_rows
    ]

    return {
        "monthly_revenue": round(float(monthly_revenue), 2),
        "total_orders": int(total_orders),
        "average_order_value": round(float(average_order_value), 2),
        "completed_orders": int(completed_orders),
        "top_selling_medicines": top_selling,
    }
