// 화면 전환 관리
class ScreenManager {
    constructor() {
        this.currentScreen = 'first';
        this.screens = {
            first: document.querySelector('.first-screen'),
            register: document.querySelector('.register-screen'),
            home: document.querySelector('.home-screen')
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.showScreen('first');
    }
    
    bindEvents() {
        // 첫 번째 화면 버튼들
        const getStartedBtn = document.querySelector('.btn-primary');
        const learnMoreBtn = document.querySelector('.btn-secondary');
        
        if (getStartedBtn) {
            getStartedBtn.addEventListener('click', () => {
                this.showScreen('register');
            });
        }
        
        if (learnMoreBtn) {
            learnMoreBtn.addEventListener('click', () => {
                this.showScreen('home');
            });
        }
        
        // 등록 화면 버튼들
        const backBtn = document.querySelector('.back-btn');
        const registerForm = document.querySelector('.register-form');
        
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.showScreen('first');
            });
        }
        
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.showScreen('home');
            });
        }
        
        // 홈 화면 네비게이션
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            });
        });
        
        // 액션 버튼들
        const actionBtns = document.querySelectorAll('.action-btn');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleActionClick(btn);
            });
        });
    }
    
    showScreen(screenName) {
        // 모든 화면 숨기기
        Object.values(this.screens).forEach(screen => {
            if (screen) {
                screen.classList.add('hidden');
            }
        });
        
        // 선택된 화면 보이기
        if (this.screens[screenName]) {
            this.screens[screenName].classList.remove('hidden');
            this.currentScreen = screenName;
        }
    }
    
    handleActionClick(btn) {
        const actionText = btn.querySelector('span').textContent;
        
        // 액션별 처리
        switch(actionText) {
            case 'Health Check':
                this.showNotification('Health check initiated...');
                break;
            case 'Appointments':
                this.showNotification('Opening appointments...');
                break;
            case 'Medications':
                this.showNotification('Loading medications...');
                break;
            case 'Reports':
                this.showNotification('Generating reports...');
                break;
            default:
                this.showNotification('Action clicked: ' + actionText);
        }
    }
    
    showNotification(message) {
        // 간단한 알림 표시
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(255, 107, 107, 0.9);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            backdrop-filter: blur(10px);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // 3초 후 제거
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// 애니메이션 CSS 추가
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification {
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }
`;
document.head.appendChild(style);

// 통계 데이터 업데이트
class StatsManager {
    constructor() {
        this.stats = {
            heartRate: 72,
            steps: 8432,
            water: 6,
            sleep: 7.5
        };
        
        this.init();
    }
    
    init() {
        this.updateStats();
        setInterval(() => {
            this.updateStats();
        }, 5000); // 5초마다 업데이트
    }
    
    updateStats() {
        // 하트레이트 랜덤 변화
        this.stats.heartRate = Math.max(60, Math.min(100, this.stats.heartRate + (Math.random() - 0.5) * 10));
        
        // 걸음 수 증가
        this.stats.steps += Math.floor(Math.random() * 50);
        
        // 물 섭취량 랜덤 변화
        this.stats.water = Math.max(0, Math.min(10, this.stats.water + (Math.random() - 0.5) * 2));
        
        // 수면 시간은 고정
        this.stats.sleep = 7.5;
        
        this.updateDisplay();
    }
    
    updateDisplay() {
        const heartRateEl = document.querySelector('.stat-card:nth-child(1) .stat-value');
        const stepsEl = document.querySelector('.stat-card:nth-child(2) .stat-value');
        const waterEl = document.querySelector('.stat-card:nth-child(3) .stat-value');
        const sleepEl = document.querySelector('.stat-card:nth-child(4) .stat-value');
        
        if (heartRateEl) heartRateEl.textContent = Math.round(this.stats.heartRate);
        if (stepsEl) stepsEl.textContent = this.stats.steps.toLocaleString();
        if (waterEl) waterEl.textContent = Math.round(this.stats.water);
        if (sleepEl) sleepEl.textContent = this.stats.sleep + 'h';
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    const screenManager = new ScreenManager();
    const statsManager = new StatsManager();
    
    // 전역 객체에 저장 (디버깅용)
    window.app = {
        screenManager,
        statsManager
    };
    
    console.log('Skancer 앱이 성공적으로 로드되었습니다! 🚀');
});

// 터치 제스처 지원 (모바일)
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // 왼쪽으로 스와이프
            console.log('왼쪽으로 스와이프');
        } else {
            // 오른쪽으로 스와이프
            console.log('오른쪽으로 스와이프');
        }
    }
}

// 키보드 단축키
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case '1':
            window.app?.screenManager.showScreen('first');
            break;
        case '2':
            window.app?.screenManager.showScreen('register');
            break;
        case '3':
            window.app?.screenManager.showScreen('home');
            break;
        case 'Escape':
            window.app?.screenManager.showScreen('first');
            break;
    }
});

// 피그마 디자인 렌더러
class FigmaRenderer {
    constructor() {
        this.figmaData = null;
        this.contentElement = document.getElementById('figma-content');
        this.loadingElement = document.getElementById('loading');
        this.errorElement = document.getElementById('error');
        this.errorMessageElement = document.getElementById('error-message');
    }

    async init() {
        try {
            await this.loadFigmaData();
        } catch (error) {
            console.error('피그마 데이터 로드 실패:', error);
            this.showError('피그마 데이터를 로드할 수 없습니다: ' + error.message);
        }
    }

    async loadFigmaData() {
        this.showLoading();
        
        try {
            const response = await fetch('/api/figma');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.figmaData = await response.json();
            console.log('피그마 데이터 로드됨:', this.figmaData);
            
            this.renderFigmaDesign();
            this.hideLoading();
        } catch (error) {
            console.error('피그마 API 호출 실패:', error);
            this.showError('피그마 API에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
        }
    }

    showLoading() {
        this.loadingElement.classList.remove('hidden');
        this.contentElement.classList.add('hidden');
        this.errorElement.classList.add('hidden');
    }

    hideLoading() {
        this.loadingElement.classList.add('hidden');
        this.contentElement.classList.remove('hidden');
    }

    showError(message) {
        this.loadingElement.classList.add('hidden');
        this.contentElement.classList.add('hidden');
        this.errorElement.classList.remove('hidden');
        this.errorMessageElement.textContent = message;
    }

    renderFigmaDesign() {
        if (!this.figmaData || !this.figmaData.document) {
            this.showError('피그마 데이터가 올바르지 않습니다.');
            return;
        }

        this.contentElement.innerHTML = '';
        
        // 캔버스 렌더링
        const canvas = this.figmaData.document;
        this.renderNode(canvas, this.contentElement);
        
        console.log('피그마 디자인 렌더링 완료');
    }

    renderNode(node, parentElement) {
        if (!node || !node.children) return;

        // 프레임이나 페이지인 경우
        if (node.type === 'CANVAS' || node.type === 'PAGE') {
            node.children.forEach(child => {
                this.renderNode(child, parentElement);
            });
            return;
        }

        // 프레임 렌더링
        if (node.type === 'FRAME') {
            const frameElement = this.createFrameElement(node);
            parentElement.appendChild(frameElement);
            
            // 자식 노드들 렌더링
            if (node.children) {
                const frameContent = frameElement.querySelector('.figma-frame-content');
                node.children.forEach(child => {
                    this.renderNode(child, frameContent);
                });
            }
            return;
        }

        // 다른 노드 타입들 렌더링
        const element = this.createElementFromNode(node);
        if (element) {
            parentElement.appendChild(element);
        }
    }

    createFrameElement(frameNode) {
        const frameDiv = document.createElement('div');
        frameDiv.className = 'figma-frame';
        
        // 프레임 헤더
        const headerDiv = document.createElement('div');
        headerDiv.className = 'figma-frame-header';
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'figma-frame-title';
        titleSpan.textContent = frameNode.name || 'Frame';
        
        const sizeSpan = document.createElement('span');
        sizeSpan.className = 'figma-frame-size';
        sizeSpan.textContent = `${Math.round(frameNode.absoluteBoundingBox?.width || 0)} × ${Math.round(frameNode.absoluteBoundingBox?.height || 0)}`;
        
        headerDiv.appendChild(titleSpan);
        headerDiv.appendChild(sizeSpan);
        
        // 프레임 콘텐츠
        const contentDiv = document.createElement('div');
        contentDiv.className = 'figma-frame-content';
        
        // 프레임 스타일 적용
        if (frameNode.absoluteBoundingBox) {
            contentDiv.style.width = `${frameNode.absoluteBoundingBox.width}px`;
            contentDiv.style.height = `${frameNode.absoluteBoundingBox.height}px`;
        }
        
        if (frameNode.backgroundColor) {
            const bgColor = this.convertFigmaColor(frameNode.backgroundColor);
            contentDiv.style.backgroundColor = bgColor;
        }
        
        frameDiv.appendChild(headerDiv);
        frameDiv.appendChild(contentDiv);
        
        return frameDiv;
    }

    createElementFromNode(node) {
        let element = null;
        
        switch (node.type) {
            case 'TEXT':
                element = this.createTextElement(node);
                break;
            case 'RECTANGLE':
                element = this.createRectangleElement(node);
                break;
            case 'ELLIPSE':
                element = this.createEllipseElement(node);
                break;
            case 'VECTOR':
                element = this.createVectorElement(node);
                break;
            case 'IMAGE':
                element = this.createImageElement(node);
                break;
            case 'INSTANCE':
            case 'COMPONENT':
                element = this.createComponentElement(node);
                break;
            case 'GROUP':
                element = this.createGroupElement(node);
                break;
            default:
                console.log('지원하지 않는 노드 타입:', node.type, node.name);
                return null;
        }
        
        if (element) {
            this.applyNodeStyles(element, node);
        }
        
        return element;
    }

    createTextElement(node) {
        const textDiv = document.createElement('div');
        textDiv.className = 'figma-node figma-text';
        
        // 텍스트 내용 설정
        if (node.characters) {
            textDiv.textContent = node.characters;
        }
        
        // 텍스트 스타일 적용
        if (node.style) {
            if (node.style.fontFamily) {
                textDiv.style.fontFamily = node.style.fontFamily;
            }
            if (node.style.fontSize) {
                textDiv.style.fontSize = `${node.style.fontSize}px`;
            }
            if (node.style.fontWeight) {
                textDiv.style.fontWeight = node.style.fontWeight;
            }
            if (node.style.textAlignHorizontal) {
                textDiv.style.textAlign = node.style.textAlignHorizontal.toLowerCase();
            }
            if (node.style.textAlignVertical) {
                textDiv.style.verticalAlign = node.style.textAlignVertical.toLowerCase();
            }
        }
        
        return textDiv;
    }

    createRectangleElement(node) {
        const rectDiv = document.createElement('div');
        rectDiv.className = 'figma-node figma-rectangle';
        
        // 모서리 반경 적용
        if (node.cornerRadius) {
            rectDiv.style.borderRadius = `${node.cornerRadius}px`;
        }
        
        return rectDiv;
    }

    createEllipseElement(node) {
        const ellipseDiv = document.createElement('div');
        ellipseDiv.className = 'figma-node figma-ellipse';
        return ellipseDiv;
    }

    createVectorElement(node) {
        const vectorDiv = document.createElement('div');
        vectorDiv.className = 'figma-node figma-vector';
        
        // SVG가 있는 경우
        if (node.vectorPaths) {
            // SVG 생성 로직 (복잡하므로 간단한 div로 대체)
            vectorDiv.style.backgroundColor = '#000';
        }
        
        return vectorDiv;
    }

    createImageElement(node) {
        const imageDiv = document.createElement('div');
        imageDiv.className = 'figma-node figma-image';
        
        // 이미지 URL이 있는 경우
        if (node.imageRef) {
            imageDiv.style.backgroundImage = `url(${node.imageRef})`;
        }
        
        return imageDiv;
    }

    createComponentElement(node) {
        const componentDiv = document.createElement('div');
        componentDiv.className = 'figma-node figma-component';
        
        // 컴포넌트 이름 표시
        if (node.name) {
            componentDiv.setAttribute('data-component-name', node.name);
        }
        
        return componentDiv;
    }

    createGroupElement(node) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'figma-node figma-group';
        
        // 그룹의 자식 노드들 렌더링
        if (node.children) {
            node.children.forEach(child => {
                const childElement = this.createElementFromNode(child);
                if (childElement) {
                    groupDiv.appendChild(childElement);
                }
            });
        }
        
        return groupDiv;
    }

    applyNodeStyles(element, node) {
        // 위치 및 크기
        if (node.absoluteBoundingBox) {
            const { x, y, width, height } = node.absoluteBoundingBox;
            element.style.position = 'absolute';
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
            element.style.width = `${width}px`;
            element.style.height = `${height}px`;
        }
        
        // 배경색
        if (node.backgroundColor) {
            const bgColor = this.convertFigmaColor(node.backgroundColor);
            element.style.backgroundColor = bgColor;
        }
        
        // 테두리
        if (node.strokes && node.strokes.length > 0) {
            const stroke = node.strokes[0];
            if (stroke.type === 'SOLID') {
                const strokeColor = this.convertFigmaColor(stroke.color);
                element.style.border = `${node.strokeWeight || 1}px solid ${strokeColor}`;
            }
        }
        
        // 투명도
        if (node.opacity !== undefined) {
            element.style.opacity = node.opacity;
        }
        
        // 회전
        if (node.rotation !== undefined) {
            element.style.transform = `rotate(${node.rotation}rad)`;
        }
        
        // 자동 레이아웃
        if (node.layoutMode) {
            element.classList.add('figma-auto-layout');
            if (node.layoutMode === 'VERTICAL') {
                element.classList.add('figma-auto-layout-vertical');
            } else if (node.layoutMode === 'HORIZONTAL') {
                element.classList.add('figma-auto-layout-horizontal');
            }
        }
        
        // 제약 조건
        if (node.constraints) {
            this.applyConstraints(element, node.constraints);
        }
        
        // 효과 (그림자, 블러 등)
        if (node.effects && node.effects.length > 0) {
            this.applyEffects(element, node.effects);
        }
    }

    convertFigmaColor(color) {
        if (!color) return 'transparent';
        
        const { r, g, b, a = 1 } = color;
        const red = Math.round(r * 255);
        const green = Math.round(g * 255);
        const blue = Math.round(b * 255);
        
        if (a === 1) {
            return `rgb(${red}, ${green}, ${blue})`;
        } else {
            return `rgba(${red}, ${green}, ${blue}, ${a})`;
        }
    }

    applyConstraints(element, constraints) {
        if (constraints.horizontal === 'LEFT') {
            element.classList.add('figma-constraint-left');
        } else if (constraints.horizontal === 'RIGHT') {
            element.classList.add('figma-constraint-right');
        } else if (constraints.horizontal === 'CENTER') {
            element.classList.add('figma-constraint-center');
        }
        
        if (constraints.vertical === 'TOP') {
            element.classList.add('figma-constraint-top');
        } else if (constraints.vertical === 'BOTTOM') {
            element.classList.add('figma-constraint-bottom');
        } else if (constraints.vertical === 'CENTER') {
            element.classList.add('figma-constraint-middle');
        }
    }

    applyEffects(element, effects) {
        effects.forEach(effect => {
            if (effect.type === 'DROP_SHADOW') {
                const { color, offset, radius, spread } = effect;
                const shadowColor = this.convertFigmaColor(color);
                element.style.boxShadow = `${offset.x}px ${offset.y}px ${radius}px ${spread}px ${shadowColor}`;
            } else if (effect.type === 'LAYER_BLUR') {
                element.style.filter = `blur(${effect.radius}px)`;
            }
        });
    }
}

// 전역 함수로 노출 (HTML에서 호출하기 위해)
window.loadFigmaData = function() {
    if (window.figmaRenderer) {
        window.figmaRenderer.loadFigmaData();
    }
};

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.figmaRenderer = new FigmaRenderer();
    window.figmaRenderer.init();
    
    console.log('피그마 렌더러가 초기화되었습니다! 🎨');
}); 