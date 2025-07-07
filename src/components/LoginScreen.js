import React, { useState } from 'react';
import axios from 'axios';

export default function LoginScreen({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    birth: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // 입력 시 에러 메시지 초기화
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await axios.post(`http://localhost:3001${endpoint}`, formData);
      
      // 토큰을 로컬 스토리지에 저장
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      // 로그인 성공 콜백 호출
      onLoginSuccess(response.data.user);
      
    } catch (error) {
      console.error('Auth error:', error);
      setError(error.response?.data?.error || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({ email: '', password: '', name: '', phone: '', birth: '' });
    setError('');
  };

  return (
    <div className="w-[360px] h-[800px] bg-white flex flex-col shadow-2xl mx-auto my-4 relative">
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* 로고/타이틀 */}
        <div className="mb-12 text-center">
          <div className="text-3xl font-bold text-[#2260FF] mb-2">
            피부 진단 앱
          </div>
          <div className="text-gray-600">
            {isLogin ? '로그인하여 서비스를 이용하세요' : '회원가입하여 서비스를 시작하세요'}
          </div>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2260FF] focus:border-transparent"
                placeholder="이름을 입력하세요"
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2260FF] focus:border-transparent"
              placeholder="이메일을 입력하세요"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2260FF] focus:border-transparent"
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                전화번호
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2260FF] focus:border-transparent"
                placeholder="전화번호를 입력하세요"
                required={!isLogin}
              />
            </div>
          )}

          {!isLogin && (
            <div>
              <label>생년월일</label>
              <input
                type="date"
                name="birth"
                value={formData.birth}
                onChange={handleInputChange}
                required={!isLogin}
              />
            </div>
          )}

          {error && (
            <div className="text-red-500 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2260FF] text-white py-3 rounded-lg font-semibold hover:bg-[#1a4fd8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '처리중...' : (isLogin ? '로그인' : '회원가입')}
          </button>
        </form>

        {/* 모드 전환 */}
        <div className="mt-8 text-center">
          <button
            onClick={toggleMode}
            className="text-[#2260FF] hover:underline"
          >
            {isLogin ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </div>

        {/* 테스트 계정 정보 */}
        {isLogin && (
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 text-center">
              <div className="font-semibold mb-2">테스트 계정</div>
              <div>이메일: test@example.com</div>
              <div>비밀번호: password</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 