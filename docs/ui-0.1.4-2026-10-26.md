# AMRAP: защитная переделка отрисовки — 0.1.4

Владелец сообщил о серой полосе при AMRAP 09:36 и разрешил публикацию после правки/тестов. Версия 0.1.4 опубликована на [timer.lyamin.org](https://timer.lyamin.org/), runtime source `b1ad370`.

Исходный симптом **не воспроизведён** в чистых Chromium, Firefox и WebKit до изменения. Браузер/версия владельца не указаны, первоначальная причина не установлена. Выпущена защитная переделка отображения.

**Приёмка 27.10.2026:** владелец повторно проверил опубликованную версию и подтвердил: «сейчас проверил, все норм теперь». Пункт 12.4 закрыт по этой проверке; исправление симптома в среде владельца принято.

## Изменение

Полоса не сжимается во flex. Meter и заполнение явно привязаны к её границам; цветной участок меняет ширину, без scaleX и цепочки процентных высот. Для прозрачных click-кнопок отключена нативная отрисовка appearance. Математика, фазы, цвета, направления и click pause/resume сохранены.

## Проверки

- Lint, typecheck/build, **80 unit**, **30 E2E Chromium** — прошли.
- Новый `progress-visibility.spec.ts` проверяет реальную ненулевую площадь заполнения, высоту 50 px, цвет, долю ширины, прозрачность и hit-test overlay. AMRAP prep/09:36/пауза/продолжение проверены на 1920×1080, 1280×800, 390×844 и 844×390; смежные For Time и EMOM также покрыты.
- Firefox: **6/6** новых сценариев. Один сценарий повторён после ошибки временных trace-артефактов, вызванной параллельным запуском другого runner; повтор прошёл.
- Доступный WebKit 27.2: [матрица](../output/playwright/v014-webkit-matrix.json) и [снимок](../output/playwright/v014-webkit-amrap.png) production preview подтверждают AMRAP 09:36 ≈96% на четырёх размерах, высоту 50 px/красный цвет/прозрачную overlay; For Time ≈4% и EMOM ≈60%. Стандартный test runner не смог создать WebKit page (`PushAPIEnabled` отсутствует в frozen macOS 14 binary); проверка выполнена через работающий CLI-драйвер. Это ограничение окружения не выдаётся за падение приложения или успешный прогон runner.
- OpenSpec strict validation — **4/4**. Физические устройства/PC+TV и исходный браузер владельца остаются непроверенными.

Снимки новой регрессии: [Chromium desktop](../output/playwright/v014-amrap-24s-chromium-1920x1080.png), [Chromium phone](../output/playwright/v014-amrap-24s-chromium-390x844.png), [Firefox desktop](../output/playwright/v014-amrap-24s-firefox-1920x1080.png), [Firefox phone](../output/playwright/v014-amrap-24s-firefox-390x844.png).

## Публикация

Архив только dist: 10 файлов, 187515 байт, SHA256 `3534c1984fa4d4fdfa1ae8a455b5b2c3462d0375627eff4a0cabd0fdbd5bfe4f`. Production — releases/b1ad370, предыдущий ecb42f3 и все его hash-assets сохранены.

[HTTP-протокол](../output/playwright/release-http-0.1.4-2026-10-26.json): SHA256 всех новых файлов совпадают, прежние JS/CSS доступны, отсутствующий JS — 404. [Live smoke](../output/playwright/release-browser-0.1.4-2026-10-26.json) подтвердил AMRAP 09:36 с красным ≈96% заполнением/50 px, click pause, offline reload/preferences/assets, waiting нового SW при старой работающей тренировке и обновление после ухода тестового клиента. Ошибок JavaScript нет.

Снимки production: [AMRAP](../output/playwright/live014-amrap.png), [телефон](../output/playwright/live014-amrap-phone.png), [обновлённая PWA](../output/playwright/live014-upgraded-pwa.png). Процедура и откат — [deployment](deployment.md#релиз-014--26102026). Cache-Control хостинга max-age=2592000 сохраняется; мгновенное обновление всех установленных копий не гарантировано.
