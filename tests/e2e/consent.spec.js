import { test, expect } from '@playwright/test';

test('baner zgody: Google Tag Manager dopiero po „Zgadzam się”', async ({ page, context }) => {
  const gtm = [];
  await context.route('https://www.googletagmanager.com/**', (r) => {
    gtm.push(r.request().url());
    r.fulfill({ body: '', contentType: 'text/javascript' });
  });
  await page.goto('./');
  await page.evaluate(() => localStorage.removeItem('zz-analytics-consent'));
  await page.reload();
  await expect(page.locator('#zz-consent')).toBeVisible();
  expect(gtm).toHaveLength(0);

  await page.locator('#zz-consent .zz-no').click();
  await expect(page.locator('#zz-consent')).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(300);
  await expect(page.locator('#zz-consent')).toHaveCount(0);
  expect(gtm).toHaveLength(0);

  await page.evaluate(() => window.zzConsent());
  await page.locator('#zz-consent .zz-ok').click();
  await expect.poll(() => gtm.length).toBe(1);
  expect(gtm[0]).toContain('gtm.js?id=GTM-PKVQBH86');
});
