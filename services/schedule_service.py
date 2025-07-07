from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

import crud
import schemas
from models import tables

def get_schedules(db: Session, user_id: int, schedule_date: Optional[date] = None) -> List[tables.Schedule]:
    """사용자의 일정 목록을 반환합니다. 특정 날짜를 지정하면 해당 날짜의 일정만 반환합니다."""
    date_str = schedule_date.isoformat() if schedule_date else None
    return crud.get_schedules_by_user(db=db, user_id=user_id, date=date_str)

def add_schedule(db: Session, schedule_data: schemas.ScheduleCreate, user_id: int) -> tables.Schedule:
    """새로운 일정을 추가합니다."""
    return crud.create_schedule(db=db, schedule=schedule_data, user_id=user_id)

def update_schedule(db: Session, schedule_id: int, schedule_data: schemas.ScheduleCreate, user_id: int) -> Optional[tables.Schedule]:
    """기존 일정을 업데이트합니다."""
    return crud.update_schedule(db=db, schedule_id=schedule_id, schedule=schedule_data, user_id=user_id)

def delete_schedule(db: Session, schedule_id: int, user_id: int) -> bool:
    """특정 일정을 삭제합니다."""
    return crud.delete_schedule(db=db, schedule_id=schedule_id, user_id=user_id)
