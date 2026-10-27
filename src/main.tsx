import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App, { defaults } from "./ui/App";
import { DisplayRuntime } from "./application";
import { DisplayBridge } from "./remote/display";
import { ControllerRuntime } from "./remote/controller";
import { RemoteApp, RemoteError } from "./ui/RemoteApp";
import type { HelloIdentity } from "./protocol";
import "./styles.css";

// The document chooses its role once. React renders never create rooms or timers.
const root = createRoot(document.getElementById("root")!);
if (location.pathname === "/remote" || location.pathname === "/remote/") {
  // A freshly scanned invitation may navigate within this same /remote document.
  // Reload only the controller so bootstrap can consume and remove the new secret.
  window.addEventListener("hashchange", () => {
    if (location.hash.length > 1) location.reload();
  });
  const fragment = new URLSearchParams(location.hash.slice(1));
  const hasInvitation = fragment.has("room") || fragment.has("invite");
  const roomId = fragment.get("room"),
    invitation = fragment.get("invite");
  history.replaceState(null, "", location.pathname + location.search);
  try {
    if (hasInvitation && (!roomId || !invitation))
      throw new Error("Incomplete invitation");
    const identity: HelloIdentity | undefined =
      roomId && invitation
        ? {
            kind: "join",
            roomId,
            invitation,
            claimSecret: crypto.randomUUID().replaceAll("-", ""),
          }
        : undefined;
    const controller = new ControllerRuntime({
      identity,
      appVersion: __APP_VERSION__,
    });
    controller.connect();
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) controller.dispose();
    });
    root.render(
      <StrictMode>
        <RemoteApp runtime={controller} />
      </StrictMode>,
    );
  } catch {
    root.render(<RemoteError />);
  }
} else {
  const runtime = new DisplayRuntime(defaults);
  const bridge =
    Math.min(window.innerWidth, window.innerHeight) > 640
      ? new DisplayBridge(runtime, { appVersion: __APP_VERSION__ })
      : undefined;
  bridge?.connect();
  let tickFrame: number;
  function tick() {
    runtime.tick();
    tickFrame = requestAnimationFrame(tick);
  }
  tickFrame = requestAnimationFrame(tick);
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) {
      cancelAnimationFrame(tickFrame);
      bridge?.dispose();
      runtime.dispose();
    }
  });
  root.render(
    <StrictMode>
      <App runtime={runtime} bridge={bridge} />
    </StrictMode>,
  );
}
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline readiness remains false; local timing never depends on registration.
    });
  });
}
