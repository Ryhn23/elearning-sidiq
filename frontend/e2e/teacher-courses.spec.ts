import { test, expect } from '@playwright/test';

test('Guru: dashboard + manajemen materi (course editor)', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('teacher@elearning.com');
  await page.locator('input[type="password"]').fill('password123');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/dashboard|teacher/);

  // ---------- Dashboard guru ----------
  await page.goto('/teacher/courses');
  await expect(page).toHaveURL(/\/teacher\/courses/);

  // ---------- Manajemen materi: buka course editor ----------
  await page.goto('/teacher/courses/new');
  await expect(page).toHaveURL(/\/teacher\/courses\/new/);
});
