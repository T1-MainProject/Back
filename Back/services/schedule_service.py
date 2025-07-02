import json
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import date

# 일정 데이터 파일 경로 설정
SCHEDULE_DATA_FILE = Path("data/schedules.json")
SCHEDULE_DATA_FILE.parent.mkdir(exist_ok=True)

# 일정 데이터 파일이 없으면 초기화
if not SCHEDULE_DATA_FILE.exists():
    with open(SCHEDULE_DATA_FILE, "w", encoding="utf-8") as f:
        # HomeScreen.js의 예시 데이터를 기반으로 초기 일정 생성
        initial_schedule = [
            {
                "id": str(uuid.uuid4()),
                "time": "10 AM",
                "title": "진료 예약",
                "desc": "흑색종 의심으로 인한 진료 예약",
                "date": "2025-06-25",
                "userId": "kangjongwoo"
            }
        ]
        json.dump(initial_schedule, f, ensure_ascii=False, indent=2)

def _load_schedules() -> List[Dict[str, Any]]:
    """일정 데이터를 파일에서 로드합니다."""
    with open(SCHEDULE_DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def _save_schedules(schedules: List[Dict[str, Any]]):
    """일정 데이터를 파일에 저장합니다."""
    with open(SCHEDULE_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(schedules, f, ensure_ascii=False, indent=2)

def get_schedules(user_id: str, schedule_date: Optional[date] = None) -> List[Dict[str, Any]]:
    """사용자의 일정 목록을 반환합니다. 특정 날짜를 지정하면 해당 날짜의 일정만 반환합니다."""
    schedules = _load_schedules()
    user_schedules = [s for s in schedules if s.get("userId") == user_id]
    
    if schedule_date:
        return [s for s in user_schedules if s.get("date") == schedule_date.isoformat()]
    
    return user_schedules

def add_schedule(schedule_data: Dict[str, Any]) -> Dict[str, Any]:
    """새로운 일정을 추가합니다."""
    schedules = _load_schedules()
    
    new_schedule = schedule_data.copy()
    new_schedule["id"] = str(uuid.uuid4())
    
    schedules.append(new_schedule)
    _save_schedules(schedules)
    
    return new_schedule

def update_schedule(schedule_id: str, schedule_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """기존 일정을 업데이트합니다."""
    schedules = _load_schedules()
    for i, schedule in enumerate(schedules):
        if schedule.get("id") == schedule_id:
            schedules[i].update(schedule_data)
            _save_schedules(schedules)
            return schedules[i]
    return None

def delete_schedule(schedule_id: str) -> bool:
    """특정 일정을 삭제합니다."""
    schedules = _load_schedules()
    original_length = len(schedules)
    filtered_schedules = [s for s in schedules if s.get("id") != schedule_id]
    
    if len(filtered_schedules) < original_length:
        _save_schedules(filtered_schedules)
        return True
    return False
