import os
import re
import time

def get_extension(filename: str) -> str:
    """파일 이름에서 확장자를 반환합니다."""
    return os.path.splitext(filename)[1]

def format_file_size(bytes_size: int) -> str:
    """파일 크기를 사람이 읽기 쉬운 형태로 포맷팅합니다."""
    if bytes_size == 0:
        return "0 Bytes"
    k = 1024
    sizes = ["Bytes", "KB", "MB", "GB"]
    i = 0
    while bytes_size >= k and i < len(sizes) - 1:
        bytes_size /= k
        i += 1
    return f"{bytes_size:.2f} {sizes[i]}"

def sanitize_filename(filename: str) -> str:
    """안전한 파일명을 위해 특수문자를 밑줄로 바꿉니다."""
    return re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)

def generate_safe_filename(original_name: str) -> str:
    """타임스탬프를 포함한 안전한 파일명을 생성합니다."""
    timestamp = int(time.time())
    base, ext = os.path.splitext(original_name)
    sanitized_base = sanitize_filename(base)
    return f"{sanitized_base}_{timestamp}{ext}"
