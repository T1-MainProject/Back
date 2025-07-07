import React, { useState, useRef, useEffect } from 'react';
import DiagnosisResultScreen from './DiagnosisResultScreen';

export default function CameraScreen({ onBack, preloadedStream, onDiagnosisComplete }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [capturedImage, setCapturedImage] = useState(null);
  const [stream, setStream] = useState(null);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCameraInitializing, setIsCameraInitializing] = useState(true); // 카메라 로딩 상태 추가

  const startCamera = async () => {
    if (stream) return; // 카메라가 이미 실행 중이면 중복 실행 방지

    setIsCameraInitializing(true);
    try {
      const constraints = {
        video: {
          facingMode: 'user',
          aspectRatio: { ideal: 9 / 16 }
        }
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // 비디오 메타데이터가 로드되면 로딩 상태를 해제하여 화면을 표시합니다.
        videoRef.current.onloadedmetadata = () => {
          setIsCameraInitializing(false);
        };
      }
      setStream(mediaStream);
      setCapturedImage(null);
      setError(null);
    } catch (err) {
      console.error("카메라 접근 오류:", err);
      setError('카메라를 시작할 수 없습니다. 장치 권한을 확인해주세요.');
      setIsCameraInitializing(false); // 에러 발생 시에도 로딩 상태 해제
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (preloadedStream) {
      // HomeScreen에서 미리 로드된 스트림을 사용합니다.
      if (videoRef.current) {
        videoRef.current.srcObject = preloadedStream;
        videoRef.current.onloadedmetadata = () => {
          setIsCameraInitializing(false);
        };
      }
      setStream(preloadedStream);
      setIsCameraInitializing(false); // 미리 로드되었으므로 로딩 화면을 즉시 해제
    } else {
      // 직접 카메라를 시작해야 하는 경우
      startCamera();
    }

    return () => {
      // 컴포넌트가 언마운트될 때, HomeScreen에서 스트림을 관리하므로
      // 여기서는 스트림을 멈추지 않도록 조건 추가가 필요할 수 있습니다.
      // 하지만 현재 onBack에서 이미 처리하고 있으므로 괜찮습니다.
    };
  }, [preloadedStream]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      const imageDataUrl = canvas.toDataURL('image/jpeg');
      setCapturedImage(imageDataUrl);
      stopCamera();
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleAlbumSelect = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedImage(e.target.result);
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDiagnose = async () => {
    if (!capturedImage) return;
    setIsLoading(true);
    setError(null);
    setDiagnosisResult(null);

    try {
      const dummyDiagnosis = {
        diagnosis: '보웬병',
        confidence: 0.92,
        riskLevel: '높음',
        description: '보웬병은 피부에 발생하는 상피내암의 일종으로, 조기 발견 시 완치가 가능합니다. 진단을 위해 반드시 조직검사가 필요합니다.',
        recommendations: [
          '피부과 전문의와 상담하세요.',
          '조직검사를 통해 확진을 받으세요.',
          '정기적으로 피부 상태를 관찰하세요.'
        ],
        diagnosisDate: new Date().toISOString(),
      };

      setTimeout(() => {
        setDiagnosisResult(dummyDiagnosis);
        setIsLoading(false);
      }, 1500);
    } catch (err) {
      console.error("진단 요청 오류:", err);
      setError('진단 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setIsLoading(false);
    }
  };

  const closeResultModal = () => {
    if (diagnosisResult && capturedImage && onDiagnosisComplete) {
      onDiagnosisComplete({
        img: capturedImage,
        title: diagnosisResult.diagnosis,
        date: diagnosisResult.diagnosisDate ? new Date(diagnosisResult.diagnosisDate).toLocaleDateString('ko-KR') : '-',
      });
    } else {
      onBack();
    }
  };

  if (diagnosisResult) {
    return (
      <DiagnosisResultScreen
        diagnosis={diagnosisResult}
        capturedImage={capturedImage}
        onClose={closeResultModal}
      />
    );
  }

  return (
    <div className="w-full h-full bg-black text-white flex flex-col items-center justify-center relative">
      <button onClick={onBack} className="absolute top-5 left-5 z-20 text-white">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="w-full flex-grow flex items-center justify-center overflow-hidden relative">
        {capturedImage ? (
          <img src={capturedImage} alt="Captured" className="max-w-full max-h-full object-contain" />
        ) : (
          <>
            {/* 비디오를 항상 렌더링하되, 로딩 중에는 스피너 오버레이로 덮습니다. */}
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            ></video>

            {isCameraInitializing && (
              <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-10">
                <div className="w-12 h-12 border-4 border-t-blue-500 border-gray-600 rounded-full animate-spin"></div>
                <p className="mt-4 text-white text-lg">카메라 준비중...</p>
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} className="hidden"></canvas>
      </div>

      <div className="w-full p-5 bg-black bg-opacity-50 flex items-center justify-around z-10">
        {capturedImage ? (
          <>
            <button onClick={handleRetake} className="text-white font-semibold">다시 찍기</button>
            <button onClick={handleDiagnose} className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold text-lg">진단하기</button>
          </>
        ) : (
          <>
            <button onClick={handleAlbumSelect} className="text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button onClick={handleCapture} className="w-20 h-20 bg-white rounded-full border-4 border-gray-400"></button>
            <div className="w-8 h-8"></div>
          </>
        )}
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-30">
          <div className="w-16 h-16 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin"></div>
          <p className="mt-4 text-white">진단 중입니다...</p>
        </div>
      )}
      {error && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg z-30">
          {error}
        </div>
      )}

      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
    </div>
  );
}
