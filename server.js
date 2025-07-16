require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { dbHelper } = require('./database');
//const huggingfaceService = require('./src/services/huggingfaceService');

const app = express();
const PORT = 3001;
// .env 파일 로딩 문제를 확인하기 위해 임시로 하드코딩합니다.
const JWT_SECRET = 'hihi';
console.log(`[Server] JWT Secret is set to: '${JWT_SECRET}'`);

// 미들웨어
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:8000'],
  credentials: true,
}));
app.use(bodyParser.json({ limit: '10mb' }));

// 이미지 업로드를 위한 multer 설정
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
    }
  }
});

// JWT 토큰 검증 미들웨어
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// 회원가입 API
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, phone, birth } = req.body;

    // 입력 검증
    if (!email || !password || !name || !phone || !birth) {
      return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '올바른 이메일 형식을 입력해주세요.' });
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' });
    }

    // 중복 이메일 확인
    const existingUser = await dbHelper.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: '이미 등록된 이메일입니다.' });
    }

    // 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 새 사용자 생성
    const userData = {
      email,
      password: hashedPassword,
      name,
      phone,
      birth
    };

    const newUser = await dbHelper.createUser(userData);

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 응답 (비밀번호 제외)
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 로그인 API
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 입력 검증
    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
    }

    // 사용자 찾기
    const user = await dbHelper.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 비밀번호 검증
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 응답 (비밀번호 제외)
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      message: '로그인이 완료되었습니다.',
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 정보 조회 API
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbHelper.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 정보 업데이트 API
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { name, profileImg } = req.body;
    const updates = {};
    
    if (name) updates.name = name;
    if (profileImg) updates.profileImg = profileImg;

    await dbHelper.updateUser(req.user.userId, updates);
    
    // 업데이트된 사용자 정보 조회
    const updatedUser = await dbHelper.getUserById(req.user.userId);
    const { password: _, ...userWithoutPassword } = updatedUser;
    
    res.json({
      message: '프로필이 업데이트되었습니다.',
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('프로필 업데이트 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 진료기록 조회 API
app.get('/api/records', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const records = await dbHelper.getRecordsByUserId(userId);
    
    res.json({ records });
  } catch (error) {
    console.error('진료기록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 진료기록 추가 API
app.post('/api/records', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { img, diagnosis, confidence, riskLevel, description, recommendations } = req.body;
    
    // 이미지 처리
    let processedImg = img;
    if (img) {
      if (img.startsWith('data:image/')) {
        // DataURL 형태인 경우 base64 부분만 추출
        processedImg = img.split(',')[1];
      } else if (img.startsWith('/images/')) {
        // 기존 정적 이미지 경로인 경우 그대로 사용
        processedImg = img;
      } else {
        // base64 문자열인 경우 그대로 사용
        processedImg = img;
      }
    } else {
      // 이미지가 없는 경우 기본 이미지 사용
      processedImg = '/images/record1.jpeg';
    }
    
    // 새 기록 생성
    const recordData = {
      userId,
      img: processedImg,
      title: diagnosis,
      date: new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\. /g, '. '),
      diagnosis,
      confidence,
      riskLevel,
      description,
      recommendations: Array.isArray(recommendations) ? recommendations : [recommendations]
    };
    
    const newRecord = await dbHelper.createRecord(recordData);
    
    console.log('진료기록이 성공적으로 저장되었습니다:', newRecord.id);
    console.log('저장된 이미지 타입:', typeof processedImg, '길이:', processedImg ? processedImg.length : 0);
    
    res.status(201).json({
      message: '진료기록이 추가되었습니다.',
      record: newRecord
    });
    
  } catch (error) {
    console.error('진료기록 추가 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// Hugging Face를 사용한 진단 API
app.post('/api/diagnose', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    console.log('Received image for Hugging Face diagnosis.');
    
    if (!req.file) {
      return res.status(400).json({ error: '이미지 파일이 필요합니다.' });
    }

    const startTime = Date.now();
    
    // 모델 타입 선택 (기본값: 'skin-cancer')
    const modelType = req.body.modelType || 'skin-cancer';
    
    // Hugging Face 서비스를 사용한 진단
    const diagnosis = await huggingfaceService.diagnoseSkinDisease(req.file.buffer, modelType);
    
    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`진단 완료 (${processingTime}초):`, diagnosis.diagnosis);

    // 진료기록에 자동 추가
    const userId = req.user.userId;
    const recordData = {
      userId,
      img: req.file.buffer.toString('base64'), // 이미지를 base64로 저장
      title: diagnosis.diagnosis,
      date: new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\. /g, '. '),
      diagnosis: diagnosis.diagnosis,
      confidence: diagnosis.confidence,
      riskLevel: diagnosis.riskLevel,
      description: diagnosis.description,
      recommendations: diagnosis.recommendations
    };
    
    await dbHelper.createRecord(recordData);

    console.log('Sending Hugging Face diagnosis result:', diagnosis);
    res.json(diagnosis);
    
  } catch (error) {
    console.error('Hugging Face 진단 오류:', error);
    res.status(500).json({ 
      error: '진단 처리 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// Hugging Face 모델 테스트 API
app.get('/api/test-model', authenticateToken, async (req, res) => {
  try {
    const { modelType } = req.query;
    const testResult = await huggingfaceService.testModel(modelType);
    res.json(testResult);
  } catch (error) {
    console.error('모델 테스트 오류:', error);
    res.status(500).json({ 
      error: '모델 테스트 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 사용 가능한 모델 목록 조회 API
app.get('/api/available-models', authenticateToken, async (req, res) => {
  try {
    const models = huggingfaceService.getAvailableModels();
    res.json(models);
  } catch (error) {
    console.error('모델 목록 조회 오류:', error);
    res.status(500).json({ 
      error: '모델 목록 조회 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// Hugging Face 데이터셋 정보 조회 API
app.get('/api/dataset-info/:datasetName', authenticateToken, async (req, res) => {
  try {
    const { datasetName } = req.params;
    const datasetInfo = await huggingfaceService.getDatasetInfo(datasetName);
    res.json(datasetInfo);
  } catch (error) {
    console.error('데이터셋 정보 조회 오류:', error);
    res.status(500).json({ 
      error: '데이터셋 정보 조회 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// ==================== 예약 API ====================

// 1. 예약 등록 (POST /api/reservations/:id)
app.post('/api/reservations/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { date, time, purpose, status } = req.body;

    // 관리자(admin)는 모든 userId 예약 가능, 일반 사용자는 본인만 가능
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '본인 또는 관리자만 예약을 생성할 수 있습니다.' });
    }

    // users 테이블에 해당 userId가 존재하는지 확인
    const user = await dbHelper.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: '해당 사용자가 존재하지 않습니다.' });
    }

    // 이미 예약이 있으면 중복 에러
    const existing = await dbHelper.getReservationByUserId(userId);
    if (existing) {
      return res.status(409).json({ error: '이미 예약이 존재합니다.' });
    }

    await dbHelper.createReservation({ userId, date, time, purpose, status });
    res.status(201).json({ message: '예약이 성공적으로 생성되었습니다.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 2. 예약 수정 (PUT /api/reservations/:id)
app.put('/api/reservations/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { date, time, purpose, status } = req.body;

    // 관리자(admin)는 모든 userId 예약 가능, 일반 사용자는 본인만 가능
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '본인 또는 관리자만 예약을 수정할 수 있습니다.' });
    }

    const reservation = await dbHelper.getReservationByUserId(userId);
    if (!reservation) {
      return res.status(404).json({ error: '예약이 존재하지 않습니다.' });
    }

    await dbHelper.updateReservationByUserId(userId, { date, time, purpose, status });
    res.json({ message: '예약이 성공적으로 수정되었습니다.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 3. 예약 조회 (GET /api/reservations/:id)
app.get('/api/reservations/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    // 관리자(admin)는 모든 userId 예약 가능, 일반 사용자는 본인만 가능
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '본인 또는 관리자만 예약을 조회할 수 있습니다.' });
    }

    const reservation = await dbHelper.getReservationByUserId(userId);
    if (!reservation) {
      return res.status(404).json({ error: '예약이 존재하지 않습니다.' });
    }

    res.json(reservation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 4. 예약 삭제 (DELETE /api/reservations/:id)
app.delete('/api/reservations/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    // 관리자(admin)는 모든 userId 예약 가능, 일반 사용자는 본인만 가능
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '본인 또는 관리자만 예약을 삭제할 수 있습니다.' });
    }

    const reservation = await dbHelper.getReservationByUserId(userId);
    if (!reservation) {
      return res.status(404).json({ error: '예약이 존재하지 않습니다.' });
    }

    await dbHelper.deleteReservationByUserId(userId);
    res.json({ message: '예약이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});