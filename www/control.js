class ControlTimer extends Timer {
    constructor() {
        super();
        this.isController = true; // Флаг для определения, что это пульт управления
    }

    // Переопределяем методы воспроизведения звука
    playSound() {
        // Пустой метод, так как в пульте управления звуки не нужны
    }

    // Переопределяем инициализацию WebSocket
    initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected, sending controller init');
            this.ws.send(JSON.stringify({ 
                type: 'init',
                isController: true 
            }));
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch(data.type) {
                case 'screen-change':
                    this.showScreen(data.screen);
                    break;
                case 'timer-update':
                    this.updateTimerDisplay(data);
                    break;
                case 'timer-finish':
                    this.showFinishMessage(data);
                    break;
            }
        };
    }

    // Добавляем метод для отправки команд
    sendCommand(action) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'command',
                action: action
            }));
        }
    }

    // Переопределяем методы запуска таймеров
    startInterval() {
        this.sendCommand('start');
    }

    startForTime() {
        this.sendCommand('start');
    }

    startAmrap() {
        this.sendCommand('start');
    }

    togglePause() {
        this.sendCommand('pause');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.timer = new ControlTimer();
}); 