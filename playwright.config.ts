import { defineConfig, devices } from "@playwright/test";
const browser = process.env.CF_TIMER_BROWSER ?? "chromium";
const device = {
  chromium: "Desktop Chrome",
  firefox: "Desktop Firefox",
  webkit: "Desktop Safari",
}[browser];
if (!device) throw new Error(`Unsupported CF_TIMER_BROWSER: ${browser}`);
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:43871", trace: "retain-on-failure" },
  projects: [{ name: browser, use: { ...devices[device] } }],
  webServer: {
    command: "npm run preview -- --port 43871 --strictPort",
    port: 43871,
    reuseExistingServer: false,
  },
});
