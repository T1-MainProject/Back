import React from 'react';
import DiagnosisResult from './DiagnosisResult';

export default function DiagnosisResultScreen({ diagnosis, capturedImage, onClose }) {
  return (
    <div className="w-[360px] h-[800px] bg-[#F5F6FA] flex items-center justify-center mx-auto my-0">
      <DiagnosisResult diagnosis={diagnosis} capturedImage={capturedImage} onClose={onClose} />
    </div>
  );
} 