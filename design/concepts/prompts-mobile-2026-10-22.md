# ImageGen: самостоятельный мобильный таймер и настройки

Дата: 22.10.2026. Использован встроенный ImageGen, не CLI. Новые концепты, без изменения исходных референсов. Направление прежних макетов принято; выбор мобильной главной и деталей формы уточняется отдельно. Изображения визуально просмотрены: режимы телефона не содержат QR/пульта, время и суммы читаемы. Это растровые композиции, размеры targets/контраст/keyboard проверяются в реализации. Статус-бар не является частью веб-приложения. Пауза может иметь акцентный цвет; итоговую семантику цвета сверить с rest/error в компонентах.

## Личный таймер

Файл: [2026-10-22-mobile-timer-v1.png](2026-10-22-mobile-timer-v1.png)

```text
Use case: ui-mockup. Create a high-fidelity product design concept board for CF TIMER, a minimalist Russian workout timer web app. Landscape board, 4 flat smartphone UI artboards side by side, equal width, dark charcoal surrounding canvas, no perspective, no hands, no photoreal devices. Beautiful functional black background, off-white strong typography, tabular huge numerals, muted grey borders, restrained vermilion primary buttons. Readable Cyrillic. Heading above board "CF TIMER — ЛИЧНЫЙ ТАЙМЕР". Each artboard ~390x844 proportions, comfortable spacing and large touch controls. This is a standalone timer running on this very phone, NOT a remote. NO QR, pairing, connected screen, remote indicators, login or bottom navigation.
Panel 1 caption "A · Выбор режима". App header CF TIMER with small info icon. Title "Начнём тренировку". Three stacked outline mode cards "ИНТЕРВАЛЫ" subtitle "Работа и отдых", "НА ВРЕМЯ" subtitle "До завершения задания", "AMRAP" subtitle "Максимум за отведённое время". Small labelled preset chips "Tabata" and "EMOM". Quiet bottom text "О проекте".
Panel 2 caption "B · Быстрый повтор". Same app header. Heading "Последняя тренировка". One featured card "TABATA", "8 раундов · 20 / 10 сек", "Всего 4:00", small line "Подготовка 10 сек". Big vermilion "ПОВТОРИТЬ". Below heading "Другой режим", three simple outline rows "Интервалы", "На время", "AMRAP". Quiet "О проекте" at bottom. This is an alternative homepage for returning users, not a next step in flow.
Panel 3 caption "Тренировка". Header "TABATA" and discreet sound icon. Main phase "РАБОТА", gigantic "00:18", "Раунд 3 из 8", slim progress bar, "Далее: отдых · 00:10". Spacious main number area. Bottom large light primary button "ПАУЗА"; separated dark outline secondary "Завершить". No settings while running.
Panel 4 caption "Пауза". Header "TABATA", main phase "ПАУЗА", gigantic frozen "00:18", "Раунд 3 из 8". Same spatial arrangement. Bottom vermilion big "ПРОДОЛЖИТЬ"; secondary outlined "Завершить". Clear hierarchy, all captions outside artboards. Original design consistent with simple gym timer minimalism. Do not invent extra features or tiny illegible text.
```

## Настройки

Файл: [2026-10-22-timer-settings-v1.png](2026-10-22-timer-settings-v1.png)

```text
Use case: ui-mockup. High-fidelity Russian product design board for CF TIMER workout web app. Consistent minimal black surfaces, warm off-white bold text, grey outline numeric fields, restrained vermilion primary Start buttons, no gradients, flat front-on artboards without physical devices. Wide landscape board with 3 equal smartphone artboards and 1 wider desktop settings artboard, readable Cyrillic typography and generous spacing. Header outside artboards "CF TIMER — НАСТРОЙКА ТРЕНИРОВКИ". No remote or QR controls on phones, no accounts or coach roles.
Artboard1 mobile heading "Интервалы", back arrow. Compact preset chips "Tabata" selected and "EMOM" unselected. Labelled row "Раунды" with minus, value 8, plus. Row "Работа" value "00:20" and unit "мин : сек". Row "Отдых" value "00:10" same unit. Row "Подготовка" value "00:10". Plain note "Без отдыха после последнего раунда". Collapsed row "Дополнительно" with chevron. Bottom summary "Всего 4:00", smaller "Подготовка включена". Large full-width vermilion "НАЧАТЬ". Values are editable labelled fields, not circular dials.
Artboard2 mobile heading "На время", back arrow. Short description "Выполните задание до лимита". Labelled large time field "Лимит времени" "10:00" units "мин : сек". Row "Подготовка" "00:10". Helpful small text "Счёт идёт вверх". Collapsed row "Дополнительно". Bottom "До 10:10 с подготовкой", large "НАЧАТЬ".
Artboard3 mobile heading "AMRAP", back arrow. Description "Максимум раундов за отведённое время". Labelled large field "Длительность" "10:00" units "мин : сек". Row "Подготовка" "00:10". Helpful text "Обратный отсчёт". Collapsed row "Дополнительно". Bottom summary "Всего 10:10", large "НАЧАТЬ".
Artboard4 desktop wider, same visual family, heading "Интервалы". Left column form: "Раунды" 8, "Работа" "00:20", "Отдых" "00:10", "Подготовка" "00:10". Right column summary "TABATA", "8 × 20 / 10 сек", big "4:00", "Без последнего отдыха". Big "НАЧАТЬ" underneath. Discreet collapsed "Пульт" button at top right represents hidden QR panel, no visible QR. Show one coherent same form adapting to screen size, not a dashboard. Bottom quiet "О проекте". Put small captions under artboards "Интервалы", "На время", "AMRAP", "Большой экран". All text limited to specified useful UI.
```

