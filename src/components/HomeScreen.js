import React, { useState } from 'react';
import Header from './Header';
import DiagnosisButton from './DiagnosisButton';
import Calendar from './Calendar';
import ScheduleCard from './ScheduleCard';
import MedicalRecordList from './MedicalRecordList';
import BottomNav from './BottomNav';
import CameraScreen from './CameraScreen';
import DiagnosisResult from './DiagnosisResult';

export default function HomeScreen({ user, onLogout, records, setRecords, onDiagnosisComplete, reservation, onReservationChanged }) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isPreparingCamera, setIsPreparingCamera] = useState(false);
  const [preloadedStream, setPreloadedStream] = useState(null);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);

  // 예시 데이터
  const schedule = [
    {
      time: "10 AM",
      title: "진료 예약",
      desc: "흑색종 의심으로 인한 진료 예약",
      date: "2025. 06. 25",
    },
  ];

  const handleDiagnoseClick = async () => {
    if (isPreparingCamera) return;

    setIsPreparingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          aspectRatio: { ideal: 9 / 16 }
        }
      });
      setPreloadedStream(stream);
      setIsCameraOpen(true); // 스트림이 준비되면 카메라 화면으로 전환
    } catch (err) {
      console.error("카메라 접근 오류:", err);
      alert('카메라를 시작할 수 없습니다. 장치 권한을 확인해주세요.');
      setIsPreparingCamera(false); // 오류 발생 시 로딩 상태 해제
    }
  };

  const handleBackFromCamera = () => {
    if (preloadedStream) {
      preloadedStream.getTracks().forEach(track => track.stop());
    }
    setPreloadedStream(null);
    setIsCameraOpen(false);
    setIsPreparingCamera(false);
  };

  // 진단 완료 시 기록 추가 콜백
  const handleDiagnosisComplete = (result, image) => {
    setDiagnosisResult(result);
    setCapturedImage(image);
    handleBackFromCamera();
  };

  // 진료기록 저장 완료 후 콜백
  const handleRecordSaved = () => {
    setDiagnosisResult(null);
    setCapturedImage(null);
    if (onDiagnosisComplete) {
      onDiagnosisComplete(); // App.js의 fetchRecords 호출
    }
  };

  if (isCameraOpen) {
    return <CameraScreen onBack={handleBackFromCamera} preloadedStream={preloadedStream} onDiagnosisComplete={handleDiagnosisComplete} />;
  }

  return (
    <div id="app-container" className="w-[360px] h-[800px] bg-white flex flex-col shadow-2xl mx-auto my-4 relative">
      <Header user={user} onLogout={onLogout} />
      <div className="flex-1 flex flex-col items-center px-4 overflow-y-auto">
        <DiagnosisButton onDiagnose={handleDiagnoseClick} />
        <Calendar />
        <ScheduleCard reservation={reservation} />
        <MedicalRecordList records={records} />
      </div>
      <div className="flex-shrink-0">
        <BottomNav onReservationChanged={onReservationChanged} />
      </div>

      {isPreparingCamera && (
        <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-50 rounded-2xl">
          <div className="w-12 h-12 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin"></div>
          <p className="mt-4 text-white text-lg">카메라 준비중...</p>
        </div>
      )}

      {diagnosisResult && (
        <DiagnosisResult
          diagnosis={diagnosisResult}
          onClose={handleRecordSaved}
          capturedImage={capturedImage}
        />
      )}
    </div>
  );
}