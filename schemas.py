from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class ImageInfo(BaseModel):
    id: int
    filename: str
    original_filename: str
    lesion_type: str
    diagnosis: str
    file_size: int
    width: int
    height: int
    uploaded_at: datetime
    uploaded_by: str
    is_synthetic: Optional[bool] = False
    ai_prediction: Optional[str]
    confidence: Optional[str]

    class Config:
        orm_mode = True

class DatasetCreate(BaseModel):
    name: str
    description: str
    lesion_types: List[str]
    is_public: Optional[bool] = False
