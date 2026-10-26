import { test, expect, type Page } from "@playwright/test";
async function setup(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /AMRAP/ }).click();
  await page.getByLabel("Длительность").fill("0200");
  await page
    .locator("summary")
    .filter({ hasText: /^Подготовка$/ })
    .click();
  await page.getByLabel("Подготовка").fill("0000");
  await page.getByRole("button", { name: "Старт" }).click();
}
test("pause, restart and confirmed menu exit preserve the intended workout", async ({
  page,
}) => {
  await page.clock.install();
  await setup(page);
  await expect(
    page.getByRole("button", { name: "Сброс", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Завершить", exact: true }),
  ).toHaveCount(0);
  await page.clock.runFor(5000);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  const paused = await page.locator(".time").textContent();
  const progress = await page
    .getByRole("progressbar")
    .getAttribute("aria-valuenow");
  await page.clock.fastForward(30000);
  await expect(page.locator(".time")).toHaveText(paused!);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    progress!,
  );
  await page.getByRole("button", { name: "Сброс", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Пауза", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".time")).toHaveText("02:00");
  await expect(
    page.getByRole("button", { name: "Пауза", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(5000);
  await page.getByRole("button", { name: "Все режимы", exact: true }).click();
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Пауза", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(115100);
  await expect(page.getByText("ГОТОВО", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.locator(".time")).toHaveText("02:00");
  await page.getByRole("button", { name: "Все режимы", exact: true }).click();
  await page.getByRole("button", { name: "В меню", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Выберите режим" }),
  ).toBeVisible();
});
test("display reload creates an idle session with mode choice", async ({
  page,
}) => {
  await setup(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Выберите режим" }),
  ).toBeVisible();
  await expect(page.locator(".timer")).toHaveCount(0);
});
test("foreground countdown continues for 60 seconds without network", async ({
  page,
  context,
}) => {
  await page.clock.install();
  await setup(page);
  await context.setOffline(true);
  await page.clock.runFor(60000);
  await expect(page.locator(".time")).toHaveText("01:00");
  await expect(page.getByText("Без сети", { exact: true })).toBeVisible();
  await context.setOffline(false);
});
test("mobile setup has numeric masks and no remote controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /Интервалы/ }).click();
  const work = page.getByLabel("Работа");
  await expect(work).toHaveAttribute("inputmode", "numeric");
  await expect(page.getByLabel("Раунды")).toHaveAttribute(
    "inputmode",
    "numeric",
  );
  await work.fill("0130");
  await expect(work).toHaveValue("01:30");
  await work.fill("0061");
  await expect(page.getByText(/QR|Подключить пульт/)).toHaveCount(0);
  await page.getByRole("button", { name: "Старт" }).click();
  await expect(page.locator(".timer")).toBeVisible();
  await expect(page.locator(".time")).toHaveText("00:10");
});

test("digits and both progress tracks toggle pause without changing the program", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /Интервалы/ }).click();
  await page.getByLabel("Раунды", { exact: true }).fill("2");
  await page.getByLabel("Работа", { exact: true }).fill("0020");
  await page.getByLabel("Отдых", { exact: true }).fill("0010");
  await page
    .locator("summary")
    .filter({ hasText: /^Подготовка$/ })
    .click();
  await page.getByLabel("Подготовка", { exact: true }).fill("0000");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  for (const selector of [".time", ".workout-progress", ".workout-timeline"]) {
    await page.clock.runFor(500);
    await page.locator(selector).click();
    await expect(page.locator(".phase")).toHaveText("ПАУЗА");
    const time = await page.locator(".time").textContent();
    const progress = await page
      .getByRole("progressbar")
      .getAttribute("aria-valuenow");
    await page.clock.runFor(1000);
    await expect(page.locator(".time")).toHaveText(time!);
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      progress!,
    );
    await page.locator(selector).click();
    await expect(page.locator(".phase")).toHaveText("РАБОТА");
    await expect(page.locator(".timer-meta h1")).toContainText("1 из 2");
  }
  // An unrelated blank area must not invoke the readout action.
  await page.locator(".timer-meta h1").click();
  await expect(page.locator(".phase")).toHaveText("РАБОТА");
});
