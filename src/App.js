import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { FirstScreen } from "./components/FirstScreen";
import HomeScreen from "./components/HomeScreen";
import LoginScreen from "./components/LoginScreen";

export default function App() {
  const [showFirstScreen, setShowFirstScreen] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [reservation, setReservation] = useState(null);

  // 앱 시작 시 로그인 상태 확인
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      setIsLoggedIn(true);
      setCurrentUser(JSON.parse(user));
      fetchRecords();
      fetchReservation(); // 로그인 시 예약 정보도 가져옴
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
    fetchReservation(); // 로그인 시 예약 정보도 가져옴
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setCurrentUser(null);
    setRecords([]);
    setReservation(null); // 로그아웃 시 예약 정보도 초기화
    window.location.reload(); // 강제 새로고침!
  };

  // 진단 완료 후 기록 새로고침
  const handleDiagnosisComplete = () => {
    fetchRecords();
  };

  const fetchReservation = async () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    if (!token || !user) return;
    const res = await fetch(`http://localhost:3001/api/reservations/${user.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      setReservation(await res.json());
    } else {
      setReservation(null);
    }
  };

  // 로그인/예약 등록/수정/삭제 후 fetchReservation() 호출

  // 예약 변경 후 두 함수 모두 호출
  const handleReservationChanged = () => {
    fetchReservation();
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
        onOpenCalendarModal={() => setShowCalendarModal(true)}
        reservation={reservation}
        onReservationChanged={handleReservationChanged}
      />
    );
  };

  console.log('showFirstScreen:', showFirstScreen);
  console.log('isLoggedIn:', isLoggedIn);
  console.log('currentUser:', currentUser);

  return (
    <Router>
      <div id="app-container" className="w-[360px] h-[800px] bg-white shadow-2xl mx-auto my-4 relative">
        <Routes>
          <Route path="/" element={renderCurrentScreen()} />
          <Route path="/home" element={
            isLoggedIn ? (
              <HomeScreen 
                records={records} 
                setRecords={setRecords} 
                user={currentUser}
                onLogout={handleLogout}
                onDiagnosisComplete={handleDiagnosisComplete}
                onOpenCalendarModal={() => setShowCalendarModal(true)}
                reservation={reservation}
                onReservationChanged={handleReservationChanged}
              />
            ) : (
              <Navigate to="/" replace />
            )
          } />
        </Routes>
      </div>
    </Router>
  );
}