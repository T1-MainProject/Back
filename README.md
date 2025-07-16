# Skancer! - AI 피부 질환 진단 앱

Hugging Face AI 모델을 활용한 피부 질환 진단 웹 애플리케이션입니다.

## 🚀 주요 기능

- **AI 기반 피부 질환 진단**: Hugging Face 모델을 사용한 정확한 진단
- **다중 모델 지원**: 다양한 피부 질환 분류 모델 선택 가능
- **실시간 이미지 분석**: 업로드된 이미지의 즉시 분석
- **진료 기록 관리**: 사용자별 진단 기록 저장 및 조회
- **사용자 인증**: JWT 기반 보안 인증 시스템
- **반응형 UI**: 모바일 친화적인 인터페이스



## 📋 요구사항

- Node.js 16.0.0 이상
- npm 또는 yarn
- Hugging Face API 토큰
- SQLite 데이터베이스

## 🛠️ 설치 및 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 환경 변수들을 설정하세요:

```env
# Hugging Face API 설정
HF_TOKEN=your-huggingface-token-here

# JWT 시크릿 키
JWT_SECRET=your-super-secret-jwt-key-here

# 서버 포트
PORT=3001

# 데이터베이스 설정
DB_PATH=./medical_app.db

# 개발 환경 설정
NODE_ENV=development
```

### 3. Hugging Face API 토큰 발급

1. [Hugging Face](https://huggingface.co/)에 가입하고 로그인
2. [Settings > Access Tokens](https://huggingface.co/settings/tokens)로 이동
3. "New token" 클릭
4. 토큰 이름을 입력하고 "read" 권한 선택
5. 생성된 토큰을 `.env` 파일의 `HF_TOKEN`에 설정

## 🚀 실행

### 개발 모드
```bash
npm run dev
```

### 프로덕션 모드
```bash
npm start
```

## 📚 API 문서

### 인증 API

#### 회원가입
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "홍길동",
  "phone": "010-1234-5678",
  "birth": "1990-01-01"
}
```

#### 로그인
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### 진단 API

#### 피부 질환 진단
```
POST /api/diagnose
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "image": <file>,
  "modelType": "skin-cancer" // 선택사항
}
```

#### 사용 가능한 모델 목록
```
GET /api/available-models
Authorization: Bearer <token>
```

#### 모델 테스트
```
GET /api/test-model?modelType=skin-cancer
Authorization: Bearer <token>
```

### 진료 기록 API

#### 진료 기록 조회
```
GET /api/records
Authorization: Bearer <token>
```

#### 진료 기록 추가
```
POST /api/records
Authorization: Bearer <token>
Content-Type: application/json

{
  "img": "base64_image_data",
  "diagnosis": "진단명",
  "confidence": 0.95,
  "riskLevel": "높음",
  "description": "진단 설명",
  "recommendations": ["권장사항1", "권장사항2"]
}
```

## 🔧 사용 예시

### 1. Hugging Face 모델을 사용한 진단

```javascript
const huggingfaceService = require('./src/services/huggingfaceService');

// 이미지 버퍼로 진단 수행
const diagnosis = await huggingfaceService.diagnoseSkinDisease(imageBuffer, 'skin-cancer');
console.log('진단 결과:', diagnosis);
```

### 2. 사용 가능한 모델 목록 조회

```javascript
const models = huggingfaceService.getAvailableModels();
console.log('사용 가능한 모델:', models);
```

### 3. 모델 테스트

```javascript
const testResult = await huggingfaceService.testModel('melanoma');
console.log('테스트 결과:', testResult);
```

## 📁 프로젝트 구조

```
├── server.js                    # 메인 서버 파일
├── database.js                  # 데이터베이스 설정
├── medical_app.db              # SQLite 데이터베이스
├── package.json                # 프로젝트 의존성
├── src/
│   ├── App.js                  # React 메인 컴포넌트
│   ├── index.jsx               # React 진입점
│   ├── components/             # React 컴포넌트들
│   │   ├── LoginScreen.js      # 로그인 화면
│   │   ├── HomeScreen.js       # 홈 화면
│   │   ├── CameraScreen.js     # 카메라 화면
│   │   └── DiagnosisResult.js  # 진단 결과 화면
│   └── services/
│       └── huggingfaceService.js # Hugging Face 서비스
└── build/                      # 빌드된 파일들
```

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🆘 문제 해결

### 일반적인 문제들

1. **Hugging Face API 토큰 오류**
   - 토큰이 올바르게 설정되었는지 확인
   - 토큰의 권한이 "read"로 설정되었는지 확인

2. **모델 연결 오류**
   - 인터넷 연결 상태 확인
   - 모델명이 올바른지 확인
   - API 요청 제한에 도달하지 않았는지 확인

3. **이미지 업로드 오류**
   - 이미지 파일 크기가 10MB 이하인지 확인
   - 지원되는 이미지 형식인지 확인 (JPG, PNG, etc.)

4. **데이터베이스 오류**
   - `medical_app.db` 파일이 존재하는지 확인
   - 데이터베이스 권한이 올바른지 확인

2. **MCP 서버 연결 실패**
   - MCP 서버가 실행 중인지 확인
   - WebSocket URL이 올바른지 확인

3. **포트 충돌**
   - 다른 프로세스가 3000번 포트를 사용하고 있는지 확인
   - `.env` 파일에서 `PORT` 설정 변경

## 📞 지원

문제가 발생하거나 질문이 있으시면 이슈를 생성해 주세요. 