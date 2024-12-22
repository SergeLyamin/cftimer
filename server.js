const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static('www', {
    setHeaders: (res, path, stat) => {
        if (path.endsWith('.js')) {
            res.set('Content-Type', 'application/javascript');
        }
        if (path.endsWith('.css')) {
            res.set('Content-Type', 'text/css');
        }
    }
}));

// Serve control page
app.get('/control', (req, res) => {
    res.sendFile(path.join(__dirname, 'control.html'));
});

const clients = new Map();
let displayClient = null;

wss.on('connection', (ws, req) => {
    ws.on('message', async (message) => {
        const data = JSON.parse(message);

        if (data.type === 'init') {
            if (!clients.has(ws)) {
                clients.set(ws, { type: 'display' });
                displayClient = ws;
                
                // Получаем host из заголовков запроса
                const host = req.headers.host;
                try {
                    // Формируем URL используя тот же протокол и хост, с которого пришел запрос
                    const protocol = req.headers['x-forwarded-proto'] || 'http';
                    const controlUrl = `${protocol}://${host}/control`;
                    console.log('Generating QR for URL:', controlUrl); // Для отладки
                    
                    const qrCodeDataUrl = await QRCode.toDataURL(controlUrl);
                    ws.send(JSON.stringify({
                        type: 'qr',
                        qrCode: qrCodeDataUrl
                    }));
                } catch (error) {
                    console.error('Ошибка генерации QR-кода:', error);
                }
            }
        } else if (data.type === 'control-init') {
            clients.set(ws, { type: 'control' });
            if (displayClient) {
                displayClient.send(JSON.stringify({
                    type: 'controller-connected'
                }));
            }
        } else if (data.type === 'command' && displayClient) {
            displayClient.send(JSON.stringify({
                type: 'command',
                action: data.action
            }));
        }
    });

    ws.on('close', () => {
        const client = clients.get(ws);
        if (client && client.type === 'control' && displayClient) {
            displayClient.send(JSON.stringify({
                type: 'controller-disconnected'
            }));
        }
        if (ws === displayClient) {
            displayClient = null;
        }
        clients.delete(ws);
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 