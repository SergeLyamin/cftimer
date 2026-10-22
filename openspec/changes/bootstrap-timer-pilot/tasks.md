# Tasks

Статус: локальная реализация создана; незакрытые задачи требуют дополнительной визуальной и аппаратной приёмки. Отчёт: docs/implementation-2026-10-22.md. Продуктовые допущения из design подлежат корректировке по ответам владельца до зависимой реализации.

## 1. Reproducible application foundation

- [x] 1.1 Создать активные entrypoint/src/configs, закрепить совместимые TypeScript/React/Vite/Tailwind/Vitest/Playwright и Node target; проверить clean npm ci, type-check и production build.
- [x] 1.2 Настроить dev/preview/lint/test scripts и CI для нового приложения, исключить archive/tooling из runtime checks; проверить команды на новом checkout и описать их в docs/development.md.

## 2. Timer behavior

- [x] 2.1 Реализовать валидацию и компиляцию фаз из timer-operation; unit tests проверяют диапазоны, нулевой отдых, total ≤4 ч и Tabata ровно 240 с с подготовкой.
- [x] 2.2 Реализовать clock-driven state machine AMRAP/For Time/intervals; unit tests проверяют границы, cap, подготовку, delayed callback на 65000 мс и rounding.
- [x] 2.3 Реализовать идемпотентные start/pause/resume, подтверждённые finish/reset и repeat; unit tests подтверждают позицию после паузы и единственное завершение.
- [x] 2.4 Описать публичные actions/snapshot и добавить тесты их сериализации для будущего remote (без восстановления active runtime после reload компьютера) без зависимости ядра от DOM/React.

## 3. Display and platform integration

- [ ] 3.1 Создать упрощённую настройку с основными полями режима, labels, пресетами, прямым вводом и компактным preview длительности; подготовка/звук доступны в дополнительных параметрах; browser tests покрывают invalid input, итог с подготовкой, Tabata/EMOM и разные поля AMRAP/For Time; проверить маску ММ:СС без ручного двоеточия, выделение/замену, Backspace, вставку и неполный ввод; вручную подтвердить цифровую клавиатуру Safari/iOS и Chrome/Android.
- [ ] 3.2 Реализовать экран из gym-display; проверить screenshots 1920×1080/1280×720, текст фаз, pause/completed, клавиатуру и 48 px controls; сохранить результаты визуального QA.
- [ ] 3.3 Реализовать audio unlock, загрузку звуков и дедупликацию сигналов; тесты переходов плюс ручная проверка mute/blocked autoplay на PC подтверждают единичные сигналы.
- [ ] 3.4 Реализовать fullscreen/Wake Lock с fallback, reduced motion и assistive announcements; browser tests/mock API и ручная проверка отказа не обнаруживают остановки таймера; обновить краткую инструкцию пользователя.
- [x] 3.5 Реализовать версионированные последние настройки без сохранения active snapshot; тесты storage blocked/corrupt и обычного/hard reload подтверждают idle и новую сессию компьютера.

- [x] 3.6 Реализовать самостоятельный mobile timer без QR; проверить 375×667/390×844 и landscape, отсутствие смены runtime при rotation/resize, локальный звук и потерю WAN. Главная всегда A — выбор режима, без карточки последней тренировки B.
- [x] 3.7 Добавить «О проекте» с автором SergeLyamin, репозиторием и местом публичной политики; проверить доступность и сохранение работающего отсчёта при открытии сведений/внешней ссылки. Не публиковать незаполненный draft.

## 4. Offline and lifecycle

- [x] 4.1 Реализовать versioned PWA shell/assets cache и проверку offline-ready; E2E после online preload закрывает/открывает приложение offline и запускает новую тренировку со звуком.
- [x] 4.2 Реализовать defer update для всех вкладок без удаления assets активной версии; двухвкладочный E2E подтверждает отсутствие reload/активации при running или неответившем client.
- [x] 4.3 Реализовать понятный offline status и инструкции о границах; E2E отключает сеть на 60 секунд, подтверждает переходы фаз и работу локальной паузы без fetch dependency.

## 5. Integration acceptance

- [x] 5.1 Выполнить полный type-check/build/unit/E2E на закреплённых версиях; записать команды и реальные результаты, не проценты «готовности».
- [ ] 5.2 Провести часовой foreground-прогон на PC+TV с независимым эталоном; записать модель, браузер, метод и отклонения ≤250 мс; проверить дальний ряд и слышимость.
- [x] 5.3 Проверить происхождение используемых шрифтов/звуков и устранить шаблонный остаток LICENSE перед распространением; результат — список assets/источников и корректный лицензионный файл.
- [x] 5.4 Сверить все сценарии трёх capability specs с проверками, обновить README/architecture/статус и выполнить npm run spec:validate.

## Workflow follow-up

- После реализации и проверки синхронизировать/архивировать change, сохранив evidence; не архивировать незавершённые задачи.
- Перейти к add-qr-remote-control. Production deployment оформить отдельным change под выбранный сервер.
