# QR-релиз 0.2.0 — 27.10.2026

Владелец вручную просмотрел desktop/пульт, уточнил интерфейс и явно поручил «готовь и деплой на прод». Это разрешение относится к текущей версии; повторного разрешения для её переключения не требуется. Исходная ветка `feat/qr-remote-control`; production до переключения — 0.1.5, `www -> releases/d7734a5`.

## Приёмка перед публикацией

- Полный ESLint прошёл. На Node 24.22.1 полный Vitest: 143/143, 11 файлов, включая строгий Origin/path, invalid frames, trusted-loopback source, комнаты/эпохи/recovery и детерминированную логику таймера.
- Chromium: 35 различных E2E-сценариев прошли суммарно (34 в полном прогоне; один тест программного выделения текста исправлен после гонки с animation frame и затем прошёл3/3 повторов). Проверки включают все режимы, mobile/landscape, readout, offline/reload/update и маршрут/роль пульта. Устаревшие ожидания цвета/порядка HTML-атрибутов приведены к принятому интерфейсу; утверждения о поведении не ослаблялись.
- Независимая приёмка Chromium156/Firefox157: два зала, first join, reload телефона без сброса экрана, deny/accept, fencing прежнего владельца, reconnect, ожидание60с, reload дисплея и mobile/touch. Подробности и пределы — [browser evidence](qr-release-0.2.0-browser-evidence.txt).
- Найден неточный busy-текст после cooldown30с; исправлен на «Запрос сейчас недоступен. Попробуйте чуть позже», без изменения авторизации.
- WebKit runner несовместим с установленным браузером: `Page.overrideSetting: Unknown setting: PushAPIEnabled`. Safari этим прогоном не проверен. Реальные iOS/Android, PC+TV/звук/часовой прогон остаются открытыми; браузерная эмуляция их не заменяет.

## Сервер и готовый способ выпуска

Под timer проверены существующий www, каталог сайта и Node 18.19.0; предоставленная владельцем авторизация позволяет sudo. Пароль не записывается в файлы/документацию. СерверLinuxx86_64/glibc2.36 подходит для отдельного Node 24.22.1; системныйNode и существующийPM2 не заменяются.

Nginx vhost сгенерирован NetAngels и остаётся нетронутым. Он включает отдельный доменный `/etc/nginx/custom-settings.d/timer.lyamin.org.conf`: туда добавляется include подготовленного QR-snippet, с backup. www-data входит в группуtimer и может читать текущий index. Прокси идёт напрямую Nginx→loopback, Apacheproxy не требуется.

- [Сервис](../deploy/cf-timer-relay.service): отдельный cf-timer-relay, пользовательtimer, loopback43980, Node 24, bounded memory/log rate, restart-on-failure.
- [Nginx-snippet](../deploy/nginx-qr-locations.conf): same-originWSS, health, точные HTML/SW/manifest revalidation и immutableassets, remote route и заголовки безопасности. XFF перезаписывается; relay принимает одиночный адрес только от явно доверенного loopback proxy.
- `npm run release:package`: immutable static/relay tar.gz с пофайловыми SHA256 и release.json из чистого коммита. Relay/ws внеwww, remote/index.html включён в static. Серверу не нужен npm install.
- Официальный Node 24.22.1linux-x64: SHA256 `6c172a9ab6718f7b801fb5a7bd486af2ee5e32758086a04b84fcce2aa77095e6`, архив32026916байт; runtime-check выполняется на той же24.22.1darwin-arm64.

## Последовательность переключения

1. Сохранить прежние www/конфигурацию/units; передать immutableпакеты и проверить каждый SHA256.
2. Приватно установить Node 24/relay, активировать отдельный service. Выполнить nginx-t, затем reload Nginx; проверить health и реальныйWSS с фактическими клиентскими runtime до переключенияwww.
3. Сохранить прежние hash-assets в новом staticрелизе; атомарно заменить только www symlink.
4. Проверить HTTPS/файлы/cache/404, свежий браузер и remoteACK, локальныйoffline и старыйSW без прерывания активной тестовой тренировки. При сбое вернуть прежний www; proxy/unit при необходимости восстанавливаются изbackup, остальные сервисы не меняются.
5. Записать фактические пути/commit/checksums/results ниже. Публикация не объявляется выполненной заранее.

Полная продуктовая диагностика/offline eventqueue/CLI, метрики pairing/рассинхронизации и аппаратный пилот остаются задачами исходных changes. Этот релиз не закрывает их автоматически.

Локальный release-smoke на Node 24.22.1 прошёл 8/8: health/чужойOrigin, две комнаты, first join, start/pause/resume ACK и phone reload без сброса. Проверка использует реальные DisplayRuntime/DisplayBridge/ControllerRuntime через WebSocket; скрипт `tools/smoke-relay.mjs` повторяется через productionWSS до переключения.

## Выполненная публикация

Опубликован runtime `cb1f2e0a6f364a82de62509051a1bc7a568fff14`, версия 0.2.0. Браузер: `index-CR95gO2v.js`, `index-CO8G2hjU.css`.

- Статика: `/home/timer/timer.lyamin.org/releases/cb1f2e0`; `www -> releases/cb1f2e0` переключён атомарно после WSS-проверки. Прежний `releases/d7734a5` не удалён; его hash-assets добавлены в новыйassets без замены новых файлов.
- Relay: `/home/timer/timer.lyamin.org/relay/releases/cb1f2e0`, `relay/current -> releases/cb1f2e0`. Node 24.22.1 установлен отдельно в `/home/timer/.local/lib/node-v24.22.1-linux-x64`, `.local/node24` — ссылка; системныйNode 18/PM2 не изменялись.
- `cf-timer-relay.service` enabled/active/running, bind только127.0.0.1:43980, Restart=on-failure, NRestarts=0; наблюдаемая память около49MiB. MemoryMax 256M, TasksMax 64, LogRateLimit 100/30 с; это не утверждение о реализации предлагаемого продуктового retention14дней/1GiB.
- NetAngels-generated vhost не менялся. В доменныйcustom-settings добавлен include `/etc/nginx/snippets/cf-timer-qr.conf`. Синтаксис unit/Nginx проверен, Nginx reload прошёл. Existingwarnings конфликтующихserver_name других сайтов записаны как прежние и не исправлялись; Apache/чужиепроцессы не менялись.
- Архивstatic SHA256 `80d893d1be4871e648d94f1eb88a17c8f82136bda2d0ac29389f893caf116a54`; relay SHA256 `90fdcae628efd3c9ea0445eecba5761e973222d0a64f7c713c93741014408dfa`. Оба архива, release.json с пофайловымиSHA256, SHA256SUMS, прежний www, архив Node и backupcustom-settings находятся внеwww в `backups/release-cb1f2e0/`.
- На сервере сверены12 статических и22 приватных файла. До переключения реальныйWSS smoke прошёл 8/8 за 4.855 с: health, чужойOrigin403, два зала, first join, start/pause/resumeACK и reloadпульта без сброса дисплея. Это smoke, не измерение p95 точности времени.
- После переключения12/12 HTTPSSHA256 совпали, старыйJS0.1.5 доступен200, отсутствующийJS404. Root/index/sw/manifest/remoteHTML имеют no-cache; hash-assets — public,max-age31536000,immutable. Прямой `/remote/index.html` отдельно исправлен на no-cache; manifest имеет application/manifest+json. Health200/no-store, CSP не мешает работе приложения.
- Fresh browser smoke прошёл: QR, все прикладные команды с ACK, подтверждение меню, offline-пультdisabled, standalone cached offline/reload с сохранениемAMRAP00:30 иopacity37%. ОшибокJS/CSP нет.
- Установленная0.1.5 продолжала нашу тестовую AMRAP при waitingновогоSW. После завершения только тестовой тренировки и перехода черезabout:blank новая0.2.0 активировалась безskipWaiting/unregister/cacheclear; чужиезанятия не затрагивались.

Доказательства: [HTTPS/SHA256](../output/releases/qr-0.2.0-http.json), [WSS до переключения](../output/releases/qr-0.2.0-wss-before-switch.json), [live browser](../output/releases/qr-0.2.0-browser.txt), [обновлениеPWA](../output/releases/qr-0.2.0-pwa-update.json), [пульт](../output/playwright/qr-live-0.2.0-phone.png), [экран](../output/playwright/qr-live-0.2.0-display.png). Ограничения Safari/реальных устройств и открытых задач выше остаются в силе.

## Откат

Откат не выполнялся: выпуск прошёл live-проверки. Под timer для возврата статической0.1.5 с сохранением новых hash-assets:

```sh
cd /home/timer/timer.lyamin.org
test "$(readlink www)" = releases/cb1f2e0
cp -an releases/cb1f2e0/assets/. releases/d7734a5/assets/
ln -s releases/d7734a5 www-rollback-cb1f2e0
mv -Tf www-rollback-cb1f2e0 www
readlink -f www
```

Relay можно оставить для уже открытых новых клиентов; при необходимости остановить только `sudo systemctl disable --now cf-timer-relay`. Полный откат proxy: восстановить `/etc/nginx/custom-settings.d/timer.lyamin.org.conf` из `backups/release-cb1f2e0/nginx-custom-before.conf`, выполнить `sudo nginx -t` и `sudo systemctl reload nginx`. Сохранить все каталоги/архивы; не удалять новые assets и не очищать кэши пользователей. Уже установленныеPWA обновляются отдельно между занятиями; symlink не даёт мгновенного отката всех клиентов.
