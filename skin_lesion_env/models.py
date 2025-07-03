from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from .database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Image(Base):
    __tablename__ = "images"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String)
    lesion_type = Column(String)
    diagnosis = Column(String)
    file_size = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)
    uploaded_by = Column(String, index=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    is_synthetic = Column(Boolean, default=False)
    ai_prediction = Column(String)
    confidence = Column(String)

class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    description = Column(Text)
    lesion_types = Column(Text)
    is_public = Column(Boolean, default=False)
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
