# Релиз 0.1.3 — проверка 26.10.2026

Владелец проверил desktop-итерации и явно поручил выполнить оставшиеся проверки и опубликовать версию. Последнее уточнение — countdown шкалы раундов начинается с правого сегмента. Исходники runtime: `ecb42f3`. Программные проверки и live smoke завершены; [timer.lyamin.org](https://timer.lyamin.org/) переключён на 0.1.3.

В релиз вошли [фазовый прогресс и форма](ui-phase-desktop-review-2026-10-26.md), [компактные действия, заголовки и шкала раундов](ui-compact-desktop-review-2026-10-26.md), конфетти и ввод до 99:99. Дополнительно цифры и обе полосы переключают паузу/продолжение. Три прозрачные native-button поверхности поддерживают мышь/касание/Enter/Space, сохраняют доступные показания времени/прогресса и не реагируют после завершения или сквозь диалог. При countdown первый сегмент справа, опустошение справа налево; count-up — слева направо.

## Программные проверки

- `npm run lint`, `npm run build` с typecheck, `npm test`: **80/80**, 6 файлов.
- Production preview Chromium: **24/24 E2E**. В первом прогоне 23 прошли, один тест ссылался на прежний ARIA-элемент; селектор исправлен, повтор этого сценария прошёл. Код приложения для этой коррекции не менялся.
- `npm run spec:validate`: **4/4**, strict. Формат спецификаций не доказывает runtime-корректность.
- Пять режимов, desktop/phone portrait/landscape: 1280×720, 390×844, 667×375, 844×390; responsive-снимки также 1920×1080 и 375×667. Проверены круги 40×40, заголовки, прямоугольные шкалы 50/20 px и 197 сегментов для 99 раундов без горизонтального overflow.
- Реальный набор/выделение/Backspace/вставка, пятая цифра без потери итога, секунды до 99, ограничения и ошибки; перезапуск, подтверждённый выход, хоткеи/fullscreen, pulse/reduced motion, конфетти/default/off/persistence/repeat.
- Новые click/touch/keyboard сценарии покрывают цифры, цветные и пустые области обеих полос, однократное переключение, заморозку времени/прогресса, prep/work/rest, отсутствие toggle сквозь диалог и после completed. Геометрия подтверждает первый countdown-сегмент справа и убывающий правый край.
- Warm offline reload/новый запуск, favicon/шрифт, активная вторая вкладка, обновление SW waiting до закрытия клиентов. Storage denial/corruption и Wake Lock fallback покрыты unit/mocks; это не физические устройства.

Дополнительно Firefox 157.0 прошёл smoke на 1280×800, 390×844 и 844×390: ввод/пятая цифра, click/Space/Enter, направление, круги 40 px, offline reload, без ошибок JavaScript. [Протокол Firefox](../output/playwright/cross013-firefox.json). WebKit 27.2 прошёл те же UI/keyboard/geometry сценарии. Его эмуляция setOffline(true) при SW-navigation выдаёт внутреннюю ошибку, соответствующую [Playwright #42775](https://github.com/microsoft/playwright/issues/42775); вместо неё остановлен только собственный preview-origin, обычный HTTP-запрос подтвердил недоступность сервера, WebKit успешно выполнил cached reload/новую тренировку/паузу и загрузку favicon/шрифта. [UI-протокол](../output/playwright/cross013-webkit.json), [offline-протокол](../output/playwright/cross013-webkit-origin-offline.json). Это программная проверка доступного движка, не реального iPhone. Установщик предупредил о frozen-сборке для macOS 14; актуальное устройство не подменяется этим результатом. После выравнивания ширины полос повторно прошли все 5 сценариев компоновки. [Smoke-функция](../output/playwright/cross-engine-0.1.3.js) проверяет ввод, клики/клавиши, направления, размеры и offline reload.

Снимки первоначального Chromium-прогона до финального выравнивания ширины полос (актуальная компоновка — на production-снимках ниже): [desktop](../output/playwright/v013-timer-desktop.png), [телефон](../output/playwright/v013-timer-mobile.png), [landscape](../output/playwright/v013-timer-landscape.png), [работа](../output/playwright/v013-work-pulse.png), [отдых](../output/playwright/v013-rest-pulse.png), [99 раундов](../output/playwright/v013-99-rounds.png).

## Публикация и ограничения

Опубликован архив только dist: 10 файлов, 187720 байт, SHA256 `f906b08900e61f515338a90c338e5bfc42f9333212fae396b0886aed5bb1b047`. Предыдущий production — `7bf4b91`; он сохранён для отката и старых вкладок. Каталог production — releases/ecb42f3; [HTTP-протокол](../output/playwright/release-http-0.1.3-2026-10-26.json) подтверждает SHA256 всех новых файлов, доступность 4 прежних assets и 404 отсутствующего JS.

[Live smoke](../output/playwright/release-browser-0.1.3-2026-10-26.json) проверил свежий клиент, правый countdown, click toggles, немедленный restart, offline reload/новую тренировку, сохранение preferences и favicon/шрифт; ошибок JavaScript нет. Прежний runtime `index-ClRRNzVg.js` работал, пока новый SW оставался waiting. После выхода только из тестовой тренировки и ухода клиента на about:blank установился `index-BC77AwsP.js`. Без skipWaiting или очистки пользовательских кэшей. [Процедура и откат](deployment.md#релиз-013--26102026).

Снимки production: [телефон](../output/playwright/live013-phone.png), [offline](../output/playwright/live013-offline.png), [ожидающее обновление](../output/playwright/live013-update-waiting.png), [обновлённая PWA](../output/playwright/live013-upgraded-pwa.png). У HTML/SW/assets сохраняется `Cache-Control: max-age=2592000`; мгновенное обновление всех установленных копий не обещается, настройка заголовков требует администратора хостинга.

Физические iPhone 13/Firefox/обычная вкладка, iOS/Android клавиатуры, звук и часовой прогон PC+TV остаются открытыми. Эмуляция браузера не закрывает эти задачи. Публикация статического локального таймера не означает допуск к пилоту; QR/relay/аккаунты не реализованы. Ограничение кэширования хостинга проверяется отдельно при выпуске.
