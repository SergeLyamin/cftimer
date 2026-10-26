async (page) => {
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  const choose = async (name) => {
    await page.goto("http://127.0.0.1:5173/");
    await page.getByRole("button", { name: new RegExp(name) }).click();
  };
  const prep = async (value) => {
    await page.getByText("Время подготовки", { exact: true }).click();
    await page.getByLabel("Подготовка", { exact: true }).fill(value);
  };
  const fraction = async () =>
    Number(await page.getByRole("progressbar").getAttribute("aria-valuenow"));
  await choose("Интервалы");
  const work = page.getByLabel("Работа", { exact: true });
  await work.focus();
  await work.press("ControlOrMeta+A");
  await work.pressSequentially("0061", { delay: 60 });
  assert((await work.inputValue()) === "00:61", "seconds 61 rejected");
  const total = await page.locator(".preview strong").innerText();
  await work.pressSequentially("7");
  assert((await work.inputValue()) === "00:61", "fifth digit changed value");
  assert(
    (await work.getAttribute("aria-invalid")) === "false",
    "fifth digit invalidated field",
  );
  assert(
    (await page.locator(".preview strong").innerText()) === total,
    "fifth digit broke total",
  );
  await page.getByLabel("Раунды", { exact: true }).fill("100");
  assert(
    (await page.getByLabel("Раунды", { exact: true }).inputValue()) === "99",
    "round limit failed",
  );
  assert(
    (await page.locator(".limit-toast").innerText()).includes("не более 99"),
    "limit notice missing",
  );
  await page.getByLabel("Раунды", { exact: true }).fill("2");
  await work.fill("0004");
  await page.getByLabel("Отдых", { exact: true }).fill("0004");
  await prep("0004");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  assert(
    (await page
      .getByRole("progressbar")
      .evaluate((n) => n.getBoundingClientRect().height)) === 50,
    "bar not 50px",
  );
  await page.waitForTimeout(1900);
  assert(
    (await fraction()) > 30 && (await fraction()) < 65,
    "preparation progress wrong",
  );
  await page.getByText("РАБОТА", { exact: true }).waitFor();
  assert((await fraction()) > 85, "work did not restart progress");
  await page.waitForTimeout(1900);
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: "output/playwright/review-phase-work-desktop.png",
  });
  await page.getByText("ОТДЫХ", { exact: true }).waitFor();
  assert((await fraction()) > 85, "rest did not restart progress");
  await page.waitForTimeout(1900);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  const paused = await fraction();
  await page.waitForTimeout(150);
  assert((await fraction()) === paused, "paused progress moved");
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: "output/playwright/review-phase-rest-desktop.png",
  });
  await choose("На время");
  await page.getByLabel("Лимит времени", { exact: true }).fill("0004");
  await prep("0000");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  assert((await fraction()) < 20, "count-up did not start empty");
  await page.waitForTimeout(1800);
  assert(
    (await fraction()) > 30 && (await fraction()) < 65,
    "count-up did not grow",
  );
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: "output/playwright/review-phase-countup-desktop.png",
  });
  await choose("Интервалы");
  await page.getByLabel("Раунды", { exact: true }).fill("1");
  await page.getByLabel("Работа", { exact: true }).fill("0001");
  await page.getByLabel("Отдых", { exact: true }).fill("0000");
  await prep("0000");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await page.getByRole("button", { name: "Повторить", exact: true }).waitFor();
  await page.waitForTimeout(1400);
  const painted = await page
    .locator(".completion-confetti")
    .evaluate((canvas) => {
      const data = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) if (data[i]) return true;
      return false;
    });
  assert(painted, "confetti did not render");
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: "output/playwright/review-phase-confetti-desktop.png",
  });
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  assert(
    await page
      .getByRole("switch", { name: "Конфетти в конце", exact: true })
      .isChecked(),
    "confetti setting missing",
  );
  await page.screenshot({
    path: "output/playwright/review-phase-settings-desktop.png",
  });
  assert(errors.length === 0, JSON.stringify(errors));
  await choose("Интервалы");
  return {
    desktop: "1280x800",
    checks: [
      "fifth digit preserves value and total",
      "seconds 00–99",
      "round cap and toast",
      "50px independent phases",
      "count-up grows",
      "paused progress frozen",
      "completion confetti and switch",
    ],
    javascriptErrors: errors,
  };
}
