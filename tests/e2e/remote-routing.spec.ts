import { expect, test } from "@playwright/test";

test("ordinary mobile stays local after resize; a new desktop document offers QR", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const qr = page.getByRole("button", { name: /Пульт с телефона/ });
  await expect(qr).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(qr).toHaveCount(0);
  await page.reload();
  await expect(qr).toBeVisible();
  await expect(qr).toHaveAttribute("aria-expanded", "false");
  await qr.click();
  await expect(
    page.getByRole("dialog", { name: "Пульт с телефона" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(qr).toHaveAttribute("aria-expanded", "false");
  await expect(qr).toBeFocused();
  await expect(page.locator(".timer")).toHaveCount(0);
});

test("invalid pairing remains remote and a new same-route fragment starts a clean document", async ({
  page,
}) => {
  await page.goto("/remote#room=incomplete-first");
  await expect(
    page.getByRole("heading", { name: "Приглашение недоступно" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/remote$/);
  await expect(page.locator(".mode-grid,.timer")).toHaveCount(0);
  await page.evaluate(() => {
    document.documentElement.dataset.routingMarker = "old-document";
  });
  await page.goto("/remote#room=incomplete-second");
  await expect(page).toHaveURL(/\/remote$/);
  await expect(
    page.getByRole("heading", { name: "Приглашение недоступно" }),
  ).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-routing-marker",
    "old-document",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".mode-grid,.timer")).toHaveCount(0);
});
