# Project workflow

## Purpose

Обеспечить проверяемый перезапуск CF Timer: сохранить старое наследие, различать действующие правила и будущую реализацию, вести небольшие изменения через OpenSpec. Runtime-функции пока не входят в принятый baseline.

## Requirements

### Requirement: Separate accepted contracts from proposed runtime behavior
Документация проекта SHALL хранить принятые действующие контракты в `openspec/specs`, а предлагаемое поведение — в `openspec/changes`; описание статуса MUST явно указывать, что новая runtime-реализация ещё отсутствует, пока это остаётся фактом.

#### Scenario: Reader opens the restart repository
- **WHEN** читатель открывает README после перезапуска 22.10.2026
- **THEN** он видит отсутствие готового приложения, ссылки на аудит и отдельные невыполненные changes, а не обещание рабочего deploy

### Requirement: Preserve legacy references
Проект SHALL сохранять архивные исходники и документы отдельно от активной реализации, с происхождением и контрольными суммами; архив MUST использоваться как reference, а не как подтверждённый рабочий релиз.

#### Scenario: Developer needs previous interval behavior
- **WHEN** разработчику нужно изучить старые интервалы
- **THEN** он находит working-tree snapshot и исторический Git snapshot в archive с указанием commit и ограничений аудита

### Requirement: Reproducible specification tooling
Проект SHALL закреплять версию OpenSpec и её зависимости локальным package/lock и предоставлять strict validation всех specs/changes без глобальной установки CLI.

#### Scenario: New contributor validates documentation
- **WHEN** разработчик выполняет `npm ci --prefix tooling/openspec --ignore-scripts` и `npm run spec:validate` на совместимом Node
- **THEN** используется закреплённый OpenSpec 1.14.3 и проверяется структура всех актуальных спецификаций

### Requirement: Verify before promoting planned behavior
Задачи SHALL отмечаться завершёнными только после выполнения; перенос runtime-требований в baseline MUST сопровождаться проверкой соответствующего кода и поведения.

#### Scenario: Planning artifacts exist but code does not
- **WHEN** proposal, design, specs и tasks созданы без реализации
- **THEN** implementation tasks остаются незавершёнными, а готовность артефактов не называется готовностью продукта
