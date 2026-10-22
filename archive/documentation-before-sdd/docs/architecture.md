# Architecture Overview

## Модульная архитектура

Новая версия CrossFit Timer построена на принципах модульной архитектуры с четким разделением ответственности.

### Слои приложения

```
┌─────────────────────────────────────┐
│           UI Layer                  │
│  Components, Views, Controllers     │
├─────────────────────────────────────┤
│        Application Layer            │
│   App Core, Timer Engine, State    │
├─────────────────────────────────────┤
│         Service Layer               │
│ WebSocket, Storage, Audio, Config   │
├─────────────────────────────────────┤
│         Server Layer                │
│  WebSocket Server, Static Server    │
└─────────────────────────────────────┘
```

### Основные компоненты

#### Timer Engine
- `BaseTimer` - базовый класс для всех таймеров
- `IntervalTimer` - интервальный таймер
- `ForTimeTimer` - таймер на время
- `AmrapTimer` - AMRAP таймер
- `ClockTimer` - часы

#### Event System
- `EventBus` - централизованная система событий
- Типизированные события для всех взаимодействий
- Слабые ссылки для предотвращения утечек памяти

#### State Management
- Централизованное управление состоянием
- Immutable updates
- Persistence в localStorage

## Принципы дизайна

1. **Single Responsibility** - каждый модуль отвечает за одну задачу
2. **Dependency Injection** - слабая связанность компонентов
3. **Event-Driven** - асинхронное взаимодействие через события
4. **Type Safety** - полная типизация с TypeScript
5. **Performance First** - оптимизация с самого начала