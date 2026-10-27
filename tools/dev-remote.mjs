import { spawn } from "node:child_process";

// Separate ports/worktree from the local-timer release being reviewed elsewhere.
const host = process.env.CF_TIMER_DEV_HOST ?? "127.0.0.1";
const port = process.env.CF_TIMER_DEV_PORT ?? "43970";
const relayPort = process.env.CF_TIMER_PORT ?? "43980";
const preview = process.argv.includes("--preview");
const env = {
  ...process.env,
  CF_TIMER_PORT: relayPort,
  CF_TIMER_ORIGINS: process.env.CF_TIMER_ORIGINS ?? `http://${host}:${port}`,
  CF_TIMER_RELAY_URL: `http://127.0.0.1:${relayPort}`,
};
const children = [
  spawn(process.execPath, preview ? ["dist-relay/main.js"] : ["--import", "tsx", "src/server/main.ts"], { env, stdio: "inherit" }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js", ...(preview ? ["preview"] : []), "--host", host, "--port", port, "--strictPort"], { env, stdio: "inherit" }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const child of children) {
  child.on("error", (error) => { console.error(error.message); stop(1); });
  child.on("exit", (code) => { if (!stopping) stop(code || 0); });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
