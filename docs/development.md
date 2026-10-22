# Работа над проектом

## Установка инструментов

Локальный runtime реализован. Рекомендуется Node 24 LTS (.nvmrc и CI); совместимый минимум приложения — Node 22.12. Локальный прогон выполнен на Node 22.23.2. Фактические версии зависимостей закреплены без диапазонов в package.json и lock-файле.

```bash
npm ci
npm run dev
# Производственная сборка и локальный просмотр (включает PWA):
npm run build
npm run preview -- --port 43870 --strictPort
# Проверки:
npm run lint
npm test
npm run test:e2e
npm ci --prefix tooling/openspec --ignore-scripts
npm run spec -- --version
npm run spec:list
npm run spec:validate
```

OpenSpec 1.14.3 закреплён отдельно от зависимостей приложения. Повторяемая установка tooling проверена; `ignore-scripts` не нужен автоматически для будущих runtime-зависимостей — их install requirements проверяются отдельно.

## Один change за раз

1. Прочитать README, `openspec/config.yaml` и целевой change. Архив открывать адресно.
2. Проверить предложение и незакрытые вопросы. Изменившийся scope сначала отразить в spec/design/tasks.
3. Реализовать один законченный сценарий с подходящими проверками, не генерировать сразу весь большой продукт.
4. Отмечать task только после фактического завершения; сохранять команду и результат проверки в change.
5. Выполнить build/typecheck и нужные unit/E2E, проверить документацию и OpenSpec.
6. После реализации и проверки синхронизировать/архивировать change, получив действующий baseline. До этого не использовать `archive --skip-specs` или forced archive для создания вида завершённости.

```bash
npm run spec -- status --change bootstrap-timer-pilot
npm run spec -- instructions apply --change bootstrap-timer-pilot
npm run spec:validate
# Только после реализации и проверки:
# npm run spec -- archive bootstrap-timer-pilot
```

`status` сообщает о наличии артефактов; четыре готовых документа не означают готовность приложения. Устанавливать новые пакеты с lock-файлом и проверенными совместимыми версиями.

## Codex

Официальные навыки установлены в `.agents/skills/`: `$openspec-explore`, `$openspec-propose`, `$openspec-apply-change`, `$openspec-update-change`, `$openspec-sync-specs`, `$openspec-archive-change`.

В командах skills `openspec ...` заменять на `npm run spec -- ...` из корня. Не нужна глобальная установка. Генерируемые skills обновляет CLI; проектные правила находятся в config и AGENTS.md. [Tooling details](../tooling/openspec/README.md).

## Проверки приложения

- Чистое ядро: границы фаз, zero rest, пауза/продолжение, time cap, пропуск callbacks, завершение один раз.
- Экран: размеры 1920×1080 и 1280×720, клавиатура, контраст, звук, ограничение автозапуска.
- Пульт: два browser contexts плюс второй независимый зал; reconnect, дубли, отозванный токен, устаревшая revision, параллельные действия.
- PWA: сначала кэширование online, затем offline reload в idle; сетевой обрыв во время занятия; обновление не перезагружает работающий таймер.
- Реальный зал: часовой прогон и слышимость/читаемость. Fake clocks не доказывают поведение настоящего браузера и оборудования.

Не восстанавливать sample-тесты `playwright.dev` как критерий качества CF Timer. Процент покрытия не заменяет проверку риска потери тренировки.

Уточнение 22.10.2026: UI не содержит ролей/аккаунтов. Передача пульта — согласие текущего или 60 с без его связи. Компьютерный reload сбрасывает сессию; phone reload не сбрасывает таймер. Логи/CLI по SSH описаны в [operations.md](operations.md).

## Приёмка текущей реализации

[Отчёт](implementation-2026-10-22.md), [инструкция пользователя](user-guide.md), [источники ресурсов](assets.md). Playwright запускает отдельный preview на 43871 и тестовый сервер обновлений на 4181; чужие серверы не переиспользуются. Service worker включён только в production build/preview; dev не объявляет offline-ready.

CI создан в .github/workflows/check.yml; факт удалённого выполнения не заявляется. Для E2E предварительно `npx playwright install chromium` (в CI — с `--with-deps`). В sandbox может требоваться разрешение запуска локального сервера/браузера.

После обновления завершите занятия и закройте все вкладки: выбран консервативный вариант активации SW без skipWaiting/clientsClaim. Проверка кэша обходит реальные precache entries; восстановление использует integrity текущей сборки, чтобы не подменить старый index новой версией. PWA plugin выдаёт upstream warning о deprecated inlineDynamicImports; сборка успешна, принудительное вмешательство во внутреннюю сборку plugin не требуется.
