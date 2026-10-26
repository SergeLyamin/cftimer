async (page) => {
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const engine = page.context().browser().browserType().name();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("http://127.0.0.1:43873/");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page
    .getByText("Готов к запуску без сети", { exact: true })
    .waitFor({ timeout: 30000 });
  await page.getByText("Версия 0.1.3", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Интервалы/ }).click();
  const work = page.getByLabel("Работа", { exact: true });
  await work.focus();
  await work.press("ControlOrMeta+A");
  await work.pressSequentially("0061", { delay: 40 });
  await work.pressSequentially("5");
  assert((await work.inputValue()) === "00:61", "fifth digit changed value");
  await page.getByLabel("Раунды", { exact: true }).fill("3");
  await work.fill("0012");
  await page.getByLabel("Отдых", { exact: true }).fill("0004");
  await page.locator("summary").click();
  await page.getByLabel("Подготовка", { exact: true }).fill("0000");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  for (const surface of ["время", "фаза", "раунды"]) {
    const button = page.getByRole("button", {
      name: `Пауза / продолжение: ${surface}`,
      exact: true,
    });
    await button.click();
    assert(
      (await page.locator(".app").getAttribute("data-status")) === "paused",
      "click failed " + surface,
    );
    await button.focus();
    await page.keyboard.press("Enter");
    assert(
      (await page.locator(".app").getAttribute("data-status")) === "running",
      "Enter failed " + surface,
    );
    await page.keyboard.press("Space");
    assert(
      (await page.locator(".app").getAttribute("data-status")) === "paused",
      "Space double toggled " + surface,
    );
    await button.click();
  }
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page
    .locator(".timer-controls")
    .evaluate((node) =>
      Promise.all(
        node
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
  for (const [width, height] of [
    [1280, 800],
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    const first = await page.locator(".timeline-segment").first().boundingBox();
    const last = await page.locator(".timeline-segment").last().boundingBox();
    assert(first.x > last.x, "timeline order");
    const main = await page
      .getByRole("button", { name: "Продолжить", exact: true })
      .boundingBox();
    const reset = await page
      .getByRole("button", { name: "Сброс", exact: true })
      .boundingBox();
    assert(main.height === 40 && reset.height === 40, "compact action height");
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "horizontal overflow",
    );
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: `output/playwright/cross013-${engine}-${width}.png`,
    });
  }
  if (engine === "webkit") {
    assert(errors.length === 0, JSON.stringify(errors));
    return {
      engine,
      version: page.context().browser().version(),
      viewports: ["1280x800", "390x844", "844x390"],
      checks:
        "input, fifth digit, click/Enter/Space toggles, rightmost countdown, 40px controls",
      offline:
        "tested separately with the origin stopped; setOffline navigation has Playwright issue 42775",
      javascriptErrors: errors,
    };
  }
  await page.context().setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: /AMRAP/ }).click();
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await page
    .getByRole("button", { name: "Пауза / продолжение: время", exact: true })
    .click();
  assert(
    (await page.locator(".app").getAttribute("data-status")) === "paused",
    "offline click",
  );
  await page.context().setOffline(false);
  assert(errors.length === 0, JSON.stringify(errors));
  return {
    engine,
    version: page.context().browser().version(),
    viewports: ["1280x800", "390x844", "844x390"],
    checks:
      "input, fifth digit, click/Enter/Space toggles, rightmost countdown, 40px controls, offline reload",
    javascriptErrors: errors,
  };
}
