from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.agents import Tool, initialize_agent, AgentType
from langchain_qdrant import QdrantVectorStore, FastEmbedSparse, RetrievalMode
from qdrant_client import QdrantClient
from dotenv import load_dotenv
import requests, os
from langchain.prompts import PromptTemplate
from langchain.agents import Tool
from langgraph.prebuilt import create_react_agent

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Keys
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
QDRANT_URL = os.getenv("QDRANT_URL")
HF_TOKEN = os.getenv("HF_TOKEN")

# LLM 설정
llm = ChatOpenAI(model="gpt-4o", openai_api_key=OPENAI_API_KEY)

# Qdrant 설정
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

# 노드 서버 주소
NODE_SERVER_URL = "http://localhost:3002"
qdrant_tool = Tool.from_function(
    func=retriever.invoke,
    name="qdrant_search",
    description="질문에 관련된 정보를 Qdrant에서 검색합니다."
)
# 예약 생성
def create_reservation(input_str: str) -> str:
    try:
        parts = input_str.replace('"', '').replace("'", '').strip().split(',')
        if len(parts) != 4:
            return f"예약 형식이 잘못되었습니다. 'userId,date,time,purpose' 형식으로 입력해주세요. 예: 6,2025-07-26,15:00,진료"

        userId, date, time, purpose = [p.strip() for p in parts]

        # 날짜 보정
        if date.count('-') == 1:
            date = f"2025-{date}"
        elif date.count('-') == 2 and not date.startswith("2024") and not date.startswith("2025"):
            date = f"2025-{date.split('-')[1]}-{date.split('-')[2]}"

        payload = { "userId": userId, "date": date, "time": time, "purpose": purpose }
        response = requests.post(f"{NODE_SERVER_URL}/api/reservations", json=payload)
        response.raise_for_status()
        return f"{date} {time}에 '{purpose}' 예약이 완료되었습니다."

    except requests.exceptions.HTTPError as http_err:
        if http_err.response.status_code == 409:
            error_data = http_err.response.json()
            return f"{error_data.get('message', '이미 예약이 존재합니다.')} {error_data.get('details', '')}"
        return f"예약 실패 (서버 오류): {http_err.response.status_code} - {http_err.response.text}"
    except Exception as e:
        return f"예약 요청 처리 중 오류 발생: {e}"

# 예약 취소
def delete_reservation(userId: str) -> str:
    try:
        response = requests.delete(f"{NODE_SERVER_URL}/api/reservations/user/{userId}")
        response.raise_for_status()
        return f"{userId}번 사용자의 예약이 모두 취소되었습니다."
    except Exception as e:
        return f"예약 취소 실패: {e}"

# Qdrant 유사 검색
def qdrant_appointment_search(query: str) -> str:
    docs = retriever.invoke(query)
    return "\n".join([doc.page_content for doc in docs]) or "관련 예약 정보를 찾을 수 없습니다."

# 도구 등록
tools = [
    Tool.from_function(
        func=create_reservation,
        name="CreateReservation",
        description="예약을 생성합니다. 형식: 'userId,date,time,purpose' 예: 6,2025-07-26,15:00,진료"
    ),
    Tool.from_function(
        func=delete_reservation,
        name="DeleteReservation",
        description="특정 사용자 ID의 예약을 모두 취소합니다. 입력 예: 6"
    ),
    Tool.from_function(
        func=qdrant_appointment_search,
        name="AppointmentSearch",
        description="예약 관련 질문에 대해 Qdrant에서 유사 문장을 검색합니다."
    )
]

# 에이전트 생성
agent = create_react_agent(
    model=llm,
    tools=[qdrant_tool],
    prompt=("너는 사용자 요청을 처리하는 에이전트야. 다음 규칙을 반드시 지켜줘.\n"
        "1. 사용자의 userId는 '{userId}'이고, 요청 내용은 '{message}'이야.\n"
        "2. 요청이 예약 생성 또는 취소와 관련 있다면, 반드시 'CreateReservation' 또는 'DeleteReservation' Tool을 사용해야 해.\n"
        "3. Tool을 사용한 후, 만약 '이미 예약이 존재합니다'와 같은 정보나 오류 메시지를 받으면, 더 이상 다른 행동을 하지 말고 그 메시지를 사용자에게 그대로 최종 답변으로 전달해줘.\n"
        "4. 예약과 관련 없는 일반적인 대화는 Tool을 사용하지 않고 자유롭게 대답해줘.\n"
        "5. 모든 답변은 반드시 한국어로 해야 해."
        "6. 병명에 대한 정보는 6줄 이상해줘")
)

# Agent 호출 API
@app.post("/invoke-agent/")
async def invoke_agent(request: dict):
    message = request.get("message")
    userId = request.get("userId")
    if not message or not userId:
        return {"error": "message와 userId는 필수입니다."}

    result = await agent.ainvoke({"messages": [("user", message)]})
    return {"response": result["messages"][-1].content}

