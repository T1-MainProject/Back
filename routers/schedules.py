from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

import schemas
from models import tables
import auth as auth_utils
from database import get_db
from services import schedule_service

router = APIRouter(
    prefix="/api/schedules",
    tags=["Schedules"],
    dependencies=[Depends(auth_utils.get_current_user)]
)

@router.get("", response_model=List[schemas.Schedule])
def read_schedules(
    schedule_date: Optional[date] = Query(None, description="YYYY-MM-DD 형식의 날짜"),
    db: Session = Depends(get_db),
    current_user: tables.User = Depends(auth_utils.get_current_user)
):
    """
    현재 사용자의 일정 목록을 조회합니다.
    특정 날짜를 쿼리 파라미터로 제공하면 해당 날짜의 일정만 필터링합니다.
    """
    schedules = schedule_service.get_schedules(db, user_id=current_user.id, schedule_date=schedule_date)
    return schedules

@router.post("", response_model=schemas.Schedule, status_code=201)
def create_new_schedule(
    schedule: schemas.ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: tables.User = Depends(auth_utils.get_current_user)
):
    """
    현재 사용자를 위한 새 일정을 생성합니다.
    """
    return schedule_service.add_schedule(db=db, schedule_data=schedule, user_id=current_user.id)

@router.put("/{schedule_id}", response_model=schemas.Schedule)
def update_existing_schedule(
    schedule_id: int,
    schedule: schemas.ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: tables.User = Depends(auth_utils.get_current_user)
):
    """
    ID로 특정 일정을 업데이트합니다.
    해당 일정이 현재 사용자의 소유인지 확인합니다.
    """
    updated_schedule = schedule_service.update_schedule(db=db, schedule_id=schedule_id, schedule_data=schedule, user_id=current_user.id)
    if updated_schedule is None:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없거나 업데이트할 권한이 없습니다.")
    return updated_schedule

@router.delete("/{schedule_id}", status_code=204)
def delete_existing_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: tables.User = Depends(auth_utils.get_current_user)
):
    """
    ID로 특정 일정을 삭제합니다.
    해당 일정이 현재 사용자의 소유인지 확인합니다.
    """
    success = schedule_service.delete_schedule(db=db, schedule_id=schedule_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없거나 삭제할 권한이 없습니다.")
    return Response(status_code=204)
