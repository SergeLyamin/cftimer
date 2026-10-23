async (page) => {
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  if (await page.locator(".timer").count() === 0) {
    await page.getByRole("button", { name: /AMRAP/ }).click();
    await page.getByRole("button", { name: "Начать", exact: true }).click();
  }
  await page.getByRole("button", { name: "Пауза", exact: true }).waitFor();
  const oldAsset = await page.locator("script[src]").getAttribute("src");
  assert(
    oldAsset.includes("index-CRZNHds-"),
    "expected previous installed PWA",
  );
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    if (!r) throw new Error("old registration missing");
    await r.update();
  });
  await page.waitForFunction(
    async () => !!(await navigator.serviceWorker.getRegistration())?.waiting,
    {},
    { timeout: 30000 },
  );
  assert(
    (await page.locator("script[src]").getAttribute("src")) === oldAsset,
    "old workout reloaded",
  );
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  const oldTime = await page.locator(".time").innerText();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  assert(
    await page.getByRole("button", { name: "Пауза", exact: true }).isVisible(),
    "old workout stopped",
  );
  await page.screenshot({
    path: "output/playwright/live-update-waiting-2026-10-23.png",
    fullPage: true,
  });
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1280, height: 720 } });
  const fresh = await context.newPage();
  const errors = [];
  fresh.on("pageerror", (e) => errors.push(e.message));
  try {
    await fresh.goto("https://timer.lyamin.org/");
    await fresh
      .getByText("Готов к запуску без сети", { exact: true })
      .waitFor({ timeout: 25000 });
    await fresh.evaluate(() => document.fonts.ready);
    assert(
      (await fresh.locator(".mode-icon").count()) === 5,
      "new home missing icons",
    );
    assert(
      (await fresh.locator("script[src]").getAttribute("src")).includes(
        "index-ZPUCepVK",
      ),
      "wrong fresh release",
    );
    await fresh.screenshot({
      path: "output/playwright/live-home-2026-10-23.png",
      fullPage: true,
    });
    await fresh.getByRole("button", { name: /Интервалы/ }).click();
    await fresh.getByRole("button", { name: "Начать", exact: true }).click();
    assert(
      (await fresh.locator("header,.brand").count()) === 0,
      "brand visible on timer",
    );
    assert(
      await fresh
        .getByRole("button", { name: "Включить звук", exact: true })
        .evaluate(
          (e) =>
            e.nextElementSibling?.getAttribute("aria-label") === "Полный экран",
        ),
      "sound ordering",
    );
    await fresh.getByRole("button", { name: "О проекте", exact: true }).click();
    await fresh.keyboard.press("Escape");
    assert(
      (await fresh.getByRole("dialog").count()) === 0,
      "About did not dismiss",
    );
    await fresh.getByRole("button", { name: "Пауза", exact: true }).click();
    await fresh.mouse.move(0, 0);
    await fresh.screenshot({
      path: "output/playwright/live-timer-2026-10-23.png",
      fullPage: true,
    });
    await context.setOffline(true);
    await fresh.reload();
    await fresh.getByRole("heading", { name: "Выберите режим" }).waitFor();
    await fresh.getByRole("button", { name: /AMRAP/ }).click();
    await fresh.getByRole("button", { name: "Начать", exact: true }).click();
    await fresh.getByRole("button", { name: "Пауза", exact: true }).click();
    await fresh.evaluate(async () => {
      const face = new FontFace(
        "LiveOfflineCheck",
        "url(/fonts/Oswald-Variable.ttf)",
        { weight: "700" },
      );
      await face.load();
      if (face.status !== "loaded") throw new Error("offline font failed");
    });
    assert((await fresh.locator("header").count()) === 0, "offline app old UI");
    await fresh.mouse.move(0, 0);
    await fresh.screenshot({
      path: "output/playwright/live-offline-2026-10-23.png",
      fullPage: true,
    });
    assert(errors.length === 0, JSON.stringify(errors));
  } finally {
    await context.setOffline(false);
    await context.close();
  }
  await page.getByRole("button", { name: "Завершить", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Завершить", exact: true })
    .click();
  await page.goto("about:blank");
  await page.waitForTimeout(1000);
  await page.goto("https://timer.lyamin.org/");
  await page.getByRole("heading", { name: "Выберите режим" }).waitFor();
  assert(
    (await page.locator(".mode-icon").count()) === 5,
    "existing PWA did not upgrade",
  );
  assert(
    (await page.locator("script[src]").getAttribute("src")).includes(
      "index-ZPUCepVK",
    ),
    "wrong upgraded release",
  );
  await page.screenshot({
    path: "output/playwright/live-upgraded-pwa-2026-10-23.png",
    fullPage: true,
  });
  return {
    oldAsset,
    oldTime,
    update: "waiting without workout reload; activated after client left",
    fresh: "new UI, pause, About, offline reload/start/font",
    javascriptErrors: errors,
  };
}
