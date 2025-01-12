export class WebSocketService {
    constructor(timer) {
        this.timer = timer;
        this.ws = null;
        this.isController = window.location.pathname === '/control.html';
        this.qrCode = null;
        this.init();
        if (this.isController) {
            this.initControlPage();
        }
    }

    init() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            
            console.log('Connecting to WebSocket:', wsUrl);
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = this.handleOpen.bind(this);
            this.ws.onclose = this.handleClose.bind(this);
            this.ws.onmessage = this.handleMessage.bind(this);
            this.ws.onerror = this.handleError.bind(this);

            // Переподключение при разрыве соединения
            setInterval(() => {
                if (this.ws.readyState === WebSocket.CLOSED) {
                    console.log('Reconnecting...');
                    this.init();
                }
            }, 5000);
        } catch (error) {
            console.error('WebSocket initialization error:', error);
        }
    }

    handleOpen() {
        console.log('WebSocket connected');
        if (this.isController) {
            this.sendMessage({ type: 'controller-connected' });
        } else {
            // Запрашиваем QR-код при подключении
            this.sendMessage({ 
                type: 'init',
                isController: false 
            });
        }
    }

    handleClose() {
        console.log('WebSocket disconnected');
    }

    handleError(error) {
        console.error('WebSocket error:', error);
    }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);
            
            switch (data.type) {
                case 'qr':
                    console.log('QR code received, length:', data.qrCode?.length);
                    this.qrCode = data.qrCode;
                    this.showQRCode();
                    break;
                case 'screen-change':
                    if (this.isController) {
                        // На пульте показываем тот же экран
                        console.log('Syncing screen on controller:', data.screen);
                        this.showControllerScreen(data.screen);
                    } else {
                        this.timer.showScreen(data.screen);
                    }
                    break;
                case 'timer-update':
                    if (this.isController) {
                        // Обновляем состояние таймера на пульте
                        console.log('Syncing timer state:', data);
                        this.updateControllerTimer(data);
                    }
                    break;
                case 'controller-connected':
                    console.log('Controller connected');
                    break;
                case 'controller-disconnected':
                    // Обработка отключения контроллера
                    break;
                case 'command':
                    this.handleCommand(data);
                    break;
                default:
                    console.warn('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error handling message:', error);
            console.error('Raw message:', event.data);
        }
    }

    handleCommand(data) {
        console.log('Handling command:', data);
        const action = data.action || data.command;

        // На основном экране выполняем команду
        if (!this.isController) {
            if (action.startsWith('start-')) {
                const timerType = action.replace('start-', '');
                console.log('Starting timer on main screen:', timerType);
                
                // Находим кнопку на основном экране и кликаем по ней
                const button = document.querySelector(`[data-timer="${timerType}"]`);
                if (button) {
                    button.click();
                }
            }
        }
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    showQRCode() {
        console.log('Showing QR code, stored code length:', this.qrCode?.length);
        if (!this.qrCode) {
            console.log('No QR code available yet');
            return;
        }
        
        let qrContainer = document.getElementById('qr-container');
        console.log('QR container found:', !!qrContainer);
        if (qrContainer) {
            qrContainer.innerHTML = `
                <img src="${this.qrCode}" alt="QR Code">
            `;
            console.log('QR code image set');
        }
    }

    cleanup() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    initControlPage() {
        if (this.isController) {
            console.log('Initializing control page buttons');
            document.querySelectorAll('.menu-item').forEach(button => {
                button.addEventListener('click', () => {
                    const timerType = button.dataset.timer;
                    if (timerType) {
                        // Отправляем команду на основной экран
                        this.sendMessage({
                            type: 'command',
                            action: `start-${timerType}`
                        });
                    }
                });
            });
        }
    }

    // Показываем тот же экран на пульте
    showControllerScreen(screen) {
        const timerScreens = document.getElementById('timer-screens');
        if (!timerScreens) return;

        // Создаем соответствующий экран на пульте
        switch(screen) {
            case 'interval':
                const intervalTimer = new IntervalTimer();
                timerScreens.innerHTML = '';
                timerScreens.appendChild(intervalTimer.createControlScreen());
                break;
            // ... аналогично для других таймеров
        }
    }

    // Обновляем состояние таймера на пульте
    updateControllerTimer(data) {
        const { time, phase, round, isRunning } = data;
        // Обновляем отображение на пульте
        const timerDisplay = document.querySelector('.timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = time;
        }
        // ... обновляем другие элементы
    }
} 