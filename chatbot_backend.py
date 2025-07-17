from fastapi import FastAPI, Path, Request
import requests
import re
from datetime import datetime

app = FastAPI()

# (실제 서비스에서는 사용자별 JWT 토큰을 받아서 사용해야 함)
JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoicmpzZHVkNTczNUBuYXZlci5jb20iLCJpYXQiOjE3NTI0NjkwMjgsImV4cCI6MTc1MzA3MzgyOH0._T7svs1DvqdNZnFuIx5O1n49OpNrCS4dp5paVfSMmjk"

# FAQ/레그(knowledge base) 예시
FAQ = {
    "예약 취소": "예약을 취소하려면 마이페이지 > 예약 내역에서 취소 버튼을 누르세요.",
    "예약 방법": "예약은 챗봇에게 '7월 19일 16시에 예약해줘'라고 입력하면 됩니다.",
    "운영 시간": "병원 운영 시간은 평일 09:00~18:00, 토요일 09:00~13:00입니다.",
    "진료 과목": "피부과, 내과, 정형외과 진료가 가능합니다."
}

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
    # "7월 19일 16시 예약을 17시로 바꿔줘"에서 기존 날짜/시간, 변경할 시간 추출
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

@app.post("/chat/{user_id}")
async def chat(user_id: int, req: Request):
    data = await req.json()
    user_message = data.get("message", "")

    # 1. 예약 조회 명령 감지
    if is_query_command(user_message):
        try:
            headers = {"Authorization": f"Bearer {JWT_TOKEN}"}
            res = requests.get(f"http://localhost:3001/api/reservations/{user_id}", headers=headers)
            if res.status_code == 200:
                reservation = res.json()
                if reservation:
                    return {"answer": f"예약 내역: {reservation}"}
                else:
                    return {"answer": "예약 내역이 없습니다."}
            else:
                return {"answer": f"예약 내역 조회에 실패했습니다. 서버 응답: {res.text}"}
        except Exception as e:
            return {"answer": f"예약 내역 조회 중 오류: {str(e)}"}

    # 2. 예약 수정 명령 감지
    if is_update_command(user_message):
        try:
            date, old_time, new_time, purpose = parse_update_info(user_message)
            if date and old_time and new_time:
                headers = {"Authorization": f"Bearer {JWT_TOKEN}", "Content-Type": "application/json"}
                # 1. 기존 예약 찾기
                res = requests.get(f"http://localhost:3001/api/reservations/{user_id}", headers=headers)
                if res.status_code == 200:
                    reservation = res.json()
                    if reservation and reservation.get("date") == date and reservation.get("time") == old_time:
                        # 2. 예약 정보 수정 (PUT)
                        body = {"date": date, "time": new_time, "purpose": purpose, "status": reservation.get("status", "confirmed")}
                        put_url = f"http://localhost:3001/api/reservations/{user_id}"
                        put_res = requests.put(put_url, json=body, headers=headers)
                        if put_res.status_code == 200:
                            return {"answer": f"{date} {old_time} 예약이 {new_time}로 변경되었습니다."}
                        else:
                            return {"answer": f"예약 변경에 실패했습니다. 서버 응답: {put_res.text}"}
                    else:
                        return {"answer": "해당 날짜와 시간에 예약이 없습니다."}
                else:
                    return {"answer": f"예약 정보를 불러오지 못했습니다. 서버 응답: {res.text}"}
            else:
                return {"answer": "변경할 예약의 날짜, 기존 시간, 변경할 시간을 정확히 입력해 주세요. 예: '7월 19일 16시 예약을 17시로 바꿔줘'"}
        except Exception as e:
            return {"answer": f"예약 수정 처리 중 오류: {str(e)}"}

    # 3. 예약 취소 명령 감지
    if is_cancel_command(user_message):
        try:
            date, time, _ = parse_reservation_info(user_message)
            headers = {"Authorization": f"Bearer {JWT_TOKEN}"}
            res = requests.get(f"http://localhost:3001/api/reservations/{user_id}", headers=headers)
            if res.status_code == 200:
                reservation = res.json()
                # 날짜/시간이 명확하지 않으면 가장 최근 예약을 취소
                if reservation:
                    if (not date or not time) or (reservation.get("date") == date and reservation.get("time") == time):
                        del_url = f"http://localhost:3001/api/reservations/{user_id}"
                        del_res = requests.delete(del_url, headers=headers)
                        if del_res.status_code == 200:
                            return {"answer": f"예약이 취소되었습니다."}
                        else:
                            return {"answer": f"예약 취소에 실패했습니다. 서버 응답: {del_res.text}"}
                    else:
                        return {"answer": "해당 날짜와 시간에 예약이 없습니다."}
                else:
                    return {"answer": "취소할 예약이 없습니다."}
            else:
                return {"answer": f"예약 정보를 불러오지 못했습니다. 서버 응답: {res.text}"}
        except Exception as e:
            return {"answer": f"예약 취소 처리 중 오류: {str(e)}"}

    # 4. 예약 생성 명령 감지
    if is_reservation_command(user_message):
        date, time, purpose = parse_reservation_info(user_message)
        if date and time:
            headers = {"Authorization": f"Bearer {JWT_TOKEN}", "Content-Type": "application/json"}
            body = {"date": date, "time": time, "purpose": purpose}
            res = requests.post(f"http://localhost:3001/api/reservations/{user_id}", json=body, headers=headers)
            if res.status_code == 201:
                return {"answer": f"{date} {time}에 예약이 완료되었습니다."}
            else:
                return {"answer": f"예약에 실패했습니다. 이미 예약이 있거나 서버 오류입니다. 서버 응답: {res.text}"}
        else:
            return {"answer": "날짜와 시간을 정확히 입력해 주세요. 예: '7월 19일 16시에 예약해줘'"}

    # 5. FAQ/레그 검색 (마지막에!)
    for key in FAQ:
        if key in user_message:
            return {"answer": FAQ[key]}

    # 6. 기타
    return {"answer": "질문을 이해하지 못했습니다."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("chatbot_backend:app", host="0.0.0.0", port=8000, reload=True) 