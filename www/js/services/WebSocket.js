export class WebSocketService {
    constructor(timer) {
        this.timer = timer;
        this.ws = null;
        this.isController = window.location.pathname === '/control';
        this.init();
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
            console.log('Received message:', data);

            switch (data.type) {
                case 'screen-change':
                    this.timer.showScreen(data.screen);
                    break;
                case 'controller-connected':
                    this.showQRCode();
                    break;
                case 'controller-disconnected':
                    // Обработка отключения контроллера
                    break;
                case 'command':
                    this.handleCommand(data.command);
                    break;
                default:
                    console.warn('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    handleCommand(command) {
        switch (command) {
            case 'start-interval':
                this.timer.startInterval();
                break;
            case 'start-fortime':
                this.timer.startForTime();
                break;
            case 'start-amrap':
                this.timer.startAmrap();
                break;
            case 'toggle-pause':
                this.timer.togglePause();
                break;
            default:
                console.warn('Unknown command:', command);
        }
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    showQRCode() {
        if (!this.isController) {
            const qrContainer = document.getElementById('qr-container');
            if (qrContainer) {
                const controlUrl = `${window.location.protocol}//${window.location.host}/control`;
                const qr = new QRCode(qrContainer, {
                    text: controlUrl,
                    width: 192,
                    height: 192,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
            }
        }
    }

    cleanup() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
} 