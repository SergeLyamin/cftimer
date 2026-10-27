# Spec Delta

## Purpose

Обеспечить проверяемое размещение QR relay рядом со статическим таймером, сохраняя безопасную границу прокси, управляемый процесс и возможность отката.

## ADDED Requirements

### Requirement: Keep relay private and managed
Relay SHALL слушать только loopback под отдельным пользователемtimer на Node24. Процесс SHALL иметь управляемый restart и ограниченные ресурсы/журналы. Браузер SHALL обращаться через same-origin HTTPS/WSS; серверные файлы и credentials MUST NOT находиться в публичномdist.

#### Scenario: Start the production service
- **WHEN** администратор устанавливает проверенный сервис
- **THEN** healthz доступен через proxy, внешний прямой порт не слушается, процесс можно перезапустить независимо от других сайтов

### Requirement: Trust only an explicit local proxy
По умолчанию relay MUST использовать socketIP. Opt-in SHALL доверять одному валидномуXFF только от loopbackpeer; proxy MUST перезаписывать XFF своим remote_addr. Внешний peer, malformed или multi-valueheader MUST NOT менять адрес источника лимитов.

#### Scenario: Attempt a forwarded address spoof
- **WHEN** прямой клиент присылает произвольныйXFF либо header содержит цепочку
- **THEN** источник остаётся socketIP; поведение комнат/прав и Origin-check не обходятся

### Requirement: Verify releases before switching
Публикация SHALL использовать зафиксированный commit, версию и SHA256 браузерного/relayартефакта. Старый релиз и hash-assets SHALL сохраняться. До переключения MUST пройти service/WSSsmoke; после — HTTPS/remote/PWAпроверки. Отсутствие доступа или работающегоproxy MUST оставлять прежний production.

#### Scenario: Missing server privileges
- **WHEN** runtime готов, но timer/proxy недоступны оператору
- **THEN** готовится проверяемый пакет и handoff, www не переключается и публикация не объявляется выполненной
