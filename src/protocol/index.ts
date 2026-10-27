import { validateConfig, type TimerConfig } from "../timer";
import type { ApplicationIntent } from "../application/types";
import { MAX_MESSAGE_BYTES, commandIdFor, type ClientMessage, type ServerMessage, type RemoteCommand, type RemoteSnapshot } from "./types";
export * from "./types";

type Check = (value: unknown) => boolean;
const text: Check = (v) => typeof v === "string" && v.length > 0 && v.length <= 128;
const token: Check = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(v);
const boolean: Check = (v) => typeof v === "boolean";
const finite: Check = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;
const integer: Check = (v) => finite(v) && Number.isSafeInteger(v);
const positive: Check = (v) => integer(v) && (v as number) > 0;
const oneOf = (...items: unknown[]): Check => (v) => items.includes(v);
const optionalText = { requestId: token, waitMs: finite, approvalMs: finite };

function shape(required: Record<string, Check>, optional: Record<string, Check> = {}): Check {
  return (v) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
    const obj = v as Record<string, unknown>;
    return Object.keys(required).every((key) => Object.hasOwn(obj, key) && required[key](obj[key])) &&
      Object.keys(obj).every((key) => Object.hasOwn(required, key) || (Object.hasOwn(optional, key) && optional[key](obj[key])));
  };
}
const configShape = shape({ mode: oneOf("intervals", "tabata", "emom", "amrap", "for-time"), rounds: positive, workSeconds: positive, restSeconds: integer, preparationSeconds: integer });
export function isTimerConfig(v: unknown): v is TimerConfig {
  return configShape(v) && Object.keys(validateConfig(v as TimerConfig)).length === 0;
}
export function isApplicationIntent(v: unknown): v is ApplicationIntent {
  return shape({ type: oneOf("start"), config: isTimerConfig })(v) ||
    shape({ type: oneOf("pause", "resume", "restart", "edit", "returnToMenu", "repeat") })(v);
}
const phase = shape({ kind: oneOf("preparation", "work", "rest"), round: integer, durationMs: positive });
const timer = shape({
  status: oneOf("idle", "running", "paused", "completed"), config: isTimerConfig,
  phase: (v) => v === null || phase(v), phaseIndex: integer, elapsedMs: finite,
  phaseElapsedMs: finite, remainingMs: finite, displayMs: finite,
  countDirection: oneOf("up", "down"), completionReason: oneOf(null, "limit", "finished"),
  revision: integer, runId: integer, totalMs: finite,
});
const application = shape({ timer, view: oneOf("home", "setup", "timer"), revision: integer });
const room = { roomId: token, sessionEpoch: token };
const remoteSnapshot = shape({ ...room, controlEpoch: integer, sequence: positive, displayNow: finite, commandValidUntil: finite, application });
export function isRemoteSnapshot(v: unknown): v is RemoteSnapshot { return remoteSnapshot(v); }
const commandShape = shape({ ...room, controlEpoch: integer, commandId: token, commandSeq: positive, expectedRevision: integer, sampleSeq: positive, intent: isApplicationIntent });
const remoteCommand: Check = (v) => {
  if (!commandShape(v)) return false;
  const c = v as RemoteCommand;
  return c.commandId === commandIdFor(c.sessionEpoch, c.controlEpoch, c.commandSeq);
};
export function isRemoteCommand(v: unknown): v is RemoteCommand { return remoteCommand(v); }
const reason = oneOf("stale", "invalid_state", "invalid_config", "expired_command", "unauthorized", "id_conflict", "history_expired", "not_seen");
const result = shape({ commandId: token, commandSeq: positive, status: oneOf("accepted", "rejected", "not_seen", "history_expired"), snapshot: remoteSnapshot }, { reason });
const identity: Check = (v) => [
  shape({ kind: oneOf("createDisplay") }),
  shape({ kind: oneOf("resumeDisplay", "resumeController"), ...room, credential: token }),
  shape({ kind: oneOf("join"), roomId: token, invitation: token, claimSecret: token }),
].some((check) => check(v));
const message = (type: string, required: Record<string, Check> = {}, optional: Record<string, Check> = {}) => shape({ type: oneOf(type), ...required }, optional);
const clientChecks: Record<ClientMessage["type"], Check> = {
  hello: message("hello", { protocolVersion: positive, appVersion: text, identity }),
  heartbeat: message("heartbeat", { nonce: finite }),
  refreshInvitation: message("refreshInvitation"), closeRoom: message("closeRoom"),
  requestControl: message("requestControl"), cancelRequest: message("cancelRequest"),
  release: message("release"), revoke: message("revoke"),
  transferDecision: message("transferDecision", { requestId: token, accept: boolean }),
  snapshot: message("snapshot", { snapshot: remoteSnapshot }),
  command: message("command", { command: remoteCommand }),
  commandStatus: message("commandStatus", { commandId: token, commandSeq: positive, controlEpoch: integer }),
  commandResult: message("commandResult", { controllerId: token, result }),
  fenceAck: message("fenceAck", { acquisitionId: token, controlEpoch: integer, controllerGeneration: integer, snapshot: remoteSnapshot }),
  clockPing: message("clockPing", { pingId: token, sentAt: finite }),
  clockPong: message("clockPong", { controllerId: token, pingId: token, sentAt: finite, displayReceivedAt: finite, displaySentAt: finite }),
};
const serverChecks: Record<ServerMessage["type"], Check> = {
  displayWelcome: message("displayWelcome", { ...room, credential: token, screenName: text, hostGeneration: positive }),
  controllerWelcome: message("controllerWelcome", { ...room, controllerId: token, credential: token, screenName: text }),
  invitation: message("invitation", { invitation: token, expiresInMs: finite }),
  heartbeat: message("heartbeat", { nonce: finite }),
  access: message("access", { state: oneOf("waiting", "ready", "denied", "expired", "replaced", "no-display", "cancelled", "released", "busy"), controlEpoch: integer }, optionalText),
  transferRequest: message("transferRequest", { requestId: token, expiresInMs: finite }),
  transferEnded: message("transferEnded", { requestId: token }),
  controllerStatus: message("controllerStatus", { hasOwner: boolean, connected: boolean, pending: boolean }),
  displayStatus: message("displayStatus", { connected: boolean }),
  fence: message("fence", { acquisitionId: token, controlEpoch: integer, controllerId: (v) => v === null || token(v), controllerGeneration: integer }),
  snapshot: message("snapshot", { snapshot: remoteSnapshot }),
  command: message("command", { controllerId: token, controllerGeneration: positive, command: remoteCommand }),
  commandStatus: message("commandStatus", { controllerId: token, controllerGeneration: positive, commandId: token, commandSeq: positive, controlEpoch: integer }),
  commandResult: message("commandResult", { result }),
  clockPing: message("clockPing", { controllerId: token, pingId: token, sentAt: finite }),
  clockPong: message("clockPong", { pingId: token, sentAt: finite, displayReceivedAt: finite, displaySentAt: finite }),
  error: message("error", { code: oneOf("bad_message", "incompatible_version", "unauthorized", "room_expired", "invitation_invalid", "rate_limited", "capacity", "not_ready"), fatal: boolean }),
};
function parse(raw: string, checks: Record<string, Check>): unknown | null {
  if (typeof raw !== "string" || new TextEncoder().encode(raw).byteLength > MAX_MESSAGE_BYTES) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || !value || !("type" in value) || typeof value.type !== "string") return null;
    return Object.hasOwn(checks, value.type) && checks[value.type](value) ? value : null;
  } catch { return null; }
}
export function parseClientMessage(raw: string): ClientMessage | null { return parse(raw, clientChecks) as ClientMessage | null; }
export function parseServerMessage(raw: string): ServerMessage | null { return parse(raw, serverChecks) as ServerMessage | null; }
