import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
const appPackage = JSON.parse(
  await readFile(new URL("./package.json", import.meta.url), "utf8"),
);
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appPackage.version) },
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
