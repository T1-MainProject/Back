from fastapi import FastAPI, Depends, HTTPException, Response, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
import os
import logging
import redis
import jwt
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv
from langchain.memory import ConversationBufferMemory
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain.memory import ChatMessageHistory
from langchain.chains import ConversationChain
from langchain.schema import HumanMessage, AIMessage, BaseMessage
from langchain_openai import ChatOpenAI

# .env 파일 로드
load_dotenv()

# 환경 변수에서 설정값 로드
# .env 파일 로딩 문제를 확인하기 위해 임시로 하드코딩합니다.
JWT_SECRET = "hihi"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
ALGORITHM = "HS256"

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Redis 연결 실패 시 사용할 인메모리 대화 기록 저장소
memories: dict[str, ChatMessageHistory] = {}

# FastAPI 앱 초기화
app = FastAPI()

# 정적 파일 마운트 (css, js, images 등)
app.mount("/css", StaticFiles(directory="css"), name="css")

# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발 중에는 모든 오리진을 허용
    allow_credentials=True,
    allow_methods=["*"],   # 모든 HTTP 메서드 허용
    allow_headers=["*"],   # 모든 헤더 허용
)

# Pydantic 모델 정의
class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

class Message(BaseModel):
    type: str
    content: str

class HistoryResponse(BaseModel):
    history: List[Message]

# HTML 파일 서빙
@app.get("/main.html", response_class=HTMLResponse)
async def read_main():
    with open("main.html", "r", encoding="utf-8") as f:
        return f.read()

# JWT 토큰에서 사용자 ID 추출
def get_current_user_id(authorization: Optional[str] = Header(None)) -> int:
    if authorization is None:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme.")
        
        logger.info(f"Attempting to decode token with secret: '{JWT_SECRET}'")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("userId")
        if user_id is None:
            raise HTTPException(status_code=401, detail="User ID not in token")
        return int(user_id)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        logger.error(f"InvalidTokenError: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"An unexpected error occurred during token decoding: {e}")
        raise HTTPException(status_code=401, detail=f"An unexpected error occurred: {e}")

# 메모리 로드 또는 초기화 (user_id 기반)
def get_memory(user_id: int) -> BaseChatMessageHistory:
    session_id = f"user_{user_id}"
    try:
        # Redis 연결 테스트 및 히스토리 객체 생성
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        redis_client.ping()
        logger.info(f"Successfully connected to Redis for user_id: {user_id}")
        history = RedisChatMessageHistory(session_id, url=REDIS_URL)
        if not history.messages:
            history.add_ai_message("안녕하세요! 저는 당신의 AI 비서입니다. 당신의 이름을 기억하고, 맞춤형 대화를 제공해 드립니다. 이름이 무엇인가요?")
        return history
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}. Falling back to in-memory history for user_id: {user_id}")
        # 인메모리 히스토리 사용 (전역 변수 'memories' 사용)
        if session_id not in memories:
            memories[session_id] = ChatMessageHistory()
            memories[session_id].add_ai_message("안녕하세요! 저는 당신의 AI 비서입니다. 당신의 이름을 기억하고, 맞춤형 대화를 제공해 드립니다. 이름이 무엇인가요?")
        return memories[session_id]

# 채팅 API
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, user_id: int = Depends(get_current_user_id)):
    logger.info(f"[/chat] Handling request for user_id: {user_id}")
    history = get_memory(user_id)
    memory = ConversationBufferMemory(chat_memory=history, return_messages=True)

    llm = ChatOpenAI(model_name="gpt-4", temperature=0.9, openai_api_key=OPENAI_API_KEY)
    conversation = ConversationChain(
        llm=llm,
        memory=memory,
        verbose=True
    )
    
    response = await conversation.apredict(input=request.message)
    return {"response": response}

# 대화 기록 API
@app.get("/history", response_model=List[dict])
async def get_history(user_id: int = Depends(get_current_user_id)):
    logger.info(f"[/history] Fetching history for user_id: {user_id}")
    memory = get_memory(user_id)
    history: List[BaseMessage] = memory.messages
    history_dicts = []
    for msg in history:
        if isinstance(msg, HumanMessage):
            history_dicts.append({"type": "human", "content": msg.content})
        elif isinstance(msg, AIMessage):
            history_dicts.append({"type": "ai", "content": msg.content})
    logger.info(f"[/history] Found {len(history_dicts)} messages for user_id: {user_id}")
    return history_dicts

# 대화 기록 삭제 API
@app.delete("/history")
async def delete_history(user_id: int = Depends(get_current_user_id)):
    logger.info(f"[/history/delete] Clearing history for user_id: {user_id}")
    session_id = f"user_{user_id}"
    try:
        # First, try to clear from Redis
        redis_history = RedisChatMessageHistory(session_id=session_id, url=REDIS_URL)
        redis.from_url(REDIS_URL).ping() # Check connection
        redis_history.clear()
        logger.info(f"Successfully cleared Redis history for user_id: {user_id}")
        # Also clear from in-memory cache if it exists
        if session_id in memories:
            del memories[session_id]
        return {"status": "success", "message": "History cleared from Redis."}
    except Exception as e:
        logger.warning(f"Could not clear Redis history for user_id: {user_id}. Falling back to in-memory. Error: {e}")
        # If Redis fails, clear from the in-memory dictionary
        if session_id in memories:
            del memories[session_id]
            logger.info(f"Cleared in-memory history for user_id: {user_id}")
            return {"status": "success", "message": "History cleared from memory."}
        else:
            logger.info(f"No in-memory history found for user_id: {user_id}")
            return {"status": "success", "message": "No history found to clear."}

# 로컬 테스트
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
