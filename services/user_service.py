from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

import crud
import schemas
from models import tables

def get_user_profile(db: Session, user_id: int) -> Optional[tables.User]:
    """특정 사용자의 프로필 정보를 반환합니다."""
    return db.query(models.User).filter(models.User.id == user_id).first()

def update_user_profile(db: Session, user_id: int, profile_data: schemas.UserProfileUpdate) -> Optional[tables.User]:
    """사용자 프로필 정보를 업데이트합니다."""
    db_user = get_user_profile(db, user_id)
    if db_user:
        update_data = profile_data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_user, key, value)
        db.commit()
        db.refresh(db_user)
    return db_user
