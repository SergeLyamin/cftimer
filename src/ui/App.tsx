import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { AnchoredDialog } from "./AnchoredDialog";
import { TimerReadout } from "./TimerReadout";
import {
  AudioSignals,
  createSettingsStore,
  createDisplaySupport,
  observeOfflineReadiness,
  repairOfflineCache,
} from "../platform";
import {
  TimerEngine,
  formatTime,
  validateConfig,
  type TimerConfig,
} from "../timer";

const modes = [
  {
    id: "intervals",
    name: "Интервалы",
    detail: "Работа и отдых",
    icon: "stopwatch",
  },
  {
    id: "for-time",
    name: "На время",
    detail: "Завершите как можно быстрее",
    icon: "hourglass",
  },
  {
    id: "amrap",
    name: "AMRAP",
    detail: "Максимум за отведённое время",
    icon: "repeat",
  },
  {
    id: "tabata",
    name: "Tabata",
    detail: "8 × 20 / 10 секунд",
    icon: "tabata",
  },
  {
    id: "emom",
    name: "EMOM",
    detail: "Новый раунд каждую минуту",
    icon: "clock",
  },
] as const;
const defaults: TimerConfig = {
  mode: "intervals",
  rounds: 8,
  workSeconds: 20,
  restSeconds: 10,
  preparationSeconds: 10,
};
const labels = { preparation: "ПОДГОТОВКА", work: "РАБОТА", rest: "ОТДЫХ" };
function Duration({
  label,
  value,
  onChange,
  error,
  id,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  error?: string;
  id: string;
}) {
  const [text, setText] = useState(() => formatTime(value * 1000));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current && Number.isFinite(value))
      setText(formatTime(value * 1000));
  }, [value]);
  function edit(input: HTMLInputElement) {
    const raw = input.value;
    const caret = input.selectionStart ?? raw.length;
    const precedingDigits = raw.slice(0, caret).replace(/\D/g, "").length;
    const digits = raw.replace(":", "");
    if (!/^\d{0,4}$/.test(digits)) {
      setText(raw);
      onChange(NaN);
      return;
    }
    const formatted =
      digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
    setText(formatted);
    const nextCaret =
      precedingDigits +
      (precedingDigits > 2 || (precedingDigits === 2 && caret > 2) ? 1 : 0);
    requestAnimationFrame(() => {
      if (document.activeElement === input)
        input.setSelectionRange(nextCaret, nextCaret);
    });
    const seconds = Number(digits.slice(2));
    onChange(
      digits.length === 4 && seconds < 60
        ? Number(digits.slice(0, 2)) * 60 + seconds
        : NaN,
    );
  }
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        <small>мин : сек</small>
      </span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        placeholder="ММ:СС"
        value={text}
        aria-invalid={!!error}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ``}`}
        onChange={(e) => edit(e.target)}
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onBlur={() => {
          focused.current = false;
        }}
      />
      <small id={`${id}-hint`}>4 цифры: ММСС, например 0130 → 01:30</small>
      {error && (
        <small className="error" id={`${id}-error`}>
          {Number.isFinite(value)
            ? error
            : "Введите время полностью в формате ММ:СС; секунды от 00 до 59"}
        </small>
      )}
    </label>
  );
}
function settingsStore(mode: TimerConfig["mode"]) {
  return createSettingsStore<TimerConfig>(
    `cftimer.settings.${mode}`,
    (value): value is TimerConfig =>
      !!value &&
      typeof value === "object" &&
      "mode" in value &&
      value.mode === mode &&
      Object.keys(validateConfig(value as TimerConfig)).length === 0,
  );
}
export default function App() {
  const engine = useRef(new TimerEngine(defaults));
  const [snapshot, setSnapshot] = useState(() => engine.current.getSnapshot());
  const [view, setView] = useState<"home" | "setup" | "timer">("home");
  const [config, setConfig] = useState<TimerConfig>(defaults);
  const [errors, setErrors] = useState<
    Partial<Record<keyof TimerConfig, string>>
  >({});
  const dialogRef = useRef<HTMLElement>(null);
  const dialogTrigger = useRef<HTMLElement | null>(null);
  const [about, setAbout] = useState(false);
  const [confirm, setConfirm] = useState<"menu" | "restart" | null>(null);
  const [sound, setSound] = useState(false);
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const audio = useRef(new AudioSignals());
  const display = useRef<ReturnType<typeof createDisplaySupport> | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [wakeActive, setWakeActive] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [updateWaiting, setUpdateWaiting] = useState(false);
  function openAbout(trigger: HTMLElement) {
    dialogTrigger.current = trigger;
    setAbout(true);
  }
  function openConfirmation(type: "menu" | "restart", trigger: HTMLElement) {
    dialogTrigger.current = trigger;
    setConfirm(type);
  }
  function closeDialog() {
    setAbout(false);
    setConfirm(null);
  }
  function backToModes(trigger: HTMLElement) {
    if (view === "timer" && snapshot.status !== "completed") {
      openConfirmation("menu", trigger);
      return;
    }
    if (view === "timer") action("reset");
    setView("home");
  }
  function beep() {
    void audio.current.test().then((ready) => {
      setAudioReady(ready);
      if (!ready)
        setNotice("Нажмите для проверки звука. Проверьте настройки браузера.");
    });
  }
  useEffect(() => {
    const currentAudio = audio.current;
    const currentDisplay = createDisplaySupport(setWakeActive);
    display.current = currentDisplay;
    const stop = observeOfflineReadiness((status) => {
      setOnline(status.online);
      setOfflineReady(status.ready);
      setUpdateWaiting(status.updateWaiting);
    });
    return () => {
      stop();
      currentDisplay.dispose();
      currentAudio.dispose();
    };
  }, []);
  useEffect(() => {
    if (snapshot.status === "running" || snapshot.status === "paused") {
      void display.current?.requestWakeLock();
    } else void display.current?.releaseWakeLock();
  }, [snapshot.status]);
  function action(
    type: "start" | "pause" | "resume" | "finish" | "reset" | "repeat",
  ) {
    engine.current.dispatch({ type });
    const next = engine.current.getSnapshot();
    setSnapshot(next);
    // Request within the local gesture as well as the lifecycle effect.
    if (next.status === "running" || next.status === "paused")
      void display.current?.requestWakeLock();
  }
  useEffect(() => {
    let frame: number;
    const tick = () => {
      setSnapshot(engine.current.getSnapshot());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || about || confirm) return;
      const target = e.target as HTMLElement;
      if (target.closest("input,textarea,select,button,a,[contenteditable]"))
        return;
      if (snapshot.status === "running" || snapshot.status === "paused") {
        e.preventDefault();
        action(snapshot.status === "running" ? "pause" : "resume");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [snapshot.status, about, confirm]);
  useEffect(() => {
    audio.current.update(
      {
        runId: String(snapshot.runId),
        phaseId: String(snapshot.phaseIndex),
        remainingMs: snapshot.remainingMs,
        status: snapshot.status,
      },
      sound,
    );
  }, [snapshot, sound]);
  useEffect(() => {
    if (!about && !confirm) return;
    const previous = dialogTrigger.current;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
      }
      if (event.key === "Tab") {
        const items =
          dialogRef.current?.querySelectorAll<HTMLElement>("button,a[href]");
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      if (
        previous?.isConnected &&
        !previous.closest("[inert]") &&
        !previous.matches(":disabled")
      )
        previous.focus();
      else
        document
          .querySelector<HTMLElement>(".timer-main-action,.mode-card")
          ?.focus();
    };
  }, [about, confirm]);
  function choose(mode: TimerConfig["mode"]) {
    let selected = {
      ...defaults,
      mode,
      ...(mode === "emom"
        ? { rounds: 10, workSeconds: 60, restSeconds: 0 }
        : mode === "amrap" || mode === "for-time"
          ? { rounds: 1, workSeconds: 600, restSeconds: 0 }
          : {}),
    };
    const stored = settingsStore(mode).load();
    if (stored) selected = stored;
    setConfig(selected);
    setErrors({});
    setView("setup");
  }
  function start() {
    const found = validateConfig(config);
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => {
        const invalid = document.querySelector<HTMLInputElement>(
          '[aria-invalid="true"]',
        );
        const group = invalid?.closest("details");
        if (group) group.open = true;
        invalid?.focus();
      });
      return;
    }
    if (!settingsStore(config.mode).save(config))
      setNotice("Настройки не сохраняются после закрытия страницы.");
    if (sound) {
      void audio.current.unlock().then((ready) => {
        setAudioReady(ready);
        if (!ready)
          setNotice("Звук заблокирован браузером. Таймер работает без звука.");
      });
    }
    engine.current.dispatch({ type: "configure", config });
    action("start");
    setView("timer");
  }
  const change = (key: keyof TimerConfig, value: number) =>
    setConfig((c) => ({ ...c, [key]: value }));
  const interval = config.mode === "intervals" || config.mode === "tabata";
  const total =
    config.preparationSeconds +
    (interval
      ? config.rounds * config.workSeconds +
        (config.rounds - 1) * config.restSeconds
      : config.mode === "emom"
        ? config.rounds * config.workSeconds
        : config.workSeconds);
  const modeName =
    config.mode === "tabata" &&
    (config.rounds !== 8 ||
      config.workSeconds !== 20 ||
      config.restSeconds !== 10)
      ? "Свои интервалы"
      : modes.find((m) => m.id === config.mode)?.name;
  const finishedBeforeWork =
    config.mode === "for-time" &&
    snapshot.status === "completed" &&
    snapshot.phase?.kind === "preparation";
  const displayedTime = formatTime(
    finishedBeforeWork ? 0 : snapshot.displayMs,
    snapshot.countDirection,
  );
  const phase =
    snapshot.status === "completed"
      ? config.mode === "for-time" && snapshot.completionReason === "limit"
        ? "ЛИМИТ ВРЕМЕНИ"
        : "ГОТОВО"
      : snapshot.status === "paused"
        ? "ПАУЗА"
        : snapshot.phase
          ? labels[snapshot.phase.kind]
          : "ГОТОВЫ?";
  const headerActions = (
    <div className="header-actions">
      {!online && <span className="network">Без сети</span>}
      <button
        className="quiet icon-button"
        onClick={(event) => openAbout(event.currentTarget)}
        aria-label="О проекте"
        title="О проекте"
      >
        <Icon name="info" />
      </button>
      {view === "timer" && (
        <button
          className={`quiet icon-button sound${sound ? "" : " muted"}`}
          onClick={() => {
            if (!sound) beep();
            setSound(!sound);
          }}
          aria-label={sound ? "Выключить звук" : "Включить звук"}
          aria-pressed={sound}
          title={sound ? "Выключить звук" : "Включить звук"}
        >
          <Icon name={sound ? "volume" : "muted"} />
        </button>
      )}
      <button
        className="quiet icon-button fullscreen"
        onClick={() => {
          if (view === "timer" && snapshot.status !== "completed")
            void display.current?.requestWakeLock();
          void display.current?.toggleFullscreen().then((ok) => {
            if (!ok)
              setNotice("Полный экран недоступен. Разверните окно вручную.");
          });
        }}
        aria-label="Полный экран"
        title="Полный экран"
      >
        <Icon name="fullscreen" />
      </button>
    </div>
  );
  return (
    <div className={`app${view === "timer" ? " app-timer" : ""}`}>
      {view !== "timer" && (
        <header>
          <button
            className="brand"
            onClick={(event) => backToModes(event.currentTarget)}
          >
            CF<span>TIMER</span>
          </button>
          {headerActions}
        </header>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Закрыть уведомление"
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      {updateWaiting && (
        <div className="notice" role="status">
          Обновление готово. После тренировки закройте все вкладки приложения и
          откройте снова.
        </div>
      )}
      <main>
        {view === "home" ? (
          <section className="home">
            <p className="eyebrow">ВАША ТРЕНИРОВКА</p>
            <h1>Выберите режим</h1>
            <div className="mode-grid">
              {modes.map((mode) => (
                <button
                  key={mode.id}
                  className={`mode-card${mode.id === "tabata" || mode.id === "emom" ? " preset" : ""}`}
                  onClick={() => choose(mode.id)}
                >
                  <Icon name={mode.icon} className="mode-icon" />
                  <strong>{mode.name}</strong>
                  <span className="mode-detail">{mode.detail}</span>
                  <Icon name="arrow" className="mode-arrow" />
                </button>
              ))}
            </div>
            <p className="home-note">
              {offlineReady
                ? "Готов к запуску без сети"
                : "Офлайн-запуск пока не готов"}
            </p>
            {!offlineReady && (
              <button
                className="quiet offline-repair"
                disabled={repairing || !online}
                onClick={() => {
                  setRepairing(true);
                  void repairOfflineCache()
                    .then((ok) => {
                      if (!ok)
                        setNotice(
                          "Офлайн-копия пока не готова. Проверьте соединение и повторите подготовку.",
                        );
                    })
                    .finally(() => setRepairing(false));
                }}
              >
                {repairing ? "Подготовка…" : "Подготовить офлайн"}
              </button>
            )}
          </section>
        ) : view === "setup" ? (
          <section className="setup">
            <p className="eyebrow">НАСТРОЙКА</p>
            <div className="workout-heading setup-heading">
              <button
                className="back quiet icon-button"
                onClick={(event) => backToModes(event.currentTarget)}
                aria-label="Все режимы"
                title="Все режимы"
              >
                <Icon name="back" />
              </button>
              <h1>{modeName}</h1>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                start();
              }}
              noValidate
            >
              {(interval || config.mode === "emom") && (
                <label className="field" htmlFor="rounds">
                  <span>Раунды</span>
                  <input
                    id="rounds"
                    inputMode="numeric"
                    value={Number.isNaN(config.rounds) ? "" : config.rounds}
                    aria-invalid={!!errors.rounds}
                    aria-describedby={
                      errors.rounds ? "rounds-error" : undefined
                    }
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      change(
                        "rounds",
                        e.target.value === "" ? NaN : Number(e.target.value),
                      )
                    }
                  />
                  {errors.rounds && (
                    <small id="rounds-error" className="error">
                      {errors.rounds}
                    </small>
                  )}
                </label>
              )}
              {config.mode !== "emom" && (
                <Duration
                  id="work"
                  label={
                    interval
                      ? "Работа"
                      : config.mode === "for-time"
                        ? "Лимит времени"
                        : "Длительность"
                  }
                  value={config.workSeconds}
                  onChange={(v) => change("workSeconds", v)}
                  error={errors.workSeconds}
                />
              )}{" "}
              {interval && (
                <Duration
                  id="rest"
                  label="Отдых"
                  value={config.restSeconds}
                  onChange={(v) => change("restSeconds", v)}
                  error={errors.restSeconds}
                />
              )}
              <details>
                <summary>Дополнительно</summary>
                <Duration
                  id="prep"
                  label="Подготовка"
                  value={config.preparationSeconds}
                  onChange={(v) => change("preparationSeconds", v)}
                  error={errors.preparationSeconds}
                />
                <label className="sound-toggle">
                  <input
                    type="checkbox"
                    checked={sound}
                    onChange={(e) => {
                      setSound(e.target.checked);
                      if (e.target.checked)
                        void audio.current.unlock().then(setAudioReady);
                    }}
                  />{" "}
                  Звуковые сигналы
                </label>
                <button
                  type="button"
                  className="quiet test-sound"
                  onClick={beep}
                >
                  {audioReady
                    ? "Звук разрешён браузером"
                    : "Нажмите для проверки звука"}
                </button>
              </details>
              <p className="preview">
                {config.mode === "for-time" ? "Максимум" : "Всего"}{" "}
                <strong>
                  {Number.isFinite(total) ? formatTime(total * 1000) : "—"}
                </strong>
                <span>
                  Подготовка{" "}
                  {Number.isFinite(config.preparationSeconds)
                    ? config.preparationSeconds
                    : 0}{" "}
                  с{interval ? " · Без последнего отдыха" : ""}
                  {config.mode === "emom" ? " · Раунд каждую минуту" : ""}
                </span>
              </p>
              <button className="primary" type="submit">
                Начать <Icon name="arrow" className="action-icon" />
              </button>
            </form>
          </section>
        ) : (
          <section className={`timer ${snapshot.phase?.kind ?? ""}`}>
            <div className="timer-meta">
              <div className="workout-heading">
                <h1>{modeName}</h1>
              </div>
              {headerActions}
            </div>
            <TimerReadout
              snapshot={snapshot}
              displayedTime={displayedTime}
              phaseLabel={phase}
              roundLabel={
                interval || config.mode === "emom"
                  ? `Раунд ${snapshot.phase?.round || 1} / ${config.rounds}`
                  : finishedBeforeWork
                    ? "До начала работы"
                    : undefined
              }
            />
            <div className="timer-footer">
              <div className="timer-action-row">
                <button
                  className="timer-exit quiet icon-button"
                  onClick={(event) => backToModes(event.currentTarget)}
                  aria-label="Все режимы"
                  title="Вернуться к выбору режима"
                >
                  <Icon name="back" />
                </button>
                <div
                  className={`timer-controls ${snapshot.status === "paused" ? "is-paused" : ""}`}
                >
                  {snapshot.status === "completed" ? (
                    <button
                      className="primary timer-main-action"
                      onClick={() => action("repeat")}
                    >
                      <Icon name="repeat" className="action-icon" />
                      Повторить
                    </button>
                  ) : (
                    <>
                      <button
                        className="primary timer-main-action"
                        onClick={() =>
                          action(
                            snapshot.status === "paused" ? "resume" : "pause",
                          )
                        }
                      >
                        <Icon
                          name={snapshot.status === "paused" ? "play" : "pause"}
                          className="action-icon"
                        />
                        {snapshot.status === "paused" ? "Продолжить" : "Пауза"}
                      </button>
                      <div
                        className="timer-reset-slot"
                        inert={snapshot.status !== "paused"}
                      >
                        <button
                          className="secondary timer-reset"
                          aria-label="Сброс"
                          title="Запустить заново"
                          disabled={snapshot.status !== "paused"}
                          onClick={(event) =>
                            openConfirmation("restart", event.currentTarget)
                          }
                        >
                          <Icon name="stop" className="action-icon" />
                          <span className="reset-label">Сброс</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {snapshot.status !== "completed" && (
                <p className="screen-hint" role="status">
                  {wakeActive ? (
                    "Экран остаётся включённым"
                  ) : (
                    <>
                      <button
                        className="wake-retry quiet"
                        onClick={() => {
                          void display.current?.requestWakeLock();
                        }}
                      >
                        Не выключать экран
                      </button>
                      <span>
                        Если браузер не разрешит — отключите автоблокировку в
                        настройках устройства.
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
          </section>
        )}
      </main>
      {(about || confirm) && (
        <AnchoredDialog
          anchor={dialogTrigger.current}
          dialogRef={dialogRef}
          onClose={closeDialog}
        >
          {about && (
            <button
              className="dialog-close quiet icon-button"
              autoFocus
              onClick={closeDialog}
              aria-label="Закрыть"
              title="Закрыть"
            >
              <Icon name="close" />
            </button>
          )}
          <h2 id="dialog-title">
            {about
              ? "CF Timer"
              : confirm === "menu"
                ? "Вернуться в меню?"
                : "Начать заново?"}
          </h2>
          {about ? (
            <>
              <p id="dialog-description">
                Простой таймер для вашей тренировки.
              </p>
              <p>Автор — SergeLyamin · Версия 0.1.0</p>
              <p>Политика конфиденциальности готовится к публикации.</p>
              <a
                href="https://github.com/SergeLyamin/cftimer"
                target="_blank"
                rel="noopener noreferrer"
              >
                Репозиторий на GitHub ↗
              </a>
            </>
          ) : (
            <>
              <p id="dialog-description">
                {confirm === "menu"
                  ? "Текущая тренировка будет сброшена."
                  : "Таймер начнёт ту же программу заново, включая подготовку."}
              </p>
              <div className="dialog-actions">
                <button
                  className="primary"
                  onClick={() => {
                    action("reset");
                    if (confirm === "restart") action("start");
                    else setView("home");
                    closeDialog();
                  }}
                >
                  {confirm === "menu" ? "В меню" : "Начать заново"}
                </button>
                <button
                  className="dialog-cancel"
                  autoFocus
                  onClick={closeDialog}
                >
                  Отмена
                </button>
              </div>
            </>
          )}
        </AnchoredDialog>
      )}
    </div>
  );
}
