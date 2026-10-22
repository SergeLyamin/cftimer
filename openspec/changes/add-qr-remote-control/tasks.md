# Tasks

Статус: план реализации, все задачи ещё не выполнены. Зависит от проверенного bootstrap-timer-pilot. Подтверждено: свободный первый пульт; передача по согласию первого либо после 60 секунд без связи; reload только компьютера сбрасывает таймер.

## 1. Protocol and room isolation

- [ ] 1.1 Зафиксировать versioned command/ACK/snapshot schema для configure/start/pause/resume/finish/reset, controlEpoch, control revision и snapshot sequence; contract tests отклоняют неизвестные типы/invalid payload и проверяют config validation.
- [ ] 1.2 Реализовать комнаты и server-issued host/controller полномочия; integration tests двух залов подтверждают изоляцию и отказ host impersonation.
- [ ] 1.3 Реализовать host connection generation/fencing и независимость новой вкладки; integration test старого/нового transport допускает одного publisher/ACK source.
- [ ] 1.4 Реализовать TTL/cleanup/epoch и heartbeat/backoff; tests покрывают 120 с invite, 10 мин disconnected host, 8 ч session и рестарт relay без остановки локального timer-core; описать lifecycle протокола.

## 2. Pairing and authorization

- [ ] 2.1 Реализовать QR, одноразовое приглашение и свободное первое подключение; E2E проверяет автообновление QR, успешное, истёкшее и повторно использованное приглашение.
- [ ] 2.2 Реализовать один controller, запрос/согласие/отказ текущего пульта, grace 60 с и controlEpoch fencing; E2E двух/трёх телефонов проверяет 59/60 секунд, гонки, общий display ACK-gate acquisition, исчезновение владельца во время 20-секундного запроса, timeout при живом пульте и отказ старому credential.
- [ ] 2.3 Реализовать Origin allowlist, frame/payload limits, pairing/command rate limits и redaction секретов; integration tests проверяют malformed JSON, 16 KiB, неверный Origin и превышение pairing 5/min.

## 3. Reliable state and command delivery

- [ ] 3.1 Подключить display action adapter с сериализацией, dedup до revision check и ACK после применения; тесты покрывают duplicate, stale, естественную смену фазы и local/remote race.
- [ ] 3.2 Реализовать pending/accepted/rejected/unknown; E2E теряет ACK, получает snapshot и повторяет commandId без повторного действия.
- [ ] 3.3 Реализовать snapshot ordering, clock-offset/RTT projection и reconnect без offline queue; тесты подтверждают отсутствие rollback при одинаковой control revision и меньшем sequence.
- [ ] 3.4 Проверить p95 расхождения времени телефона и экрана ≤250 мс при RTT≤100 мс в foreground; записать метод, устройства и реальные результаты отдельно от точности display timer.

## 4. Controller and display UX

- [ ] 4.1 Создать отдельный пульт только по явному pairing route, с именем экрана, подтверждённым временем, настройкой до старта, pause/resume и защищёнными finish/reset; E2E проходит основной UX-путь, screenshot QA проверяет mobile 375×667 и 390×844.
- [ ] 4.2 Реализовать состояния pairing/approval/busy/expired/no connection/no display; E2E блокирует телефон и отключает сеть, экран продолжает, пульт восстанавливает актуальное состояние.
- [ ] 4.3 Добавить крупный desktop QR, сворачивание до «Пульт» с локальным предпочтением и доступ во время занятия; проверить повторное раскрытие актуального QR, сохранение таймера/credential/ожидания при сворачивании и fallback без storage; проверить сканирование с 1–3 м на реальном оборудовании и отсутствие второго источника звука.
- [ ] 4.4 Обновить инструкции пользователю и privacy-safe diagnostics; ручной walkthrough отличает offline timer от offline remote и объясняет unknown ACK.

- [ ] 4.5 Проверить обычный/hard reload компьютера (idle/new session), reload текущего телефона (reconnect), reload отвергнутого/заменённого телефона (без обхода); E2E подтверждает все три ветки.
- [ ] 4.6 Реализовать опциональную вибрацию с тестовой кнопкой; ручной тест Android и fallback Safari подтверждают полноценное управление без haptics.

## 5. Integration acceptance

- [ ] 5.1 Пройти через staging HTTPS/WSS proxy два зала, два телефона, рестарт relay и минутную потерю WAN; подтвердить, что ни один сценарий не останавливает локальную тренировку.
- [ ] 5.2 Провести 10 первых pairing-попыток: минимум 9 без помощи, медиана ≤20 с, p90 ≤40 с; записать проблемы и решения, не объявлять метрики достигнутыми без измерения.
- [ ] 5.3 Запустить type-check/build/unit/integration/E2E и npm run spec:validate; обновить документацию и карту «requirement → проверка» с результатами.

## 6. Session diagnostics

- [ ] 6.1 Реализовать ограниченные JSON-события, client offline queue, redaction и tools/report-usage.mjs + tools/trace-session.mjs; fixture/integration tests отличают incomplete от completed, дедуплицируют eventId и не содержат credentials; задокументировать запуск по SSH и retention.

## Workflow follow-up

- После выполнения и проверки синхронизировать/архивировать change.
- Подготовить отдельный deployment change и провести 20 занятий суммарно в 1–3 залах по docs/product.md.
