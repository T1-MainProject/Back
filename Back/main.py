from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request
from starlette.responses import Response
import os
import uuid
from datetime import datetime, date
import json
from typing import List, Optional, Dict, Any
import shutil
from pathlib import Path
import logging

# --- 서비스, 모델, 유틸리티 임포트 ---
from services.diagnosis_service import analyze_skin_image, get_records as get_all_records, add_record as add_new_record, delete_record as delete_existing_record
from services.user_service import get_user_profile, update_user_profile
from services.schedule_service import get_schedules, add_schedule, update_schedule, delete_schedule
from utils.logging_utils import setup_logging, get_logger
from utils.file_utils import generate_safe_filename
from models.diagnosis import DiagnosisResult, Record
from models.user import UserProfile, UserProfileUpdate
from models.schedule import Schedule, ScheduleCreate

# --- 로깅 설정 ---
setup_logging()
logger = get_logger(__name__)

# --- FastAPI 앱 초기화 ---
app = FastAPI(
    title="Scancer API", 
    description="피부암 진단 보조 및 기록 관리를 위한 백엔드 API",
    version="1.0.0"
)

# --- 미들웨어 설정 ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션 환경에서는 실제 프론트엔드 주소로 변경
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

@app.get("/", tags=["기본"])
async def root():
    return {"message": "Scancer API에 오신 것을 환영합니다."}

# --- 진단 API ---
@app.post("/api/diagnose", response_model=Dict[str, Any], tags=["진단"])
async def diagnose_image_api(file: UploadFile = File(...), user_id: str = Form(...)):
    """
    이미지를 업로드하여 피부 질환을 진단하고 결과를 기록합니다.
    - **file**: 진단할 이미지 파일 (JPG, JPEG, PNG)
    - **user_id**: 진단을 요청한 사용자 ID
    """
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in [".jpg", ".jpeg", ".png"]:
        raise HTTPException(status_code=400, detail="지원하지 않는 파일 형식입니다.")

    safe_filename = generate_safe_filename(file.filename)
    file_path = UPLOAD_DIR / safe_filename

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"{user_id} 사용자가 {safe_filename} 파일을 업로드했습니다.")
    except Exception as e:
        logger.error(f"파일 저장 실패: {e}")
        raise HTTPException(status_code=500, detail="파일 저장 중 오류가 발생했습니다.")

    try:
        diagnosis_data = await analyze_skin_image(str(file_path))
        diagnosis_result = DiagnosisResult(**diagnosis_data)
        
        image_url = f"/uploads/{safe_filename}"

        # 진단 기록 생성
        new_record = Record(
            img=image_url,
            title=diagnosis_result.diagnosis,
            date=datetime.now().strftime("%Y. %m. %d."),
            diagnosis_result=diagnosis_result,
            user_id=user_id
        )
        add_new_record(new_record.dict())
        logger.info(f"{user_id} 사용자의 진단 결과가 기록되었습니다: {new_record.id}")

        return {
            "diagnosis": diagnosis_result.dict(),
            "image_url": image_url,
            "record_id": new_record.id
        }
    except Exception as e:
        logger.error(f"이미지 분석 실패: {e}")
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail="이미지 분석 중 오류가 발생했습니다.")

# --- 기록 API ---
@app.get("/api/records", response_model=List[Record], tags=["기록"])
async def get_records_api(user_id: str):
    """특정 사용자의 모든 진단 기록을 조회합니다."""
    return get_all_records(user_id)

@app.delete("/api/records/{record_id}", status_code=204, tags=["기록"])
async def delete_record_api(record_id: str):
    """특정 진단 기록을 삭제합니다."""
    if not delete_existing_record(record_id):
        raise HTTPException(status_code=404, detail="해당 ID의 기록을 찾을 수 없습니다.")
    return Response(status_code=204)

# --- 사용자 프로필 API ---
@app.get("/api/users/{user_id}", response_model=UserProfile, tags=["사용자"])
async def get_user_profile_api(user_id: str):
    """사용자 프로필 정보를 조회합니다."""
    profile = get_user_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return profile

@app.put("/api/users/{user_id}", response_model=UserProfile, tags=["사용자"])
async def update_user_profile_api(user_id: str, profile_update: UserProfileUpdate):
    """사용자 프로필 정보를 업데이트합니다."""
    updated_profile = update_user_profile(user_id, profile_update.dict(exclude_unset=True))
    if not updated_profile:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return updated_profile

# --- 일정 API ---
@app.get("/api/schedules", response_model=List[Schedule], tags=["일정"])
async def get_schedules_api(user_id: str, schedule_date: Optional[date] = Query(None)):
    """사용자의 일정을 조회합니다. 특정 날짜를 지정할 수 있습니다."""
    return get_schedules(user_id, schedule_date)

@app.post("/api/schedules", response_model=Schedule, status_code=201, tags=["일정"])
async def add_schedule_api(schedule_create: ScheduleCreate):
    """새로운 일정을 추가합니다."""
    new_schedule_data = add_schedule(schedule_create.dict())
    return new_schedule_data

@app.put("/api/schedules/{schedule_id}", response_model=Schedule, tags=["일정"])
async def update_schedule_api(schedule_id: str, schedule_update: ScheduleCreate):
    """기존 일정을 업데이트합니다."""
    updated_schedule = update_schedule(schedule_id, schedule_update.dict())
    if not updated_schedule:
        raise HTTPException(status_code=404, detail="해당 ID의 일정을 찾을 수 없습니다.")
    return updated_schedule

@app.delete("/api/schedules/{schedule_id}", status_code=204, tags=["일정"])
async def delete_schedule_api(schedule_id: str):
    """특정 일정을 삭제합니다."""
    if not delete_schedule(schedule_id):
        raise HTTPException(status_code=404, detail="해당 ID의 일정을 찾을 수 없습니다.")
    return Response(status_code=204)

# --- 정적 파일 서빙 ---
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/images", StaticFiles(directory="../Front/public/images"), name="images") # 프론트엔드 이미지 서빙

# --- 개발 서버 실행 ---
if __name__ == "__main__":
    import uvicorn
    logger.info("Scancer API 서버를 시작합니다.")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
