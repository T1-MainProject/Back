from sqlalchemy.orm import Session
from models import tables as models
import schemas
from typing import List
import auth
from typing import Optional


# --- User CRUD ---
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password, name=user.name, phone=user.phone, birth=user.birth)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_records_by_user(db: Session, user_id: int) -> List[models.DiagnosisRecord]:
    """특정 사용자의 모든 진단 기록을 조회합니다."""
    return db.query(models.DiagnosisRecord).filter(models.DiagnosisRecord.user_id == user_id).order_by(models.DiagnosisRecord.created_at.desc()).all()

def create_diagnosis_record(db: Session, record: schemas.DiagnosisRecordCreate, user_id: int) -> models.DiagnosisRecord:
    """새로운 진단 기록을 데이터베이스에 추가합니다."""
    db_record = models.DiagnosisRecord(**record.dict(), user_id=user_id)
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

# --- Schedule CRUD ---

def get_schedules_by_user(db: Session, user_id: int, date: Optional[str] = None) -> List[models.Schedule]:
    """특정 사용자의 일정을 조회합니다. 날짜가 지정되면 해당 날짜의 일정만 필터링합니다."""
    query = db.query(models.Schedule).filter(models.Schedule.user_id == user_id)
    if date:
        query = query.filter(models.Schedule.date == date)
    return query.order_by(models.Schedule.date, models.Schedule.time).all()

def create_schedule(db: Session, schedule: schemas.ScheduleCreate, user_id: int) -> models.Schedule:
    """새로운 일정을 데이터베이스에 추가합니다."""
    db_schedule = models.Schedule(**schedule.dict(), user_id=user_id)
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

def update_schedule(db: Session, schedule_id: int, schedule: schemas.ScheduleCreate, user_id: int) -> Optional[models.Schedule]:
    """기존 일정을 업데이트합니다."""
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id, models.Schedule.user_id == user_id).first()
    if db_schedule:
        update_data = schedule.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_schedule, key, value)
        db.commit()
        db.refresh(db_schedule)
    return db_schedule

def delete_schedule(db: Session, schedule_id: int, user_id: int) -> bool:
    """특정 일정을 삭제합니다."""
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id, models.Schedule.user_id == user_id).first()
    if db_schedule:
        db.delete(db_schedule)
        db.commit()
        return True
    return False
