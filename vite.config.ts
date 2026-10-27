import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
const appPackage = JSON.parse(
  await readFile(new URL("./package.json", import.meta.url), "utf8"),
);
const relay = process.env.CF_TIMER_RELAY_URL ?? "http://127.0.0.1:43980";
const proxy = {
  "/ws": { target: relay, ws: true },
  "/healthz": { target: relay },
};
const headers = {
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appPackage.version) },
  server: {
    proxy,
    headers,
    ...(process.env.CF_TIMER_DESKTOP_REVIEW === "1" ? { hmr: false } : {}),
  },
  preview: { proxy, headers: {
    ...headers,
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectRegister: false,
      registerType: "prompt",
      manifest: {
        name: "CF Timer",
        short_name: "CF Timer",
        lang: "ru",
        description: "Таймер для тренировок",
        theme_color: "#101112",
        background_color: "#101112",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,webmanifest,ttf,woff2,txt,ico}"],
        manifestTransforms: [
          async (entries) => ({
            manifest: await Promise.all(
              entries.map(async (entry) => ({
                ...entry,
                integrity:
                  "sha256-" +
                  createHash("sha256")
                    .update(await readFile(`dist/${entry.url}`))
                    .digest("base64"),
              })),
            ),
            warnings: [],
          }),
        ],
      },
    }),
  ],
});
