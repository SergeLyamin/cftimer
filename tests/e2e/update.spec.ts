import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";

test("new worker waits while another tab runs, activates only after all tabs close", async ({
  browser,
}) => {
  let version = 1;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, "http://localhost");
      const file = resolve(
        "dist",
        "." + (url.pathname === "/" ? "/index.html" : url.pathname),
      );
      if (!file.startsWith(resolve("dist") + "/")) {
        res.writeHead(403).end();
        return;
      }
      const data = await readFile(file);
      const types: Record<string, string> = {
        ".js": "text/javascript",
        ".html": "text/html",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".webmanifest": "application/manifest+json",
      };
      res.setHeader(
        "Content-Type",
        types[extname(file)] ?? "application/octet-stream",
      );
      res.setHeader("Cache-Control", "no-store");
      res.end(
        url.pathname === "/sw.js"
          ? Buffer.concat([data, Buffer.from(`\n// deployment ${version}`)])
          : data,
      );
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) =>
    server.listen(4181, "127.0.0.1", resolve),
  );
  const context = await browser.newContext();
  try {
    const idle = await context.newPage();
    await idle.goto("http://127.0.0.1:4181");
    await idle.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await idle.reload();
    const active = await context.newPage();
    await active.goto("http://127.0.0.1:4181");
    await active.getByRole("button", { name: /AMRAP/ }).click();
    await active.getByRole("button", { name: /Начать/ }).click();
    version = 2;
    await idle.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg!.update();
    });
    await expect
      .poll(() =>
        idle.evaluate(
          async () =>
            !!(await navigator.serviceWorker.getRegistration())?.waiting,
        ),
      )
      .toBe(true);
    await expect(
      active.getByRole("button", { name: "Пауза", exact: true }),
    ).toBeVisible();
    await idle.close();
    await expect
      .poll(() =>
        active.evaluate(
          async () =>
            !!(await navigator.serviceWorker.getRegistration())?.waiting,
        ),
      )
      .toBe(true);
    await active.close();
    const next = await context.newPage();
    await next.goto("http://127.0.0.1:4181");
    await expect
      .poll(() =>
        next.evaluate(
          async () =>
            !(await navigator.serviceWorker.getRegistration())?.waiting,
        ),
      )
      .toBe(true);
    await expect(
      next.getByRole("heading", { name: "Выберите режим" }),
    ).toBeVisible();
  } finally {
    await context.close();
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
