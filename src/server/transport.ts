import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { MAX_MESSAGE_BYTES, parseClientMessage } from "../protocol/index.ts";
import { RoomService } from "./room-service.ts";

export function createRelayServer(options: {
  origins: string[];
  service?: RoomService;
}) {
  const service = options.service ?? new RoomService();
  const origins = new Set(options.origins);
  const server = createServer((req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"status":"ok"}');
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  const wsServer = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
    perMessageDeflate: false,
  });
  const ips = new Map<string, number>();
  server.on("upgrade", (request, socket, head) => {
    const source = request.socket.remoteAddress ?? "unknown";
    if (
      wsServer.clients.size >= 128 ||
      request.url !== "/ws" ||
      !request.headers.origin ||
      !origins.has(request.headers.origin) ||
      (ips.get(source) ?? 0) >= 32
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    wsServer.handleUpgrade(request, socket, head, (ws) => {
      ips.set(source, (ips.get(source) ?? 0) + 1);
      const id = randomUUID();
      const peer = {
        id,
        send: (message: import("../protocol/types.ts").ServerMessage) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          if (ws.bufferedAmount > 64 * 1024) {
            service.disconnect(id);
            ws.terminate();
            return;
          }
          ws.send(JSON.stringify(message));
        },
        close: (code: number, reason: string) => {
          ws.close(code, reason);
          const timer = setTimeout(() => ws.terminate(), 1000);
          timer.unref();
        },
      };
      ws.on("close", () => {
        service.disconnect(id);
        const remaining = (ips.get(source) ?? 1) - 1;
        if (remaining) ips.set(source, remaining);
        else ips.delete(source);
      });
      ws.on("error", () => {
        service.disconnect(id);
        ws.terminate();
      });
      if (!service.connect(peer, source)) return;
      ws.on("message", (data, binary) => {
        const message = binary ? null : parseClientMessage(data.toString());
        if (!message) {
          peer.send({ type: "error", code: "bad_message", fatal: true });
          service.disconnect(id);
          peer.close(1008, "bad_message");
          return;
        }
        service.receive(id, message);
      });
    });
  });
  const interval = setInterval(() => service.tick(), 250);
  interval.unref();
  server.on("close", () => {
    clearInterval(interval);
    for (const socket of wsServer.clients) socket.terminate();
    wsServer.close();
  });
  return { server, service, wsServer };
}
