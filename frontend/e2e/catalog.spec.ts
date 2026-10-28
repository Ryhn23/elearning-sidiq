import { test, expect } from '@playwright/test';

test('Student dapat membuka katalog kurs', async ({ page }) => {
  await page.goto('/courses');
  await expect(page).toHaveURL(/\/courses/);
});
