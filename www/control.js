class TimerControl {
    constructor() {
        this.timerId = new URLSearchParams(window.location.search).get('id');
        this.status = document.getElementById('status');
        this.controls = document.getElementById('controls');
        
        if (!this.timerId) {
            this.status.textContent = 'Ошибка: ID таймера не найден';
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
            
            switch(data.type) {
                case 'connected':
                    this.status.textContent = 'Подключено';
                    this.controls.style.display = 'flex';
                    break;
                    
                case 'host-disconnected':
                    this.status.textContent = 'Таймер отключен';
                    this.controls.style.display = 'none';
                    break;
            }
        };
        
        this.ws.onclose = () => {
            this.status.textContent = 'Соединение потеряно';
            this.controls.style.display = 'none';
            setTimeout(() => this.connectWebSocket(), 5000);
        };
    }
    
    initControls() {
        document.querySelectorAll('[data-action]').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.ws.send(JSON.stringify({
                    type: 'control',
                    timerId: this.timerId,
                    target: 'host',
                    action: action
                }));
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TimerControl();
}); 