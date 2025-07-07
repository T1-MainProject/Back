from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

import crud
import schemas
from auth import get_current_user
from database import get_db
from models import tables as models

router = APIRouter(
    prefix="/api/records",
    tags=["Records"],
)

@router.get("/", response_model=List[schemas.DiagnosisRecord])
def read_user_records(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retrieve all diagnosis records for the current logged-in user.
    """
    records = crud.get_records_by_user(db, user_id=current_user.id)
    return records
