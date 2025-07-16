from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

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
llm = ChatOpenAI(
    model="gpt-4o",  # 또는 "gpt-4-vision" (OpenAI 계정에 따라 다를 수 있음)
    openai_api_key=""
)

@app.post("/analyze-image/")
async def analyze_image(file: UploadFile = File(...)):
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
    response = llm.invoke(messages)
    print("=== GPT 응답 ===")
    print(response.content)
    print("================")
    return {"result": response.content}
