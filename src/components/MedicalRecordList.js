import React from "react";

export default function MedicalRecordList({ records }) {
  const safeRecords = records || [];
  console.log('진료기록 렌더:', safeRecords);
  return (
    <div className="w-full bg-[#2260FF] rounded-2xl p-3 mb-4">
      <div className="text-white font-bold mb-2">진료기록!</div>
      <div className="max-h-60 overflow-y-auto pr-1">
        {safeRecords.map((rec, idx) => (
          <div
            key={idx}
            className="flex items-center bg-white rounded-xl mb-2 p-2 shadow"
          >
            <img
              src={rec.img}
              alt={rec.title}
              className="w-12 h-12 rounded-lg object-cover mr-3"
            />
            <div>
              <div className="text-xs font-semibold text-[#2260FF]">{rec.title}</div>
              <div className="text-xs text-gray-500">{rec.date}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 