async (page) => {
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.bringToFront();
  const oldAsset = await page.locator("script[src]").getAttribute("src");
  assert(oldAsset.includes("index-ClRRNzVg"), "expected previous release");
  assert((await page.locator(".timer").count()) === 1, "old workout missing");
  await page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration()).update(),
  );
  await page.waitForFunction(
    async () => !!(await navigator.serviceWorker.getRegistration())?.waiting,
    null,
    { timeout: 30000 },
  );
  assert(
    (await page.locator("script[src]").getAttribute("src")) === oldAsset,
    "active client reloaded",
  );
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.screenshot({
    path: "output/playwright/live013-update-waiting.png",
  });

  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 390, height: 844 } });
  const fresh = await context.newPage();
  const errors = [];
  fresh.on("pageerror", (error) => errors.push(error.message));
  let wakeStatus;
  try {
    await fresh.goto("https://timer.lyamin.org/");
    await fresh.bringToFront();
    assert(
      (await fresh.locator("script[src]").getAttribute("src")).includes(
        "index-BC77AwsP",
      ),
      "wrong fresh asset",
    );
    await fresh.getByRole("button", { name: "Настройки", exact: true }).click();
    await fresh.getByText("Версия 0.1.3", { exact: true }).waitFor();
    await fresh
      .getByText("Готов к запуску без сети", { exact: true })
      .waitFor({ timeout: 25000 });
    await fresh
      .getByRole("switch", { name: "Конфетти в конце", exact: true })
      .uncheck();
    await fresh
      .getByRole("switch", { name: "Пульсация краёв", exact: true })
      .uncheck();
    await fresh.keyboard.press("Escape");
    await fresh.getByRole("button", { name: /Интервалы/ }).click();
    await fresh.getByLabel("Раунды", { exact: true }).fill("3");
    await fresh.getByLabel("Работа", { exact: true }).fill("0020");
    await fresh.getByLabel("Отдых", { exact: true }).fill("0004");
    await fresh.getByRole("button", { name: "Старт", exact: true }).click();
    assert(
      (await fresh.locator(".timer-meta h1").innerText()).includes("1 из 3"),
      "round heading missing",
    );
    const first = await fresh
      .locator(".timeline-segment")
      .first()
      .boundingBox();
    const last = await fresh.locator(".timeline-segment").last().boundingBox();
    assert(first.x > last.x, "countdown did not start at right edge");
    for (const name of ["время", "фаза", "раунды"]) {
      const button = fresh.getByRole("button", {
        name: `Пауза / продолжение: ${name}`,
        exact: true,
      });
      await button.click();
      assert(
        (await fresh.locator(".phase").innerText()) === "ПАУЗА",
        "click did not pause " + name,
      );
      await button.click();
      assert(
        (await fresh.locator(".phase").innerText()) !== "ПАУЗА",
        "click did not resume " + name,
      );
    }
    await fresh.getByRole("button", { name: "Пауза", exact: true }).click();
    await fresh.getByRole("button", { name: "Сброс", exact: true }).click();
    assert((await fresh.getByRole("dialog").count()) === 0, "reset prompted");
    await fresh
      .locator(".timer-controls")
      .evaluate((n) =>
        Promise.all(
          n
            .getAnimations({ subtree: true })
            .map((a) => a.finished.catch(() => {})),
        ),
      );
    await fresh.mouse.move(0, 0);
    await fresh.screenshot({
      path: "output/playwright/live013-phone.png",
      fullPage: true,
    });
    await fresh.getByRole("button", { name: "Настройки", exact: true }).click();
    wakeStatus = await fresh.locator(".settings-statuses").innerText();
    await fresh.keyboard.press("Escape");
    await context.setOffline(true);
    await fresh.reload();
    await fresh.getByRole("button", { name: "Настройки", exact: true }).click();
    assert(
      !(await fresh
        .getByRole("switch", { name: "Конфетти в конце", exact: true })
        .isChecked()),
      "confetti preference lost",
    );
    assert(
      !(await fresh
        .getByRole("switch", { name: "Пульсация краёв", exact: true })
        .isChecked()),
      "effects preference lost",
    );
    await fresh.keyboard.press("Escape");
    for (const asset of [
      "/favicon.svg",
      "/favicon.ico",
      "/fonts/Oswald-Variable.ttf",
    ])
      assert(
        await fresh.evaluate(async (url) => (await fetch(url)).ok, asset),
        "offline missing " + asset,
      );
    await fresh.getByRole("button", { name: /AMRAP/ }).click();
    await fresh.getByRole("button", { name: "Старт", exact: true }).click();
    await fresh
      .getByRole("button", { name: "Пауза / продолжение: время", exact: true })
      .click();
    assert(
      (await fresh.locator(".phase").innerText()) === "ПАУЗА",
      "offline click failed",
    );
    await fresh.mouse.move(0, 0);
    await fresh.screenshot({
      path: "output/playwright/live013-offline.png",
      fullPage: true,
    });
    assert(errors.length === 0, JSON.stringify(errors));
  } finally {
    await context.setOffline(false);
    await context.close();
  }
  await page.bringToFront();
  await page.getByRole("button", { name: "Все режимы", exact: true }).click();
  await page.getByRole("button", { name: "В меню", exact: true }).click();
  await page.goto("about:blank");
  await page.waitForTimeout(1000);
  await page.goto("https://timer.lyamin.org/");
  assert(
    (await page.locator("script[src]").getAttribute("src")).includes(
      "index-BC77AwsP",
    ),
    "installed PWA not upgraded",
  );
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page.getByText("Версия 0.1.3", { exact: true }).waitFor();
  await page.screenshot({ path: "output/playwright/live013-upgraded-pwa.png" });
  return {
    oldAsset,
    newAsset: "index-BC77AwsP.js",
    version: "0.1.3",
    update: "waiting while active; activated after client left",
    fresh: "rightmost countdown, click toggles, header and direct restart",
    offline: "reload, preferences, new workout, favicons/font and click pause",
    wakeStatus,
    javascriptErrors: errors,
  };
}
