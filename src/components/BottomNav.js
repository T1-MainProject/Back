import React from "react";


export default function BottomNav() {
  return (
    // 1. 배경을 SVG 이미지 대신 파란색(#2260FF)으로 직접 채웁니다.
    // 2. 둥근 모서리, 여백 등 기존 스타일은 그대로 유지합니다.
    <div className="relative w-[360px] h-[72px] mx-auto rounded-2xl overflow-hidden bg-[#2260FF]">
      {/* 아이콘 버튼들: h-full로 높이를 꽉 채우고, justify-around로 아이콘 간격을 균등하게 맞춥니다. */}
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
        <button className="flex-1 flex flex-col items-center justify-center">
          <img src="/images/B_calendar.svg" alt="Calendar" className="w-8 h-8 mt-[-12px]" />
        </button>
      </div>
    </div>
  );
} 