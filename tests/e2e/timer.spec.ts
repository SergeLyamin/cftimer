import { test, expect, type Page } from "@playwright/test";
async function setup(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /AMRAP/ }).click();
  await page.getByLabel("Длительность").fill("0200");
  await page.getByText("Дополнительно", { exact: true }).click();
  await page.getByLabel("Подготовка").fill("0000");
  await page.getByRole("button", { name: "Начать" }).click();
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
  await page.getByRole("button", { name: "Начать" }).click();
  await expect(work).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".timer")).toHaveCount(0);
  await expect(page.getByText(/QR|Подключить пульт/)).toHaveCount(0);
});
