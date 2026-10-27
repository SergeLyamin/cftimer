# Релиз 0.1.5 — проверки и публикация 27.10.2026

Владелец просмотрел локальный desktop и подтвердил: **«все нравится. Продолжай»**. После программных проверок владелец отдельно разрешил публикацию ответом **«да»**. **0.1.5 опубликована** на https://timer.lyamin.org/.

Runtime source: `d7734a5de0b16ae641afb3fc707555c9c725def6`. Изменения и первичный desktop review: [отчёт](ui-desktop-review-2026-10-27.md). [Машинный протокол](../output/playwright/acceptance-0.1.5-2026-10-27.json).

## Проверки

- **Lint, typecheck/build, 80 unit-тестов в 6 файлах** прошли. Стандартное предупреждение сборщика PWA об устаревающем `inlineDynamicImports` не препятствует сборке.
- **33 Chromium E2E**, 54.8 с: пять режимов и адаптивная компоновка, ввод/вставка/лимиты, пауза по трём поверхностям, горячие клавиши/fullscreen, редактирование и новый старт, фазы/пульсация/99 раундов, настройки/reduced motion, осевшее конфетти и повтор, непрерывность при демо, offline/reload и отложенное обновление PWA. Ожидания обновлены под одобренный UI; старые снимки v013/v014 сохранены.
- **Firefox 157.0 и WebKit 27.2**, каждый — пять режимов × три размера **1280×800, 390×844, 844×390**. Подтверждены 56/40 px, зазоры 28 px, отсутствие горизонтального переполнения и перекрытия управления, шкала 3 px справа налево, пустой разделитель времени, редактирование/старт с подготовкой. На телефоном размере проверены финал без полос, оседание конфетти и демо настроек. Ошибок JavaScript нет.
- Firefox проверял готовую **0.1.5**. WebKit-матрица прошла на сборке того же одобренного UI до смены номера **0.1.4→0.1.5**; затем реально проверено обновление на новый JS-bundle 0.1.5: старая тренировка сохраняет паузу при waiting, после ухода последнего клиента активируется новый код. Никакого принудительного skipWaiting/reload.
- Firefox: отключение сети через контекст браузера, reload, CF favicon/шрифт, сохранённая конфигурация, редактирование и новый старт работают offline.
- WebKit 0.1.5: собственный preview-origin остановлен, контрольный HTTP-запрос вернул 000; из PWA-кэша прошли reload, favicon/шрифт, настройка/редактирование/старт. Эмуляция `setOffline` не использовалась из-за ранее документированного ограничения окружения. Это проверка недоступного origin, не физического отключения WAN устройства.
- OpenSpec strict: **4/4**. Bootstrap остаётся открытым: физические iPhone 13/Firefox, клавиатуры iOS/Android, слышимость и длительный PC+TV-прогон здесь не проверены. Успех браузерных эмуляций их не заменяет.

Снимки: [Chromium телефон](../output/playwright/ui27-regression-timer-mobile.png), [Chromium landscape](../output/playwright/ui27-regression-timer-landscape.png), [Firefox телефон](../output/playwright/accept27-firefox-intervals-390.png), [WebKit landscape](../output/playwright/accept27-webkit-intervals-844.png), [финал WebKit](../output/playwright/accept27-webkit-completed-phone.png), [настройки Firefox](../output/playwright/accept27-firefox-settings-phone.png), [обновлённый WebKit](../output/playwright/accept27-webkit-upgraded.png), [WebKit offline](../output/playwright/accept27-webkit-offline.png).

## Артефакт и публикация

[Manifest с SHA256 всех файлов](../output/playwright/release-candidate-0.1.5-2026-10-27.json): 10 файлов dist, 11 precache entries. Локальный tar.gz — **188194 байта**, SHA256 `6989300b28fc8f66c92204652cbd732de39557b27991d4c00abeb44ac30b1e82`. Архив сохранён в `/private/tmp/cftimer-0.1.5-d7734a5/`; проверенная копия передана на сервер и сохранена в `backups/release-d7734a5/`.

`www` атомарно переключён с `releases/b1ad370` на `releases/d7734a5`; предыдущий каталог и все его hash-assets сохранены. [HTTPS-протокол](../output/playwright/release-http-0.1.5-2026-10-27.json): **14/14**, новые файлы совпадают по SHA256, прежние JS/CSS доступны, отсутствующий JS404. [Live smoke](../output/playwright/release-browser-0.1.5-2026-10-27.json) подтвердил новый UI, финал/конфетти, offline и обновление активного клиента0.1.4 без прерывания.

Production-снимки: [пауза](../output/playwright/live015-paused-phone.png), [финал](../output/playwright/live015-completed-phone.png), [offline](../output/playwright/live015-offline-phone.png), [ожидание обновления](../output/playwright/live015-update-waiting.png), [обновлённая PWA](../output/playwright/live015-upgraded-pwa.png). Процедура и [откат](deployment.md#релиз-015--27102026) записаны. Ограничения кэширования хостинга сохраняются.
