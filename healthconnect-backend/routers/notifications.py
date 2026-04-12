from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import SessionLocal
import schemas
from models import Notification, User

router = APIRouter(tags=["Notifications"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/{user_id}", response_model=list[schemas.NotificationResponse])
def get_notifications(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return notifications


@router.get("", response_model=list[schemas.NotificationResponse])
def get_notifications_by_query(userId: int | None = Query(default=None), db: Session = Depends(get_db)):
    if userId is None:
        return []
    return get_notifications(user_id=userId, db=db)

@router.put("/{user_id}/mark-read")
def mark_notifications_read(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"message": "Notifications marked as read"}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    userId: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(Notification).filter(Notification.id == notification_id)
    if userId is not None:
        query = query.filter(Notification.user_id == userId)

    notification = query.first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notification)
    db.commit()
    return {"message": "Notification deleted", "id": notification_id}
