# 설치 필요: pip install fastapi uvicorn python-multipart requests passlib[bcrypt]

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from passlib.context import CryptContext
import os
import hashlib
from datetime import datetime
from pathlib import Path
import threading
import time
import requests
import json

# 비밀번호 해싱 설정
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(
    title="피부 종양 이미지 API", 
    version="1.0.2",
    description="피부 종양 이미지 데이터 관리 및 AI 소견 제공 API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 데이터 파일 경로
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
USERS_FILE = DATA_DIR / "users.json"
IMAGES_FILE = DATA_DIR / "images.json"
DATASETS_FILE = DATA_DIR / "datasets.json"

# 메모리 기반 저장소 (실제 환경에서는 데이터베이스 사용 권장)
users_db = {}
images_db = {}
datasets_db = {}

UPLOAD_DIR = Path("uploads/skin_lesions")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 데이터 로드 함수
def load_data():
    global users_db, images_db, datasets_db
    
    # 사용자 데이터 로드
    if USERS_FILE.exists():
        try:
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                users_db = json.load(f)
            print(f"✅ 사용자 데이터 로드: {len(users_db)}명")
        except Exception as e:
            print(f"⚠️ 사용자 데이터 로드 실패: {e}")
            users_db = {}
    
    # 이미지 데이터 로드
    if IMAGES_FILE.exists():
        try:
            with open(IMAGES_FILE, 'r', encoding='utf-8') as f:
                images_data = json.load(f)
                # 문자열 키를 정수로 변환
                images_db = {int(k): v for k, v in images_data.items()}
            print(f"✅ 이미지 데이터 로드: {len(images_db)}개")
        except Exception as e:
            print(f"⚠️ 이미지 데이터 로드 실패: {e}")
            images_db = {}
    
    # 데이터셋 데이터 로드
    if DATASETS_FILE.exists():
        try:
            with open(DATASETS_FILE, 'r', encoding='utf-8') as f:
                datasets_data = json.load(f)
                # 문자열 키를 정수로 변환
                datasets_db = {int(k): v for k, v in datasets_data.items()}
            print(f"✅ 데이터셋 데이터 로드: {len(datasets_db)}개")
        except Exception as e:
            print(f"⚠️ 데이터셋 데이터 로드 실패: {e}")
            datasets_db = {}

# 데이터 저장 함수
def save_data():
    try:
        # 사용자 데이터 저장
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(users_db, f, ensure_ascii=False, indent=2)
        
        # 이미지 데이터 저장
        with open(IMAGES_FILE, 'w', encoding='utf-8') as f:
            json.dump(images_db, f, ensure_ascii=False, indent=2)
        
        # 데이터셋 데이터 저장
        with open(DATASETS_FILE, 'w', encoding='utf-8') as f:
            json.dump(datasets_db, f, ensure_ascii=False, indent=2)
            
        print("💾 데이터 저장 완료")
    except Exception as e:
        print(f"❌ 데이터 저장 실패: {e}")

# 서버 시작 시 데이터 로드
load_data()

# 빈 파비콘
EMPTY_FAVICON_BYTES = (
    b"\x00\x00\x01\x00\x01\x00\x10\x10\x00\x00\x01\x00\x04\x00\x28\x01"
    b"\x00\x00\x16\x00\x00\x00\x00\x00\x00\x00\x00\x00\x16\x00\x00\x00"
    b"\x28\x00\x00\x00\x10\x00\x00\x00\x20\x00\x00\x00\x01\x00\x04\x00"
    b"\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
    b"\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
)

@app.get("/favicon.ico")
async def favicon():
    return Response(content=EMPTY_FAVICON_BYTES, media_type="image/x-icon")

# 통합된 사용자 모델 (username과 email 둘 다 지원)
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: str

class ImageInfo(BaseModel):
    id: int
    filename: str
    original_filename: str
    lesion_type: str
    diagnosis: str
    file_size: int
    width: int
    height: int
    uploaded_at: str
    uploaded_by: str
    is_synthetic: bool = False

class DatasetCreate(BaseModel):
    name: str
    description: str
    lesion_types: List[str]
    is_public: bool = False

def hash_password(password: str) -> str:
    """bcrypt를 사용한 안전한 비밀번호 해싱"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증"""
    return pwd_context.verify(plain_password, hashed_password)

def find_user(username: str = None, email: str = None) -> Optional[Dict]:
    """사용자명 또는 이메일로 사용자 찾기"""
    for user_key, user_data in users_db.items():
        if username and user_key == username:
            return user_data
        if email and user_data.get("email") == email:
            return user_data
    return None

def get_image_info(file_path: str) -> Dict[str, Any]:
    try:
        file_size = os.path.getsize(file_path)
        return {
            "file_size": file_size,
            "width": 512,
            "height": 512,
            "is_valid": True
        }
    except Exception as e:
        return {"is_valid": False, "error": str(e)}

def simulate_lesion_classification(filename: str) -> Dict[str, Any]:
    lesion_types = ["melanoma", "nevus", "basal_cell_carcinoma", "actinic_keratosis", "benign"]
    hash_val = hash(filename) % len(lesion_types)
    predicted_type = lesion_types[hash_val]
    confidence = round(0.7 + (hash_val * 0.05), 2)
    return {
        "predicted_type": predicted_type,
        "confidence": confidence
    }

@app.get("/")
async def root():
    return {
        "message": "피부 종양 이미지 API",
        "version": "1.0.2",
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "auth": "/auth/*",
            "images": "/images/*",
            "datasets": "/datasets/*",
            "statistics": "/statistics"
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "data_counts": {
            "users": len(users_db),
            "images": len(images_db),
            "datasets": len(datasets_db)
        }
    }

# 사용자 조회 엔드포인트 추가 (디버깅용)
@app.get("/debug/users")
async def get_users():
    """디버깅용 사용자 목록 조회"""
    return {
        "total_users": len(users_db),
        "users": {
            username: {
                "username": data.get("username"),
                "email": data.get("email"),
                "created_at": data.get("created_at"),
                "is_active": data.get("is_active")
            }
            for username, data in users_db.items()
        }
    }

@app.post("/auth/register")
async def register(user: UserCreate):
    # 디버깅을 위한 로그 출력
    print(f"[DEBUG] 회원가입 시도 - username: {user.username}, email: {user.email}")
    
    # 중복 사용자명 확인
    if user.username in users_db:
        print(f"[DEBUG] 사용자명 중복: {user.username}")
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # 중복 이메일 확인
    if find_user(email=user.email):
        print(f"[DEBUG] 이메일 중복: {user.email}")
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 비밀번호 길이 검증
    if len(user.password) < 6:
        print(f"[DEBUG] 비밀번호 길이 부족: {len(user.password)}")
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # 사용자 생성
    hashed_password = hash_password(user.password)
    users_db[user.username] = {
        "username": user.username,
        "email": user.email,
        "password": hashed_password,
        "created_at": datetime.now().isoformat(),
        "is_active": True
    }
    
    # 데이터 저장
    save_data()
    
    print(f"[DEBUG] 사용자 생성 완료: {user.username}")
    print(f"[DEBUG] 현재 등록된 사용자들: {list(users_db.keys())}")
    
    return {
        "message": "User registered successfully",
        "username": user.username,
        "email": user.email,
        "created_at": users_db[user.username]["created_at"]
    }

# 회원가입 (호환성을 위한 추가 엔드포인트)
@app.post("/signup")
async def signup(user: UserCreate):
    return await register(user)

@app.post("/auth/login")
async def login(user: UserLogin):
    # 디버깅을 위한 로그 출력
    print(f"[DEBUG] 로그인 시도 - username: {user.username}, email: {user.email}")
    print(f"[DEBUG] 현재 등록된 사용자들: {list(users_db.keys())}")
    
    # username 또는 email 중 하나는 반드시 제공되어야 함
    if not user.username and not user.email:
        raise HTTPException(status_code=400, detail="Username or email is required")
    
    # 사용자 찾기
    user_data = None
    user_key = None
    
    if user.username:
        print(f"[DEBUG] username으로 검색: {user.username}")
        if user.username in users_db:
            user_data = users_db[user.username]
            user_key = user.username
            print(f"[DEBUG] 사용자 찾음: {user_key}")
        else:
            print(f"[DEBUG] username '{user.username}' 찾을 수 없음")
    elif user.email:
        print(f"[DEBUG] email로 검색: {user.email}")
        for key, data in users_db.items():
            if data.get("email") == user.email:
                user_data = data
                user_key = key
                print(f"[DEBUG] 이메일로 사용자 찾음: {user_key}")
                break
        if not user_data:
            print(f"[DEBUG] email '{user.email}' 찾을 수 없음")
    
    if not user_data:
        # 더 자세한 디버깅 정보 제공
        debug_info = {
            "available_users": list(users_db.keys()),
            "available_emails": [data.get("email") for data in users_db.values()],
            "search_username": user.username,
            "search_email": user.email
        }
        print(f"[DEBUG] 사용자를 찾을 수 없음: {debug_info}")
        raise HTTPException(
            status_code=401, 
            detail={
                "error": "User not found",
                "debug": debug_info
            }
        )
    
    # 비밀번호 검증
    print(f"[DEBUG] 비밀번호 검증 시작")
    if not verify_password(user.password, user_data["password"]):
        print(f"[DEBUG] 비밀번호 불일치")
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # 계정 활성화 상태 확인
    if not user_data.get("is_active", True):
        print(f"[DEBUG] 계정 비활성화")
        raise HTTPException(status_code=401, detail="Account is inactive")
    
    print(f"[DEBUG] 로그인 성공: {user_key}")
    return {
        "message": "Login successful",
        "username": user_key,
        "email": user_data["email"]
    }

# 로그인 (호환성을 위한 추가 엔드포인트)
@app.post("/login")
async def login_compat(user: UserLogin):
    return await login(user)

@app.post("/images/upload")
async def upload_image(
    file: UploadFile = File(...),
    lesion_type: str = Form(...),
    diagnosis: str = Form(""),
    username: str = Form(...)
):
    # 사용자 인증 확인
    if username not in users_db:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    # 파일 확장자 검증
    allowed_extensions = {'.png', '.jpg', '.jpeg', '.bmp', '.tiff'}
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Only {', '.join(allowed_extensions)} files are allowed")
    
    # 파일 크기 검증
    max_size = 10 * 1024 * 1024  # 10MB
    file_content = await file.read()
    if len(file_content) > max_size:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    
    # 파일 저장
    timestamp = datetime.now().timestamp()
    safe_filename = f"{int(timestamp)}_{file.filename.replace(' ', '_')}"
    file_path = UPLOAD_DIR / safe_filename
    
    with open(file_path, "wb") as buffer:
        buffer.write(file_content)
    
    # 이미지 정보 확인
    image_info = get_image_info(str(file_path))
    if not image_info["is_valid"]:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=image_info["error"])
    
    # AI 분류 시뮬레이션
    classification = simulate_lesion_classification(file.filename)
    
    # 이미지 데이터 저장
    image_id = len(images_db) + 1
    image_data = {
        "id": image_id,
        "filename": safe_filename,
        "original_filename": file.filename,
        "file_path": str(file_path),
        "lesion_type": lesion_type,
        "diagnosis": diagnosis,
        "file_size": image_info["file_size"],
        "width": image_info["width"],
        "height": image_info["height"],
        "uploaded_by": username,
        "uploaded_at": datetime.now().isoformat(),
        "is_synthetic": False,
        "ai_classification": classification
    }
    
    images_db[image_id] = image_data
    
    # 데이터 저장
    save_data()
    
    return {
        "id": image_id,
        "filename": safe_filename,
        "original_filename": file.filename,
        "lesion_type": lesion_type,
        "file_size": image_info["file_size"],
        "ai_prediction": classification,
        "message": "Image uploaded and processed successfully"
    }

@app.get("/images", response_model=List[ImageInfo])
async def get_images(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    lesion_type: Optional[str] = None,
    username: Optional[str] = None,
    is_synthetic: Optional[bool] = None
):
    images = list(images_db.values())
    
    # 필터링
    if lesion_type:
        images = [img for img in images if img["lesion_type"] == lesion_type]
    if username:
        images = [img for img in images if img["uploaded_by"] == username]
    if is_synthetic is not None:
        images = [img for img in images if img["is_synthetic"] == is_synthetic]
    
    # 정렬 및 페이지네이션
    images.sort(key=lambda x: x["uploaded_at"], reverse=True)
    return images[skip:skip + limit]

@app.get("/images/{image_id}")
async def get_image_detail(image_id: int):
    if image_id not in images_db:
        raise HTTPException(status_code=404, detail="Image not found")
    return images_db[image_id]

@app.get("/images/{image_id}/download")
async def download_image(image_id: int):
    if image_id not in images_db:
        raise HTTPException(status_code=404, detail="Image not found")
    
    file_path = images_db[image_id]["file_path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        filename=images_db[image_id]["original_filename"],
        media_type="application/octet-stream"
    )

@app.get("/images/{image_id}/opinion")
async def get_image_opinion(image_id: int):
    if image_id not in images_db:
        raise HTTPException(status_code=404, detail="Image not found")
    
    image = images_db[image_id]
    ai = image["ai_classification"]
    lesion = ai["predicted_type"]
    confidence = ai["confidence"]
    
    suggestion = {
        "melanoma": "조기 발견이 중요한 악성 병변입니다. 피부과 전문의 상담을 권장합니다.",
        "nevus": "양성 모반으로 보이지만 변화가 있으면 추적 관찰이 필요합니다.",
        "basal_cell_carcinoma": "기저세포암 의심. 조기 절제가 필요할 수 있습니다.",
        "actinic_keratosis": "광노출로 인한 전암 병변일 수 있습니다.",
        "benign": "양성 병변으로 보이며, 특별한 치료는 필요하지 않을 수 있습니다."
    }
    
    return {
        "image_id": image_id,
        "lesion_type": lesion,
        "confidence": confidence,
        "opinion": f"AI는 이 이미지를 '{lesion}'로 분류하였고, 정확도는 약 {int(confidence * 100)}%입니다.",
        "suggestion": suggestion.get(lesion, "정확한 진단을 위해 피부과 전문의의 상담이 필요합니다.")
    }

@app.delete("/images/{image_id}")
async def delete_image(image_id: int, username: str = ""):
    if username not in users_db:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    if image_id not in images_db:
        raise HTTPException(status_code=404, detail="Image not found")
    
    image_data = images_db[image_id]
    if image_data["uploaded_by"] != username:
        raise HTTPException(status_code=403, detail="Not authorized to delete this image")
    
    # 파일 삭제
    try:
        os.remove(image_data["file_path"])
    except FileNotFoundError:
        pass  # 파일이 이미 없으면 무시
    
    # 데이터베이스에서 삭제
    del images_db[image_id]
    
    # 데이터 저장
    save_data()
    
    return {"message": "Image deleted successfully"}

@app.post("/datasets")
async def create_dataset(dataset: DatasetCreate, username: str = ""):
    if username not in users_db:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    # 중복 데이터셋 이름 확인
    for ds in datasets_db.values():
        if ds["name"] == dataset.name and ds["created_by"] == username:
            raise HTTPException(status_code=400, detail="Dataset name already exists")
    
    dataset_id = len(datasets_db) + 1
    datasets_db[dataset_id] = {
        "id": dataset_id,
        "name": dataset.name,
        "description": dataset.description,
        "lesion_types": dataset.lesion_types,
        "is_public": dataset.is_public,
        "created_by": username,
        "created_at": datetime.now().isoformat(),
        "image_ids": []
    }
    
    # 데이터 저장
    save_data()
    
    return {
        "dataset_id": dataset_id,
        "name": dataset.name,
        "message": "Dataset created successfully"
    }

@app.get("/datasets")
async def get_datasets(
    skip: int = 0, 
    limit: int = 20, 
    username: str = "", 
    is_public: Optional[bool] = None
):
    datasets = list(datasets_db.values())
    
    # 필터링
    if username:
        datasets = [ds for ds in datasets if ds["created_by"] == username or ds["is_public"]]
    if is_public is not None:
        datasets = [ds for ds in datasets if ds["is_public"] == is_public]
    
    # 정렬 및 페이지네이션
    datasets.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {
        "datasets": datasets[skip:skip + limit],
        "total": len(datasets)
    }

@app.get("/statistics")
async def get_statistics():
    total_images = len(images_db)
    lesion_counts = {}
    user_upload_counts = {}
    
    for img in images_db.values():
        lesion_type = img["lesion_type"]
        lesion_counts[lesion_type] = lesion_counts.get(lesion_type, 0) + 1
        
        user = img["uploaded_by"]
        user_upload_counts[user] = user_upload_counts.get(user, 0) + 1
    
    return {
        "summary": {
            "total_images": total_images,
            "real_images": total_images,
            "total_users": len(users_db),
            "total_datasets": len(datasets_db)
        },
        "lesion_type_distribution": lesion_counts,
        "user_upload_distribution": user_upload_counts,
        "recent_activity": {
            "last_upload": max([img["uploaded_at"] for img in images_db.values()]) if images_db else None,
            "last_registration": max([user["created_at"] for user in users_db.values()]) if users_db else None
        }
    }

# 자동 회원가입/로그인 테스트 함수
def run_test():
    # 더 긴 대기 시간으로 서버 완전 시작 보장
    time.sleep(3)  

    BASE_URL = "http://localhost:8000"
    username = "dustpdks"
    email = "dustpdks123456@naver.com"
    password = "dksrlah123!"

    print("\n" + "="*50)
    print("🧪 자동 테스트 시작")
    print("="*50)

    # 먼저 현재 상태 확인
    print("\n[상태 확인] 현재 등록된 사용자 조회")
    try:
        r = requests.get(f"{BASE_URL}/debug/users")
        if r.status_code == 200:
            users_info = r.json()
            print(f"📊 현재 등록된 사용자 수: {users_info['total_users']}")
            if users_info['total_users'] > 0:
                print("👥 등록된 사용자들:")
                for user, info in users_info['users'].items():
                    print(f"  - {user} ({info['email']})")
        else:
            print(f"❌ 사용자 조회 실패: {r.status_code}")
    except Exception as e:
        print(f"❌ 사용자 조회 요청 실패: {e}")

    print(f"\n[테스트 1] 회원가입 시도 - {username}")
    register_payload = {
        "username": username,
        "email": email,
        "password": password
    }
    
    try:
        r = requests.post(f"{BASE_URL}/auth/register", json=register_payload)
        if r.status_code == 200:
            print("✅ 회원가입 성공")
            print("📝 회원가입 결과:", r.json())
        elif r.status_code == 400:
            response_data = r.json()
            if "already registered" in response_data.get("detail", ""):
                print("⚠️ 이미 등록된 사용자 (정상)")
                print("📝 응답:", response_data)
            else:
                print("❌ 회원가입 실패:", response_data)
        else:
            print(f"❌ 회원가입 실패 ({r.status_code}):", r.json())
    except Exception as e:
        print(f"❌ 회원가입 요청 실패: {e}")

    # 짧은 대기 후 로그인 시도
    time.sleep(1)

    print(f"\n[테스트 2] 로그인 시도 (username) - {username}")
    login_payload = {
        "username": username,
        "password": password
    }
    
    try:
        r = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
        if r.status_code == 200:
            print("✅ 로그인 성공 (username)")
            print("🔐 로그인 결과:", r.json())
        else:
            print(f"❌ 로그인 실패 (username) [{r.status_code}]:", r.json())
    except Exception as e:
        print(f"❌ 로그인 요청 실패: {e}")

    print(f"\n[테스트 3] 로그인 시도 (email) - {email}")
    login_payload = {
        "email": email,
        "password": password
    }
    
    try:
        r = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
        if r.status_code == 200:
            print("✅ 로그인 성공 (email)")
            print("🔐 로그인 결과:", r.json())
        else:
            print(f"❌ 로그인 실패 (email) [{r.status_code}]:", r.json())
    except Exception as e:
        print(f"❌ 로그인 요청 실패: {e}")

    print("\n" + "="*50)
    print("🎯 테스트 완료!")
    print("="*50)

if __name__ == "__main__":
    import uvicorn
    print("🚀 서버 시작 중...")
    print("📋 테스트 계정: dustpdks / dustpdks123456@naver.com")
    print("🔗 API 문서: http://localhost:8000/docs")
    
    threading.Thread(target=run_test, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)