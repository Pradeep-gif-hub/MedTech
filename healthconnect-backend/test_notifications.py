from database import SessionLocal
from models import Notification
import schemas

db = SessionLocal()
try:
    # Query notifications
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == 32)
        .order_by(Notification.created_at.desc())
        .all()
    )
    
    print(f"Found {len(notifications)} notifications")
    for notif in notifications:
        print(f"  - ID: {notif.id}, Type: {notif.type}, Message: {notif.message}")
        
        # Try to convert to response model
        try:
            response = schemas.NotificationResponse.from_orm(notif)
            print(f"    Serialized: OK")
        except Exception as e:
            print(f"    Serialization error: {e}")
            
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
