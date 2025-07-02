import logging
import sys

def setup_logging(level=logging.INFO):
    """애플리케이션의 기본 로깅을 설정합니다."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        stream=sys.stdout
    )

def get_logger(name: str):
    """지정된 이름으로 로거 인스턴스를 가져옵니다."""
    return logging.getLogger(name)
