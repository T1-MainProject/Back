const fetch = require('node-fetch');
const sharp = require('sharp');

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_URL = "https://api.runpod.ai/v2/ozjch4shkql8tb/openai/v1/chat/completions"; // 수정된 URL

if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_URL) {
  console.error("RunPod API 키 또는 엔드포인트 URL이 .env 파일에 설정되지 않았습니다.");
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

class DiagnosisApiService {
  async diagnoseSkinDisease(imageBuffer) {
    if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_URL) {
      throw new Error("RunPod API 자격 증명이 설정되지 않았습니다.");
    }

    try {
      const base64Image = await sharp(imageBuffer)
        .jpeg()
        .toBuffer()
        .then(buffer => buffer.toString('base64'));

      const user_prompt_text = `**너는 한국어 피부과 전문의 AI이다. 모든 응답은 반드시 한국어로만 작성해야 한다.**

너는 피부 병변 진단을 위한 전문 AI 의사이다.  
사용자가 제공한 이미지에는 피부 병변이 포함되어 있다.

다음은 네가 진단할 수 있는 대표적인 피부 병변 목록이다. 각 병변은 형태, 색, 크기, 경계, 발생 부위, 진행 속도, 전이 가능성 등 여러 특징을 가진다.  
이 정보들을 바탕으로 이미지를 정밀 분석하여 가장 일치하는 하나의 질병을 찾아 진단하라.

분석 기준:
1. 병변의 모양, 색, 경계, 위치, 크기, 특징적 표면 등을 종합적으로 고려하라.
2. 병변 목록 중 가장 유사한 하나의 질환만 선택하라.
3. 왜 그 질환으로 판단했는지 의학적 근거를 설명하라.

출력 형식 (엄격히 준수):
- 반드시 아래와 같은 XML 구조로 응답하라.
- 다른 문장이나 주석은 금지된다.

멜라닌세포모반
- 병변형태: 갈색 또는 흑갈색의 경계가 뚜렷한 반점
- 발생시기: 선천적 또는 후천적
- 병변크기: 작지만 경우에 따라 증가 가능
- 악성화 가능성: 크기, 색, 경계 변화 시 악성화 가능성 있음
- 일반적 예후: 대부분 양성이며 변화 없으면 치료 불필요

광선각화증
- 발생부위: 자외선 노출이 많은 얼굴, 손등, 두피
- 병변모양: 붉거나 살색의 각질성 반점
- 병인: 만성 자외선 노출로 인한 DNA 손상
- 암화위험: 편평세포암으로 진행할 수 있음
- 진행속도: 천천히 진행되며, 조기 발견 시 예후 양호

악성흑색종
- 색상특징: 비균일한 검정, 갈색, 붉은색 혼합
- 비대칭성: 모양이 비대칭이며 경계가 불규칙함
- 병변변화: 빠르게 크기 증가 및 색 변화 가능
- 전이가능성: 림프절 및 전신으로 빠르게 전이
- 생존율: 조기 발견 시 생존율 높지만, 진행 시 예후 불량

편평세포암
- 병변형태: 붉고 딱딱한 결절 또는 궤양
- 주요원인: 자외선, 방사선, 화학자극 등
- 조직침습성: 주변 조직으로 깊게 침습 가능
- 전이위험: 림프절 전이 가능성 있음
- 치료예후: 조기 절제 시 완치 가능

보웬병
- 병변특징: 경계 뚜렷한 붉은 반점 + 각질
- 병리학적 특징: 표재성 편평세포암 (in situ)
- 진행속도: 천천히 진행되나 방치 시 침습암으로 발전 가능
- 증상: 대개 무증상이나 가려움 또는 자극감 동반 가능
- 치료법: 냉동요법, 국소 약물, 수술 등으로 치료 가능

사마귀
- 원인: 인유두종 바이러스(HPV) 감염
- 병변형태: 거칠고 단단한 표면의 돌출 병변
- 발생부위: 손, 발, 무릎 등 압박 부위
- 전염성: 피부 접촉이나 간접 접촉으로 전파
- 치료법: 냉동요법, 전기소작, 면역치료 등

피지샘증식증
- 병변형태: 노란빛의 작고 둥근 융기
- 발생부위: 이마, 코, 볼 등 얼굴 부위
- 병인: 피지선의 과증식
- 증상: 대부분 무증상, 드물게 가려움 동반
- 예후: 양성 병변이며 미용상 이유로 제거 가능

흑색점
- 병인: 멜라닌 색소의 국소적 과다 침착
- 색상: 균일한 갈색 또는 검은색
- 발생부위: 얼굴, 손등, 팔 등 햇빛 노출 부위
- 악성위험도: 변화가 없다면 대부분 양성
- 유사질환과 구분: 흑색종과의 감별이 필요할 수 있음

기저세포암
- 병변형태: 진주빛 반투명 결절 또는 궤양
- 성장속도: 천천히 자라며 국소 조직 침습
- 출혈: 표면이 얇아 출혈 및 궤양 발생 가능
- 전이위험: 전이는 매우 드물지만 재발 가능성 높음
- 치료: 수술 절제, 냉동요법, 광역학 치료 등 적용 가능

화농 육아종
- 발생기전: 외상, 감염, 호르몬 변화 등 자극 후 혈관 과증식
- 외형: 빠르게 자라는 붉은 결절, 표면에 광택 있음
- 증상: 쉽게 출혈되며 통증 동반 가능
- 진행속도: 수일 내 크기 증가
- 치료법: 외과적 절제, 전기소작, 레이저 등으로 제거

비립종
- 병변형태: 작고 단단한 하얀색 낭종
- 발생부위: 눈 주위, 뺨 등 얇은 피부
- 병인: 각질(케라틴)이 표피 아래에 갇혀 발생
- 증상: 무통성, 미용상 제거 요청 많음
- 치료: 절개 및 압출, 재발은 드묾

지루각화증
- 병변형태: 갈색~검은색의 융기된 각질성 반점
- 발생연령: 중장년층 이상에서 흔함
- 병리특성: 양성의 표피성 종양
- 증상: 드물게 가려움, 감염 시 염증 가능
- 치료필요성: 미용적 목적 외에는 치료 불필요

혈관종
- 병변형태: 붉거나 보라색의 부드러운 결절
- 유형: 유아형(모세혈관종)과 성인형(체리혈관종 등)
- 자연경과: 유아형은 대부분 자연 소실됨
- 위치: 얼굴, 두피, 몸통 등에 흔함
- 치료: 크거나 출혈 시 레이저, 수술, 경화요법 고려

피부섬유종
- 병변형태: 작고 단단한 결절, 중심부 오목함(딤플 사인)
- 발생원인: 외상 후 섬유조직 반응성 증식
- 통증여부: 대개 무통성
- 위치: 팔, 다리, 어깨 등에서 흔함
- 치료: 치료 불필요하나 원할 경우 절제 가능

표피낭종
- 병변형태: 둥글고 부드러운 낭종성 결절
- 병인: 피지선 배출구 폐쇄로 인한 케라틴 축적
- 증상: 염증 시 발적, 압통, 화농 동반
- 촉감: 압박 시 이동성 있음
- 치료: 염증 없을 때 절제, 감염 시 항생제 병용

응답은 반드시 <label>과 <summary> 태그를 사용한 XML 형식으로만 작성해야 한다.
예시: <label>질병명</label><summary>진단소견</summary>`;

const runPodPayload = {
  max_tokens: 300,
  messages: [
    {
      role: 'system',
      content: user_prompt_text,
    },
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${base64Image}`,
          },
        },
      ],
    },
  ],
};

// API 호출
const runResponse = await fetch(RUNPOD_ENDPOINT_URL, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RUNPOD_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(runPodPayload),
});

// 요청 데이터 로깅
console.log('API 요청 데이터:', JSON.stringify(runPodPayload, null, 2));

// 응답 처리
const runResult = await runResponse.json();
console.log('API 응답:', JSON.stringify(runResult, null, 2));

if (!runResponse.ok) {
  const errorBody = await runResponse.text();
  throw new Error(`/run API 요청 실패: ${runResponse.status} - ${errorBody || '응답 없음'}`);
}

if (!runResult.choices || runResult.choices.length === 0 || !runResult.choices[0].message.content) {
  console.error('AI 응답에서 콘텐츠를 추출하지 못했습니다. 원본 응답:', JSON.stringify(runResult, null, 2));
  throw new Error('AI 응답의 형식이 예상과 다릅니다.');
}

const aiContent = runResult.choices[0].message.content;
return this.formatDiagnosisResult(aiContent);

    } catch (error) {
      console.error('!!! [/api/diagnose] 오류 발생 !!!:', error);
      throw error;
    }
  }

  formatDiagnosisResult(aiContent) {
    try {
      console.log('AI 응답 파싱 시도. 원본 전체 텍스트:', aiContent);
      
      let textResult = aiContent.trim();
      
      textResult = textResult.trim();


      const diseaseList = [
        '멜라닌세포모반', '광선각화증', '악성흑색종', '편평세포암', '보웬병', 
        '사마귀', '피지샘증식증', '흑색점', '기저세포암', '화농 육아종', 
        '비립종', '지루각화증', '혈관종', '피부섬유종', '표피낭종'
      ];

      let foundDiagnosis = null;
      let lastIndex = -1;

      diseaseList.forEach(disease => {
        const index = textResult.lastIndexOf(disease);
        if (index > lastIndex) {
          lastIndex = index;
          foundDiagnosis = disease;
        }
      });

      if (!foundDiagnosis) {
        console.error("AI 응답에서 질병명을 찾을 수 없습니다. 원본:", textResult);
        throw new Error('AI가 보낸 응답에서 아는 질병명을 찾지 못했습니다.');
      }
      
      let description = '';
      const summaryMatch = textResult.match(/<summary>([\s\S]*?)<\/summary>|<summary>([\s\S]*)/);

      if (summaryMatch && (summaryMatch[1] || summaryMatch[2])) {
        description = (summaryMatch[1] || summaryMatch[2]).trim();
      } else {
        description = textResult.replace(/<[^>]*>/g, '').trim();
      }

      if (!description) {
        console.error("AI 응답에서 설명을 찾을 수 없습니다. 원본:", textResult);
        throw new Error('AI가 보낸 응답에서 진단 설명을 찾을 수 없습니다.');
      }
      
      const diagnosis = foundDiagnosis;
      const recommendations = ['정확한 진단 및 치료를 위해 전문의와 상담하세요.'];
      const detailedInfo = description;

      return { diagnosis, description, recommendations, detailedInfo };

    } catch (error) {
      console.error(`formatDiagnosisResult 오류: ${error.message}`);
      throw new Error(`RunPod 결과 처리 중 오류가 발생했습니다.`);
    }
  }
}

module.exports = new DiagnosisApiService();