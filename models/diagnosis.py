from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

class DiagnosisResult(BaseModel):
    diagnosis: str = Field(..., description="진단명")
    confidence: float = Field(..., description="신뢰도 점수")
    riskLevel: str = Field(..., description="위험도 수준")
    description: str = Field(..., description="설명")
    recommendations: List[str] = Field(..., description="권장 사항")
    diagnosisDate: str = Field(default_factory=lambda: datetime.now().isoformat(), description="진단 날짜")
    features: Optional[dict] = Field(None, description="추가적인 분석 특징")

class Record(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="기록 ID")
    img: str = Field(..., description="이미지 URL")
    title: str = Field(..., description="기록 제목 (진단명)")
    date: str = Field(..., description="기록 날짜")
    diagnosis_result: DiagnosisResult = Field(..., description="상세 진단 결과")
    user_id: str = Field(..., description="사용자 ID")
