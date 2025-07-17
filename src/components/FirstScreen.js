import React, { useEffect } from "react";
import LoadingMainIcon from "./LoadingMainIcon.svg";
import LoadingMainTitle from "./LoadingMainTitle.svg";
import MiniTitle from "./MiniTitle.svg";

export const FirstScreen = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex flex-row justify-center w-full" style={{ backgroundColor: '#2260FF' }}>
      <div className="w-[360px] h-[800px] relative flex flex-col items-center justify-center" style={{ backgroundColor: '#2260FF' }}>
        <img src={LoadingMainIcon} alt="로딩 메인 아이콘" className="mb-8" />
        <img src={LoadingMainTitle} alt="로딩 메인 타이틀" className="mb-4" />
        <img src={MiniTitle} alt="미니 타이틀" className="mt-2" />
      </div>
    </div>
  );
}; 