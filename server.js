require('dotenv').config();
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY);

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { db, dbHelper } = require('./database');
const huggingfaceService = require('./src/services/huggingfaceService');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const fetch = require('node-fetch');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const axios = require('axios');
const sharp = require('sharp');

// 비로그인 사용자의 진단 결과를 임시 저장하는 객체
const tempDiagnosisResults = {};

const app = express();
const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// CORS 설정
app.use(cors({
  origin: ['https://91c661a53a1f.ngrok-free.app', 'http://localhost:3000'], // ngrok URL 및 로컬 호스트 추가
  credentials: true
}));
app.options('*', cors()); // 모든 경로에 대해 OPTIONS 요청 처리

app.use(bodyParser.json({ limit: '10mb' }));

// 모든 요청을 로깅하는 최상위 미들웨어
app.use((req, res, next) => {
  console.log(`[Request Logger] Received: ${req.method} ${req.originalUrl}`);
  next();
});

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

// 업로드 폴더 생성 및 정적 파일 서빙
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));


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

// JWT 토큰 검증 미들웨어 (선택적)
const authenticateTokenOptional = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  console.log('[Auth] 헤더 수신:', authHeader); // 헤더 확인 로그 추가
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('[Auth] 토큰 없음. 비로그인으로 처리.'); // 토큰 없을 시 로그 추가
    return next(); // 토큰이 없으면 그냥 다음으로 진행
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('[Auth] 토큰 검증 오류:', err.message); // 오류 발생 시 로그 추가
    } else {
      console.log('[Auth] 토큰 검증 성공. 사용자:', user); // 성공 시 로그 추가
      req.user = user; // 유효한 토큰이면 사용자 정보 추가
    }
    // 토큰이 유효하지 않아도 오류를 발생시키지 않고 다음으로 진행
    next();
  });
};

// 회원가입 API
app.post('/api/auth/register', async (req, res) => {
  console.log('\n--- 회원가입 요청 받음 ---');
  console.log('Request Body:', req.body); 
  try {
    const { email, password, name, phoneNumber, birthDate } = req.body;

    // 입력 검증
    if (!email || !password || !name || !phoneNumber || !birthDate) {
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

    const userData = {
      email,
      password: hashedPassword,
      name,
      phone: phoneNumber,
      birth: birthDate,
    };

    const newUser = await dbHelper.createUser(userData);

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 응답 (비밀번호는 createUser에서 이미 제외됨)
    res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      user: newUser, // `userWithoutPassword` 대신 `newUser`를 직접 사용
      token
    });

  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 로그인 API
app.post('/api/auth/login', async (req, res) => {
  console.log('\n--- 로그인 요청 받음 ---');
  console.log('Request Body:', req.body);
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

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
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
    const { password, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 정보 수정 API
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;
    const updatedUser = await dbHelper.updateUser(req.user.userId, updates);
    
    const { password, ...userWithoutPassword } = updatedUser;
    res.json({
      message: '프로필이 성공적으로 업데이트되었습니다.',
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('프로필 업데이트 오류:', error);
    res.status(500).json({ error: '사용자 정보 업데이트 중 서버 오류가 발생했습니다.' });
  }
});

// 사용자의 모든 진료기록 조회
app.get('/api/medical_records', authenticateToken, async (req, res) => {
  try {
    const records = await dbHelper.getRecordsByUserId(req.user.userId);
    res.json(records);
  } catch (error) {
    console.error('진료기록 조회 중 오류 발생:', error);
    res.status(500).json({ error: '진료기록을 가져오는 중 서버 오류가 발생했습니다.' });
  }
});

// 진료기록 조회 API
app.get('/api/records', authenticateToken, async (req, res) => {
  try {
    const userId = req.user ? req.user.userId : null;
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
    const recordData = { ...req.body, userId: req.user.userId };
    const newRecord = await dbHelper.createRecord(recordData);
    
    res.status(201).json(newRecord);

  } catch (error) {
    console.error('진료기록 추가 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 특정 진단 기록 조회 API
app.get('/api/diagnosis/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let record = await dbHelper.getRecordById(id);

    // DB에 없으면 임시 결과에서 확인
    if (!record) {
      if (tempDiagnosisResults[id]) {
        record = {
          id: id,
          userId: null, // 비로그인 사용자는 userId가 없음
          image: tempDiagnosisResults[id].image, // Base64 이미지 데이터
          title: `AI 진단 결과: ${tempDiagnosisResults[id].diseaseName}`,
          diagnosis: tempDiagnosisResults[id].description,
          createdAt: tempDiagnosisResults[id].diagnosisDate
        };
      }
    }

    if (!record) {
      return res.status(404).json({ error: '진단 기록을 찾을 수 없습니다.' });
    }

    // 프론트엔드에서 사용하는 DiagnosisResult 형태로 변환
    const diagnosisResult = {
      id: record.id.toString(),
      userId: record.userId || null,
      image: '', // image 컬럼이 삭제되었으므로 빈 문자열 반환
      diseaseName: record.title ? record.title.replace('AI 진단 결과: ', '') : '진단명 없음',
      description: record.diagnosis || '상세 설명이 없습니다.',
      recommendations: [
        '정확한 진단 및 치료를 위해 전문의와 상담하세요.',
      ],
      detailedInfo: record.diagnosis || '', // 상세 정보는 현재 없으므로 빈 문자열
      diagnosisDate: record.createdAt || new Date().toISOString(),
    };

    res.json(diagnosisResult);

  } catch (error) {
    console.error(`!!! [/api/diagnosis/${req.params.id}] 오류 발생 !!!:`, error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// Hugging Face를 사용한 진단 API
app.post('/api/diagnose', authenticateTokenOptional, upload.single('image'), async (req, res) => {
  console.log('\n--- [/api/diagnose] 진단 요청 받음 ---');
  console.log('[ENV CHECK] 현재 서버가 기억하는 RunPod 주소:', process.env.RUNPOD_ENDPOINT_URL);
  
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: "이미지 파일이 필요합니다." });
  }
  
  // 사용자 인증 상태 확인
  const isAuthenticated = !!req.user;
  console.log('[인증 상태]', isAuthenticated ? `성공: ${req.user.email}` : '실패 또는 비로그인 사용자');

  // 파일 유효성 검사
  if (!req.file) {
    console.log('[파일 검증] 실패: 파일이 없습니다.');
    return res.status(400).json({ error: '진단할 이미지를 업로드해주세요.' });
  }
  console.log('[파일 검증] 성공:', req.file.originalname, ', Size:', req.file.size, 'bytes');

  try {
    // Hugging Face API 호출 (수정됨)
    console.log('[AI 모델] RunPod 모델 호출 시작...');
    const diagnosisResult = await huggingfaceService.diagnoseSkinDisease(req.file.buffer);
    console.log('[AI 모델] 결과 수신 완료.');

    if (!diagnosisResult) {
      throw new Error('RunPod API에서 결과를 받지 못했습니다.');
    }

    // 이미지를 파일로 저장하고 URL 경로 생성
    const filename = `${Date.now()}-${req.file.originalname.split('.').slice(0, -1).join('.')}.jpg`; // 확장자를 .jpg로 변경
    const filepath = path.join(uploadsDir, filename);
    await sharp(req.file.buffer) // 이미지를 JPEG로 변환하여 저장
      .resize(800, 600) // 원하는 크기로 조정
      .jpeg() // JPEG 형식으로 저장
      .toFile(filepath);
    const imageUrl = `/uploads/${filename}`; // 클라이언트가 접근할 경로

    const finalResult = {
      id: Date.now().toString(),
      image: imageUrl, // Base64 대신 URL 경로 사용
      diseaseName: diagnosisResult.diagnosis,
      description: diagnosisResult.description,
      recommendations: diagnosisResult.recommendations,
      diagnosisDate: new Date().toISOString(),
      confidence: diagnosisResult.confidence || 0,
    };

    if (isAuthenticated) {
      console.log('[DB 저장] 로그인 사용자이므로 진단 결과를 DB에 저장합니다.');
      console.log('[디버깅] 현재 req.user 객체:', JSON.stringify(req.user, null, 2)); // 디버깅 로그 추가
      
      const recordData = {
        userId: req.user.userId, // `id` -> `userId` 로 수정
        title: finalResult.diseaseName,
        date: finalResult.diagnosisDate,
        diagnosis: finalResult.description,
        image: imageUrl, // DB에 이미지 URL 경로 저장
      };

      try {
        const newRecord = await dbHelper.createRecord(recordData);
        finalResult.id = newRecord.id; 
        console.log(`[DB 저장] 성공. 새 기록 ID: ${newRecord.id}`);
      } catch (dbError) {
        console.error('[DB 저장] 실패:', dbError);
      }
    }

    res.status(200).json(finalResult);

  } catch (error) {
    console.error('!!! [/api/diagnose] 오류 발생 !!!:', error);
    res.status(500).json({ error: '진단 중 오류가 발생했습니다.' });
  }
});

// 특정 진료기록 조회
app.get('/api/medical_records/:id', authenticateToken, async (req, res) => {
  try {
    const record = await dbHelper.getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: '진료기록을 찾을 수 없습니다.' });
    }
    // 본인의 기록이 맞는지 확인
    if (record.userId !== req.user.userId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    // 프론트엔드에서 사용할 수 있도록 recommendations 필드 추가 (필요 시)
    record.recommendations = record.recommendations ? JSON.parse(record.recommendations) : ['정확한 진단 및 치료를 위해 전문의와 상담하세요.'];

    res.json(record);
  } catch (error) {
    console.error('특정 진료기록 조회 중 오류 발생:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 진료기록 삭제
app.delete('/api/medical_records/:id', authenticateToken, async (req, res) => {
  const recordId = req.params.id;
  const userId = req.user.userId;

  try {
    const result = await dbHelper.deleteRecordById(userId, recordId);
    if (result.changes === 0) {
      return res.status(404).json({ error: '삭제할 진료기록이 없거나 권한이 없습니다.' });
    }
    res.status(200).json({ message: '진료기록이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('진료기록 삭제 중 오류 발생:', error);
    res.status(500).json({ error: '진료기록 삭제 중 서버 오류가 발생했습니다.' });
  }
});

// =================================
// 예약 (Reservations) API
// =================================

// 특정 사용자의 모든 예약 조회
app.get('/api/reservations/user/:userId', authenticateToken, async (req, res) => {
  try {
    // 토큰의 userId와 요청된 userId가 일치하는지 확인 (보안 강화)
    if (req.user.userId.toString() !== req.params.userId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    const reservations = await dbHelper.getReservationsByUserId(req.params.userId);
    res.json(reservations);
  } catch (error) {
    console.error('사용자 예약 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 새 예약 생성 (챗봇용 - 인증 제거)
app.post('/api/reservations', async (req, res) => {
    try {
      const { userId, date, time, purpose } = req.body;
      const parsedUserId = parseInt(userId, 10);
  
      if (isNaN(parsedUserId) || !date || !time || !purpose) {
        return res.status(400).json({ error: 'userId, 날짜, 시간, 목적은 필수입니다.' });
      }
  
      // 1. 먼저 해당 userId로 예약이 있는지 확인
      const existingReservations = await dbHelper.getReservationsByUserId(parsedUserId);
  
      // 2. 이미 예약이 있는 경우, 409 Conflict 반환
      if (existingReservations.length > 0) {
        const existing = existingReservations[0];
        return res.status(409).json({
          message: `이미 예약이 존재합니다.`,
          details: `날짜: ${existing.date}, 시간: ${existing.time}`
        });
      }
  
      // 3. 예약이 없는 경우, 새로 생성
      const newReservation = await dbHelper.createReservation({ userId: parsedUserId, date, time, purpose });
      res.status(201).json(newReservation);
  
    } catch (error) {
      console.error('예약 생성 오류:', error);
      res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  });

// 특정 사용자의 모든 예약 취소 (챗봇용)
app.delete('/api/reservations/user/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ error: '유효하지 않은 사용자 ID입니다.' });
      }
  
      // dbHelper에 해당 기능이 있다고 가정하고 호출
      await dbHelper.deleteReservationByUserId(userId);
      res.status(204).send(); // 성공적으로 처리되었으나 반환할 콘텐츠 없음
  
    } catch (error) {
      console.error('사용자 전체 예약 취소 오류:', error);
      res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  });


// 특정 예약 조회
app.get('/api/reservations/:id', authenticateToken, async (req, res) => {
  try {
    const reservation = await dbHelper.getReservationById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
    }
    if (reservation.userId !== req.user.userId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    res.json(reservation);
  } catch (error) {
    console.error('특정 예약 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 예약 수정
app.put('/api/reservations/:id', authenticateToken, async (req, res) => {
    try {
      const reservation = await dbHelper.getReservationById(req.params.id);
      if (!reservation) {
        return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
      }
      if (reservation.userId !== req.user.userId) {
        return res.status(403).json({ error: '권한이 없습니다.' });
      }
  
      const result = await dbHelper.updateReservationById(req.params.id, req.body);
      res.json({ updated: result.changes });
    } catch (error) {
      console.error('예약 수정 오류:', error);
      res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  });
  
  // 예약 삭제
app.delete('/api/reservations/:id', authenticateToken, async (req, res) => {
    try {
      const reservation = await dbHelper.getReservationById(req.params.id);
      if (!reservation) {
        return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
      }
      if (reservation.userId !== req.user.userId) {
        return res.status(403).json({ error: '권한이 없습니다.' });
      }
  
      const result = await dbHelper.deleteReservation(req.params.id);
      res.json({ deleted: result.changes > 0 });
    } catch (error) {
      console.error('예약 삭제 오류:', error);
      res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  });


// =================================
// 챗봇 (LangChain Agent) API
// =================================
app.post('/api/chat/:userId', authenticateToken, async (req, res) => {
    const userId = req.params.userId;
    const { message } = req.body;
  
    // 토큰의 userId와 요청된 userId가 일치하는지 확인
    if (req.user.userId.toString() !== userId) {
        return res.status(403).json({ error: '권한이 없습니다.' });
    }

    try {
      // Python LangChain Agent 서버로 요청 전송
      const agentResponse = await axios.post('http://127.0.0.1:8000/invoke-agent/', {
        message: message,
        userId: userId
      });
  
      // Agent의 응답을 클라이언트에게 그대로 전달
      return res.json(agentResponse.data);
  
    } catch (e) {
      if (e.response) {
        console.error('Agent 서버 응답 오류:', e.response.data);
        return res.status(500).json({ error: 'Agent 서버에서 오류가 발생했습니다.', details: e.response.data });
      } else if (e.request) {
        console.error('Agent 서버 연결 실패:', e.message);
        return res.status(500).json({ error: 'Agent 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.' });
      } else {
        console.error('API /api/chat/:userId 오류:', e.message);
        return res.status(500).json({ error: '요청 처리 중 알 수 없는 오류가 발생했습니다.' });
      }
    }
  });


process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});