# Development Guide

## Настройка окружения

### Требования
- Node.js >= 18.0.0
- npm >= 9.0.0
- TypeScript >= 5.0.0

### Установка
```bash
npm install
npm run dev
```

## Структура проекта

```
src/
├── components/          # UI компоненты
├── services/           # Сервисы приложения
├── timers/            # Логика таймеров
├── types/             # TypeScript типы
├── utils/             # Утилиты
└── main.ts            # Точка входа

public/
├── sounds/            # Звуковые файлы
└── index.html         # HTML шаблон
```

## Соглашения по коду

### TypeScript
- Строгий режим включен
- Все публичные API должны быть типизированы
- Использование интерфейсов для контрактов

### Именование
- PascalCase для классов и интерфейсов
- camelCase для методов и переменных
- UPPER_CASE для констант
- kebab-case для CSS классов

### Компоненты
- Каждый компонент в отдельном файле
- Интерфейс для props
- Lifecycle методы в определенном порядке

## Команды разработки

```bash
npm run dev          # Запуск dev сервера
npm run build        # Сборка для продакшена
npm run test         # Запуск тестов
npm run lint         # Проверка кода
npm run type-check   # Проверка типов
```