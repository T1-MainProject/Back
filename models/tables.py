from sqlalchemy import Column, Integer, String, DateTime, func
import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship

from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    birth = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    records = relationship("DiagnosisRecord", back_populates="owner")
    schedules = relationship("Schedule", back_populates="owner")

class DiagnosisRecord(Base):
    __tablename__ = "diagnosis_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    image_path = Column(String, nullable=False)
    diagnosis = Column(String)
    confidence = Column(Float)
    risk_level = Column(String)
    description = Column(Text)
    recommendations = Column(JSON)
    features = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="records")

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    desc = Column(Text)
    date = Column(String, nullable=False) # Storing date as string for simplicity
    time = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="schedules")
