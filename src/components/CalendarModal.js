import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { jwtDecode } from "jwt-decode";

export default function CalendarModal({ onClose, records = [] }) {
  const [date, setDate] = useState(null); // null이면 날짜 미선택
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reservation, setReservation] = useState(null);

  // 예약 정보 불러오기
  useEffect(() => {
    const fetchReservation = async () => {
      const token = localStorage.getItem("token");
      const decoded = jwtDecode(token);
      const userId = decoded.userId;
      const res = await fetch(`http://localhost:3001/api/reservations/${userId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReservation(data);
        // 예약이 있으면 시간 입력란에 기본값 설정
        if (data && data.time) setTime(data.time);
      }
    };
    fetchReservation();
  }, []);

  const handleReserve = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      // 토큰에서 userId 추출
      let userId = null;
      if (token) {
        const decoded = jwtDecode(token);
        userId = decoded.userId;
      }
      if (!userId) throw new Error("로그인 정보가 없습니다.");
      const res = await fetch(`http://localhost:3001/api/reservations/${userId}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          date: date ? date.toISOString().slice(0, 10) : "",
          time,
          purpose: "진료 예약"
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "예약 실패");
      }
      onClose(true); // 예약 성공 시 true 전달
    } catch (e) {
      setError(e.message || "예약에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  // 예약 수정 함수
  const handleUpdate = async () => {
    const token = localStorage.getItem("token");
    const decoded = jwtDecode(token);
    const userId = decoded.userId;
    await fetch(`http://localhost:3001/api/reservations/${userId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        date: date ? date.toISOString().slice(0, 10) : reservation?.date,
        time: time || reservation?.time,
        purpose: "진료 예약",
        status: "confirmed"
      })
    });
    onClose(true); // 수정 성공 시 true 전달
  };

  // 예약 삭제 함수
  const handleDelete = async () => {
    const token = localStorage.getItem("token");
    const decoded = jwtDecode(token);
    const userId = decoded.userId;
    await fetch(`http://localhost:3001/api/reservations/${userId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    // 성공 시 UI 갱신
    onClose(true); // 삭제 성공 시 true 전달
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-80 flex flex-col items-center shadow-lg relative">
        <button className="absolute top-2 right-3 text-xl" onClick={onClose}>×</button>
        <div className="mb-4 w-full">
          <label className="block text-[#2260FF] font-bold mb-2">날짜 선택</label>
          <Calendar
            onChange={setDate}
            value={date}
            minDate={new Date()}
            locale="ko-KR"
          />
        </div>
        {date && (
          <>
            <div className="mb-4 w-full">
              <label className="block text-[#2260FF] font-bold mb-2">시간</label>
              <input type="time" className="w-full border rounded p-2" value={time} onChange={e => setTime(e.target.value)} />
            </div>
            {error && <div className="text-red-500 mb-2">{error}</div>}
            <button className="w-full bg-[#2260FF] text-white rounded p-2 font-bold" onClick={handleReserve} disabled={loading || !time}>
              {loading ? "예약 중..." : "예약하기"}
            </button>
            {reservation && (
              <div className="w-full flex gap-2 mt-2">
                <button
                  className="flex-1 bg-[#2260FF] text-white rounded p-2 font-bold"
                  onClick={handleUpdate}
                >
                  예약 수정
                </button>
                <button
                  className="flex-1 bg-[#2260FF] text-white rounded p-2 font-bold"
                  onClick={handleDelete}
                >
                  예약 삭제
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 