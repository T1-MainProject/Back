import React from "react";

export default function DiagnosisButton({ onDiagnose }) {
  // 부모 컴포넌트(HomeScreen)에서 받은 onDiagnose 함수를 바로 사용합니다.
  return (
    <div className="flex flex-col items-center my-4">
      <button
        onClick={onDiagnose} // onClick 이벤트에 onDiagnose 함수를 직접 연결합니다.
        className="flex flex-col items-center justify-center w-40 h-40 bg-gradient-to-b from-[#E2EAFF] to-[#CAD6FF] rounded-full shadow-md mb-2"
      >
        <img src="/images/Mainicon.svg" alt="청진기" className="w-50 h-50" />
      </button>
      <span className="text-[#2260FF] text-2xl font-bold mt-2">진단하기!</span>
    </div>
  );
} 