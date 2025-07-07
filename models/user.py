from pydantic import BaseModel, Field
from typing import Optional

class UserProfile(BaseModel):
    id: str = Field(..., description="사용자 ID")
    name: str = Field(..., description="사용자 이름")
    profileImg: Optional[str] = Field(None, description="프로필 이미지 URL")

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    profileImg: Optional[str] = None
