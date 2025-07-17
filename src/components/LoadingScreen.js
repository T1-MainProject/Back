import React, { useEffect, useState } from 'react';

const LoadingScreen = ({ onLoadingComplete }) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [figmaData, setFigmaData] = useState(null);

  useEffect(() => {
    // Figma 데이터 가져오기 시뮬레이션
    const fetchFigmaData = async () => {
      try {
        // 실제로는 MCP 서버를 통해 Figma 데이터를 가져와야 함
        const mockFigmaData = {
          "First Screen": {
            id: "first-screen",
            name: "First Screen",
            type: "FRAME",
            fills: [{ type: "SOLID", color: "#FFFFFF" }],
            children: [
              {
                id: "logo",
                name: "Logo",
                type: "RECTANGLE",
                fills: [{ type: "SOLID", color: "#4F46E5" }],
                absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 120 }
              },
              {
                id: "title",
                name: "Title",
                type: "TEXT",
                characters: "Skancer",
                style: {
                  fontFamily: "Inter",
                  fontSize: 32,
                  fontWeight: 700,
                  fills: [{ type: "SOLID", color: "#1F2937" }]
                },
                absoluteBoundingBox: { x: 0, y: 140, width: 200, height: 40 }
              },
              {
                id: "subtitle",
                name: "Subtitle",
                type: "TEXT",
                characters: "당신의 건강을 위한 스마트 솔루션",
                style: {
                  fontFamily: "Inter",
                  fontSize: 16,
                  fontWeight: 400,
                  fills: [{ type: "SOLID", color: "#6B7280" }]
                },
                absoluteBoundingBox: { x: 0, y: 190, width: 300, height: 24 }
              }
            ]
          }
        };
        
        setFigmaData(mockFigmaData);
      } catch (error) {
        console.error('Figma 데이터 로딩 실패:', error);
      }
    };

    fetchFigmaData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            onLoadingComplete();
          }, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [onLoadingComplete]);

  // Figma 디자인에 맞는 스타일
  const containerStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '800px',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
  };

  const logoStyle = {
    width: '120px',
    height: '120px',
    backgroundColor: '#4F46E5',
    borderRadius: '24px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 20px 25px -5px rgba(79, 70, 229, 0.1), 0 10px 10px -5px rgba(79, 70, 229, 0.04)'
  };

  const titleStyle = {
    fontSize: '32px',
    fontWeight: 700,
    color: '#1F2937',
    marginBottom: '10px',
    textAlign: 'center'
  };

  const subtitleStyle = {
    fontSize: '16px',
    fontWeight: 400,
    color: '#6B7280',
    marginBottom: '40px',
    textAlign: 'center'
  };

  const progressContainerStyle = {
    width: '200px',
    height: '4px',
    backgroundColor: '#E5E7EB',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '20px'
  };

  const progressBarStyle = {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
    width: `${loadingProgress}%`
  };

  const progressTextStyle = {
    fontSize: '14px',
    color: '#6B7280',
    textAlign: 'center'
  };

  return (
    <div style={containerStyle}>
      <div style={logoStyle}>
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          <path d="M30 10C18.954 10 10 18.954 10 30C10 41.046 18.954 50 30 50C41.046 50 50 41.046 50 30C50 18.954 41.046 10 30 10ZM30 45C21.716 45 15 38.284 15 30C15 21.716 21.716 15 30 15C38.284 15 45 21.716 45 30C45 38.284 38.284 45 30 45Z" fill="white"/>
          <path d="M30 20C24.477 20 20 24.477 20 30C20 35.523 24.477 40 30 40C35.523 40 40 35.523 40 30C40 24.477 35.523 20 30 20ZM30 35C26.686 35 25 32.314 25 30C25 27.686 26.686 25 30 25C33.314 25 35 27.686 35 30C35 32.314 33.314 35 30 35Z" fill="white"/>
        </svg>
      </div>
      
      <h1 style={titleStyle}>Skancer</h1>
      <p style={subtitleStyle}>당신의 건강을 위한 스마트 솔루션</p>
      
      <div style={progressContainerStyle}>
        <div style={progressBarStyle}></div>
      </div>
      
      <p style={progressTextStyle}>{loadingProgress}%</p>
    </div>
  );
};

export default LoadingScreen; 