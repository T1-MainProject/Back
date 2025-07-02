import re
from typing import List, Dict, Any

def is_valid_email(email: str) -> bool:
    """이메일 주소의 유효성을 검사합니다."""
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(email_regex, email) is not None

def is_valid_url(url: str) -> bool:
    """URL의 유효성을 검사합니다."""
    try:
        from urllib.parse import urlparse
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except ImportError:
        return False

def validate_required_fields(data: Dict[str, Any], required_fields: List[str]) -> List[str]:
    """필수 필드가 모두 있는지 검사하고, 누락된 필드 목록을 반환합니다."""
    missing_fields = [field for field in required_fields if field not in data or not data[field]]
    return missing_fields
