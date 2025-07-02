import os
import base64
from datetime import datetime
from PIL import Image
import google.generativeai as genai
from PIL import Image
import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# .env 파일에서 환경 변수 로드
load_dotenv()

# Gemini API 키 설정
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

# --- 데이터 파일 경로 ---
RECORDS_FILE = Path("data/records.json")
RECORDS_FILE.parent.mkdir(exist_ok=True)
if not RECORDS_FILE.exists():
    with open(RECORDS_FILE, "w", encoding="utf-8") as f:
        json.dump([], f, ensure_ascii=False)

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
    "basal_cell_carcinoma": {
        "name_kr": "기저세포암",
        "risk_level": "위험",
        "description": "기저세포암은 가장 흔한 유형의 피부암으로, 일반적으로 햇빛에 노출된 부위에 발생합니다. 진주 모양의 융기, 상처, 또는 붉은 반점으로 나타날 수 있으며, 천천히 자라지만 주변 조직을 파괴할 수 있습니다.",
        "recommendations": [
            "즉시 피부과 전문의의 진료를 받으세요.",
            "외과적 제거, 방사선 치료 등 전문적인 치료가 필요합니다.",
            "치료 후에도 재발 가능성이 있으므로 정기적인 추적 관찰이 중요합니다."
        ]
    },
    "dermatofibroma": {
        "name_kr": "피부섬유종",
        "risk_level": "안전",
        "description": "피부섬유종은 단단하고 작은 양성 종양으로, 보통 다리에 나타납니다. 일반적으로 무해하며 치료가 필요하지 않지만, 다른 피부 질환과 감별이 필요할 수 있습니다.",
        "recommendations": [
            "대부분 치료가 필요 없지만, 미용적 문제나 불편함이 있다면 제거를 고려할 수 있습니다.",
            "크기나 모양에 변화가 있는지 주기적으로 관찰하세요.",
            "정확한 진단을 위해 피부과 전문의와 상담하는 것이 좋습니다."
        ]
    },
    "melanoma": {
        "name_kr": "흑색종",
        "risk_level": "매우 위험",
        "description": "흑색종은 가장 위험한 형태의 피부암으로, 멜라닌 세포에서 발생합니다. 기존 점의 모양, 크기, 색깔 변화나 새로운 점의 발생으로 나타날 수 있으며, 조기 발견과 치료가 매우 중요합니다.",
        "recommendations": [
            "지체 없이 피부과 전문의의 진료를 받아야 합니다.",
            "정확한 진단을 위해 조직 검사가 필요할 수 있습니다.",
            "조기 발견 시 완치율이 높으므로, 의심되는 병변이 있다면 즉시 병원을 방문하세요."
        ]
    },
    "nevus": {
        "name_kr": "모반 (점)",
        "risk_level": "안전",
        "description": "모반은 일반적으로 '점'이라고 불리는 흔한 양성 피부 병변입니다. 대부분 무해하지만, 비정형적인 모양을 보이거나 변화가 있을 경우 흑색종과의 감별이 필요합니다.",
        "recommendations": [
            "대부분의 점은 치료가 필요하지 않습니다.",
            "ABCDE 규칙(비대칭성, 불규칙한 경계, 다양한 색상, 직경 6mm 이상, 변화)을 사용하여 주기적으로 점을 자가 검진하세요.",
            "변화가 관찰되면 피부과 전문의와 상담하세요."
        ]
    },
    "seborrheic_keratosis": {
        "name_kr": "지루각화증",
        "risk_level": "안전",
        "description": "지루각화증은 흔한 양성 피부 종양으로, 나이가 들면서 발생합니다. 사마귀처럼 보이며 갈색 또는 검은색을 띨 수 있습니다. 악성으로 변하지는 않지만, 다른 피부암과 유사해 보일 수 있습니다.",
        "recommendations": [
            "일반적으로 치료가 필요하지 않습니다.",
            "미용적인 이유나 자극으로 인해 불편할 경우 제거할 수 있습니다.",
            "정확한 진단을 위해 피부과 전문의의 확인을 받는 것이 좋습니다."
        ]
    },
    "squamous_cell_carcinoma": {
        "name_kr": "편평세포암",
        "risk_level": "위험",
        "description": "편평세포암은 두 번째로 흔한 피부암으로, 햇빛 노출 부위에 주로 발생합니다. 붉고 단단한 결절, 비늘 모양의 패치, 또는 아물지 않는 상처로 나타날 수 있으며, 다른 부위로 전이될 수 있습니다.",
        "recommendations": [
            "즉시 피부과 전문의의 진료를 받으세요.",
            "외과적 제거, 방사선 치료 등 전문적인 치료가 필요합니다.",
            "자외선 차단과 정기적인 피부 검진으로 예방 및 조기 발견이 중요합니다."
        ]
    },
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

# --- 진단 기록 CRUD 함수 ---

def _load_records() -> List[Dict[str, Any]]:
    """진단 기록을 파일에서 로드합니다."""
    with open(RECORDS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def _save_records(records: List[Dict[str, Any]]):
    """진단 기록을 파일에 저장합니다."""
    with open(RECORDS_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

def get_records(user_id: str) -> List[Dict[str, Any]]:
    """특정 사용자의 진단 기록을 조회합니다."""
    all_records = _load_records()
    return [r for r in all_records if r.get("user_id") == user_id]

def add_record(record_data: Dict[str, Any]):
    """새로운 진단 기록을 추가합니다."""
    records = _load_records()
    records.insert(0, record_data)
    _save_records(records)

def delete_record(record_id: str) -> bool:
    """특정 진단 기록을 삭제합니다."""
    records = _load_records()
    original_length = len(records)
    filtered_records = [r for r in records if r.get("id") != record_id]
    
    if len(filtered_records) < original_length:
        _save_records(filtered_records)
        return True
    return False

# --- 이미지 분석 함수 ---

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
