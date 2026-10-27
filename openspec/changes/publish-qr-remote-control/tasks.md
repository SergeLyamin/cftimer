# Tasks

## 1. Verified release preparation

- [x] 1.1 Зафиксировать явное разрешение публикации и inventory dev7/Node/proxy/www; разделить публикацию и открытый аппаратный пилот.
- [x] 1.2 Завершить применимые проверки на Node24, browser и remote; записать результаты и ограничения без ложной Safari/physical приёмки.
- [x] 1.3 Подготовить managed service и proxy boundary; tests отвергают untrusted/malformed XFF, config перезаписывает XFF только в доменном Nginxlocation.
- [x] 1.4 Зафиксировать source0.2.0 и собрать immutable static/relay пакеты с SHA256, Nodebinary и rollbackmanifest.

## 2. Server readiness

- [x] 2.1 Подtimer установить приватный runtime/release, проверить SHA256 и servicehealth без изменения www.
- [x] 2.2 Сохранить доменный custom-settings, установить локальный proxyinclude и unit, проверить nginx-t/systemd и активировать только relay/Nginxreload.
- [x] 2.3 Через реальныйHTTPS/WSS проверить version/origin/pairing/fence/commandACK и health до переключенияUI.

## 3. Publish and verify

- [x] 3.1 Сохранить текущий0.1.5 и прежние hash-assets, атомарно переключить www на проверенный0.2.0.
- [x] 3.2 Проверить SHA256/HTTPS/cache/404 и browserremote/PWA smoke после переключения; при ошибке откатить.
- [x] 3.3 Записать releasecommit/paths/checksums, фактический rollback и открытые ограничения, сохранить итоговую ветку.
