import type { ApplicationIntent, ApplicationSnapshot } from "../application/types";

export const PROTOCOL_VERSION = 1 as const;
export const MAX_MESSAGE_BYTES = 16 * 1024;
export const COMMAND_WINDOW_MS = 3_000;
export const HEARTBEAT_MS = 3_000;
export const CONTACT_TIMEOUT_MS = 10_000;
export const INVITE_TTL_MS = 120_000;
export const TRANSFER_TTL_MS = 20_000;
export const TAKEOVER_MS = 60_000;
export const HOST_TTL_MS = 600_000;
export const SESSION_TTL_MS = 8 * 60 * 60 * 1_000;

/** A command identity cannot be reused with a fresh sequence after cache eviction. */
export function commandIdFor(sessionEpoch: string, controlEpoch: number, commandSeq: number): string {
  return `${sessionEpoch}_${controlEpoch}_${commandSeq}`;
}

export interface RoomIdentity {
  roomId: string;
  sessionEpoch: string;
}
export interface RemoteSnapshot extends RoomIdentity {
  controlEpoch: number;
  sequence: number;
  displayNow: number;
  commandValidUntil: number;
  application: ApplicationSnapshot;
}
export interface RemoteCommand extends RoomIdentity {
  controlEpoch: number;
  commandId: string;
  commandSeq: number;
  expectedRevision: number;
  sampleSeq: number;
  intent: ApplicationIntent;
}
export type RejectionCode =
  | "stale" | "invalid_state" | "invalid_config" | "expired_command"
  | "unauthorized" | "id_conflict" | "history_expired" | "not_seen";
export interface CommandResult {
  commandId: string;
  commandSeq: number;
  status: "accepted" | "rejected" | "not_seen" | "history_expired";
  reason?: RejectionCode;
  snapshot: RemoteSnapshot;
}
export type HelloIdentity =
  | { kind: "createDisplay" }
  | ({ kind: "resumeDisplay"; credential: string } & RoomIdentity)
  | { kind: "join"; roomId: string; invitation: string; claimSecret: string }
  | ({ kind: "resumeController"; credential: string } & RoomIdentity);
export type ClientMessage =
  | { type: "hello"; protocolVersion: number; appVersion: string; identity: HelloIdentity }
  | { type: "heartbeat"; nonce: number }
  | { type: "refreshInvitation" }
  | { type: "closeRoom" }
  | { type: "requestControl" }
  | { type: "cancelRequest" }
  | { type: "release" }
  | { type: "revoke" }
  | { type: "transferDecision"; requestId: string; accept: boolean }
  | { type: "snapshot"; snapshot: RemoteSnapshot }
  | { type: "command"; command: RemoteCommand }
  | { type: "commandStatus"; commandId: string; commandSeq: number; controlEpoch: number }
  | { type: "commandResult"; controllerId: string; result: CommandResult }
  | { type: "fenceAck"; acquisitionId: string; controlEpoch: number; controllerGeneration: number; snapshot: RemoteSnapshot }
  | { type: "clockPing"; pingId: string; sentAt: number }
  | { type: "clockPong"; controllerId: string; pingId: string; sentAt: number; displayReceivedAt: number; displaySentAt: number };

export type AccessState = "waiting" | "ready" | "denied" | "expired" | "replaced" | "no-display" | "cancelled" | "released" | "busy";
export type ProtocolError = "bad_message" | "incompatible_version" | "unauthorized" | "room_expired" | "invitation_invalid" | "rate_limited" | "capacity" | "not_ready";
export type ServerMessage =
  | ({ type: "displayWelcome"; credential: string; screenName: string; hostGeneration: number } & RoomIdentity)
  | ({ type: "controllerWelcome"; controllerId: string; credential: string; screenName: string } & RoomIdentity)
  | { type: "invitation"; invitation: string; expiresInMs: number }
  | { type: "heartbeat"; nonce: number }
  | { type: "access"; state: AccessState; controlEpoch: number; requestId?: string; waitMs?: number; approvalMs?: number }
  | { type: "transferRequest"; requestId: string; expiresInMs: number }
  | { type: "transferEnded"; requestId: string }
  | { type: "controllerStatus"; hasOwner: boolean; connected: boolean; pending: boolean }
  | { type: "displayStatus"; connected: boolean }
  | { type: "fence"; acquisitionId: string; controlEpoch: number; controllerId: string | null; controllerGeneration: number }
  | { type: "snapshot"; snapshot: RemoteSnapshot }
  | { type: "command"; controllerId: string; controllerGeneration: number; command: RemoteCommand }
  | { type: "commandStatus"; controllerId: string; controllerGeneration: number; commandId: string; commandSeq: number; controlEpoch: number }
  | { type: "commandResult"; result: CommandResult }
  | { type: "clockPing"; controllerId: string; pingId: string; sentAt: number }
  | { type: "clockPong"; pingId: string; sentAt: number; displayReceivedAt: number; displaySentAt: number }
  | { type: "error"; code: ProtocolError; fatal: boolean };
