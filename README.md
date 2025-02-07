# Кроссфит Таймер

Веб-приложение для тренировок, включающее различные типы таймеров (Интервалы, FOR TIME, AMRAP) с возможностью удаленного управления через QR-код.

Демо: https://timer.lyamin.org

## Функциональность

- ⏰ Различные режимы таймера:
  - Интервальный таймер
  - FOR TIME (прямой отсчет)
  - AMRAP (обратный отсчет)
- 📱 Удаленное управление через QR-код
- 🔊 Звуковые сигналы для разных фаз тренировки
- ⌨️ Управление с клавиатуры (пробел для паузы)
- 📺 Полноэкранный режим (кнопка или F)
- 🎨 Адаптивный дизайн:
  - Поддержка мобильных устройств
  - Горизонтальная и вертикальная ориентация
- 🔄 Сохранение настроек в течение сессии
- 🌐 Русскоязычный интерфейс
- 📊 Интеграция с метриками (Yandex.Metrika, Google Analytics)

## Технические требования

### Системные требования
- Node.js >= 16.0.0
- npm 9.x или выше
- Nginx (рекомендуется для проксирования)
- SSL сертификат (для HTTPS)
- Современный браузер с поддержкой WebSocket

### Сетевые требования
- Открытый порт 3000 (или настраиваемый)
- Поддержка WebSocket соединений

## Установка и запуск

1. Клонируйте репозиторий:
```bash
git clone https://github.com/your-username/crossfit-timer.git
cd crossfit-timer
```

2. Установите зависимости:
```bash
npm install
```

3. Настройте метрики:
```bash
cp www/metrics.js.example www/metrics.js
# Отредактируйте www/metrics.js, добавив ваши ID счетчиков
```

4. Запустите сервер:
```bash
npm start
```

## Разработка

Доступны следующие команды:

```bash
# Запуск сервера разработки
npm run dev

# Сборка CSS (Tailwind)
npm run css

# Отслеживание изменений CSS
npm run css:watch

# Копирование ассетов
npm run copy-assets

# Полная сборка
npm run build

# Запуск всех процессов разработки
npm run dev:full
```

### Процесс разработки и перезапуск

1. Полный перезапуск (npm run build && npm run start) требуется при изменении:
   - Серверных файлов (server.js, server/*.js)
   - Конфигурационных файлов (package.json, webpack.config.js)
   - Настроек WebSocket, портов, путей

2. Только пересборка (npm run build) требуется при изменении:
   - CSS файлов
   - Tailwind конфигурации
   - Добавлении новых стилей

3. Только обновление страницы (F5) требуется при изменении:
   - JavaScript файлов в www/js/*
   - HTML файлов
   - Изображений и других статических файлов

### Отладка

- Используйте консоль разработчика (F12) для просмотра логов
- Все сообщения WebSocket логируются в консоль браузера
- При проблемах с соединением проверьте консоль сервера
- QR-код генерируется на сервере и передается при инициализации соединения

## Структура проекта

```
├── www/                  # Статические файлы
│   ├── index.html       # Главная страница
│   ├── control.html     # Страница удаленного управления
│   ├── timer.js         # Логика таймера
│   ├── control.js       # Логика управления
│   ├── styles.css       # Исходные стили
│   ├── dist/            # Скомпилированные ассеты
│   ├── img/             # Изображения и иконки
│   └── sound/           # Звуковые файлы
├── server.js            # Express сервер
├── config.js            # Конфигурация
├── ecosystem.config.js  # Конфигурация PM2
└── deploy.sh            # Скрипт деплоя
```

## Деплой

Проект использует PM2 для управления процессом на сервере:

```bash
npm run deploy
```

## Конфигурация

Настройки в `config.js` можно переопределить через переменные окружения:

- `PORT`: порт сервера (по умолчанию 3000)
- `BASE_URL`: базовый URL для продакшена
- `NODE_ENV`: окружение (development/production)

## Лицензия

Apache License 2.0. См. файл [LICENSE](LICENSE) для деталей.


