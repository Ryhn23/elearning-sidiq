import { test, expect } from '@playwright/test';

test('Admin: manage sistem e-learning (kursus + analytics)', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@elearning.com');
  await page.locator('input[type="password"]').fill('password123');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/dashboard|admin/);

  // ---------- Admin: manajemen kursus ----------
  await page.goto('/admin/courses');
  await expect(page).toHaveURL(/\/admin\/courses/);

  // ---------- Admin: dashboard sistem (analytics) ----------
  await page.goto('/admin/analytics');
  await expect(page).toHaveURL(/\/admin\/analytics/);
});
