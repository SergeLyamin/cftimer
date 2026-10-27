import { createRelayServer, isLoopbackAddress } from "./transport.ts";
import { RoomService } from "./room-service.ts";
const port = Number(process.env.CF_TIMER_PORT ?? 43980);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid CF_TIMER_PORT");
const host = process.env.CF_TIMER_HOST ?? "127.0.0.1";
const trustLoopbackProxy = process.env.CF_TIMER_TRUST_LOOPBACK_PROXY === "1";
if (trustLoopbackProxy && !isLoopbackAddress(host))
  throw new Error("Trusted proxy requires a loopback CF_TIMER_HOST");
const origins = (process.env.CF_TIMER_ORIGINS ?? "http://127.0.0.1:43970")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
for (const origin of origins)
  if (new URL(origin).origin !== origin)
    throw new Error("Origins must be exact URL origins");
let loggingAvailable = true;
process.stdout.on("error", () => {
  loggingAvailable = false;
});
function log(event: object) {
  if (!loggingAvailable || process.stdout.writableLength > 64 * 1024) return;
  try {
    process.stdout.write(
      `${JSON.stringify({ time: new Date().toISOString(), ...event })}\n`,
    );
  } catch {
    loggingAvailable = false;
  }
}
const service = new RoomService({ log });
const { server, wsServer } = createRelayServer({
  origins,
  service,
  trustLoopbackProxy,
});
server.listen(port, host, () => log({ event: "relay_listening", port }));
function stop() {
  for (const socket of wsServer.clients) socket.terminate();
  server.close();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
