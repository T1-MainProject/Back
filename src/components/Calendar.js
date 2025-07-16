import React from "react";

const days = [
  { day: "MON", date: 23 },
  { day: "TUE", date: 24 },
  { day: "WED", date: 25, active: true },
  { day: "THU", date: 26 },
  { day: "FRI", date: 27 },
  { day: "SAT", date: 28 },
];

export default function Calendar() {
  return (
    <div className="w-full bg-[#CAD6FF] rounded-t-2xl py-3 px-2 flex flex-col items-center mb-2">
      <div className="flex justify-between w-full mb-1">
        {days.map((d, i) => (
          <div
            key={i}
            className={`flex flex-col items-center w-10 ${
              d.active
                ? "bg-[#2260FF] text-white rounded-2xl py-1"
                : "text-[#2260FF]"
            }`}
          >
            <span className="text-xs">{d.date}</span>
            <span className="text-[10px]">{d.day}</span>
          </div>
        ))}
      </div>
      <div className="w-full text-right text-xs text-[#2260FF] font-semibold">
        25 수요일 · 당일
      </div>
    </div>
  );
} 