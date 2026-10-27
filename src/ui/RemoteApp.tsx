import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ControllerRuntime } from "../remote/controller";
import type { ApplicationIntent, ApplicationSnapshot } from "../application";
import { formatTime, type TimerConfig } from "../timer";
import { defaults, modes } from "./App";
import { RemoteSetup } from "./RemoteSetup";
import { AnchoredDialog } from "./AnchoredDialog";
import { Icon } from "./Icon";

const accessText: Record<string, string> = {
  waiting: "Ждём передачу управления",
  ready: "Управление у вас",
  denied: "Передача отклонена",
  expired: "Время ответа истекло",
  replaced: "Управление передано другому пульту",
  "no-display": "Нет связи с экраном",
  cancelled: "Запрос отменён",
  released: "Пульт отключён",
  busy: "Другой запрос уже ожидает ответа",
};
function workoutName(config?: TimerConfig) {
  return config?.mode === "tabata" &&
    (config.rounds !== 8 ||
      config.workSeconds !== 20 ||
      config.restSeconds !== 10)
    ? "Свои интервалы"
    : modes.find((m) => m.id === config?.mode)?.name;
}
export function RemoteError() {
  return (
    <div className="remote-app">
      <header>
        <span className="brand">CF TIMER</span>
        <span>Пульт</span>
      </header>
      <main className="remote-content">
        <h1>Приглашение недоступно</h1>
        <p>Откройте QR на общем экране и отсканируйте его ещё раз.</p>
        <p>
          Эта страница остаётся пультом. Локальный таймер здесь не запускается.
        </p>
      </main>
    </div>
  );
}
export function RemoteApp({ runtime }: { runtime: ControllerRuntime }) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  const [, repaint] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => repaint((n) => n + 1), 100);
    return () => clearInterval(timer);
  }, []);
  const [commandBase, setCommandBase] = useState<ApplicationSnapshot>();
  const application =
    state.pending && commandBase ? commandBase : runtime.getProjectedSnapshot();
  const [draft, setDraft] = useState<{
    config: TimerConfig;
    revision: number;
  }>();
  const [confirm, setConfirm] = useState<{
    revision: number;
    trigger: HTMLElement;
  }>();
  const dialogRef = useRef<HTMLElement>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!confirm) return;
    const trigger = confirm.trigger;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setConfirm(undefined);
      }
      if (event.key !== "Tab") return;
      const items = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]),[tabindex='0']",
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
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (trigger.isConnected && !trigger.matches(":disabled")) trigger.focus();
      else
        document
          .querySelector<HTMLElement>(
            ".remote-main-action,.remote-modes button",
          )
          ?.focus();
    };
  }, [confirm]);
  const [haptics, setHaptics] = useState(false);
  const [hapticNotice, setHapticNotice] = useState("");
  const lastHaptic = useRef<string | undefined>(undefined);
  useEffect(() => {
    const result = state.lastResult;
    if (!result || result.commandId === lastHaptic.current) return;
    lastHaptic.current = result.commandId;
    if (
      haptics &&
      result.status === "accepted" &&
      document.visibilityState === "visible"
    )
      navigator.vibrate?.(35);
  }, [state.lastResult, haptics]);
  const enabled = runtime.canSend();
  const timer = application?.timer;
  const hasDraft =
    draft &&
    (draft.revision === application?.revision ||
      state.pending?.command.intent.type === "start");
  const setup =
    application &&
    ((hasDraft && application.view !== "timer") ||
      application.view === "setup" ||
      (hasDraft && state.pending?.command.intent.type === "start"));
  const config = hasDraft ? draft.config : timer?.config;
  const linked = state.connection === "connected" && state.access === "ready";
  function send(
    intent: ApplicationIntent,
    expectedRevision = application?.revision,
  ) {
    if (runtime.send(intent, expectedRevision)) {
      setCommandBase(application);
      setConfirm(undefined);
    }
  }
  function choose(mode: TimerConfig["mode"]) {
    setDraft({
      revision: application!.revision,
      config: {
        ...defaults,
        mode,
        ...(mode === "emom"
          ? { rounds: 10, workSeconds: 60, restSeconds: 0 }
          : mode === "amrap" || mode === "for-time"
            ? { rounds: 1, workSeconds: 600, restSeconds: 0 }
            : {}),
      },
    });
  }
  const fatal = state.stopped === true;
  const accessLabel =
    state.access === "waiting"
      ? state.waitUntil
        ? "Ждём освобождения пульта"
        : state.approvalUntil
          ? "Ждём ответа активного пульта"
          : "Ожидаем подтверждения экрана…"
      : accessText[state.access];
  const modeName = workoutName(config);
  return (
    <div className="remote-app">
      <header>
        <span className="brand">
          CF<span>TIMER</span>
        </span>
        <span className="remote-badge">Пульт</span>
      </header>
      <main className="remote-content">
        <div className="remote-connection">
          <h1>{state.screenName ?? "Общий экран"}</h1>
          <p role="status">
            {state.connection !== "connected"
              ? fatal
                ? "Подключение недоступно"
                : "Связь потеряна · подключаемся…"
              : (accessLabel ?? "Подключение…")}
          </p>
        </div>
        {notice && (
          <p className="remote-alert" role="status">
            {notice}
          </p>
        )}
        {state.error && (
          <p className="remote-alert" role="alert">
            {state.error === "incompatible_version"
              ? "Версии экрана и пульта несовместимы. После тренировки обновите обе страницы и отсканируйте новый QR."
              : state.error === "invitation_invalid" ||
                  state.error === "room_expired" ||
                  state.error === "unauthorized"
                ? "Приглашение больше не действует. Отсканируйте новый QR на экране."
                : "Не удалось выполнить запрос. Проверьте связь и попробуйте снова."}
          </p>
        )}
        {state.stopped &&
          ![
            "incompatible_version",
            "invitation_invalid",
            "room_expired",
            "unauthorized",
          ].includes(state.error ?? "") && (
            <button className="secondary" onClick={() => runtime.retry()}>
              Повторить подключение
            </button>
          )}
        {state.pending && (
          <p className="remote-alert" role="status">
            {state.pending.state === "pending"
              ? "Ждём подтверждения экрана…"
              : "Нет подтверждения от экрана. Команда могла выполниться"}
            {state.pending.state !== "pending" && (
              <button className="quiet" onClick={() => runtime.checkStatus()}>
                Проверить состояние
              </button>
            )}
          </p>
        )}
        {!state.pending && state.lastResult?.status === "history_expired" && (
          <p className="remote-alert" role="status">
            Нет подтверждения от экрана. Команда могла выполниться
          </p>
        )}
        {!state.pending && state.lastResult?.status === "not_seen" && (
          <p className="remote-alert" role="status">
            Команда не была выполнена. Проверьте состояние экрана перед новым
            действием.
          </p>
        )}
        {!state.pending && state.lastResult?.status === "rejected" && (
          <p className="remote-alert" role="status">
            Команда не выполнена. Состояние экрана изменилось — проверьте его и
            повторите действие.
          </p>
        )}
        {state.transferRequest && (
          <section className="remote-card" aria-label="Запрос передачи">
            <h2>Передать управление?</h2>
            <p>
              Другой телефон просит пульт. На ответ — 20 секунд. Осталось{" "}
              {Math.max(
                0,
                Math.ceil(
                  (state.transferRequest.expiresAt - performance.now()) / 1000,
                ),
              )}{" "}
              с.
            </p>
            <div className="remote-actions">
              <button
                className="secondary"
                onClick={() =>
                  runtime.transferDecision(
                    state.transferRequest!.requestId,
                    false,
                  )
                }
              >
                Оставить у меня
              </button>
              <button
                className="primary"
                onClick={() =>
                  runtime.transferDecision(
                    state.transferRequest!.requestId,
                    true,
                  )
                }
              >
                Передать
              </button>
            </div>
          </section>
        )}
        {state.access !== "ready" && (
          <section className="remote-card">
            <h2>{accessLabel ?? "Подключаем пульт"}</h2>
            {state.access === "waiting" || state.access === "no-display" ? (
              <>
                <p>
                  {state.access === "no-display"
                    ? "Нет связи с общим экраном. Уже запущенный таймер на нём продолжает работать."
                    : state.waitUntil
                      ? `Активный пульт потерял связь. До освобождения управления: ${Math.max(0, Math.ceil((state.waitUntil - performance.now()) / 1000))} с из 60 секунд после последнего контакта.`
                      : state.approvalUntil
                        ? `Ждём ответа активного пульта: ${Math.max(0, Math.ceil((state.approvalUntil - performance.now()) / 1000))} с. На ответ даётся 20 секунд; без ответа управление не передаётся.`
                        : "Ожидаем подтверждения экрана…"}
                </p>
                <button
                  className="secondary"
                  onClick={() => runtime.cancelRequest()}
                >
                  Отменить запрос
                </button>
              </>
            ) : (
              <>
                <p>
                  {state.access === "replaced"
                    ? "Этот телефон больше не управляет таймером."
                    : "Тренировка на общем экране продолжается."}
                </p>
                {
                  <button
                    className="secondary"
                    disabled={state.connection !== "connected" || fatal}
                    onClick={() => runtime.requestControl()}
                  >
                    Запросить управление
                  </button>
                }
              </>
            )}
          </section>
        )}
        {application && (
          <>
            {!linked && (
              <p className="remote-frozen">
                Последнее подтверждённое состояние
              </p>
            )}
            {setup && config ? (
              <>
                <h2>{modeName}</h2>
                <RemoteSetup
                  key={`${config.mode}-${hasDraft ? draft.revision : application.revision}`}
                  initial={config}
                  disabled={!enabled}
                  onStart={(c) => send({ type: "start", config: c })}
                  onBack={() => {
                    setDraft(undefined);
                    if (application.view === "setup")
                      send({ type: "returnToMenu" });
                  }}
                />
              </>
            ) : application.view === "home" ? (
              <div className="remote-modes">
                {modes.map((mode) => (
                  <button
                    key={mode.id}
                    className="mode-card"
                    disabled={!enabled}
                    onClick={() => choose(mode.id)}
                  >
                    <Icon name={mode.icon} />
                    <strong>{mode.name}</strong>
                    <span>{mode.detail}</span>
                  </button>
                ))}
              </div>
            ) : (
              timer && (
                <section className="remote-timer">
                  <h2>{workoutName(timer.config)}</h2>
                  <p className="remote-phase">
                    {timer.status === "paused"
                      ? "ПАУЗА"
                      : timer.status === "completed"
                        ? "ГОТОВО!"
                        : timer.phase?.kind === "preparation"
                          ? "ПОДГОТОВКА"
                          : timer.phase?.kind === "rest"
                            ? "ОТДЫХ"
                            : "РАБОТА"}
                  </p>
                  <div className="remote-time">
                    {formatTime(timer.displayMs, timer.countDirection)}
                  </div>
                  {timer.config.rounds > 1 && (
                    <p>
                      Раунд {timer.phase?.round ?? 1} / {timer.config.rounds}
                    </p>
                  )}
                  <button
                    className="primary remote-main-action"
                    disabled={!enabled}
                    onClick={() =>
                      send({
                        type:
                          timer.status === "completed"
                            ? "repeat"
                            : timer.status === "paused"
                              ? "resume"
                              : "pause",
                      })
                    }
                  >
                    {timer.status === "completed"
                      ? "Повторить"
                      : timer.status === "paused"
                        ? "Продолжить"
                        : "Пауза"}
                  </button>
                  {timer.status === "paused" && (
                    <div className="remote-actions">
                      <button
                        className="secondary"
                        disabled={!enabled}
                        onClick={() => send({ type: "edit" })}
                      >
                        Редактировать
                      </button>
                      <button
                        className="secondary"
                        disabled={!enabled}
                        onClick={() => send({ type: "restart" })}
                      >
                        Заново
                      </button>
                    </div>
                  )}
                  <button
                    className="quiet"
                    disabled={!enabled}
                    onClick={(event) =>
                      timer.status === "completed"
                        ? send({ type: "returnToMenu" })
                        : setConfirm({
                            revision: application.revision,
                            trigger: event.currentTarget,
                          })
                    }
                  >
                    В меню
                  </button>
                </section>
              )
            )}
          </>
        )}
        {confirm && (
          <AnchoredDialog
            anchor={confirm.trigger}
            dialogRef={dialogRef}
            onClose={() => setConfirm(undefined)}
          >
            <h2 id="dialog-title">Вернуться в меню?</h2>
            <p id="dialog-description">
              Текущий отсчёт будет сброшен на общем экране
            </p>
            <div className="dialog-actions">
              <button
                className="primary"
                disabled={!enabled}
                onClick={() => {
                  if (
                    runtime.getSnapshot().remote?.application.revision !==
                    confirm.revision
                  ) {
                    setConfirm(undefined);
                    setNotice(
                      "Состояние экрана изменилось. Проверьте таймер и подтвердите возврат в меню ещё раз.",
                    );
                    return;
                  }
                  send({ type: "returnToMenu" }, confirm.revision);
                }}
              >
                В меню
              </button>
              <button
                className="dialog-cancel"
                autoFocus
                onClick={() => setConfirm(undefined)}
              >
                Отмена
              </button>
            </div>
          </AnchoredDialog>
        )}
        <footer className="remote-footer">
          <p>
            Звук воспроизводится на общем экране. При отключении пульта таймер
            продолжает работать.
          </p>
          {"vibrate" in navigator && (
            <>
              <label className="setting-switch">
                <span>Вибрация после команды</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={haptics}
                  onChange={(e) => setHaptics(e.target.checked)}
                />
              </label>
              <button
                className="quiet"
                onClick={() =>
                  setHapticNotice(
                    navigator.vibrate(70)
                      ? "Почувствовали отклик? Вибрация зависит от устройства."
                      : "Вибрация недоступна на этом устройстве.",
                  )
                }
              >
                Проверить вибрацию
              </button>
              <p role="status">{hapticNotice}</p>
            </>
          )}
          {state.access === "ready" && (
            <button className="quiet" onClick={() => runtime.release()}>
              Отключить пульт
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}
