# Визуальная правка локального таймера — 23.10.2026

Выполнены замечания владельца к локальному UI. Это продолжение change `bootstrap-timer-pilot`, раздел 6; общая приёмка пилота остаётся открытой. Требования и решения — в [UX](ux.md) и [gym-display](../openspec/changes/bootstrap-timer-pilot/specs/gym-display/spec.md).

## Результат

Узкая жирная типографика Oswald для времени и заголовков, чёрный фон и контурные элементы приближают интерфейс к [концептам](../design/concepts/). Шрифт поставляется локально; [источник и лицензия](assets.md) проверены. Авторские SVG заменяют системные символы и номера карточек.

На подготовке, во время работы, паузы и результата нет бренд-шапки. Центральное поле отдано цифрам; убраны подписи «Держите свой темп» и дублирующее сообщение о завершении. Действия по умолчанию чёрные с белой рамкой, красные при наведении мышью; pause/play/stop/repeat дополнены иконками. Возврат — стрелка у названия; активный выход подтверждается, завершённый — свободный. Reset также возвращает к выбору режимов после подтверждения.

Звук — доступная кнопка динамика перед fullscreen; mute показан приглушённым перечёркнутым динамиком. «О проекте» закрывается нейтральным ×, Escape и фоном. Сохраняются отсчёт, ограничение Tab внутри окна и возврат фокуса на i.

Tabata/EMOM сохранены парой внизу меню, с теми же размерами названий и иконок, что у основных режимов. Для Tabata выбран секундомер с делениями, для EMOM — циферблат с круговой стрелкой. Семантика пресетов не менялась. Параметры работающего таймера, ядро и платформа времени не изменены.

## Проверки и доказательства

- `npm run build`: typecheck приложения/SW и production build прошли; precache включает шрифт и его лицензию. Осталось предупреждение инструмента PWA об устаревшем `inlineDynamicImports`; сборка успешна.
- `npm run lint`: без ошибок и предупреждений.
- `npm test`: 32/32.
- `npm run test:e2e`: 7/7 Chromium на финальных JS/CSS. Проверены прежние pause/resume/reset/finish/repeat, reload, offline и обновление SW между вкладками.
- `npm run spec:validate`: 3/3, strict. Это проверка документов, не runtime.
- Дополнительный браузерный прогон проверил размеры главной на 1920×1080, 1280×720, 390×844, 375×667; работающего таймера также на 844×390, 667×375 и 320×568. У цифр и управления нет обрезки или прокрутки, targets кнопок ≥48 px. У пресетов равные с основными режимами размеры названий/иконок. Проверены нейтральная заливка и красный hover.
- Проверены Tabata 8×20/10 с итогом 04:00, EMOM 10 минутных раундов, звук (имя/состояние/место), отмена и подтверждение выхода, пауза, продолжение, завершение, повтор. Для About проверены внутренний клик, ×, backdrop, Escape, прямой/обратный Tab, восстановление фокуса и непрерывный отсчёт; Space внутри окна не включает глобальную паузу.
- Production preview: наличие Oswald в версионированном Workbox cache, offline reload, загрузка нового FontFace и чтение всех 172088 байт шрифта без сети, затем запуск AMRAP с SVG. Первая попытка проверки искала cache key без revision; проверочный скрипт исправлен на `ignoreSearch`, дефекта precache не обнаружено.

| Состояние | Снимки |
| --- | --- |
| Главная | [1920](../output/playwright/refine-home-1920.png), [1280](../output/playwright/refine-home-1280.png), [390](../output/playwright/refine-home-390.png), [375](../output/playwright/refine-home-375.png) |
| Настройка | [Desktop](../output/playwright/refine-setup-desktop.png), [телефон](../output/playwright/refine-setup-mobile.png) |
| Подготовка | [Телефон](../output/playwright/refine-preparation-mobile.png) |
| Работа | [1920×1080](../output/playwright/refine-work-1920x1080.png), [1280×720](../output/playwright/refine-work-1280x720.png), [390×844](../output/playwright/refine-work-390x844.png), [375×667](../output/playwright/refine-work-375x667.png), [844×390](../output/playwright/refine-work-844x390.png), [667×375](../output/playwright/refine-work-667x375.png), [320×568](../output/playwright/refine-work-320x568.png) |
| Пауза | [Desktop](../output/playwright/refine-paused-desktop.png), [portrait](../output/playwright/refine-paused-390x844.png), [landscape](../output/playwright/refine-paused-844x390.png) |
| Результат | [Desktop](../output/playwright/refine-completed-desktop.png), [portrait](../output/playwright/refine-completed-390x844.png), [landscape](../output/playwright/refine-completed-844x390.png) |
| Диалог / offline | [О проекте](../output/playwright/refine-about.png), [локальный шрифт без сети](../output/playwright/refine-offline-font.png) |

Дополнительные сценарии сохранены как артефакты [UI-проверки](../output/playwright/refinement-check.js) и [проверки offline-шрифта](../output/playwright/refinement-offline-check.js). Это функции для Playwright CLI `run-code --filename=...`, не новые тесты ядра. UI-сценарий ожидает dev на 43872; offline-сценарий — страницу production preview на 43873. Прогонять в отдельной тестовой browser session: UI-сценарий очищает её localStorage и использует виртуальные часы. Снимки просмотрены визуально; адаптивный дефект, выталкивавший нижнюю подсказку из невысокого окна, исправлен до финального прогона.

## Границы приёмки

Браузерная эмуляция размеров не заменяет реальные Safari/iOS, Chrome/Android, телевизор, аппаратные разрешения fullscreen/Wake Lock, слышимость и часовой прогон с эталоном. Ранние незакрытые задачи полной приёмки остаются открытыми. Change не синхронизирован и не архивирован; QR-пульт не реализован. Эта работа меняет только локальный интерфейс. После принятия владельцем публикация выполнена отдельным change publish-local-timer-ui; [результат и откат](deployment.md#выполненный-деплой-23102026).

Для просмотра текущих исходников — `npm run dev -- --port 43872 --strictPort`. В уже открытом PWA новая версия может ждать закрытия всех старых вкладок: не обновлять работающую тренировку ради просмотра дизайна.
