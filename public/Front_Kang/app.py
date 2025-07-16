from fastapi import FastAPI, Depends, Cookie, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from langchain.memory import ConversationBufferMemory
from langchain_openai import ChatOpenAI
from langchain.chains import ConversationChain
from langchain.schema import HumanMessage, AIMessage
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

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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

user_memories: Dict[str, ConversationBufferMemory] = {}

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
    if session_id in user_memories:
        return user_memories[session_id]

    if USE_REDIS:
        memory = get_memory_from_redis(session_id)
        if memory:
            user_memories[session_id] = memory
            return memory

    memory = ConversationBufferMemory()

    if session_id.startswith("customer"):
        # 모든 고객 ID에 대해 동일한 초기 메시지 설정
        memory.chat_memory.add_user_message("당신은 사용자의 이름을 포함한 모든 정보를 기억해야 합니다. 사용자가 '내 이름은 OOO이야'라고 하면 그 이름을 기억하고, '내 이름은 뭐야?'라고 물어보면 기억한 이름을 대답해야 합니다.")
        
        # 고객 ID에 따른 초기 인사 메시지 분기
        if session_id.startswith("customer002"):
            memory.chat_memory.add_ai_message("안녕하세요! 저는 영양 상담을 도와드리는 영양사입니다. 어떤 영양 관련 고민이 있으신가요?")
        elif session_id.startswith("customer003"):
            memory.chat_memory.add_ai_message("안녕하세요! 저는 피부진단을 도와드리는 SBOT입니다. 어떤 피부 고민이 있으신가요?")
        elif session_id.startswith("customer004"):
            memory.chat_memory.add_ai_message("안녕하세요! 저는 건강 상담을 도와드리는 전문가입니다. 어떤 건강 고민이 있으신가요?")
        else:
            memory.chat_memory.add_ai_message("안녕하세요! 무엇을 도와드릴까요?")
    
    user_memories[session_id] = memory
    if USE_REDIS:
        save_memory_to_redis(session_id, memory)
    return memory

# 채팅 API  
@app.post("/chat/{user_id}", response_model=ChatResponse)
async def chat_with_user(
    user_id: int,
    request: ChatRequest,
    response: Response,
    session_id: str = Depends(get_or_create_session_id)
):
  
    try:
        if request.customer_id:
            session_id = request.customer_id
            print(f"POST 요청에서 전달된 customer_id 사용: {session_id}")
            response.set_cookie(key="customer_id", value=session_id, httponly=True, samesite="lax")
        response.set_cookie(key="session_id", value=session_id, httponly=True, samesite="lax")

        memory = get_memory(session_id)
        memory.chat_memory.add_user_message(request.message)

        try:
            # 모델 버전을 명시적으로 지정하고 최신 버전 사용
            chat_model = ChatOpenAI(
                api_key=OPENAI_API_KEY, 
                model="gpt-3.5-turbo-0125",  # 최신 안정 버전 명시
                temperature=0.7,
                max_tokens=1024  # 응답 길이 제한 설정
            )
            
            # 직접 메시지 형식으로 호출하여 오류 가능성 줄이기
            messages = memory.chat_memory.messages
            formatted_messages = []
            
            # 시스템 메시지 추가 (역할 명확화)
            system_message = "당신은 사용자의 질문에 답변하는 도우미입니다."
            if session_id.startswith("customer002"):
                system_message += " 영양 상담 관련 질문에 전문적으로 답변해주세요."
            elif session_id.startswith("customer003"):
                system_message += " 피부진단 관련 질문에 전문적으로 답변해주세요."
            elif session_id.startswith("customer004"):
                system_message += " 건강 상담 관련 질문에 전문적으로 답변해주세요."
            
            from langchain.schema import SystemMessage
            
            # langchain의 메시지 형식으로 변환
            langchain_messages = [SystemMessage(content=system_message)]
            
            # 기존 메시지 추가
            langchain_messages.extend(messages)
            
            # 현재 메시지 추가
            current_message = request.message if request.message else "질문이 없습니다."
            langchain_messages.append(HumanMessage(content=current_message))
            
            # langchain을 통한 API 호출
            response = chat_model.invoke(langchain_messages)
            
            # 응답 추출
            bot_response = response.content
            
        except Exception as e:
            print(f"OpenAI API 오류 상세: {str(e)}")
            # 더 자세한 오류 정보 로깅
            import traceback
            print(traceback.format_exc())
            
            # API 키 오류 등으로 인한 오류 발생 시 기본 응답 사용
            if session_id.startswith("customer002"):
                bot_response = "죄송합니다. 현재 서버에 문제가 있어 영양 상담 서비스를 제공할 수 없습니다. 다시 시도해주세요."
            elif session_id.startswith("customer003"):
                bot_response = "죄송합니다. 현재 서버에 문제가 있어 피부진단 서비스를 제공할 수 없습니다. 다시 시도해주세요."
            elif session_id.startswith("customer004"):
                bot_response = "죄송합니다. 현재 서버에 문제가 있어 건강 상담 서비스를 제공할 수 없습니다. 다시 시도해주세요."
            else:
                bot_response = "죄송합니다. 현재 서버에 문제가 있습니다. 다시 시도해주세요."

        memory.chat_memory.add_ai_message(bot_response)

        if USE_REDIS:
            save_memory_to_redis(session_id, memory)

        return ChatResponse(response=bot_response, session_id=session_id)
    except Exception as e:
        print(f"채팅 요청 처리 중 오류: {e}")
        return ChatResponse(
            response="죄송합니다. 서버 오류가 발생했습니다. 다시 시도해주세요.", 
            session_id=session_id
        )

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
@app.delete("/history/{session_id}")
async def clear_history(session_id: str, customer_id: Optional[str] = Cookie(None)):
    if customer_id:
        session_id = customer_id

    if session_id in user_memories:
        del user_memories[session_id]

    if USE_REDIS:
        try:
            redis_client.delete(f"memory:{session_id}")
            print(f"Redis에서 {session_id} 메모리가 삭제되었습니다.")
        except Exception as e:
            print(f"Redis에서 메모리 삭제 오류: {e}")

    return {"status": "success", "message": f"세션 {session_id}의 대화 기록이 삭제되었습니다."}

# 로컬 테스트
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
