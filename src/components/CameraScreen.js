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

  // 이미지 압축 함수
  const compressImage = (dataUrl, maxWidth = 800, quality = 0.8) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // 비율 유지하면서 크기 조정
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        const newWidth = img.width * ratio;
        const newHeight = img.height * ratio;
        
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        // 이미지 그리기
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        // 압축된 이미지 반환
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      
      img.src = dataUrl;
    });
  };

  // DataURL을 Blob으로 변환하는 함수
  function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
  }

  const handleDiagnose = async () => {
    if (!capturedImage) return;
    setIsLoading(true);
    setError(null);
    setDiagnosisResult(null);

    try {
      // 이미지 압축
      const compressedImage = await compressImage(capturedImage, 800, 0.7);
      
      // FastAPI 서버에 이미지 업로드 및 진단 요청
      const formData = new FormData();
      formData.append('file', dataURLtoBlob(compressedImage), 'captured.jpg');

      const response = await fetch('http://localhost:8000/analyze-image/', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('서버 응답:', response.status, errorText);
        throw new Error(`서버 오류: ${response.status}`);
      }
      
      const result = await response.json();
      
      console.log("=== FastAPI 응답 ===");
      console.log(result.result);
      console.log("===================");
      
      // GPT 응답을 파싱하여 구조화된 데이터로 변환
      const parseDiagnosisResponse = (response) => {
        // 예시: - 진단명: 사마귀\n- 신뢰도: 0.85\n- 위험도: 낮음\n- 설명: ...\n- 권장사항: ...
        const diagnosis = {
          diagnosis: "",
          confidence: null,
          riskLevel: "",
          description: "",
          recommendations: [],
          diagnosisDate: new Date().toISOString()
        };

        // GPT가 거부 응답을 했는지 확인
        const isRefusalResponse = response.toLowerCase().includes("sorry") || 
                                 response.toLowerCase().includes("can't") || 
                                 response.toLowerCase().includes("cannot") ||
                                 response.toLowerCase().includes("죄송") ||
                                 response.toLowerCase().includes("분석할 수 없") ||
                                 response.toLowerCase().includes("assist");

        if (isRefusalResponse) {
          // 거부 응답일 경우 기본값 설정
          diagnosis.diagnosis = "분석 불가";
          diagnosis.confidence = 0.0;
          diagnosis.riskLevel = "알 수 없음";
          diagnosis.description = "AI가 이미지 분석을 거부했습니다. 전문의 상담을 권장합니다.";
          diagnosis.recommendations = [
            "피부과 전문의에게 직접 상담하세요",
            "정확한 진단을 위해 의료진의 검사를 받으세요",
            "증상이 심각하다면 즉시 병원을 방문하세요",
            "자가 진단보다는 전문의의 의견을 우선하세요"
          ];
        } else {
          // 정상 응답일 경우 기존 파싱 로직 사용
          // 진단명
          const diagnosisMatch = response.match(/- 진단명:\s*([^\n]+)/);
          if (diagnosisMatch) diagnosis.diagnosis = diagnosisMatch[1].trim();

          // 신뢰도
          const confidenceMatch = response.match(/- 신뢰도:\s*([0-9.]+)/);
          if (confidenceMatch) diagnosis.confidence = parseFloat(confidenceMatch[1]);

          // 위험도
          const riskMatch = response.match(/- 위험도:\s*([^\n]+)/);
          if (riskMatch) diagnosis.riskLevel = riskMatch[1].trim();

          // 설명
          const descMatch = response.match(/- 설명:\s*([^\n]+)/);
          if (descMatch) diagnosis.description = descMatch[1].trim();

          // 권장사항 (여러 줄도 커버)
          const recMatch = response.match(/- 권장사항:\s*([\s\S]*)/);
          if (recMatch) {
            // 여러 줄일 경우 줄바꿈 기준으로 배열화
            diagnosis.recommendations = recMatch[1].split('\n').map(s => s.trim()).filter(Boolean);
          }

          // 파싱된 데이터가 부족한 경우 기본값 설정
          if (!diagnosis.diagnosis) diagnosis.diagnosis = "분석 결과 없음";
          if (diagnosis.confidence === null) diagnosis.confidence = 0.0;
          if (!diagnosis.riskLevel) diagnosis.riskLevel = "알 수 없음";
          if (!diagnosis.description) diagnosis.description = "분석 결과를 확인할 수 없습니다.";
          if (diagnosis.recommendations.length === 0) {
            diagnosis.recommendations = [
              "피부과 전문의에게 상담하세요",
              "정확한 진단을 위해 의료진의 검사를 받으세요"
            ];
          }
        }

        console.log("=== 파싱된 진단 결과 ===");
        console.log(diagnosis);
        console.log("=======================");

        return diagnosis;
      };
      
      const diagnosisResult = parseDiagnosisResponse(result.result);
      
      setDiagnosisResult(diagnosisResult);
    } catch (err) {
      console.error('진단 요청 오류:', err);
      setError(`진단 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const closeResultModal = () => {
    if (diagnosisResult && capturedImage && onDiagnosisComplete) {
      // 진단 결과 전체와 이미지 모두 전달
      onDiagnosisComplete(diagnosisResult, capturedImage);
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
