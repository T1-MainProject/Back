# backend.py
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models, schemas, auth

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# DB 세션 주입 함수
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 회원가입
@app.post("/signup", response_model=schemas.UserOut)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    hashed_pw = auth.hash_password(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_pw)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# 로그인
@app.post("/login")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not auth.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="잘못된 이메일 또는 비밀번호입니다.")
    return {"message": "로그인 성공", "user_id": db_user.id}
