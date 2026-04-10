from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy.orm import Session

from .users import get_db, forgot_password as users_forgot_password, reset_password as users_reset_password

router = APIRouter(tags=["Auth"])


@router.post("/forgot-password")
def forgot_password(data: dict = Body(...), request: Request = None, db: Session = Depends(get_db)):
    return users_forgot_password(data=data, request=request, db=db)


@router.post("/reset-password")
def reset_password(data: dict = Body(...), db: Session = Depends(get_db)):
    return users_reset_password(data=data, db=db)
