import { describe, expect, it } from "vitest";
import { DisplayRuntime } from "../application";
import { parseClientMessage, parseServerMessage, commandIdFor, type RemoteSnapshot } from "./index";

const id = "1234567890abcdef1234567890abcdef";
const config = { mode: "intervals" as const, rounds: 2, workSeconds: 30, restSeconds: 10, preparationSeconds: 5 };
const runtime = new DisplayRuntime(config, { now: () => 0 });
const snapshot: RemoteSnapshot = { roomId: id, sessionEpoch: id, controlEpoch: 1, sequence: 1, displayNow: 0, commandValidUntil: 3000, application: runtime.getSnapshot() };
const command = { roomId: id, sessionEpoch: id, controlEpoch: 1, commandId: commandIdFor(id, 1, 1), commandSeq: 1, expectedRevision: 0, sampleSeq: 1, intent: { type: "start", config } };

describe("strict protocol boundary", () => {
  it("accepts versioned handshake and atomic start, not former split actions", () => {
    expect(parseClientMessage(JSON.stringify({ type: "hello", protocolVersion: 1, appVersion: "0.1.5", identity: { kind: "createDisplay" } }))).not.toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "command", command }))).not.toBeNull();
    for (const type of ["configure", "finish", "reset", "toggle", "constructor"]) {
      expect(parseClientMessage(JSON.stringify({ type: "command", command: { ...command, intent: { type } } }))).toBeNull();
    }
  });
  it("rejects untrusted configuration before core execution", () => {
    for (const invalid of [null, [], {}, { ...config, rounds: 0 }, { ...config, workSeconds: 1.1 }, { ...config, rounds: 99, workSeconds: 6039 }, { ...config, mode: "other" }, { ...config, extra: "value" }]) {
      expect(parseClientMessage(JSON.stringify({ type: "command", command: { ...command, intent: { type: "start", config: invalid } } }))).toBeNull();
    }
  });
  it("rejects unknown keys/types, prototype names and malformed messages", () => {
    for (const raw of ["{", "null", "[]", '"hello"', '{"type":"__proto__"}', '{"type":"constructor"}', '{"type":"release","roomId":"other"}', '{"type":"heartbeat","nonce":-1}', '{"type":"heartbeat","nonce":1e309}', '{"type":"heartbeat","nonce":0,"__proto__":{}}']) {
      expect(parseClientMessage(raw)).toBeNull();
      expect(parseServerMessage(raw)).toBeNull();
    }
  });
  it("validates complete snapshots rather than casting relay data", () => {
    expect(parseServerMessage(JSON.stringify({ type: "snapshot", snapshot }))).not.toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: "snapshot", snapshot: { ...snapshot, sequence: 0 } }))).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: "snapshot", snapshot: { ...snapshot, application: { ...snapshot.application, timer: { ...snapshot.application.timer, phase: { kind: "unknown", round: 0, durationMs: 100 } } } } }))).toBeNull();
  });
  it("enforces byte size, positive sequences and finite clock samples", () => {
    expect(parseClientMessage(" ".repeat(16 * 1024) + '{"type":"release"}')).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "hello", protocolVersion: 1, appVersion: "😀".repeat(8192), identity: { kind: "createDisplay" } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "command", command: { ...command, commandSeq: Number.MAX_SAFE_INTEGER + 1 } }))).toBeNull();
    expect(parseServerMessage('{"type":"clockPong","pingId":"1234567890abcdef","sentAt":0,"displayReceivedAt":0,"displaySentAt":1e309}')).toBeNull();
  });
  it("cannot reuse a former command identity with a higher sequence", () => {
    expect(parseClientMessage(JSON.stringify({ type: "command", command: { ...command, commandSeq: 2 } }))).toBeNull();
  });
});
