# 예약 API 문서

## 기본 정보
- **Base URL**: `http://localhost:3001`
- **Content-Type**: `application/json`
- **인증**: JWT Token (Authorization 헤더에 Bearer 토큰 필요)

## 인증 토큰 획득

### 1. 로그인
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password"
}
```

응답에서 `token` 값을 복사하여 다음 API 호출 시 사용

---

## 예약 API

### 1. 예약 등록 (POST)

**Endpoint**: `POST /api/reservations`

**Headers**:
```
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoicmpzZHVkNTczNUBuYXZlci5jb20iLCJpYXQiOjE3NTI1NDQxOTEsImV4cCI6MTc1MzE0ODk5MX0.exGdpqhD4w1M_EpaZvJD625Abc9VObLZSLa8aYXqBDE
Content-Type: application/json
```

**Request Body**:
```json
{
  "date": "2025-07-12",
  "time": "14:00",
  "purpose": "피부과 진료 예약"
}
```

**Response (201 Created)**:
```json
{
  "reservation_id": 1,
  "message": "예약이 등록되었습니다.",
  "reservation": {
    "id": 1,
    "date": "2025-07-12",
    "time": "14:00",
    "purpose": "피부과 진료 예약",
    "status": "confirmed"
  }
}
```

**Error Response (400 Bad Request)**:
```json
{
  "error": "날짜, 시간, 목적을 모두 입력해주세요."
}
```

---

### 2. 예약 조회 (GET)

**Endpoint**: `GET /api/reservations/{id}`

**Headers**:
```
 Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoicmpzZHVkNTczNUBuYXZlci5jb20iLCJpYXQiOjE3NTI1NDQxOTEsImV4cCI6MTc1MzE0ODk5MX0.exGdpqhD4w1M_EpaZvJD625Abc9VObLZSLa8aYXqBDE
```

**Response (200 OK)**:
```json
[
  {
    "reservation_id": 1,
    "date": "2025-07-12",
    "time": "14:00",
    "purpose": "피부과 진료 예약",
    "status": "confirmed"
  },
  {
    "reservation_id": 2,
    "date": "2025-07-15",
    "time": "10:30",
    "purpose": "재진료",
    "status": "confirmed"
  }
]
```

---

### 3. 특정 예약 조회 (GET)

**Endpoint**: `GET /api/reservations/{id}`

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoicmpzZHVkNTczNUBuYXZlci5jb20iLCJpYXQiOjE3NTI1NDQxOTEsImV4cCI6MTc1MzE0ODk5MX0.exGdpqhD4w1M_EpaZvJD625Abc9VObLZSLa8aYXqBDE
```

**Response (200 OK)**:
```json
{
  "reservation_id": 1,
  "date": "2025-07-12",
  "time": "14:00",
  "purpose": "피부과 진료 예약",
  "status": "confirmed"
}
```

**Error Response (404 Not Found)**:
```json
{
  "error": "예약을 찾을 수 없습니다."
}
```

---

### 4. 예약 수정 (PUT)

**Endpoint**: `PUT /api/reservations/{id}`

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoicmpzZHVkNTczNUBuYXZlci5jb20iLCJpYXQiOjE3NTI1NDQxOTEsImV4cCI6MTc1MzE0ODk5MX0.exGdpqhD4w1M_EpaZvJD625Abc9VObLZSLa8aYXqBDE
Content-Type: application/json
```

**Request Body**:
```json
{
  "date": "2025-07-13",
  "time": "15:30"
}
```

**Response (200 OK)**:
```json
{
  "message": "예약이 수정되었습니다.",
  "reservation_id": 1
}
```

**Error Response (404 Not Found)**:
```json
{
  "error": "예약을 찾을 수 없습니다."
}
```

---

### 5. 예약 삭제 (DELETE)

**Endpoint**: `DELETE /api/reservations/{id}`

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoicmpzZHVkNTczNUBuYXZlci5jb20iLCJpYXQiOjE3NTI1NDQxOTEsImV4cCI6MTc1MzE0ODk5MX0.exGdpqhD4w1M_EpaZvJD625Abc9VObLZSLa8aYXqBDE
```

**Response (200 OK)**:
```json
{
  "message": "예약이 삭제되었습니다.",
  "reservation_id": 1
}
```

**Error Response (404 Not Found)**:
```json
{
  "error": "예약을 찾을 수 없습니다."
}
```

---

## Postman Collection 설정

### 1. 환경 변수 설정
- `base_url`: `http://localhost:3001`
- `token`: 로그인 후 받은 JWT 토큰

### 2. Pre-request Script (로그인 후)
```javascript
// 로그인 응답에서 토큰을 환경 변수로 설정
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set("token", response.token);
}
```

### 3. Authorization 설정
- Type: `Bearer Token`
- Token: `{{token}}`

---

## 테스트 시나리오

### 1. 기본 플로우
1. 로그인하여 토큰 획득
2. 예약 등록
3. 예약 목록 조회
4. 특정 예약 조회
5. 예약 수정
6. 예약 삭제

### 2. 에러 케이스
1. 잘못된 날짜 형식으로 예약 등록
2. 과거 날짜로 예약 등록
3. 잘못된 시간 형식으로 예약 등록
4. 존재하지 않는 예약 수정/삭제
5. 다른 사용자의 예약 수정/삭제

---

## 데이터 형식 규칙

### 날짜 형식
- **형식**: `YYYY-MM-DD`
- **예시**: `2025-07-12`

### 시간 형식
- **형식**: `HH:MM`
- **예시**: `14:00`, `09:30`

### 목적 (purpose)
- **타입**: 문자열
- **최대 길이**: 제한 없음
- **예시**: `"피부과 진료 예약"`, `"재진료"`, `"검사"`

---

## 상태 코드

- `200`: 성공
- `201`: 생성 성공 (예약 등록)
- `400`: 잘못된 요청 (입력 검증 실패)
- `401`: 인증 실패
- `403`: 권한 없음
- `404`: 리소스 없음
- `500`: 서버 오류 

---

## 설명

- 아래 코드는 **파이썬에서 예약 수정(UPDATE, PUT) 요청을 보내는 예시**입니다:
  ```python
  body = {
      "userId": user_id,
      "date": date,
      "time": new_time,
      "purpose": purpose,
      "status": target.get("status", "confirmed")
  }
  put_url = f"http://localhost:3001/api/reservations/{user_id}"
  put_res = requests.put(put_url, json=body, headers=headers)
  ```
- 이 코드는 **챗봇 백엔드(파이썬)**에서 사용자가 "예약을 바꿔줘"라고 했을 때  
  Express(노드) 서버의 `/api/reservations/{userId}`로 예약 수정 요청을 보내는 부분입니다.

---

## Postman에서 직접 테스트하려면?

**Postman에서 예약 수정(UPDATE) 테스트 방법:**

1. **Method:** PUT
2. **URL:**  
   ```
   http://localhost:3001/api/reservations/1
   ```
   (여기서 1은 userId)
3. **Body (JSON):**
   ```json
   {
     "userId": 1,
     "date": "2025-07-19",
     "time": "17:00",
     "purpose": "진료",
     "status": "confirmed"
   }
   ```
4. **Headers:**  
   - Content-Type: application/json

---

## 요약

- **파이썬 코드:** 챗봇에서 자동으로 예약 수정할 때 사용
- **Postman:** 직접 API를 테스트할 때 사용 (위 방법 참고)

---

**Postman에서 직접 테스트해보고 싶으면 위 방법대로 해보세요!  
문제가 있으면 응답 결과를 보여주시면 원인 분석해드릴 수 있습니다.** 

---

## 원인 분석

이 에러는 대부분 **Express(서버)에서 SQL 쿼리 오류**나  
**body 파싱 문제** 등으로 발생합니다.

### 1. 테이블 구조 확인
- 현재 `reservations` 테이블은 **userId가 PRIMARY KEY**입니다.
- 즉, `id` 컬럼이 없고, `userId`가 곧 예약의 고유번호입니다.

### 2. 서버 코드(Express)에서 PUT 라우트 확인
- `server.js`의 `/api/reservations/:id` 라우트에서  
  **id → userId**로 동작해야 합니다.

#### 예시 (수정 필요)
```js
// 기존 코드 (id 컬럼 기준)
app.put('/api/reservations/:id', (req, res) => {
  const { id } = req.params;
  const { userId, date, time, purpose, status } = req.body;
  db.run(
    `UPDATE reservations SET date = ?, time = ?, purpose = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
    [date, time, purpose, status, id],
    function (err) {
      if (err) return res.status(500).json({ error: "서버 오류가 발생했습니다." });
      res.json({ success: true });
    }
  );
});
```

#### **수정해야 할 부분**
- **WHERE id = ?** → **WHERE userId = ?**
- **id** 변수 → **userId** 변수로 통일

---

## 수정 예시

```js
<code_block_to_apply_changes_from>
app.put('/api/reservations/:userId', (req, res) => {
  const { userId } = req.params;
  const { date, time, purpose, status } = req.body;
  db.run(
    `UPDATE reservations SET date = ?, time = ?, purpose = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ?`,
    [date, time, purpose, status, userId],
    function (err) {
      if (err) return res.status(500).json({ error: "서버 오류가 발생했습니다." });
      res.json({ success: true });
    }
  );
});
```

---

## 정리

1. **server.js**에서  
   - `PUT /api/reservations/:userId`  
   - 쿼리의 WHERE 조건을 **userId**로 변경
2. **Postman**에서는  
   - URL: `http://localhost:3001/api/reservations/1`
   - Body:  
     ```json
     {
       "userId": 1,
       "date": "2025-07-19",
       "time": "17:00",
       "purpose": "진료",
       "status": "confirmed"
     }
     ```

---

### 이렇게 수정한 후 다시 시도해보세요!  
**500 에러가 계속 나오면, server.js의 해당 부분 코드를 보여주시면 더 정확히 진단해드릴 수 있습니다.** 