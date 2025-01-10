export class WebSocketService {
    constructor(timer) {
        this.timer = timer;
        this.ws = null;
        this.isController = window.location.pathname === '/control';
        this.qrCode = null;
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
                    this.timer.showScreen(data.screen);
                    break;
                case 'controller-connected':
                    console.log('Controller connected');
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
            console.error('Raw message:', event.data);
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
} 