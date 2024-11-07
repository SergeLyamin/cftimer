const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

// Раздаем статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// Маршрут для страницы управления
app.get('/control/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'control.html'));
});

// Генерация QR кода
app.get('/qr/:roomId', async (req, res) => {
    try {
        const url = `${req.protocol}://${req.get('host')}/control/${req.params.roomId}`;
        const qr = await QRCode.toDataURL(url);
        res.send(qr);
    } catch (err) {
        res.status(500).send('Error generating QR code');
    }
});

// WebSocket логика
const rooms = new Map();

wss.on('connection', (ws, req) => {
    const roomId = req.url.split('/').pop();
    
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(ws);

    ws.on('message', (message) => {
        rooms.get(roomId).forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        const room = rooms.get(roomId);
        if (room) {
            room.delete(ws);
            if (room.size === 0) {
                rooms.delete(roomId);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 