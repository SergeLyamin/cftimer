class ControlTimer {
    constructor() {
        this.initWebSocket();
    }

    initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        const connect = () => {
            console.log('Connecting to WebSocket:', wsUrl);
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('Controller connected, sending init');
                this.ws.send(JSON.stringify({ 
                    type: 'init',
                    isController: true 
                }));
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket connection closed, reconnecting...');
                setTimeout(connect, 1000);
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('Received message:', data);
                
                switch(data.type) {
                    case 'screen-change':
                        this.updateScreen(data.screen);
                        break;
                    case 'timer-update':
                        this.updateDisplay(data);
                        break;
                }
            };
        };
        
        connect();
        this.initControls();
    }

    initControls() {
        document.querySelectorAll('.menu-item').forEach(button => {
            button.addEventListener('click', (e) => {
                const timerType = e.target.dataset.timer;
                if (timerType && this.ws) {
                    console.log('Sending command:', timerType);
                    this.ws.send(JSON.stringify({
                        type: 'command',
                        action: 'screen-change',
                        screen: timerType
                    }));
                }
            });
        });

        // Добавляем обработчики для кнопок управления таймером
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('start-button')) {
                this.sendCommand('start');
            }
            if (e.target.classList.contains('timer-display')) {
                this.sendCommand('pause');
            }
        });

        // Обработка полноэкранного режима
        const fullscreenButton = document.querySelector('.fullscreen-button');
        if (fullscreenButton) {
            fullscreenButton.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                } else {
                    document.exitFullscreen();
                }
            });
        }

        // Обработка кнопки "назад"
        const backButton = document.querySelector('.back-button');
        if (backButton) {
            backButton.addEventListener('click', () => {
                window.history.back();
            });
        }
    }

    sendCommand(action) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('Sending command:', action);
            this.ws.send(JSON.stringify({
                type: 'command',
                action: action
            }));
        }
    }

    updateScreen(screenName) {
        // Обновляем UI в соответствии с текущим экраном
        console.log('Updating screen:', screenName);
    }

    updateDisplay(data) {
        // Обновляем отображение таймера
        console.log('Updating display:', data);
        const display = document.querySelector('.timer-display');
        if (display && data.time) {
            display.textContent = data.time;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Controller initialized');
    window.controller = new ControlTimer();
}); 