# OpenSpec tooling

Изолированная установка OpenSpec **1.14.3**, требующая Node.js **>=20.19.0**.
Зависимости приложения и их lock-файл не затрагиваются. Глобальная установка не нужна.

Из корня репозитория:

```bash
npm ci --prefix tooling/openspec --ignore-scripts
npm --prefix tooling/openspec run openspec -- --version
npm --prefix tooling/openspec run openspec -- list --specs
npm --prefix tooling/openspec run validate
```

Скрипты запускают CLI из корня репозитория, чтобы он находил `openspec/`.
Они отключают телеметрию только для текущего процесса, не меняя глобальные настройки.
В командах сгенерированных skills заменяйте `openspec ...` на
`npm --prefix tooling/openspec run openspec -- ...`, выполняя их из корня репозитория.

Обновление локальной интеграции Codex:

```bash
npm --prefix tooling/openspec run openspec -- update
```

Файлы `.agents/skills/openspec-*` сгенерированы официальным CLI. Проектные правила
следует менять в `openspec/config.yaml` и корневом `AGENTS.md`, а не внутри skills:
команда `update` может перезаписать сгенерированные файлы.

Версия зафиксирована в `package.json` и `package-lock.json`. Обновлять её следует
отдельным изменением с проверкой CLI и повторной валидацией спецификаций.

Источники: [OpenSpec 1.14.3](https://github.com/Fission-AI/OpenSpec/tree/v1.14.3),
[CLI reference](https://github.com/Fission-AI/OpenSpec/blob/v1.14.3/docs/cli.md).
