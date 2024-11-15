initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    console.log('Подключение к WebSocket:', wsUrl);
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
        console.log('WebSocket соединение установлено');
        this.ws.send(JSON.stringify({ type: 'init' }));
    };
    
    this.ws.onerror = (error) => {
        console.error('WebSocket ошибка:', error);
    };
} 