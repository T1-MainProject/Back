import React, { useState } from 'react';

const DiagnosisResult = ({ diagnosis, onClose, capturedImage }) => {
  const [isSaving, setIsSaving] = useState(false);
  
  if (!diagnosis) return null;

  // features가 없을 때도 안전하게 처리
  const features = diagnosis.features || {};

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      // 진료기록 저장
      const token = localStorage.getItem('token');
      const recordData = {
        img: capturedImage,
        diagnosis: diagnosis.diagnosis,
        confidence: diagnosis.confidence,
        riskLevel: diagnosis.riskLevel,
        description: diagnosis.description,
        recommendations: diagnosis.recommendations
      };

      const response = await fetch('http://localhost:3001/api/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(recordData)
      });

      if (response.ok) {
        console.log('진료기록이 성공적으로 저장되었습니다.');
        // 홈화면으로 이동
        onClose();
      } else {
        console.error('진료기록 저장 실패');
        alert('진료기록 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('진료기록 저장 오류:', error);
      alert('진료기록 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case '위험': return 'text-red-600 bg-red-100';
      case '높음': return 'text-orange-600 bg-orange-100';
      case '보통': return 'text-yellow-600 bg-yellow-100';
      case '낮음': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceColor = (confidence) => {
    if (!confidence || confidence === 0) return 'text-gray-600';
    if (confidence <= 0.4) return 'text-red-600';
    if (confidence <= 0.8) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getConfidenceBarColor = (confidence) => {
    if (!confidence || confidence === 0) return 'bg-gray-500';
    if (confidence <= 0.4) return 'bg-red-500';
    if (confidence <= 0.8) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="absolute inset-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">진단 결과</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* 진단 결과 내용 */}
        <div className="p-6">
          <div className="w-full max-w-[320px] mx-auto bg-[#CAD6FF] rounded-2xl px-6 py-6 space-y-6">
            {/* 찍은 사진 */}
            {capturedImage && (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">촬영된 이미지</h3>
                <div className="flex justify-center mt-4 mb-6">
                  <img 
                    src={capturedImage} 
                    alt="촬영된 이미지" 
                    className="w-64 h-64 object-cover rounded-lg border border-gray-200"
                  />
                </div>
              </div>
            )}

            {/* 진단명 */}
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">진단명</h3>
              <p className="text-lg text-gray-700">{diagnosis.diagnosis}</p>
            </div>

            {/* 신뢰도 + 위험도 */}
            <div className="bg-white rounded-xl p-4 space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">신뢰도</h3>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getConfidenceBarColor(diagnosis.confidence)}`}
                      style={{ width: `${diagnosis.confidence ? diagnosis.confidence * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className={`font-semibold text-lg ${getConfidenceColor(diagnosis.confidence)}`}>
                    {diagnosis.confidence ? Math.round(diagnosis.confidence * 100) : 0}%
                  </span>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">위험도</h3>
                <span className={`px-3 py-1 rounded-full text-lg font-medium ${getRiskColor(diagnosis.riskLevel)}`}>
                  {diagnosis.riskLevel}
                </span>
              </div>
            </div>

            {/* 설명 */}
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">설명</h3>
              <p className="text-lg text-gray-700 leading-relaxed">
                {diagnosis.description}
              </p>
            </div>

            {/* 권장사항 */}
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">권장사항</h3>
              <ul className="space-y-2">
                {(diagnosis.recommendations || []).map((rec, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-blue-500 mt-1 text-lg">•</span>
                    <span className="text-gray-700 text-lg">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 진단 정보 */}
            <div className="bg-white p-4 rounded-lg">
              <div className="text-lg">
                <div>
                  <p className="text-gray-500 text-xl">진단 날짜</p>
                  <p className="font-bold text-gray-800 font-sans text-xl">
                    {diagnosis.diagnosisDate ? new Date(diagnosis.diagnosisDate).toLocaleDateString('ko-KR') : '-' }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={handleConfirm}
            disabled={isSaving}
            className={`w-full py-3 rounded-xl font-semibold transition-colors ${
              isSaving 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSaving ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                저장 중...
              </div>
            ) : (
              '확인'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiagnosisResult;
