import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import { Icon } from "./Icon";
import type { DisplayBridge } from "../remote/display";

export function DisplayRemotePanel({
  bridge,
  open,
  setOpen,
}: {
  bridge: DisplayBridge;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const state = useSyncExternalStore(bridge.subscribe, bridge.getSnapshot);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const connected =
    state.connection === "connected" &&
    !state.stopped &&
    state.controller?.hasOwner === true &&
    state.controller.connected;
  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const focus = (event: FocusEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key, true);
    document.addEventListener("focusin", focus);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("focusin", focus);
    };
  }, [open, setOpen]);
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
  return (
    <div className="display-remote-control" ref={containerRef}>
      <button
        ref={triggerRef}
        className="quiet icon-button remote-qr-button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={`Пульт с телефона${connected ? ": подключён" : ""}`}
        title="Пульт с телефона"
        aria-expanded={open}
        aria-controls="display-remote-popover"
        aria-haspopup="dialog"
      >
        <Icon name="qr" />
        {connected && (
          <span className="remote-connected-dot" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div
          id="display-remote-popover"
          className="display-remote-popover"
          role="dialog"
          aria-label="Пульт с телефона"
          onKeyDown={(event) => event.stopPropagation()}
        >
          <button
            ref={closeRef}
            className="quiet icon-button remote-panel-close"
            onClick={() => close()}
            aria-label="Закрыть QR"
          >
            <Icon name="close" />
          </button>
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
        </div>
      )}
    </div>
  );
}
