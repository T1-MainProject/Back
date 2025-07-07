import React, { useState, useEffect } from "react";
import { FirstScreen } from "./components/FirstScreen";
import HomeScreen from "./components/HomeScreen";
import LoginScreen from "./components/LoginScreen";

export default function App() {
  const [showFirstScreen, setShowFirstScreen] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // 앱 시작 시 로그인 상태 확인
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      setIsLoggedIn(true);
      setCurrentUser(JSON.parse(user));
      fetchRecords();
    } else {
      setIsLoggedIn(false);
      setCurrentUser(null);
    }
  }, []);

  const handleFirstScreenComplete = () => {
    setShowFirstScreen(false);
  };

  // 진료기록 가져오기
  const fetchRecords = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/records', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecords(data.records);
      } else {
        console.error('진료기록 가져오기 실패');
      }
    } catch (error) {
      console.error('진료기록 가져오기 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (user) => {
    setIsLoggedIn(true);
    setCurrentUser(user);
    fetchRecords(); // 로그인 성공 시 진료기록 가져오기
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setCurrentUser(null);
    setRecords([]);
    window.location.reload(); // 강제 새로고침!
  };

  // 진단 완료 후 기록 새로고침
  const handleDiagnosisComplete = () => {
    fetchRecords();
  };

  const renderCurrentScreen = () => {
    if (showFirstScreen) {
      return <FirstScreen onComplete={handleFirstScreenComplete} />;
    }
    if (!isLoggedIn) {
      return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }
    return (
      <HomeScreen 
        records={records} 
        setRecords={setRecords} 
        user={currentUser}
        onLogout={handleLogout}
        onDiagnosisComplete={handleDiagnosisComplete}
      />
    );
  };

  console.log('showFirstScreen:', showFirstScreen);
  console.log('isLoggedIn:', isLoggedIn);
  console.log('currentUser:', currentUser);

  return (
    <div id="app-container" className="w-[360px] h-[800px] bg-white shadow-2xl mx-auto my-4 relative">
      {renderCurrentScreen()}
    </div>
  );
}