const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const QRCode = require('qrcode');
const config = require('./config');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Служим статические файлы из директории www
app.use(express.static('www'));

// Хранилище для соединений
const connections = new Map();

// Генерация уникального ID для каждого таймера
function generateTimerId() {
    return Math.random().toString(36).substr(2, 9);
}

// Обработка WebSocket соединений
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch(data.type) {
                case 'init':
                    // Инициализация нового таймера
                    const timerId = generateTimerId();
                    connections.set(timerId, { host: ws });
                    ws.timerId = timerId;
                    
                    // Генерируем QR код
                    const controlUrl = `${config.baseUrl}/control.html?id=${timerId}`;
                    QRCode.toDataURL(controlUrl)
                        .then(url => {
                            ws.send(JSON.stringify({
                                type: 'qr',
                                qrCode: url,
                                timerId: timerId
                            }));
                        });
                    break;

                case 'connect':
                    // Подключение контроллера к существующему таймеру
                    const connection = connections.get(data.timerId);
                    if (connection) {
                        connection.controller = ws;
                        ws.timerId = data.timerId;
                        ws.send(JSON.stringify({ type: 'connected' }));
                        connection.host.send(JSON.stringify({ type: 'controller-connected' }));
                    }
                    break;

                case 'control':
                    // Передача команд управления
                    const conn = connections.get(data.timerId);
                    if (conn) {
                        const target = data.target === 'host' ? conn.host : conn.controller;
                        if (target) {
                            target.send(JSON.stringify({
                                type: 'command',
                                action: data.action,
                                settings: data.settings
                            }));
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('Ошибка обработки сообщения:', error);
        }
    });

    ws.on('close', () => {
        if (ws.timerId) {
            const connection = connections.get(ws.timerId);
            if (connection) {
                if (connection.host === ws) {
                    // Хост отключился - удаляем соединение
                    if (connection.controller) {
                        connection.controller.send(JSON.stringify({ type: 'host-disconnected' }));
                    }
                    connections.delete(ws.timerId);
                } else if (connection.controller === ws) {
                    // Контроллер отключился
                    connection.controller = null;
                    connection.host.send(JSON.stringify({ type: 'controller-disconnected' }));
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
}); 