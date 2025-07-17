import React from "react";

export default function Header({ user, onLogout }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <div className="flex items-center gap-3">
        <img
          src={user.profileImg}
          alt="프로필"
          className="w-14 h-14 rounded-full object-cover border-2 border-blue-200"
          style={{ width: "56px", height: "56px", objectFit: "cover", borderRadius: "50%" }}
        />
        <div>
          <div className="text-xs text-[#2260FF] font-semibold">안녕하세요,</div>
          <div className="text-base font-bold text-gray-800">{user.name} 님!</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button>
          <img src="/images/Alarm.svg" alt="알람" className="w-27 h-27" />
        </button>
        <button onClick={onLogout} className="text-sm text-gray-600 hover:text-red-500">
          로그아웃
        </button>
      </div>
    </div>
  );
} 