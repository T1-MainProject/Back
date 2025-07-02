# Scancer Backend API

FastAPI 기반의 Scancer 애플리케이션 백엔드입니다.

## 기능

- 피부 이미지 업로드 및 분석
- Gemini API를 활용한 피부 질환 진단
- 진단 기록 저장 및 관리

## 설치 방법

1. 필요한 패키지 설치:

```bash
pip install -r requirements.txt
```

2. `.env` 파일에 Gemini API 키가 설정되어 있는지 확인하세요:

```
GEMINI_API_KEY=your_api_key_here
```

## 실행 방법

다음 명령어로 서버를 실행합니다:

```bash
uvicorn main:app --reload
```

서버는 기본적으로 http://localhost:8000 에서 실행됩니다.

## API 엔드포인트

### 진단 API

- `POST /api/diagnose`: 이미지를 업로드하여 피부 질환 진단
  - 요청: 이미지 파일 (form-data)
  - 응답: 진단 결과 및 이미지 URL

### 기록 관리 API

- `GET /api/records`: 모든 진단 기록 조회
- `POST /api/records`: 새로운 진단 기록 추가
- `DELETE /api/records/{record_id}`: 특정 진단 기록 삭제

## API 문서

서버 실행 후 다음 URL에서 API 문서를 확인할 수 있습니다:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
