import { test, expect } from '@playwright/test';

const cell = (page, r, c) => ({
  // klik, potem czekamy na koniec animacji ruchu (w jej trakcie plansza ignoruje kliknięcia)
  click: async () => {
    await page.locator(`.cell[data-r="${r}"][data-c="${c}"]`).click();
    await expect(page.locator('#board:not([data-busy])')).toBeVisible();
  },
});
const pieceAt = (page, r, c) =>
  page.locator(`.piece[style*="--r: ${r};"][style*="--c: ${c};"]`);

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('stawianie i przepychanie myszy', async ({ page }) => {
  await expect(page.locator('#status')).toContainText('gracz pomarańczowy');
  await cell(page, 2, 2).click();
  await expect(page.locator('#status')).toContainText('gracz szary');
  await expect(page.locator('#player-0 [data-count="mouse"]')).toHaveText('7');

  // szara mysz obok — pomarańczowa odsuwa się w prawo
  await cell(page, 2, 1).click();
  await expect(pieceAt(page, 2, 3)).toHaveClass(/p0/);
  await expect(page.locator('.piece')).toHaveCount(2);
});

test('partia wraca po odświeżeniu strony', async ({ page }) => {
  await cell(page, 0, 0).click();
  await cell(page, 5, 5).click();
  await expect(page.locator('.piece')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.piece')).toHaveCount(2);
  await expect(page.locator('#status')).toContainText('gracz pomarańczowy');
  await page.locator('#btn-undo').click();
  await expect(page.locator('.piece')).toHaveCount(1);
});

test('nowa gra w trakcie partii wymaga drugiego kliknięcia', async ({ page }) => {
  await cell(page, 3, 3).click();
  await expect(page.locator('.piece')).toHaveCount(1);
  const btn = page.locator('#btn-new');
  await btn.click();
  await expect(btn).toHaveText(/Na pewno/);
  await expect(page.locator('.piece')).toHaveCount(1);
  await btn.click();
  await expect(page.locator('.piece')).toHaveCount(0);
  await expect(btn).toHaveText('Nowa gra');
});

test('strona nie przewija się w bok', async ({ page }) => {
  const [scroll, width] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(scroll).toBeLessThanOrEqual(width);
});

test('aplikacja do zainstalowania działa bez internetu', async ({ page, context }) => {
  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
  const res = await page.request.get(manifest);
  const json = await res.json();
  expect(json.name).toBe('Kocie przepychanki');
  expect(json.icons.some((i) => i.purpose === 'maskable')).toBe(true);

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // teraz stronę obsługuje service worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Kocie przepychanki');
  await cell(page, 1, 1).click();
  await expect(page.locator('.piece')).toHaveCount(1);
  await context.setOffline(false);
});
