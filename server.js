const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Статические файлы
app.use(express.static(path.join(__dirname, 'www')));

// Маршруты
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'www', 'index.html'));
});

app.get('/control', (req, res) => {
    res.sendFile(path.join(__dirname, 'www', 'control.html'));
});

// WebSocket соединения
const connections = {
    host: null,
    controllers: new Set()
};

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data);

            switch (data.type) {
                case 'init':
                    if (data.isController) {
                        connections.controllers.add(ws);
                        ws.isController = true;
                        console.log('Controller connected');
                    } else {
                        connections.host = ws;
                        ws.isHost = true;
                        console.log('Host connected');

                        // Генерируем QR-код для подключения контроллера
                        const controlUrl = `${process.env.APP_URL || 'http://localhost:3000'}/control`;
                        const qrCode = await QRCode.toDataURL(controlUrl);
                        ws.send(JSON.stringify({
                            type: 'qr',
                            qrCode: qrCode
                        }));
                    }
                    break;

                case 'screen-change':
                    // Отправляем всем контроллерам
                    connections.controllers.forEach(controller => {
                        controller.send(JSON.stringify({
                            type: 'screen-change',
                            screen: data.screen
                        }));
                    });
                    break;

                case 'command':
                    // Отправляем команду хосту
                    if (connections.host) {
                        connections.host.send(JSON.stringify({
                            type: 'command',
                            action: data.action
                        }));
                    }
                    break;

                case 'timer-update':
                    // Отправляем обновление таймера всем контроллерам
                    connections.controllers.forEach(controller => {
                        controller.send(JSON.stringify({
                            type: 'timer-update',
                            ...data
                        }));
                    });
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        if (ws.isController) {
            connections.controllers.delete(ws);
            console.log('Controller disconnected');
        }
        if (ws.isHost) {
            connections.host = null;
            console.log('Host disconnected');
            // Уведомляем контроллеры об отключении хоста
            connections.controllers.forEach(controller => {
                controller.send(JSON.stringify({
                    type: 'host-disconnected'
                }));
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 