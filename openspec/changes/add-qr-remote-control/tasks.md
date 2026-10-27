# Tasks

Статус: реализация разрешена владельцем 27.10.2026 в изолированной ветке от проверенного локального кандидата 0.1.5. Новая UI-приёмка, аппаратные сценарии и публикация QR остаются отдельными gates. Подтверждено: свободный первый пульт; передача по согласию первого либо после 60 секунд без связи; reload только компьютера сбрасывает таймер.

## 0. Application foundation and reviewed contract

- [x] 0.1 Согласовать proposal/design/specs/tasks с принятым 27.10 планом: атомарные намерения, исходы неизвестных команд, fencing отзыва, лимиты и версия; npm run spec:validate проходит.
- [x] 0.2 Выделить документный DisplayRuntime с pure immutable snapshot и одним замером now на транзакцию; целевые deterministic tests проверяют phase boundary, stale, invalid state/config и атомарный restart/start.
- [x] 0.3 Перевести локальный UI на application contract без изменения одобренной композиции; desktop smoke подтверждает согласованные view/config при локальном/удалённом действии.
- [ ] 0.4 Создавать local/remote runtime до React по маршруту, без второго host при StrictMode/resize; desktop smoke проверяет /remote и fallback без storage.

## 1. Protocol and room isolation

- [x] 1.1 Зафиксировать versioned command/ACK/snapshot schema для start(config)/pause/resume/restart/edit/returnToMenu/repeat, controlEpoch, control revision и snapshot sequence; contract tests отклоняют неизвестные типы/invalid payload и проверяют config validation.
- [x] 1.2 Реализовать комнаты и server-issued host/controller полномочия; integration tests двух залов подтверждают изоляцию и отказ host impersonation.
- [x] 1.3 Реализовать host connection generation/fencing и независимость новой вкладки; integration test старого/нового transport допускает одного publisher/ACK source.
- [ ] 1.4 Реализовать TTL/cleanup/epoch и heartbeat/backoff; tests покрывают 120 с invite, 10 мин disconnected host, 8 ч session и рестарт relay без остановки локального timer-core; описать lifecycle протокола.

## 2. Pairing and authorization

- [ ] 2.1 Реализовать QR, одноразовое приглашение и свободное первое подключение; E2E проверяет автообновление QR, успешное, истёкшее и повторно использованное приглашение.
- [ ] 2.2 Реализовать один controller, запрос/согласие/отказ текущего пульта, grace 60 с и controlEpoch fencing; E2E двух/трёх телефонов проверяет 59/60 секунд, гонки, общий display ACK-gate acquisition, исчезновение владельца во время 20-секундного запроса, timeout при живом пульте и отказ старому credential.
- [ ] 2.3 Реализовать Origin allowlist, frame/payload limits, pairing/command rate limits и redaction секретов; integration tests проверяют malformed JSON, 16 KiB, неверный Origin и превышение pairing 5/min.

## 3. Reliable state and command delivery

- [x] 3.1 Подключить display action adapter с сериализацией, dedup до revision check и ACK после применения; тесты покрывают duplicate, stale, естественную смену фазы и local/remote race.
- [x] 3.2 Реализовать pending/accepted/rejected/unknown, result query, watermark и срок3с; целевые tests теряют ACK, восстанавливают pending без replay, отвергают ID с другим payload и просроченную новую команду.
- [x] 3.3 Реализовать snapshot ordering, clock-offset/RTT projection и reconnect без offline queue; тесты подтверждают отсутствие rollback при одинаковой control revision и меньшем sequence.
- [ ] 3.4 Проверить p95 расхождения времени телефона и экрана ≤250 мс при RTT≤100 мс в foreground; записать метод, устройства и реальные результаты отдельно от точности display timer.

## 4. Controller and display UX

- [x] 4.1 Создать отдельный пульт по /remote с подтверждённым временем, настройкой/start(config), pause/resume, restart/edit paused, подтверждённым returnToMenu и repeat; первичный desktop walkthrough проходит действия без ложного успеха до ACK.
- [ ] 4.2 Реализовать состояния pairing/approval/busy/expired/no connection/no display; E2E блокирует телефон и отключает сеть, экран продолжает, пульт восстанавливает актуальное состояние.
- [ ] 4.3 Добавить крупный desktop QR, раскрытие кнопкой QR в шапке слева от настроек, индикатор подключённого пульта и доступ во время занятия; проверить повторное раскрытие актуального QR, сохранение таймера/credential/ожидания при сворачивании и fallback без storage; проверить сканирование с 1–3 м на реальном оборудовании и отсутствие второго источника звука.
- [ ] 4.4 Обновить инструкции пользователю и privacy-safe diagnostics; ручной walkthrough отличает offline timer от offline remote и объясняет unknown ACK.

- [ ] 4.5 Проверить обычный/hard reload компьютера (idle/new session), reload текущего телефона (reconnect), reload отвергнутого/заменённого телефона (без обхода); E2E подтверждает все три ветки.
- [ ] 4.6 Реализовать опциональную вибрацию с тестовой кнопкой; ручной тест Android и fallback Safari подтверждают полноценное управление без haptics.

- [x] 4.7 Применить правки владельца 27.10 по remote-flow-v1: статус с точкой в шапке пульта, без номеров, QR в шапке общего экрана и мягкий фон; desktop walkthrough проверяет connected/waiting/disconnected, focus/Escape и доступность QR на home/setup/timer.

- [x] 4.8 Выполнить уточнения владельца: компактный header/status-menu, disconnect внутри меню, верхняя навигация и круг pause; общий экран preparation violet, digits+10%, track width/opacity, gaps3px, edge+10%; компактные capability-aware настройки. Desktop walkthrough проверяет управление, геометрию и opacity; повторное одобрение владельца остаётся в 5.0.

## 5. Integration acceptance

- [ ] 5.0 Предоставить владельцу новый desktop QR UI и получить явное UI approval; замечания возвращают на desktop review до расширенных проверок.
- [ ] 5.4 После нового UI approval проверить mobile375×667/390×844, responsive/landscape, cross-browser, regression, offline/PWA, несовместимые версии и reload; результаты записать отдельно от физических устройств.
- [ ] 5.5 Проверить потерянный fence ACK, отмену выдачи, release без кандидата и late command, controller/host generation, bounded resources и malformed messages; целевые model/integration tests сохраняют one-writer/monotonic-epoch/room-isolation.


- [ ] 5.1 Пройти через staging HTTPS/WSS proxy два зала, два телефона, рестарт relay и минутную потерю WAN; подтвердить, что ни один сценарий не останавливает локальную тренировку.
- [ ] 5.2 Провести 10 первых pairing-попыток: минимум 9 без помощи, медиана ≤20 с, p90 ≤40 с; записать проблемы и решения, не объявлять метрики достигнутыми без измерения.
- [ ] 5.3 Запустить type-check/build/unit/integration/E2E и npm run spec:validate; обновить документацию и карту «requirement → проверка» с результатами.

## 6. Session diagnostics

- [ ] 6.1 Реализовать ограниченные JSON-события, client offline queue, redaction и tools/report-usage.mjs + tools/trace-session.mjs; fixture/integration tests отличают incomplete от completed, дедуплицируют eventId и не содержат credentials; задокументировать запуск по SSH и retention.

## Workflow follow-up

- После выполнения и проверки синхронизировать/архивировать change.
- Подготовить отдельный deployment change и провести 20 занятий суммарно в 1–3 залах по docs/product.md.
