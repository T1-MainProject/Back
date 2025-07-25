require('dotenv').config();
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY);

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { dbHelper } = require('./database');
const axios = require('axios'); // Python Agent 서버와 통신하기 위해 추가
const huggingfaceService = require('./src/services/huggingfaceService');
const OpenAI = require('openai');
const fetch = require('node-fetch'); // HuggingFace 직접 호출을 위해 추가
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();

// 모든 요청을 로깅하는 최상위 미들웨어
app.use((req, res, next) => {
  console.log(`[Request Logger] Received: ${req.method} ${req.originalUrl}`);
  next();
});
const PORT = 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';




// 미들웨어
app.use(cors({
  origin: '*',
  credentials: true
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
  console.log('\n--- 회원가입 요청 받음 ---');
  console.log('Request Body:', req.body);
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
      console.log(`[로그인 실패] 이메일(${email})을 찾을 수 없습니다.`);
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    console.log(`[로그인 시도] 사용자(${email})를 DB에서 찾았습니다.`);

    // 비밀번호 검증
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log(`[로그인 실패] 사용자(${email})의 비밀번호가 일치하지 않습니다.`);
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    console.log(`[로그인 성공] 사용자(${email})의 비밀번호가 일치합니다.`);

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
    const userId = req.user.userId; // 인증 토큰에서 userId 추출
    const { title, date, diagnosis } = req.body;

    if (!userId || !title || !date || !diagnosis) {
      return res.status(400).json({ error: '필수값이 누락되었습니다.' });
    }

    await dbHelper.createRecord({ userId, title, date, diagnosis });
    res.status(201).json({ message: '진료기록이 추가되었습니다.' });
  } catch (error) {
    console.error('진료기록 추가 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// Hugging Face를 사용한 진단 API
app.post('/api/diagnose', upload.single('image'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "이미지 파일이 필요합니다." });
    }
    const imageBuffer = req.file.buffer;
    // 내 모델로 진단
    const diagnosisResult = await huggingfaceService.diagnoseSkinDisease(imageBuffer, "my-skin-model");

    // 진단 결과를 DB에 저장 (로그인한 사용자인 경우)
    if (req.user && req.user.userId) {
      const userId = req.user.userId; // JWT 토큰에서 사용자 ID 추출
      await dbHelper.createRecord({
        userId: userId,
        title: `AI 진단 결과: ${diagnosisResult.diagnosis || '알 수 없음'}`,
        date: new Date().toISOString().split('T')[0], // 오늘 날짜
        diagnosis: JSON.stringify(diagnosisResult) // 전체 결과를 JSON 문자열로 저장
      });
    }
    res.json({ result: diagnosisResult });
  } catch (e) {
    res.status(500).json({ error: e.message });
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

// 새 예약 생성 (챗봇용)
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
// 사용자 ID로 모든 예약 삭제 (챗봇용)
app.delete('/api/reservations/user/:userId', async (req, res) => {
  try {
    const result = await dbHelper.deleteReservationByUserId(req.params.userId);
    res.json({ deleted: result.changes > 0, count: result.changes });
  } catch (error) {
    console.error('사용자 전체 예약 삭제 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

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

// 사용자 정보 조회 (express_full_server.js)
app.get('/api/user/:id', (req, res) => {
  const userId = req.params.id;
  dbHelper.getUserById(userId)
    .then(user => {
      if (!user) return res.status(404).json({ error: 'User not found' });
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    })
    .catch(err => res.status(500).json({ error: err.message }));
});



// AI 챗봇 (OpenAI 연동, express_full_server.js)
// AI 챗봇 (OpenAI 연동, express_full_server.js)
app.post('/api/chat', async (req, res) => {
  const { userId, message } = req.body;
  dbHelper.getUserById(userId)
    .then(async user => {
      if (!user) return res.status(404).json({ error: 'User not found' });
      const systemPrompt = `안녕하세요! ${user.name}님의 AI 도우미입니다.`;
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ]
        });
        const botResponse = completion.choices[0].message.content;
        res.json({ response: botResponse });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    })
    .catch(err => res.status(500).json({ error: err.message }));
});

// /api/chat/:userId (예약/챗봇 통합) - Python Agent 연동
app.post('/api/chat/:userId', async (req, res) => {
  const userId = req.params.userId;
  const { message } = req.body;

  try {
    // 1. 사용자 정보 확인
    const user = await dbHelper.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 2. Python LangChain Agent 서버로 요청 전송
    const agentResponse = await axios.post('http://127.0.0.1:8000/invoke-agent/', {
      message: message,
      userId: userId
    });

    // 3. Agent의 응답을 클라이언트에게 그대로 전달
    return res.json(agentResponse.data);

  } catch (e) {
    // 4. 오류 처리 (Agent 서버 연결 실패 등)
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

// === LangChain JS 예약 Tool 예시 ===
// (실제 사용 시 langchain 패키지 설치 필요)
// npm install langchain openai

// 아래 코드는 예시이며, 실제로는 별도 라우트나 명령어로 실행해야 합니다.
// import { initializeAgentExecutorWithOptions, Tool } from "langchain/agents";
// import { ChatOpenAI } from "langchain/chat_models/openai";

// const tools = [
//   new Tool({
//     name: "CreateReservation",
//     func: async (input) => {
//       // input 파싱해서 createReservation 호출
//       // 예: input = "userId:1, date:2024-07-25, time:14:00, purpose:진료"
//       // 파싱 로직 필요
//       return JSON.stringify(createReservation(...));
//     },
//     description: "예약 생성"
//   }),
//   // ...getReservation, updateReservation, deleteReservation Tool도 추가
// ];
//
// const model = new ChatOpenAI({ openAIApiKey: "sk-..." });
//
// const executor = await initializeAgentExecutorWithOptions(tools, model, {
//   agentType: "openai-functions",
//   verbose: true,
// });
//
// // 자연어 명령 실행 예시
// const result = await executor.call({ input: "7월 25일 14시에 예약해줘" });
// console.log(result.output);

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});