import { test, expect } from '@playwright/test';

test('Landing page renders correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/E-Learning/);
});
