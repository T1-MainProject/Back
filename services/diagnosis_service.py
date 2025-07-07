import os
import json
from typing import List, Dict, Any, Optional
from PIL import Image
import google.generativeai as genai
from dotenv import load_dotenv
from sqlalchemy.orm import Session

import crud
import schemas
from models import tables

# .env 파일에서 환경 변수 로드
load_dotenv()

# Gemini API 키 설정
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

# --- 피부 질환 정보 (예시 데이터) ---
skin_conditions = {
    "actinic_keratosis": {
        "name_kr": "광선각화증",
        "risk_level": "주의",
        "description": "광선각화증은 장기간 햇빛 노출로 인해 발생하는 피부 전암 병변입니다. 거칠고 비늘 같은 패치로 나타나며, 치료하지 않으면 편평세포암으로 발전할 수 있습니다.",
        "recommendations": [
            "피부과 전문의와 상담하여 정확한 진단 및 치료 계획을 세우세요.",
            "자외선 차단제를 꾸준히 사용하고, 햇빛 노출을 최소화하세요.",
            "정기적인 피부 검진을 통해 변화를 관찰하세요."
        ]
    },
    # ... (기존 skin_conditions 데이터 유지) ...
    "vascular_lesion": {
        "name_kr": "혈관성 병변",
        "risk_level": "주의",
        "description": "혈관성 병변은 혈관의 비정상적인 증식으로 인해 발생하며, 체리 혈관종, 거미 혈관종 등 다양한 종류가 있습니다. 대부분 양성이지만, 다른 질환과의 감별이 필요할 수 있습니다.",
        "recommendations": [
            "대부분 치료가 필요 없지만, 출혈이나 미용적 문제가 있을 경우 레이저 치료 등을 고려할 수 있습니다.",
            "갑자기 크기가 커지거나 출혈이 잦아지면 피부과 전문의와 상담하세요.",
            "정확한 진단을 위해 전문가의 확인이 필요합니다."
        ]
    }
}

def get_records(db: Session, user_id: int) -> List[tables.DiagnosisRecord]:
    """특정 사용자의 진단 기록을 조회합니다."""
    return crud.get_records_by_user(db=db, user_id=user_id)

def delete_record(db: Session, record_id: int, user_id: int) -> bool:
    """특정 진단 기록을 삭제합니다."""
    record = db.query(tables.DiagnosisRecord).filter(tables.DiagnosisRecord.id == record_id, tables.DiagnosisRecord.user_id == user_id).first()
    if record:
        db.delete(record)
        db.commit()
        return True
    return False

async def analyze_and_save_skin_image(db: Session, image_path: str, user_id: int) -> tables.DiagnosisRecord:
    """
    Gemini Pro Vision API를 사용하여 피부 이미지를 분석하고, 결과를 데이터베이스에 저장합니다.
    """
    analysis_result = await analyze_skin_image(image_path)

    record_data = schemas.DiagnosisRecordCreate(
        image_path=image_path,
        **analysis_result
    )

    return crud.create_diagnosis_record(db=db, record=record_data, user_id=user_id)

async def analyze_skin_image(image_path: str) -> dict:
    """
    Gemini Pro Vision API를 사용하여 피부 이미지를 분석하고 진단 결과를 반환합니다.
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY가 설정되지 않았습니다.")

    model = genai.GenerativeModel('gemini-pro-vision')
    
    try:
        image = Image.open(image_path)
    except Exception as e:
        raise IOError(f"이미지 파일을 열 수 없습니다: {e}")

    # 프롬프트 정의
    prompt = f"""
    당신은 피부과 전문의입니다. 다음 피부 이미지를 분석하여, 아래 목록에 있는 피부 질환 중 가장 가능성이 높은 하나를 진단해 주세요.
    반드시 다음 형식에 맞춰 JSON으로만 응답해야 합니다. 다른 설명은 절대 추가하지 마세요.

    **진단 가능한 질환 목록:**
    {', '.join(skin_conditions.keys())}

    **응답 JSON 형식:**
    {{
      "diagnosis_key": "<진단된 질환의 영문 키>",
      "confidence": <진단에 대한 신뢰도 점수 (0.0 ~ 1.0 사이의 float)>,
      "reason": "<진단 근거에 대한 간략한 설명>"
    }}
    """

    try:
        response = await model.generate_content_async([prompt, image])
        
        # 응답 텍스트에서 JSON 부분만 추출
        response_text = response.text
        json_match = response_text[response_text.find('{'):response_text.rfind('}')+1]
        
        if not json_match:
            raise ValueError("API 응답에서 유효한 JSON을 찾을 수 없습니다.")

        result_json = json.loads(json_match)
        diagnosis_key = result_json.get("diagnosis_key")
        
        if diagnosis_key in skin_conditions:
            condition_info = skin_conditions[diagnosis_key]
            return {
                "diagnosis": condition_info["name_kr"],
                "confidence": result_json.get("confidence", 0.0),
                "riskLevel": condition_info["risk_level"],
                "description": condition_info["description"],
                "recommendations": condition_info["recommendations"],
                "features": {"reason": result_json.get("reason")}
            }
        else:
            # API가 목록에 없는 질환을 반환한 경우, 일반적인 응답 생성
            return {
                "diagnosis": "알 수 없는 병변",
                "confidence": result_json.get("confidence", 0.0),
                "riskLevel": "정보 없음",
                "description": f"AI가 이미지를 분석했지만, 제공된 목록에 없는 '{diagnosis_key}'(으)로 판단했습니다. 전문가의 상담이 필요합니다.",
                "recommendations": ["피부과 전문의와 상담하여 정확한 진단을 받으세요."],
                "features": {"reason": result_json.get("reason")}
            }

    except Exception as e:
        # API 호출 실패 또는 JSON 파싱 오류 시, 대체 로직 수행
        # 여기서는 가장 흔하지만 위험도가 낮은 '모반'으로 가정하고 응답
        fallback_condition = skin_conditions["nevus"]
        return {
            "diagnosis": fallback_condition["name_kr"],
            "confidence": 0.3, # 낮은 신뢰도 점수 설정
            "riskLevel": fallback_condition["risk_level"],
            "description": f"AI 분석 중 오류가 발생했습니다. ({str(e)}) 정확한 진단을 위해 전문가와 상담하세요.",
            "recommendations": fallback_condition["recommendations"],
            "features": {"reason": "AI 분석 시스템 오류로 인한 대체 진단"}
        }
