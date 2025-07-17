const { HfInference } = require('@huggingface/inference');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Hugging Face API 키 (환경변수에서 가져오기)
const HF_TOKEN = process.env.HF_TOKEN || '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';
const headers = { Authorization: `Bearer ${HF_TOKEN}` };

// Hugging Face Inference 클라이언트 초기화
const hf = new HfInference(HF_TOKEN);

// 피부 질환 분류 모델들
const SKIN_DISEASE_MODELS = {
  'my-skin-model': 'MAGEONYOUNG/skin_dataset', // ← 본인 모델명으로 변경
  // 실제 피부 질환 분류 모델들 (Hugging Face에서 사용 가능한 모델들)
  'skin-cancer': 'microsoft/DialoGPT-medium', // 임시 모델 - 실제 피부 질환 모델로 변경 필요
  'dermatology': 'microsoft/DialoGPT-medium', // 임시 모델
  'melanoma': 'microsoft/DialoGPT-medium'     // 임시 모델
};

// 기본 모델 선택
const DEFAULT_MODEL = 'my-skin-model';

class HuggingFaceService {
  /**
   * 이미지 전처리
   * @param {Buffer} imageBuffer - 원본 이미지 버퍼
   * @returns {Promise<Buffer>} - 전처리된 이미지 버퍼
   */
  async preprocessImage(imageBuffer) {
    try {
      // 이미지를 224x224 크기로 리사이즈하고 정규화
      const processedImage = await sharp(imageBuffer)
        .resize(224, 224)
        .jpeg({ quality: 90 })
        .toBuffer();
      
      return processedImage;
    } catch (error) {
      console.error('이미지 전처리 오류:', error);
      throw new Error('이미지 전처리에 실패했습니다.');
    }
  }

  /**
   * Hugging Face 모델을 사용한 피부 질환 진단
   * @param {Buffer} imageBuffer - 진단할 이미지
   * @param {string} modelType - 사용할 모델 타입 (기본값: 'skin-cancer')
   * @returns {Promise<Object>} - 진단 결과
   */
  async diagnoseSkinDisease(imageBuffer, modelType = DEFAULT_MODEL) {
    try {
      // 이미지 전처리
      const processedImage = await this.preprocessImage(imageBuffer);
      
      // 모델 선택
      const selectedModel = SKIN_DISEASE_MODELS[modelType] || SKIN_DISEASE_MODELS[DEFAULT_MODEL];
      
      // Hugging Face 모델에 이미지 전송
      const result = await hf.imageClassification({
        model: selectedModel,
        inputs: processedImage,
      });

      // 결과 파싱 및 포맷팅
      const diagnosis = this.formatDiagnosisResult(result);
      
      return diagnosis;
    } catch (error) {
      console.error('Hugging Face 진단 오류:', error);
      throw new Error('진단 처리 중 오류가 발생했습니다.');
    }
  }

  /**
   * 진단 결과를 앱 형식에 맞게 포맷팅
   * @param {Array} hfResult - Hugging Face API 결과
   * @returns {Object} - 포맷팅된 진단 결과
   */
  formatDiagnosisResult(hfResult) {
    // 상위 3개 결과 추출
    const topResults = hfResult.slice(0, 3);
    
    // 가장 높은 신뢰도를 가진 결과를 메인 진단으로 사용
    const mainDiagnosis = topResults[0];
    
    // 신뢰도에 따른 위험도 결정
    const riskLevel = this.calculateRiskLevel(mainDiagnosis.score);
    
    // 진단 설명 및 권장사항 생성
    const { description, recommendations } = this.generateRecommendations(
      mainDiagnosis.label,
      mainDiagnosis.score
    );

    return {
      diagnosis: mainDiagnosis.label,
      confidence: Math.round(mainDiagnosis.score * 100) / 100,
      riskLevel,
      description,
      recommendations,
      alternativeDiagnoses: topResults.slice(1).map(result => ({
        diagnosis: result.label,
        confidence: Math.round(result.score * 100) / 100
      })),
      diagnosisDate: new Date().toISOString()
    };
  }

  /**
   * 신뢰도에 따른 위험도 계산
   * @param {number} confidence - 신뢰도 (0-1)
   * @returns {string} - 위험도 레벨
   */
  calculateRiskLevel(confidence) {
    if (confidence >= 0.8) return '높음';
    if (confidence >= 0.6) return '중간';
    return '낮음';
  }

  /**
   * 진단에 따른 설명 및 권장사항 생성
   * @param {string} diagnosis - 진단명
   * @param {number} confidence - 신뢰도
   * @returns {Object} - 설명 및 권장사항
   */
  generateRecommendations(diagnosis, confidence) {
    // 기본 권장사항
    const baseRecommendations = [
      '피부과 전문의와 상담하세요.',
      '정기적으로 피부 상태를 관찰하세요.',
      '자외선 차단제를 사용하세요.'
    ];

    // 진단별 특화 권장사항
    const specificRecommendations = {
      'melanoma': [
        '즉시 피부과 전문의와 상담하세요.',
        '조직검사를 통해 확진을 받으세요.',
        '정기적인 피부 검진을 받으세요.'
      ],
      'basal_cell_carcinoma': [
        '피부과 전문의와 상담하세요.',
        '수술적 제거를 고려하세요.',
        '정기적인 모니터링이 필요합니다.'
      ],
      'squamous_cell_carcinoma': [
        '즉시 피부과 전문의와 상담하세요.',
        '조직검사를 통해 확진을 받으세요.',
        '치료 후 정기적인 추적 관찰이 필요합니다.'
      ],
      'benign_lesion': [
        '정기적인 관찰이 필요합니다.',
        '변화가 있을 경우 즉시 의료진과 상담하세요.',
        '자외선 차단을 철저히 하세요.'
      ]
    };

    const recommendations = specificRecommendations[diagnosis] || baseRecommendations;
    
    const description = `진단 결과: ${diagnosis}. 신뢰도는 ${Math.round(confidence * 100)}%입니다. 정확한 진단을 위해 반드시 전문의와 상담하시기 바랍니다.`;

    return {
      description,
      recommendations
    };
  }

  /**
   * Hugging Face 데이터셋에서 정보 조회
   * @param {string} datasetName - 데이터셋 이름
   * @returns {Promise<Object>} - 데이터셋 정보
   */
  async getDatasetInfo(datasetName) {
    try {
      const response = await fetch(`https://huggingface.co/api/datasets/${datasetName}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('데이터셋 정보 조회 오류:', error);
      throw new Error('데이터셋 정보를 가져올 수 없습니다.');
    }
  }

  /**
   * 모델 성능 테스트
   * @param {string} modelType - 테스트할 모델 타입
   * @returns {Promise<Object>} - 테스트 결과
   */
  async testModel(modelType = DEFAULT_MODEL) {
    try {
      const selectedModel = SKIN_DISEASE_MODELS[modelType] || SKIN_DISEASE_MODELS[DEFAULT_MODEL];
      
      // 간단한 테스트 이미지로 모델 동작 확인
      const testResult = await hf.imageClassification({
        model: selectedModel,
        inputs: 'https://example.com/test-image.jpg', // 테스트 이미지 URL
      });
      
      return {
        success: true,
        message: `모델 ${modelType}이(가) 정상적으로 작동합니다.`,
        modelType,
        testResult
      };
    } catch (error) {
      return {
        success: false,
        message: `모델 ${modelType} 테스트에 실패했습니다.`,
        modelType,
        error: error.message
      };
    }
  }

  /**
   * 사용 가능한 모델 목록 조회
   * @returns {Object} - 사용 가능한 모델 목록
   */
  getAvailableModels() {
    return {
      models: Object.keys(SKIN_DISEASE_MODELS),
      defaultModel: DEFAULT_MODEL,
      descriptions: {
        'skin-cancer': '일반적인 피부암 분류 모델',
        'dermatology': '피부과 질환 분류 모델',
        'melanoma': '흑색종 특화 분류 모델'
      }
    };
  }

  /**
   * Hugging Face 데이터셋에서 파일 목록 조회
   * @param {string} datasetName - 데이터셋 이름
   * @returns {Promise<Object>} - 파일 목록
   */
  async getFileList(datasetName) {
    try {
      const response = await fetch(`https://huggingface.co/api/datasets/${datasetName}/tree/main`);
      const files = await response.json();
      return files;
    } catch (error) {
      console.error('파일 목록 조회 오류:', error);
      throw new Error('파일 목록을 가져올 수 없습니다.');
    }
  }

  // 2. 라벨 파일 다운로드 및 파싱 (예: labels.csv)
  async getLabels(datasetName) {
    const labelUrl = `https://huggingface.co/datasets/${datasetName}/resolve/main/labels.csv`;
    const res = await fetch(labelUrl, { headers });
    const csv = await res.text();
    // CSV 파싱 (간단 예시)
    const lines = csv.split('\n').filter(Boolean);
    const labels = lines.map(line => {
      const [filename, label] = line.split(',');
      return { filename, label };
    });
    return labels;
  }

  // 3. 이미지 다운로드
  async downloadImage(datasetName, filename) {
    const imageUrl = `https://huggingface.co/datasets/${datasetName}/resolve/main/images/${filename}`;
    const res = await fetch(imageUrl, { headers });
    const buffer = await res.arrayBuffer ? Buffer.from(await res.arrayBuffer()) : await res.buffer();
    // ./downloaded 폴더가 없으면 생성
    const dir = path.join(__dirname, '../../downloaded');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(path.join(dir, filename), buffer);
  }

  // 4. 전체 프로세스
  async processDataset(datasetName) {
    const labels = await this.getLabels(datasetName);
    for (const { filename, label } of labels) {
      await this.downloadImage(datasetName, filename);
      console.log(`Downloaded ${filename} with label ${label}`);
      // 여기서 buffer를 바로 가공하거나, DB에 저장 등 추가 작업 가능
    }
  }
}

if (require.main === module) {
  const huggingfaceService = new HuggingFaceService();
  const datasetName = "MAGEONYOUNG/skin_dataset";
  huggingfaceService.processDataset(datasetName).then(() => {
    console.log('모든 이미지 다운로드 및 라벨 가공 완료!');
  });
}

module.exports = new HuggingFaceService(); 