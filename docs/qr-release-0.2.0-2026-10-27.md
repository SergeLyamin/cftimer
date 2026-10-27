# QR-релиз 0.2.0 — 27.10.2026

Владелец вручную просмотрел desktop/пульт, уточнил интерфейс и явно поручил «готовь и деплой на прод». Это разрешение относится к текущей версии; повторного разрешения для её переключения не требуется. Исходная ветка `feat/qr-remote-control`; production до переключения — 0.1.5, `www -> releases/d7734a5`.

## Приёмка перед публикацией

- Полный ESLint прошёл. На Node24.22.1 полный Vitest: 143/143, 11 файлов, включая строгий Origin/path, invalid frames, trusted-loopback source, комнаты/эпохи/recovery и детерминированную логику таймера.
- Chromium: 35 различных E2E-сценариев прошли суммарно (34 в полном прогоне; один тест программного выделения текста исправлен после гонки с animation frame и затем прошёл3/3 повторов). Проверки включают все режимы, mobile/landscape, readout, offline/reload/update и маршрут/роль пульта. Устаревшие ожидания цвета/порядка HTML-атрибутов приведены к принятому интерфейсу; утверждения о поведении не ослаблялись.
- Независимая приёмка Chromium156/Firefox157: два зала, firstjoin, reload телефона без сброса экрана, deny/accept, fencing прежнего владельца, reconnect, ожидание60с, reload дисплея и mobile/touch. Подробности и пределы — [browser evidence](qr-release-0.2.0-browser-evidence.txt).
- Найден неточный busy-текст после cooldown30с; исправлен на «Запрос сейчас недоступен. Попробуйте чуть позже», без изменения авторизации.
- WebKit runner несовместим с установленным браузером: `Page.overrideSetting: Unknown setting: PushAPIEnabled`. Safari этим прогоном не проверен. Реальные iOS/Android, PC+TV/звук/часовой прогон остаются открытыми; браузерная эмуляция их не заменяет.

## Сервер и готовый способ выпуска

Подtimer проверены существующий www, каталог сайта и Node18.19.0; предоставленная владельцем авторизация позволяет sudo. Пароль не записывается в файлы/документацию. СерверLinuxx86_64/glibc2.36 подходит для отдельного Node24.22.1; системныйNode и существующийPM2 не заменяются.

Nginxvhost сгенерирован NetAngels и остаётся нетронутым. Он включает отдельный доменный `/etc/nginx/custom-settings.d/timer.lyamin.org.conf`: туда добавляется include подготовленного QR-snippet, с backup. www-data входит в группуtimer и может читать текущий index. Прокси идёт напрямую Nginx→loopback, Apacheproxy не требуется.

- [Сервис](../deploy/cf-timer-relay.service): отдельный cf-timer-relay, пользовательtimer, loopback43980, Node24, bounded memory/log rate, restart-on-failure.
- [Nginx-snippet](../deploy/nginx-qr-locations.conf): same-originWSS, health, точные HTML/SW/manifest revalidation и immutableassets, remote route и заголовки безопасности. XFF перезаписывается; relay принимает одиночный адрес только от явно доверенного loopback proxy.
- `npm run release:package`: immutable static/relay tar.gz с пофайловыми SHA256 и release.json из чистого коммита. Relay/ws внеwww, remote/index.html включён в static. Серверу не нужен npm install.
- Официальный Node24.22.1linux-x64: SHA256 `6c172a9ab6718f7b801fb5a7bd486af2ee5e32758086a04b84fcce2aa77095e6`, архив32026916байт; runtime-check выполняется на той же24.22.1darwin-arm64.

## Последовательность переключения

1. Сохранить прежние www/конфигурацию/units; передать immutableпакеты и проверить каждый SHA256.
2. Приватно установить Node24/relay, активировать отдельный service. Выполнить nginx-t, затем reload Nginx; проверить health и реальныйWSS с фактическими клиентскими runtime до переключенияwww.
3. Сохранить прежние hash-assets в новом staticрелизе; атомарно заменить только www symlink.
4. Проверить HTTPS/файлы/cache/404, свежий браузер и remoteACK, локальныйoffline и старыйSW без прерывания активной тестовой тренировки. При сбое вернуть прежнийwww; proxy/unit при необходимости восстанавливаются изbackup, остальные сервисы не меняются.
5. Записать фактические пути/commit/checksums/results ниже. Публикация не объявляется выполненной заранее.

Полная продуктовая диагностика/offline eventqueue/CLI, метрики pairing/рассинхронизации и аппаратный пилот остаются задачами исходных changes. Этот релиз не закрывает их автоматически.

Локальный release-smoke на Node24.22.1 прошёл8/8: health/чужойOrigin, две комнаты, firstjoin, start/pause/resume ACK и phone reload без сброса. Проверка использует реальные DisplayRuntime/DisplayBridge/ControllerRuntime через WebSocket; скрипт `tools/smoke-relay.mjs` повторяется через productionWSS до переключения.
