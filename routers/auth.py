from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

import crud
import schemas
import auth as auth_utils
from models import tables
from database import get_db

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)

@router.post("/register", response_model=schemas.User, status_code=201)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="이미 등록된 이메일입니다.")
    return crud.create_user(db=db, user=user)

@router.post("/login")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = auth_utils.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth_utils.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth_utils.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    user_info = schemas.User.from_orm(user)
    return {"access_token": access_token, "token_type": "bearer", "user": user_info.dict()}

@router.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: tables.User = Depends(auth_utils.get_current_user)):
    return current_user
