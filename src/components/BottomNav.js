import React, { useState } from "react";
import CalendarModal from "./CalendarModal";

export default function BottomNav({ onReservationChanged }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  return (
    <>
      <div className="relative w-[360px] h-[72px] mx-auto rounded-2xl overflow-hidden bg-[#2260FF]">
        <div className="relative z-10 w-full h-full flex items-center justify-around">
          <button className="flex-1 flex flex-col items-center justify-center">
            <img src="/images/B_home.svg" alt="Home" className="w-8 h-8 mt-[-12px]" />
          </button>
          <button className="flex-1 flex flex-col items-center justify-center">
            <img src="/images/B_chat.svg" alt="Chat" className="w-8 h-8 mt-[-12px]" />
          </button>
          <button className="flex-1 flex flex-col items-center justify-center">
            <img src="/images/B_user.svg" alt="User" className="w-8 h-8 mt-[-12px]" />
          </button>
          <button className="flex-1 flex flex-col items-center justify-center" onClick={() => setCalendarOpen(true)}>
            <img src="/images/B_calendar.svg" alt="Calendar" className="w-8 h-8 mt-[-12px]" />
          </button>
        </div>
      </div>
      {calendarOpen && <CalendarModal onClose={(changed) => {
        setCalendarOpen(false);
        if (changed && onReservationChanged) onReservationChanged();
      }} />}
    </>
  );
} 