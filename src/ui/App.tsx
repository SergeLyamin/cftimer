import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Icon } from "./Icon";
import { AnchoredDialog } from "./AnchoredDialog";
import { TimerReadout } from "./TimerReadout";
import { Duration } from "./Duration";
import { PhaseEffects } from "./PhaseEffects";
import { CompletionConfetti } from "./CompletionConfetti";
import {
  defaultPreferences,
  preferencesStore,
  type Preferences,
} from "../platform/preferences";
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirm, setConfirm] = useState<"menu" | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(() => ({
    ...defaultPreferences,
    ...preferencesStore.load(),
  }));
  const sound = preferences.sound;
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [pageVisible, setPageVisible] = useState(
    () => document.visibilityState === "visible",
  );
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(140);
  const lastFullscreenExit = useRef(-Infinity);
  const [notice, setNotice] = useState("");
  const [limitNotice, setLimitNotice] = useState<{
    id: number;
    message: string;
  } | null>(null);
  const limitNoticeId = useRef(0);
  const [online, setOnline] = useState(navigator.onLine);
  const audio = useRef(new AudioSignals());
  const display = useRef<ReturnType<typeof createDisplaySupport> | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [wakeActive, setWakeActive] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [updateWaiting, setUpdateWaiting] = useState(false);
  function notifyLimit(message: string) {
    setLimitNotice({ id: ++limitNoticeId.current, message });
  }
  useEffect(() => {
    if (!limitNotice) return;
    const timeout = window.setTimeout(() => setLimitNotice(null), 10000);
    return () => window.clearTimeout(timeout);
  }, [limitNotice]);
  function openSettings(trigger: HTMLElement) {
    dialogTrigger.current = trigger;
    setSettingsOpen(true);
  }
  function openConfirmation(type: "menu", trigger: HTMLElement) {
    dialogTrigger.current = trigger;
    setConfirm(type);
  }
  function closeDialog() {
    setSettingsOpen(false);
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
  function updatePreference(key: keyof Preferences, value: boolean) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    if (!preferencesStore.save(next))
      setNotice(
        "Настройки доступны до закрытия страницы: браузер запретил сохранение.",
      );
    if (key === "sound" && value)
      void audio.current.unlock().then(setAudioReady);
  }
  function restart() {
    action("reset");
    action("start");
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(".timer-main-action")?.focus(),
    );
  }
  function toggleFullscreen() {
    if (view === "timer" && snapshot.status !== "completed")
      void display.current?.requestWakeLock();
    void display.current?.toggleFullscreen().then((ok) => {
      if (!ok) setNotice("Полный экран недоступен. Разверните окно вручную.");
    });
  }
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () =>
      setPageVisible(document.visibilityState === "visible");
    const fullscreenChanged = () => {
      if (!document.fullscreenElement)
        lastFullscreenExit.current = performance.now();
    };
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    document.addEventListener("fullscreenchange", fullscreenChanged);
    return () => {
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
      document.removeEventListener("fullscreenchange", fullscreenChanged);
    };
  }, []);
  useEffect(() => {
    if (view !== "timer" || !footerRef.current) return;
    const element = footerRef.current;
    const measure = () =>
      setFooterHeight(Math.ceil(element.getBoundingClientRect().height));
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [view]);
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
  const handleHotkey = useEffectEvent((e: KeyboardEvent) => {
    if (
      e.repeat ||
      e.defaultPrevented ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.shiftKey ||
      settingsOpen ||
      confirm
    )
      return;
    const target = e.target as HTMLElement;
    if (target.closest("input,textarea,select,[contenteditable]")) return;
    if (e.code === "KeyF") {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.code === "Escape") {
      if (document.fullscreenElement) {
        e.preventDefault();
        void document
          .exitFullscreen()
          .catch(() =>
            setNotice("Выйдите из полного экрана через меню браузера."),
          );
        return;
      }
      if (performance.now() - lastFullscreenExit.current < 150) return;
      if (view === "timer" && snapshot.status === "paused") {
        e.preventDefault();
        restart();
      }
    } else if (
      e.code === "Space" &&
      !target.closest("button,a") &&
      view === "timer" &&
      (snapshot.status === "running" || snapshot.status === "paused")
    ) {
      e.preventDefault();
      action(snapshot.status === "running" ? "pause" : "resume");
    }
  });
  useEffect(() => {
    const key = (event: KeyboardEvent) => handleHotkey(event);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
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
    if (!settingsOpen && !confirm) return;
    const previous = dialogTrigger.current;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeDialog();
      }
      if (event.key === "Tab") {
        const items = dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),a[href],input:not([disabled]),[tabindex='0']",
        );
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
  }, [settingsOpen, confirm]);
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
    setLimitNotice(null);
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
  const change = (key: keyof TimerConfig, value: number) => {
    setConfig((c) => ({ ...c, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  function togglePause() {
    if (view !== "timer" || settingsOpen || confirm) return;
    const status = engine.current.getSnapshot().status;
    if (status === "running" || status === "paused")
      action(status === "running" ? "pause" : "resume");
  }
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
  const timerTitleDetail =
    interval || config.mode === "emom"
      ? `${snapshot.phase?.round || 1} из ${config.rounds}`
      : config.mode === "for-time"
        ? formatTime(config.workSeconds * 1000)
        : undefined;
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
        onClick={(event) => openSettings(event.currentTarget)}
        aria-label="Настройки"
        title="Настройки"
      >
        <Icon name="settings" />
      </button>
      <button
        className="quiet icon-button fullscreen"
        onClick={toggleFullscreen}
        aria-label="Полный экран"
        title="Полный экран"
      >
        <Icon name="fullscreen" />
      </button>
    </div>
  );
  return (
    <div
      className={`app${view === "timer" ? " app-timer" : ""}`}
      data-phase={view === "timer" ? snapshot.phase?.kind : undefined}
      data-status={view === "timer" ? snapshot.status : undefined}
      style={{ "--timer-footer-height": `${footerHeight}px` } as CSSProperties}
    >
      {view === "timer" && (
        <CompletionConfetti
          snapshot={snapshot}
          enabled={
            preferences.confetti !== false && !reducedMotion && pageVisible
          }
        />
      )}
      {view === "timer" && (
        <PhaseEffects
          snapshot={snapshot}
          enabled={preferences.edgePulse && !reducedMotion && pageVisible}
        />
      )}
      {view !== "timer" && (
        <header className={view === "setup" ? "mode-header" : ""}>
          {view === "home" ? (
            <button
              className="brand"
              onClick={(event) => backToModes(event.currentTarget)}
            >
              CF<span>TIMER</span>
            </button>
          ) : (
            <div className="workout-heading">
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
          )}
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
          </section>
        ) : view === "setup" ? (
          <section className="setup">
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
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (!/^\d*$/.test(raw)) {
                        e.target.value = Number.isNaN(config.rounds)
                          ? ""
                          : String(config.rounds);
                        return;
                      }
                      const value = raw === "" ? NaN : Number(raw);
                      if (value > 99) {
                        e.target.value = "99";
                        change("rounds", 99);
                        notifyLimit("Раунды — не более 99");
                      } else change("rounds", value);
                    }}
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
                  onLimit={notifyLimit}
                />
              )}{" "}
              {interval && (
                <Duration
                  id="rest"
                  label="Отдых"
                  value={config.restSeconds}
                  onChange={(v) => change("restSeconds", v)}
                  error={errors.restSeconds}
                  onLimit={notifyLimit}
                />
              )}
              <details className="preparation-options">
                <summary>Подготовка</summary>
                <Duration
                  id="prep"
                  label="Подготовка"
                  value={config.preparationSeconds}
                  onChange={(v) => change("preparationSeconds", v)}
                  error={errors.preparationSeconds}
                  hideLabel
                />
              </details>
              <button className="primary" type="submit">
                Старт <Icon name="arrow" className="action-icon" />
              </button>
              <p className="preview">
                Общее время:{" "}
                <strong>
                  {Number.isFinite(total) ? formatTime(total * 1000) : "—"}
                </strong>
              </p>
            </form>
          </section>
        ) : (
          <section className={`timer ${snapshot.phase?.kind ?? ""}`}>
            <div className="timer-meta">
              <div className="workout-heading">
                <button
                  className="back quiet icon-button"
                  onClick={(event) => backToModes(event.currentTarget)}
                  aria-label="Все режимы"
                  title="Все режимы"
                >
                  <Icon name="back" />
                </button>
                <h1>
                  {modeName}
                  {timerTitleDetail && (
                    <span className="timer-title-detail">
                      {" "}
                      – {timerTitleDetail}
                    </span>
                  )}
                </h1>
              </div>
              {headerActions}
            </div>
            <TimerReadout
              snapshot={snapshot}
              onToggle={togglePause}
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
            <div className="timer-footer" ref={footerRef}>
              <div className="timer-action-row">
                <div
                  className={`timer-controls ${snapshot.status === "paused" ? "is-paused" : snapshot.status === "completed" ? "is-completed" : ""}`}
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
                        aria-label={
                          snapshot.status === "paused" ? "Продолжить" : "Пауза"
                        }
                        title={
                          snapshot.status === "paused" ? "Продолжить" : "Пауза"
                        }
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
                          onClick={restart}
                        >
                          <Icon name="stop" className="action-icon" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      {limitNotice && (
        <div key={limitNotice.id} className="limit-toast" role="status">
          {limitNotice.message}
        </div>
      )}
      {(settingsOpen || confirm) && (
        <AnchoredDialog
          anchor={dialogTrigger.current}
          dialogRef={dialogRef}
          onClose={closeDialog}
        >
          {settingsOpen ? (
            <>
              <button
                className="dialog-close quiet icon-button"
                autoFocus
                onClick={closeDialog}
                aria-label="Закрыть"
                title="Закрыть"
              >
                <Icon name="close" />
              </button>
              <h2 id="dialog-title">Настройки</h2>
              <p id="dialog-description" className="visually-hidden">
                Параметры звука и визуальных эффектов
              </p>
              <label className="setting-switch">
                <span>Звук</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={sound}
                  onChange={(e) => updatePreference("sound", e.target.checked)}
                />
              </label>
              <button
                type="button"
                className="quiet settings-test-sound"
                onClick={beep}
              >
                Проверить звук
              </button>
              {audioReady && (
                <p className="settings-note">Звук разрешён браузером</p>
              )}
              <label className="setting-switch">
                <span>Пульсация краёв</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={preferences.edgePulse}
                  onChange={(e) =>
                    updatePreference("edgePulse", e.target.checked)
                  }
                />
              </label>
              {reducedMotion && (
                <p className="settings-note">
                  Анимации отключены системным уменьшением движения.
                </p>
              )}
              <label className="setting-switch">
                <span>Конфетти в конце</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={preferences.confetti !== false}
                  onChange={(e) =>
                    updatePreference("confetti", e.target.checked)
                  }
                />
              </label>
              <p className="hotkey-hint">
                Пробел — пауза / продолжить
                <br />
                Esc — заново на паузе
                <br />F — полный экран
              </p>
              <div
                className="settings-statuses"
                aria-label="Состояние приложения"
              >
                {view === "timer" && snapshot.status !== "completed" && (
                  <div className="settings-status" role="status">
                    <p>
                      {wakeActive
                        ? "Экран остаётся включённым"
                        : "Удержание экрана не подтверждено"}
                    </p>
                    {!wakeActive && (
                      <>
                        <button
                          className="quiet wake-retry"
                          onClick={() => {
                            void display.current?.requestWakeLock();
                          }}
                        >
                          Не выключать экран
                        </button>
                        <p className="settings-note">
                          Если браузер не разрешит — отключите автоблокировку в
                          настройках устройства.
                        </p>
                      </>
                    )}
                  </div>
                )}
                <div className="settings-status" role="status">
                  <p>
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
                </div>
              </div>
              <div className="settings-footer">
                <span>Версия {__APP_VERSION__}</span>
                <a
                  href="https://github.com/SergeLyamin/cftimer"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub автора →
                </a>
              </div>
            </>
          ) : (
            <>
              <h2 id="dialog-title">Вернуться в меню?</h2>
              <p id="dialog-description">Текущая тренировка будет сброшена.</p>
              <div className="dialog-actions">
                <button
                  className="primary"
                  onClick={() => {
                    action("reset");
                    setView("home");
                    closeDialog();
                  }}
                >
                  В меню
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
