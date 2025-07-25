from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.agents import Tool
from langchain_qdrant import QdrantVectorStore, FastEmbedSparse, RetrievalMode
from qdrant_client import QdrantClient
from dotenv import load_dotenv
from langchain.prompts import PromptTemplate
from functools import partial
from langgraph.prebuilt import create_react_agent
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import RedisChatMessageHistory

import requests, os, logging, redis, re
from datetime import datetime
from dateutil import parser

# ✅ 로깅 설정
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# ✅ 환경변수 로드
load_dotenv()

# ✅ Redis 설정
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
redis_url = f"redis://{REDIS_HOST}:{REDIS_PORT}" if not REDIS_PASSWORD else f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}"

try:
    redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASSWORD, decode_responses=True)
    redis_client.ping()
    print("✅ Redis 연결 성공")
except redis.exceptions.ConnectionError as e:
    print(f"❌ Redis 연결 실패: {e}")

# ✅ FastAPI 인스턴스 생성
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ API 키 로드
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
QDRANT_URL = os.getenv("QDRANT_URL")
HF_TOKEN = os.getenv("HF_TOKEN")

# ✅ LLM 설정
llm = ChatOpenAI(model="gpt-4o", openai_api_key=OPENAI_API_KEY)

# ✅ Qdrant 설정
embedding_model = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
sparse_embeddings = FastEmbedSparse(model_name="Qdrant/bm25", token=HF_TOKEN)
qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

vector_store = QdrantVectorStore(
    client=qdrant_client,
    collection_name="medical_chatbot_vector",
    embedding=embedding_model,
    sparse_embedding=sparse_embeddings,
    retrieval_mode=RetrievalMode.HYBRID,
    vector_name="dense",
    sparse_vector_name="sparse",
)
retriever = vector_store.as_retriever(search_kwargs={"k": 5})

# ✅ 노드 서버 주소
NODE_SERVER_URL = "http://localhost:3002"

def create_reservation(user_input: str, userId: str) -> str:
    try:
        logger.debug(f"[DEBUG] 원본 입력: {user_input}")
        cleaned_input = re.sub(r"[^\w\s]", "", user_input)  # 특수문자 제거
        logger.debug(f"[DEBUG] 전처리된 입력: {cleaned_input}")

        # 한글 월/일/오전오후 대응
        now = datetime.now()

        # 한글 날짜 추출 (예: 7월30일)
        date_match = re.search(r"(\d{1,2})월\s*(\d{1,2})일", cleaned_input)
        if not date_match:
            return "날짜 형식을 이해하지 못했습니다. '7월 30일' 형식으로 입력해주세요."
        month, day = int(date_match.group(1)), int(date_match.group(2))

        # 시간 추출 (예: 오후2시 → 14:00)
        time_match = re.search(r"(오전|오후)?\s*(\d{1,2})시", cleaned_input)
        if not time_match:
            return "시간 형식을 이해하지 못했습니다. '오전 10시' 또는 '오후 3시' 형식으로 입력해주세요."
        period = time_match.group(1)
        hour = int(time_match.group(2))
        if period == "오후" and hour < 12:
            hour += 12
        elif period == "오전" and hour == 12:
            hour = 0

        # 날짜 및 시간 생성
        parsed_datetime = datetime(year=2025, month=month, day=day, hour=hour)
        formatted_date = parsed_datetime.strftime('%Y-%m-%d')
        formatted_time = parsed_datetime.strftime('%H:%M')
        purpose = "진료"

        payload = {
            "userId": userId,
            "date": formatted_date,
            "time": formatted_time,
            "purpose": purpose
        }

        logger.debug(f"[DEBUG] 예약 요청 페이로드: {payload}")
        response = requests.post(f"{NODE_SERVER_URL}/api/reservations", json=payload)
        response.raise_for_status()
        return f"{formatted_date} {formatted_time}에 '{purpose}' 예약이 완료되었습니다."

    except requests.exceptions.HTTPError as http_err:
        if http_err.response.status_code == 409:
            error_data = http_err.response.json()
            return f"{error_data.get('message', '이미 예약이 존재합니다.')}"
        return f"예약 실패 (서버 오류): {http_err.response.status_code} - {http_err.response.text}"
    except Exception as e:
        return f"예약 요청 처리 중 오류 발생: {e}"


# ✅ 예약 취소 함수
def delete_reservation(userId: str) -> str:
    try:
        response = requests.delete(f"{NODE_SERVER_URL}/api/reservations/user/{userId}")
        response.raise_for_status()
        return f"{userId}번 사용자의 예약이 모두 취소되었습니다."
    except Exception as e:
        return f"예약 취소 실패: {e}"

# ✅ Qdrant 검색 함수
def qdrant_appointment_search(query: str) -> str:
    docs = retriever.invoke(query)
    return "\n".join([doc.page_content for doc in docs]) or "관련 예약 정보를 찾을 수 없습니다."

# ✅ 에이전트 엔드포인트
@app.post("/invoke-agent/")
async def invoke_agent(request: Request):
    body = await request.json()
    message = body.get("message")
    userId = body.get("userId")

    if not message or not userId:
        return {"error": "message와 userId는 필수입니다."}

    logger.debug(f"📨 입력 메시지: {message}")
    logger.debug(f"👤 사용자 ID: {userId}")

    tools = [
        Tool(
            name="qdrant_search",
            func=qdrant_appointment_search,
            description="피부질환 설명 또는 진료 예약 관련 문장을 검색합니다."
        ),
        Tool(
            name="CreateReservation",
            func=lambda user_input: create_reservation(user_input, str(userId)),
            description="자연어 문장에서 예약 날짜와 시간을 추출하여 예약을 생성합니다. 예: '7월 30일 오후 2시에 예약해줘'"
        ),
        Tool(
            name="DeleteReservation",
            func=lambda _: delete_reservation(str(userId)),
            description="해당 사용자의 예약을 모두 취소합니다."
        ),
    ]

    prompt = PromptTemplate.from_template(
        """너는 사용자 요청을 처리하는 AI 비서야. 다음 규칙을 반드시 지켜줘.
        1. 사용자의 userId는 '{userId}'이고, 요청 내용은 '{messages}'야.
        2. 예약 요청(예: '내일 오후 2시에 예약해줘')을 받으면, 사용자의 메시지를 **절대 변형하지 말고 원본 그대로** 'CreateReservation' 도구에 전달해야 해.
        3. 예약 취소 요청은 'DeleteReservation' 도구를 사용해야 해.
        4. 일반적인 질병 정보 요청은 'qdrant_search' 도구를 사용해.
        5. 병명 설명은 3줄 이상으로 자세히 해줘.
        6. 모든 응답은 반드시 한국어로, 친절하고 명확하게 작성해줘.
        """
    )

    llm_with_prompt = llm.bind(prompt=prompt)
    agent = create_react_agent(llm_with_prompt, tools)

    agent_with_history = RunnableWithMessageHistory(
        agent,
        lambda session_id: RedisChatMessageHistory(
            session_id=session_id,
            url=redis_url  # ex: "redis://localhost:6379"
        ),
        input_messages_key="messages"  # ✅ 이것만 있으면 충분
        # history_messages_key 제거!
    )

    result = await agent_with_history.ainvoke(
        {"messages": [("user", message)], "userId": str(userId)},
        config={"configurable": {"session_id": str(userId)}},
    )
    return {"response": result["messages"][-1].content}