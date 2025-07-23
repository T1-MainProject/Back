const fetch = require('node-fetch');
const sharp = require('sharp');

// .env 파일에서 RunPod API 키와 엔드포인트 URL 로드
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_URL = process.env.RUNPOD_ENDPOINT_URL;

if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_URL) {
  console.error("RunPod API 키 또는 엔드포인트 URL이 .env 파일에 설정되지 않았습니다.");
}

// 유틸리티 함수: 지정된 시간(ms) 동안 대기
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

class DiagnosisApiService {
  /**
   * RunPod에 배포된 모델을 사용하여 피부 질환 진단
   * @param {Buffer} imageBuffer - 진단할 이미지 버퍼
   * @returns {Promise<Object>} - 포맷팅된 진단 결과
   */
  async diagnoseSkinDisease(imageBuffer) {
    if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_URL) {
      throw new Error("RunPod API 자격 증명이 설정되지 않았습니다.");
    }

    try {
      // 1. 이미지 유효성 검사 및 전처리
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error("유효하지 않은 이미지 파일입니다.");
      }
      console.log(`RunPod 진단 요청: 원본 이미지 크기=${imageBuffer.length} bytes`);
      const base64Image = await sharp(imageBuffer)
        .resize(512, 512)
        .jpeg()
        .toBuffer()
        .then(buffer => buffer.toString('base64'));
      const prompt = "USER: <image>\n이 이미지에 있는 피부 질환을 진단하고, 가능한 원인과 추천되는 관리법을 알려주세요.\nASSISTANT:";

      // 2. RunPod에 비동기 작업 요청 (/run)
      const runResponse = await fetch(RUNPOD_ENDPOINT_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RUNPOD_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            image: base64Image,
            prompt: prompt,
            max_new_tokens: 250
          }
        })
      });

      if (!runResponse.ok) {
        const errorBody = await runResponse.text();
        console.error(`RunPod /run API 오류: ${runResponse.status}`, errorBody);
        throw new Error(`/run API 요청 실패: ${runResponse.status} - ${errorBody}`);
      }

      const runResult = await runResponse.json();
      const jobId = runResult.id;
      console.log(`RunPod 작업 시작됨, Job ID: ${jobId}, 상태: ${runResult.status}`);

      // 3. 결과가 나올 때까지 폴링 (/status)
      const statusUrl = RUNPOD_ENDPOINT_URL.replace('/run', `/status/${jobId}`);
      let finalResult = null;
      const maxAttempts = 60; // 최대 90회 시도 (약 3분)
      let attempt = 0;

      while (attempt < maxAttempts) {
        await delay(2000); // 2초 대기
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
        });

        if (!statusResponse.ok) {
          console.warn(`상태 확인 실패 (시도 ${attempt + 1}): ${statusResponse.status}`);
          continue; 
        }

        const statusResult = await statusResponse.json();
        console.log(`[시도 ${attempt + 1}] 현재 작업 상태: ${statusResult.status}`);

        if (statusResult.status === 'COMPLETED') {
          finalResult = statusResult;
          break;
        } else if (statusResult.status === 'FAILED') {
          throw new Error(`RunPod 작업 실패: ${JSON.stringify(statusResult)}`);
        }
        attempt++;
      }

      if (!finalResult) {
        throw new Error('RunPod 작업 시간 초과');
      }

      console.log('RunPod 최종 결과:', JSON.stringify(finalResult, null, 2));

      // 4. 최종 결과 포맷팅
      return this.formatDiagnosisResult(finalResult);

    } catch (error) {
      console.error('RunPod 진단 서비스 오류:', error);
      throw error;
    }
  }

  /**
   * RunPod API 결과를 앱 형식에 맞게 포맷팅
   * @param {Object} apiResult - 최종 RunPod API 결과 (COMPLETED 상태)
   * @returns {Object} - 포맷팅된 진단 결과
   */
  formatDiagnosisResult(apiResult) {
    try {
      // RunPod 응답 형식에 따라 'output.choices[0].tokens[0]' 경로에서 결과 추출
      const generatedText = apiResult.output[0].choices[0].tokens[0];

      if (!generatedText || generatedText.trim() === '') {
        console.error('잘못된 형식의 최종 RunPod 진단 결과:', apiResult);
        throw new Error('RunPod에서 유효한 최종 텍스트 결과를 받지 못했습니다.');
      }

      return {
        diagnosis: generatedText, // AI가 생성한 전체 텍스트
        description: 'AI 모델의 분석 결과입니다.', // 설명은 간단히 고정
        full_results: apiResult
      };
    } catch (e) {
      console.error('RunPod 결과 포맷팅 중 오류 발생:', e);
      console.error('오류 발생 시점의 전체 API 결과:', JSON.stringify(apiResult, null, 2));
      throw new Error('RunPod 결과 처리 중 오류가 발생했습니다.');
    }
  }
}

module.exports = new DiagnosisApiService();