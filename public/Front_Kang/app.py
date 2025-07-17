from fastapi import FastAPI, Depends, Cookie, HTTPException, Response, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from langchain.memory import ConversationBufferMemory, ConversationEntityMemory
from langchain_openai import ChatOpenAI
from langchain.schema import SystemMessage, HumanMessage
from pydantic import BaseModel
from typing import Dict, Optional, List
import uuid
import redis
import pickle
import openai
from dotenv import load_dotenv
load_dotenv()
import os
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

import sqlite3
import re
from datetime import datetime

DB_PATH = "C:/Users/Addinedu/Desktop/Final/medical_app.db"  # 경로는 실제 위치에 맞게

# users 테이블에서 한 명의 사용자 정보 조회
def get_user_by_id(user_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, name, phone, birth FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "id": row[0],
            "email": row[1],
            "name": row[2],
            "phone": row[3],
            "birth": row[4]
        }
    return None

def get_reservations_by_user_id(user_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT date, time, purpose, status FROM reservations WHERE userId = ?", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "date": r[0],
            "time": r[1],
            "purpose": r[2],
            "status": r[3]
        }
        for r in rows
    ]

# 예약 명령어 감지 함수들

def is_reservation_command(text):
    return "예약" in text and "취소" not in text and ("변경" not in text and "수정" not in text)

def is_cancel_command(text):
    return "예약" in text and "취소" in text

def is_update_command(text):
    return "예약" in text and ("변경" in text or "수정" in text or "바꿔" in text)

def is_query_command(text):
    return ("예약" in text and ("조회" in text or "확인" in text or "내역" in text or "보여" in text))

def parse_reservation_info(text):
    date_match = re.search(r"(\d{1,2})월\s*(\d{1,2})일", text)
    time_match = re.search(r"(\d{1,2})시", text)
    purpose = "진료"  # 기본값
    if date_match and time_match:
        month = int(date_match.group(1))
        day = int(date_match.group(2))
        hour = int(time_match.group(1))
        year = datetime.now().year
        date_str = f"{year}-{month:02d}-{day:02d}"
        time_str = f"{hour:02d}:00"
        return date_str, time_str, purpose
    return None, None, None

def parse_update_info(text):
    date_match = re.search(r"(\d{1,2})월\s*(\d{1,2})일", text)
    old_time_match = re.search(r"(\d{1,2})시 예약[을]? ", text)
    new_time_match = re.search(r"(\d{1,2})시로 바꿔", text)
    purpose = "진료"
    if date_match and old_time_match and new_time_match:
        month = int(date_match.group(1))
        day = int(date_match.group(2))
        old_hour = int(old_time_match.group(1))
        new_hour = int(new_time_match.group(1))
        year = datetime.now().year
        date_str = f"{year}-{month:02d}-{day:02d}"
        old_time_str = f"{old_hour:02d}:00"
        new_time_str = f"{new_hour:02d}:00"
        return date_str, old_time_str, new_time_str, purpose
    return None, None, None, None

# 예약 관련 DB 함수 예시 (간단 버전, 실제로는 예외처리 등 필요)
def create_reservation(user_id, date, time, purpose):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO reservations (userId, date, time, purpose, status) VALUES (?, ?, ?, ?, ?)",
                   (user_id, date, time, purpose, "confirmed"))
    conn.commit()
    conn.close()

def update_reservation(user_id, date, old_time, new_time, purpose):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE reservations SET time = ?, purpose = ? WHERE userId = ? AND date = ? AND time = ?",
                   (new_time, purpose, user_id, date, old_time))
    conn.commit()
    conn.close()

def delete_reservation(user_id, date=None, time=None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    if date and time:
        cursor.execute("DELETE FROM reservations WHERE userId = ? AND date = ? AND time = ?", (user_id, date, time))
    else:
        # 가장 최근 예약의 id를 먼저 찾음
        cursor.execute("SELECT rowid FROM reservations WHERE userId = ? ORDER BY date DESC, time DESC LIMIT 1", (user_id,))
        row = cursor.fetchone()
        if row:
            cursor.execute("DELETE FROM reservations WHERE rowid = ?", (row[0],))
    conn.commit()
    conn.close()

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 또는 ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 제공 설정
app.mount("/css", StaticFiles(directory="css"), name="css")

@app.get("/")
async def read_root():
    return FileResponse("main.html")

@app.get("/main.html")
async def read_main():
    return FileResponse("main.html")

# OpenAI API 키 설정
# openai.api_key = os.getenv("OPENAI_API_KEY")

# Redis 연결 설정
try:
    redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=False)
    redis_client.ping()
    print("Redis 서버에 성공적으로 연결되었습니다.")
    USE_REDIS = True
except redis.ConnectionError:
    print("Redis 서버에 연결할 수 없습니다. 메모리를 사용합니다.")
    USE_REDIS = False

# user_memories: Dict[str, ConversationBufferMemory]
user_profile_loaded_flags = {}

# Pydantic 모델
class ChatRequest(BaseModel):
    message: str
    customer_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: Optional[str] = None

class MessageItem(BaseModel):
    role: str
    content: str

class HistoryResponse(BaseModel):
    messages: List[MessageItem]
    session_id: str

# Redis 메모리 핸들링
def get_memory_from_redis(session_id: str) -> Optional[ConversationBufferMemory]:
    try:
        memory_data = redis_client.get(f"memory:{session_id}")
        if memory_data:
            return pickle.loads(memory_data)
    except Exception as e:
        print(f"Redis에서 메모리 가져오기 오류: {e}")
    return None

def save_memory_to_redis(session_id: str, memory: ConversationBufferMemory):
    try:
        redis_client.set(f"memory:{session_id}", pickle.dumps(memory))
        print(f"{session_id} 메모리가 Redis에 저장되었습니다.")
    except Exception as e:
        print(f"Redis에 메모리 저장 오류: {e}")

# 세션 ID
def get_or_create_session_id(session_id: Optional[str] = Cookie(None), customer_id: Optional[str] = Cookie(None)) -> str:
    return customer_id or session_id or str(uuid.uuid4())

# 메모리 로드 또는 초기화
def get_memory(session_id: str) -> ConversationBufferMemory:
    if USE_REDIS:
        memory = get_memory_from_redis(session_id)
        if memory:
            return memory

    # Redis에 없거나 Redis 사용 불가한 경우
    memory = ConversationBufferMemory()

    # 초기에 사용자 프로필과 인사말 세팅
    if session_id not in user_profile_loaded_flags:
        if session_id.startswith("customer"):
            memory.chat_memory.add_user_message("당신은 사용자의 이름을 포함한 모든 정보를 기억해야 합니다. 사용자가 '내 이름은 OOO이야'라고 하면 그 이름을 기억하고, '내 이름은 뭐야?'라고 물어보면 기억한 이름을 대답해야 합니다.")

            if session_id.startswith("customer002"):
                memory.chat_memory.add_ai_message("안녕하세요! 저는 영양 상담을 도와드리는 영양사입니다. 어떤 영양 관련 고민이 있으신가요?")
            elif session_id.startswith("customer003"):
                memory.chat_memory.add_ai_message("안녕하세요! 저는 피부진단을 도와드리는 SBOT입니다. 어떤 피부 고민이 있으신가요?")
            elif session_id.startswith("customer004"):
                memory.chat_memory.add_ai_message("안녕하세요! 저는 건강 상담을 도와드리는 전문가입니다. 어떤 건강 고민이 있으신가요?")
            else:
                memory.chat_memory.add_ai_message("안녕하세요! 무엇을 도와드릴까요?")

        user_profile_loaded_flags[session_id] = True

    # Redis에 저장
    if USE_REDIS:
        save_memory_to_redis(session_id, memory)

    return memory

def get_user_profile_and_reservations(user_id):
    user = get_user_by_id(user_id)
    reservations = get_reservations_by_user_id(user_id)
    return user, reservations

# 채팅 API  
from langchain.schema import SystemMessage, HumanMessage, AIMessage

@app.post("/chat/{user_id}", response_model=ChatResponse)
async def chat_with_user(
    user_id: int,
    request: ChatRequest,
    response: Response,
    session_id: str = Depends(get_or_create_session_id)
):
    user_message = request.message

    # 1. 대화 이력 불러오기
    memory = get_memory(session_id)

    # 2. DB에서 사용자 정보/예약 불러오기
    user, reservations = get_user_profile_and_reservations(user_id)

    # 예약 조회
    if is_query_command(user_message):
        reservations = get_reservations_by_user_id(user_id)
        if reservations:
            res_str = "\n".join([f"{r['date']} {r['time']} - {r['purpose']} ({r['status']})" for r in reservations])
            return ChatResponse(response=f"예약 내역:\n{res_str}", session_id=session_id)
        else:
            return ChatResponse(response="예약 내역이 없습니다.", session_id=session_id)

    # 예약 생성
    if is_reservation_command(user_message):
        date, time, purpose = parse_reservation_info(user_message)
        if date and time:
            create_reservation(user_id, date, time, purpose)
            return ChatResponse(response=f"{date} {time}에 예약이 완료되었습니다.", session_id=session_id)
        else:
            return ChatResponse(response="날짜와 시간을 정확히 입력해 주세요. 예: '7월 19일 16시에 예약해줘'", session_id=session_id)

    # 예약 취소
    if is_cancel_command(user_message):
        date, time, _ = parse_reservation_info(user_message)
        delete_reservation(user_id, date, time)
        return ChatResponse(response="예약이 취소되었습니다.", session_id=session_id)

    # 예약 수정
    if is_update_command(user_message):
        date, old_time, new_time, purpose = parse_update_info(user_message)
        if date and old_time and new_time:
            update_reservation(user_id, date, old_time, new_time, purpose)
            return ChatResponse(response=f"{date} {old_time} 예약이 {new_time}로 변경되었습니다.", session_id=session_id)
        else:
            return ChatResponse(response="변경할 예약의 날짜, 기존 시간, 변경할 시간을 정확히 입력해 주세요. 예: '7월 19일 16시 예약을 17시로 바꿔줘'", session_id=session_id)

    # 3. 시스템 프롬프트 개선
    system_message = (
        "당신은 병원 고객의 질문에 친절하고 기억력 좋은 AI 도우미입니다.\n"
        "이전 대화 내용을 기억하고, 그 정보를 기반으로 질문에 답하십시오.\n"
    )
    if user:
        system_message += (
            f"- 이름: {user['name']}\n"
            f"- 생년월일: {user['birth']}\n"
            f"- 전화번호: {user['phone']}\n"
        )
    if reservations:
        system_message += "예약 정보:\n"
        for r in reservations[:3]:  # 최근 3건
            system_message += f"- {r['date']} {r['time']}에 '{r['purpose']}' 예약이 있습니다.\n"

    system_message += (
        "\n예: 사용자가 '오늘 아침에 아메리카노 마셨어, 기억해줘'라고 말하면, "
        "이후 '내가 오늘 마신 커피는?'이라는 질문에 '아메리카노'라고 답해야 합니다.\n"
        "사용자의 발화를 요약해 기억하고 맥락에 맞는 응답을 제공하세요."
    )

    # 4. 메시지 리스트 구성
    langchain_messages = [SystemMessage(content=system_message)]
    langchain_messages.extend(memory.chat_memory.messages)
    langchain_messages.append(HumanMessage(content=user_message))

    # 5. OpenAI 호출
    try:
        chat_model = ChatOpenAI(
            api_key=OPENAI_API_KEY,
            model="gpt-3.5-turbo-0125",
            temperature=0.7,
            max_tokens=1024,
        )
        response_obj = chat_model.invoke(langchain_messages)
        bot_response = response_obj.content
    except Exception as e:
        print(f"OpenAI API 오류 상세: {str(e)}")
        import traceback
        print(traceback.format_exc())
        bot_response = "죄송합니다. 서버에 문제가 있습니다. 다시 시도해주세요."

    # 6. 대화 이력에 저장
    memory.chat_memory.add_user_message(user_message)
    memory.chat_memory.add_ai_message(bot_response)

    if USE_REDIS:
        save_memory_to_redis(session_id, memory)

    return ChatResponse(response=bot_response, session_id=session_id)

# 대화 이력 조회
@app.get("/history", response_model=HistoryResponse)
async def get_history(
    response: Response, 
    session_id: str = Depends(get_or_create_session_id), 
    customer_id: Optional[str] = None,
):
    # 쿼리 파라미터로 전달된 customer_id가 있으면 우선 사용
    if customer_id:
        session_id = customer_id
        print(f"쿼리 파라미터로 전달된 customer_id 사용: {session_id}")
    
    response.set_cookie(key="session_id", value=session_id, httponly=True, samesite="lax")
    response.set_cookie(key="customer_id", value=session_id, httponly=True, samesite="lax")

    memory = get_memory(session_id)
    messages = []

    if hasattr(memory, 'chat_memory') and hasattr(memory.chat_memory, 'messages'):
        for msg in memory.chat_memory.messages:
            if isinstance(msg, HumanMessage):
                messages.append(MessageItem(role="user", content=msg.content))
            elif isinstance(msg, AIMessage):
                messages.append(MessageItem(role="assistant", content=msg.content))

    if USE_REDIS:
        save_memory_to_redis(session_id, memory)

    return HistoryResponse(messages=messages, session_id=session_id)

# 대화 기록 삭제


# 로컬 테스트
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)

# --- [1] JWT 인증 함수 추가 ---
import jwt
import logging
from fastapi import Header

JWT_SECRET = "hihi"
ALGORITHM = "HS256"

def get_current_user_id(authorization: str = Header(None)) -> int:
    if authorization is None:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme.")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("userId")
        if user_id is None:
            raise HTTPException(status_code=401, detail="User ID not in token")
        return int(user_id)
    except Exception as e:
        logging.error(f"JWT decode error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

# --- [2] Redis/인메모리 대화 이력 관리 함수 추가 ---
import redis
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain.memory import ChatMessageHistory

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
simple_memories: dict[str, ChatMessageHistory] = {}

def get_simple_memory(user_id: int):
    session_id = f"user_{user_id}"
    try:
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        redis_client.ping()
        history = RedisChatMessageHistory(session_id, url=REDIS_URL)
        if not history.messages:
            history.add_ai_message("안녕하세요! 저는 당신의 AI 비서입니다. 이름이 무엇인가요?")
        return history
    except Exception as e:
        logging.warning(f"Redis connection failed: {e}. Using in-memory history.")
        if session_id not in simple_memories:
            simple_memories[session_id] = ChatMessageHistory()
            simple_memories[session_id].add_ai_message("안녕하세요! 저는 당신의 AI 비서입니다. 이름이 무엇인가요?")
        return simple_memories[session_id]

# --- [3] /simple_chat API 추가 ---
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationChain
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

class SimpleChatRequest(BaseModel):
    message: str

class SimpleChatResponse(BaseModel):
    response: str

@app.post("/simple_chat", response_model=SimpleChatResponse)
async def simple_chat(request: SimpleChatRequest, user_id: int = Depends(get_current_user_id)):
    history = get_simple_memory(user_id)
    memory = ConversationBufferMemory(chat_memory=history, return_messages=True)
    llm = ChatOpenAI(model_name="gpt-4", temperature=0.9, openai_api_key=OPENAI_API_KEY)
    conversation = ConversationChain(
        llm=llm,
        memory=memory,
        verbose=True
    )
    response = await conversation.apredict(input=request.message)
    return {"response": response}
