document.addEventListener('DOMContentLoaded', () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    console.log('Initializing controller WebSocket:', wsUrl);

    // Валидация сообщений перед отправкой
    function sendMessage(type, data) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return;
        }

        const message = {
            type,
            ...data,
            timestamp: Date.now()
        };

        try {
            ws.send(JSON.stringify(message));
            console.log('Message sent:', message);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    ws.onopen = () => {
        console.log('WebSocket connected');
        // Инициализация контроллера
        sendMessage('init', { isController: true });

        // Добавляем обработчики для кнопок
        document.querySelectorAll('.menu-item').forEach(button => {
            button.addEventListener('click', () => {
                const timerType = button.dataset.timer;
                if (timerType) {
                    sendMessage('command', { action: `start-${timerType}` });
                }
            });
        });
    };

    // Обработка разрыва соединения с переподключением
    ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        // Переподключение через 1 секунду
        setTimeout(() => {
            console.log('Attempting to reconnect...');
            window.location.reload();
        }, 1000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    // Валидация входящих сообщений
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            // Проверяем структуру сообщения
            if (!data.type) {
                console.error('Invalid message format:', data);
                return;
            }

            console.log('Message received:', data);

            switch (data.type) {
                case 'screen-change':
                    console.log('Screen changed to:', data.screen);
                    break;
                case 'timer-update':
                    console.log('Timer updated:', data.time);
                    break;
                default:
                    console.warn('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    };
}); 