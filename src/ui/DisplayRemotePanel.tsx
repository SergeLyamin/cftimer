import { useEffect, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import type { DisplayBridge } from "../remote/display";

export function DisplayRemotePanel({
  bridge,
  timer,
}: {
  bridge: DisplayBridge;
  timer: boolean;
}) {
  const state = useSyncExternalStore(bridge.subscribe, bridge.getSnapshot);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("cftimer.qr.collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [timerExpanded, setTimerExpanded] = useState(false);
  const [image, setImage] = useState<{ url: string; data: string }>();
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 500);
    return () => clearInterval(id);
  }, []);
  const valid =
    state.connection === "connected" &&
    state.invitation &&
    state.invitation.expiresAt > now;
  const url = valid
    ? `${location.origin}/remote#room=${encodeURIComponent(state.roomId!)}&invite=${encodeURIComponent(state.invitation!.token)}`
    : undefined;
  useEffect(() => {
    let active = true;
    if (url)
      void QRCode.toDataURL(url, {
        width: 224,
        margin: 4,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      })
        .then((data) => {
          if (active) setImage({ url, data });
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [url]);
  const expanded = timer ? timerExpanded : !collapsed;
  function toggle() {
    if (timer) setTimerExpanded(!timerExpanded);
    else {
      setCollapsed(!collapsed);
      try {
        localStorage.setItem("cftimer.qr.collapsed", String(!collapsed));
      } catch {
        /* Memory state remains available. */
      }
    }
  }
  return (
    <aside
      className={`display-remote ${timer ? "display-remote-timer" : ""} ${expanded ? "is-expanded" : "is-collapsed"}`}
      aria-label="Управление с телефона"
    >
      <button
        className="quiet remote-panel-toggle"
        onClick={toggle}
        aria-expanded={expanded}
      >
        {expanded ? "Свернуть" : "Пульт"}
        <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <div className="remote-panel-body">
          <h2>Пульт на телефоне</h2>
          <p>Наведите камеру на QR</p>
          {url && image?.url === url ? (
            <img
              src={image.data}
              width="224"
              height="224"
              alt="QR-приглашение для управления этим экраном"
            />
          ) : (
            <div className="qr-unavailable" role="status">
              {state.error === "incompatible_version"
                ? "Версия экрана несовместима с сервером. Обновите страницу после тренировки."
                : state.error === "rate_limited"
                  ? "Слишком много подключений. Повторите попытку позже. Локальный таймер работает."
                  : state.error === "capacity"
                    ? "Сервер временно занят. Повторите попытку позже. Локальный таймер работает."
                    : state.connection === "connected"
                      ? "Обновляем приглашение…"
                      : "Нет связи с сервером. Локальный таймер работает."}
            </div>
          )}
          {state.stopped && state.error !== "incompatible_version" && (
            <button className="secondary" onClick={() => bridge.retry()}>
              Повторить подключение
            </button>
          )}
          <p className="remote-screen-name">
            {state.screenName ?? "Общий экран"}
          </p>
          {valid && (
            <>
              <p role="status">
                {state.controller?.hasOwner
                  ? state.controller.connected
                    ? "Пульт подключён"
                    : "Связь с пультом потеряна"
                  : "Пульт свободен"}
              </p>
              <p className="remote-help">
                {state.controller?.hasOwner
                  ? "Новый телефон запросит передачу у активного пульта."
                  : "Первый телефон получает управление сразу."}
              </p>
            </>
          )}
          {state.connection === "connected" && state.controller?.hasOwner && (
            <button className="secondary" onClick={() => bridge.revoke()}>
              Отключить пульт
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
