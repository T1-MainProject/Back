import json
from pathlib import Path
from typing import Dict, Any, Optional

# 사용자 데이터 파일 경로 설정
USER_DATA_FILE = Path("data/users.json")
USER_DATA_FILE.parent.mkdir(exist_ok=True)

# 사용자 데이터 파일이 없으면 초기화
if not USER_DATA_FILE.exists():
    with open(USER_DATA_FILE, "w", encoding="utf-8") as f:
        # HomeScreen.js의 예시 데이터를 기반으로 초기 사용자 생성
        initial_user = {
            "kangjongwoo": {
                "id": "kangjongwoo",
                "name": "강종우",
                "profileImg": "/images/profile.png"
            }
        }
        json.dump(initial_user, f, ensure_ascii=False, indent=2)

def _load_users() -> Dict[str, Any]:
    """사용자 데이터를 파일에서 로드합니다."""
    with open(USER_DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def _save_users(users: Dict[str, Any]):
    """사용자 데이터를 파일에 저장합니다."""
    with open(USER_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """특정 사용자의 프로필 정보를 반환합니다."""
    users = _load_users()
    return users.get(user_id)

def update_user_profile(user_id: str, profile_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """사용자 프로필 정보를 업데이트합니다."""
    users = _load_users()
    if user_id in users:
        users[user_id].update(profile_data)
        _save_users(users)
        return users[user_id]
    return None
