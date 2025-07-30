from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
import os
from dotenv import load_dotenv
load_dotenv()

app = FastAPI()

# CORS 미들웨어 추가
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
llm = ChatOpenAI(
    model="gpt-4o",
    openai_api_key=OPENAI_API_KEY
)

from langchain.agents import Tool, initialize_agent, AgentType
from langchain.memory import ConversationBufferMemory
from langchain.prompts import MessagesPlaceholder
from pydantic import BaseModel
import requests

# 요청 본문을 위한 Pydantic 모델
class ChatRequest(BaseModel):
    message: str
    user_id: str # 또는 int, server.js와 맞춰야 함

# Node.js 서버의 주소
NODE_SERVER_URL = "http://localhost:3002"

def create_reservation(query: str, user_id: str):
    """주어진 쿼리(자연어)와 사용자 ID를 바탕으로 진료 예약을 생성합니다."""
    # TODO: LangChain이나 다른 NLP 기술을 사용하여 query에서 날짜, 시간, 목적 등을 추출해야 합니다.
    # 현재는 query 전체를 details로 사용합니다.
    # 예시: "내일 오후 3시에 피부 트러블 상담 예약해줘"
    data = {'date': '2024-08-01', 'time': '15:00', 'details': query, 'userId': user_id}
    try:
        response = requests.post(f"{NODE_SERVER_URL}/api/reservations", json=data)
        response.raise_for_status() # 오류 발생 시 예외를 던짐
        return response.json()
    except requests.exceptions.RequestException as e:
        return f"예약 생성 중 오류 발생: {e}"

def get_reservation(user_id: str):
    """주어진 사용자 ID로 예약 정보를 조회합니다."""
    try:
        response = requests.get(f"{NODE_SERVER_URL}/api/reservations/user/{user_id}") # Node.js API 경로 확인 필요
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return f"예약 조회 중 오류 발생: {e}"

# LangChain 도구 정의
tools = [
    Tool(
        name="CreateReservation", 
        func=create_reservation, 
        description="사용자가 진료 예약을 원할 때 사용합니다. 'query'와 'user_id' 두 개의 인수가 필요합니다. query는 사용자의 예약 요청 전체(예: '내일 3시 예약')이며, user_id는 현재 대화 중인 사용자의 ID입니다."
    ),
    Tool(
        name="GetReservation", 
        func=get_reservation, 
        description="사용자의 예약 정보를 조회할 때 사용합니다. 'user_id' 인수가 필요하며, 현재 대화 중인 사용자의 ID를 전달해야 합니다."
    ),
]

# 대화 메모리 설정
# 각 사용자별로 메모리를 관리하는 것이 이상적입니다. 여기서는 간단하게 단일 메모리를 사용합니다.
memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

# LLM 및 에이전트 초기화
llm = ChatOpenAI(model="gpt-4o", openai_api_key=OPENAI_API_KEY, temperature=0)

chat_history = MessagesPlaceholder(variable_name="chat_history")

agent = initialize_agent(
    tools,
    llm,
    agent=AgentType.CHAT_CONVERSATIONAL_REACT_DESCRIPTION,
    verbose=True,
    memory=memory,
    agent_kwargs={
        "extra_prompt_messages": [chat_history]
    }
)

@app.post("/chat")
def chat_with_agent(request: ChatRequest):
    print(f"Received message for user {request.user_id}: {request.message}")
    # 에이전트 실행
    # user_id를 어떻게 활용할지 정책 필요 (예: get_reservation 호출 시 전달)
    response = agent.invoke({"input": request.message, "user_id": request.user_id})
    return {"response": response['output']}

@app.post("/analyze-image/")
async def analyze_image(
    file: UploadFile = File(...),
    userId: int = Form(...),
    title: str = Form("AI 진단"),
    date: str = Form(None),
):
    image_bytes = await file.read()
    import base64
    image_b64 = base64.b64encode(image_bytes).decode()
    
    
    
    # 피부 질환 라벨링 데이터
    skin_conditions = [
        "광선각화증", "기저세포암", "멜라닌세포모반", "보웬병", "비립종", "사마귀", 
        "악성흑색종", "지루각화증", "편평세포암", "표피낭종", "피부선유종", 
        "피지샘증식증", "흑관종", "화상 상아종", "흑색점"
    ]
    
    system_prompt = f"""당신은 전문 피부과 의사입니다.
아래 피부 질환 중에서 가장 유사한 것을 진단하고, 반드시 **한국어**로만 답변하세요.

피부 질환 목록: {', '.join(skin_conditions)}

아래 형식으로만, 빈 값이라도 모두 채워서 답변하세요:
- 진단명: [가장 유사한 피부 질환명, 없으면 '불명']
- 위험도: [낮음/보통/높음/위험, 없으면 '불명']
- 설명: [진단 근거와 특징 설명, 없으면 '설명 없음']
- 권장사항: [치료 및 관리 방법, 없으면 '권장사항 없음']

다른 말은 절대 하지 마세요. 반드시 위의 형식과 한국어만 사용하세요.
"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(
            content=[
                {"type": "text", "text": "이 피부 이미지를 분석하여 위의 형식으로 진단해주세요."},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}}
            ]
        )
    ]

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(
            content=[
                {"type": "text", "text": "이 피부 이미지를 분석하여 위의 형식으로 진단해주세요."},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}}
            ]
        )
    ]
    response = llm.invoke(messages)
    print("=== GPT 응답 ===")
    print(response.content)
    print("================")
    return {"result": response.content}
