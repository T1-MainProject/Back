import React from "react";

export default function ScheduleCard({ schedule }) {
  return (
    <div className="w-full bg-white rounded-2xl shadow p-3 mb-3">
      <div className="text-xs text-[#2260FF] font-bold mb-1">9 AM - 12 AM</div>
      {schedule.map((item, idx) => (
        <div key={idx} className="border border-[#2260FF] rounded-xl p-2 mb-1 bg-[#E2EAFF]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#2260FF]">{item.title}</span>
            <span className="text-xs text-gray-400">✔</span>
          </div>
          <div className="text-xs text-gray-700">{item.desc}</div>
        </div>
      ))}
    </div>
  );
} 