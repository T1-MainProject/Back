from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, time
import uuid

class ScheduleBase(BaseModel):
    time: str = Field(..., description="일정 시간 (예: '10 AM')")
    title: str = Field(..., description="일정 제목")
    desc: Optional[str] = Field(None, description="일정 설명")
    date: date = Field(..., description="일정 날짜")
    user_id: str = Field(..., description="사용자 ID")

class ScheduleCreate(ScheduleBase):
    pass

class Schedule(ScheduleBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="일정 ID")

    class Config:
        orm_mode = True
