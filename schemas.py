from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import datetime

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# --- User Schemas ---
class UserBase(BaseModel):
    email: str
    name: str
    phone: Optional[str] = None
    birth: Optional[str] = None

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class DiagnosisRecordBase(BaseModel):
    image_path: str
    diagnosis: str
    confidence: float
    risk_level: str
    description: str
    recommendations: List[str]
    features: Dict[str, Any]

class DiagnosisRecordCreate(DiagnosisRecordBase):
    pass

class DiagnosisRecord(DiagnosisRecordBase):
    id: int
    user_id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class ScheduleBase(BaseModel):
    title: str
    desc: Optional[str] = None
    date: str
    time: Optional[str] = None

class ScheduleCreate(ScheduleBase):
    pass

class Schedule(ScheduleBase):
    id: int
    user_id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class User(UserBase):
    id: int
    created_at: datetime.datetime
    records: List[DiagnosisRecord] = []
    schedules: List[Schedule] = []

    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    birth: Optional[str] = None
