from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request
from datetime import date
from typing import List, Optional, Dict, Any
import shutil
from pathlib import Path
import uuid
import os

# --- 로깅, 서비스, 모델, 라우터 등 임포트 ---
from utils.logging_utils import setup_logging, get_logger
from utils.file_utils import generate_safe_filename
from services import diagnosis_service, user_service
from models import tables
from database import engine, get_db
from routers import auth, schedules, records
import schemas
import auth as auth_utils

# --- 데이터베이스 테이블 생성 ---
tables.Base.metadata.create_all(bind=engine)

# --- 로깅 설정 ---
setup_logging()
logger = get_logger(__name__)

# --- FastAPI 앱 초기화 ---
app = FastAPI(
    title="Scancer API",
    description="피부암 진단 보조 및 기록 관리를 위한 백엔드 API",
    version="1.1.0"
)

# --- 라우터 등록 ---
app.include_router(auth.router)
app.include_router(schedules.router)
app.include_router(records.router)

# --- 미들웨어 설정 ---
app.add_middleware(
    CORSMiddleware,
        allow_origins=["http://localhost:3000"],  # 프론트엔드 개발 서버 주소
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response: {response.status_code}")
    return response

# --- 디렉토리 설정 ---
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# --- API 엔드포인트 ---

@app.get("/", tags=["Root"])
async def root():
    return {"message": "Welcome to the Scancer API"}

# --- 진단 API ---
@app.post("/diagnosis", response_model=schemas.DiagnosisRecord, tags=["Diagnosis"], description="피부 이미지 진단 및 기록 저장")
async def diagnose_and_save(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: tables.User = Depends(auth_utils.get_current_user)
):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다.")

    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    
    file_path = upload_dir / f"{uuid.uuid4()}_{file.filename}"
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        record = await diagnosis_service.analyze_and_save_skin_image(
            db=db, image_path=str(file_path), user_id=current_user.id
        )
        return record
    except Exception as e:
        # 오류 발생 시 파일 삭제
        if file_path.exists():
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"진단 중 오류 발생: {str(e)}")

@app.get("/records", response_model=List[schemas.DiagnosisRecord], tags=["Records"], description="현재 사용자의 모든 진단 기록 조회")
def get_user_records(
    db: Session = Depends(get_db),
    current_user: tables.User = Depends(auth_utils.get_current_user)
):
    return diagnosis_service.get_records(db=db, user_id=current_user.id)

@app.delete("/records/{record_id}", tags=["Records"], description="특정 진단 기록 삭제")
def delete_user_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: tables.User = Depends(auth_utils.get_current_user)
):
    success = diagnosis_service.delete_record(db=db, record_id=record_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 ID의 기록을 찾을 수 없거나 삭제 권한이 없습니다.")
    return {"message": "기록이 성공적으로 삭제되었습니다."}

@app.get("/profile/me", response_model=schemas.User, tags=["Profile"], description="현재 로그인된 사용자 프로필 조회")
def get_my_profile(current_user: tables.User = Depends(auth_utils.get_current_user)):
    return current_user

@app.put("/profile/me", response_model=schemas.User, tags=["Profile"], description="현재 로그인된 사용자 프로필 수정")
def update_my_profile(
    profile_data: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: tables.User = Depends(auth_utils.get_current_user)
):
    return user_service.update_user_profile(db=db, user_id=current_user.id, profile_data=profile_data)

# --- 정적 파일 서빙 ---
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- 개발 서버 실행 ---
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Scancer API server.")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
