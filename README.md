# Таймер

Веб-приложение для отображения таймера обратного отсчета с возможностью удаленного управления через QR-код.

## Установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/your-username/crossfit-timer.git
```

2. Установите зависимости:
```bash
npm install
```

3. Запустите сервер:
```bash
npm start
```

Для разработки используйте:
```bash
npm run dev
```

## Деплой

Проект настроен для деплоя с использованием PM2:

```bash
npm run deploy
```

## Структура проекта

```
├── public/
│   ├── index.html
│   ├── control.html
│   ├── timer.js
│   ├── control.js
│   ├── styles.css
│   └── sound/
│       ├── beep.mp3
│       ├── start.mp3
│       ├── rest.mp3
│       └── finish.mp3
├── server.js
├── config.js
├── ecosystem.config.js
└── deploy.sh
```

## Конфигурация

Настройки проекта находятся в файле `config.js`. Для продакшена используйте переменные окружения:

- `PORT`: порт сервера (по умолчанию 3000)
- `BASE_URL`: базовый URL для продакшена
- `NODE_ENV`: окружение (development/production)

## Лицензия

MIT

