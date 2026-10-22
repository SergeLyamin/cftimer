class TimerControl {
    constructor() {
        this.timerId = new URLSearchParams(window.location.search).get('id');
        this.currentScreen = 'main-menu';
        this.isConnected = false;
        
        this.translations = {
            'CLOCK': 'ЧАСЫ',
            'INTERVAL': 'ИНТЕРВАЛЫ',
            'FOR TIME': 'НА ВРЕМЯ',
            'START': 'СТАРТ',
            'PAUSE': 'ПАУЗА',
            'RESET': 'СБРОС',
            'RESTART': 'ПЕРЕЗАПУСК'
        };
        
        if (!this.timerId) {
            this.showError('ID таймера не найден');
            return;
        }
        
        this.connectWebSocket();
        this.initControls();
    }
    
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${window.location.host}`);
        
        this.ws.onopen = () => {
            this.ws.send(JSON.stringify({
                type: 'connect',
                timerId: this.timerId
            }));
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
        
        this.ws.onclose = () => {
            this.isConnected = false;
            this.updateConnectionStatus('Соединение потеряно');
            setTimeout(() => this.connectWebSocket(), 5000);
        };
    }
    
    handleMessage(data) {
        switch(data.type) {
            case 'connected':
                this.isConnected = true;
                this.updateConnectionStatus('Подключено');
                break;
                
            case 'screen-change':
                this.showScreen(data.screen);
                break;
                
            case 'state-change':
                this.updateState(data.state);
                break;
                
            case 'settings-update':
                this.updateSettings(data.settings);
                break;
        }
    }
    
    showScreen(screenName) {
        this.currentScreen = screenName;
        const timerScreens = document.getElementById('timer-screens');
        timerScreens.innerHTML = this.createScreenContent(screenName);
        
        // Обновляем видимость экранов
        document.querySelectorAll('.screen').forEach(screen => {
            screen.style.display = 'none';
        });
        
        const currentScreen = document.querySelector(`[data-screen="${screenName}"]`);
        if (currentScreen) {
            currentScreen.style.display = 'flex';
        }
    }
    
    createScreenContent(screenName) {
        const baseControls = `
            <div class="control-buttons">
                <button class="menu-item" data-action="start">${this.translations.START}</button>
                <button class="menu-item" data-action="pause">${this.translations.PAUSE}</button>
                <button class="menu-item" data-action="reset">${this.translations.RESET}</button>
            </div>
        `;
        
        return `
            <div class="screen" data-screen="${screenName}">
                <div class="header-panel">
                    <h2 class="timer--header">${this.translations[screenName.toUpperCase()]}</h2>
                </div>
                <div class="timer-display"></div>
                ${baseControls}
            </div>
        `;
    }
    
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connection-status');
        statusElement.textContent = status;
        statusElement.className = this.isConnected ? 'connected' : 'disconnected';
    }
    
    initControls() {
        document.addEventListener('click', (e) => {
            if (!this.isConnected) return;
            
            const action = e.target.dataset.action;
            if (action) {
                this.ws.send(JSON.stringify({
                    type: 'control',
                    timerId: this.timerId,
                    action: action
                }));
            }
            
            const timerType = e.target.dataset.timer;
            if (timerType) {
                this.ws.send(JSON.stringify({
                    type: 'screen-change',
                    timerId: this.timerId,
                    screen: timerType
                }));
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TimerControl();
}); 