import { test, expect } from '@playwright/test';

test('Guru: manage nilai (gradebook)', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('teacher@elearning.com');
  await page.locator('input[type="password"]').fill('password123');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/dashboard|teacher/);

  // ---------- Guru: manajemen nilai via gradebook ----------
  await page.goto('/teacher/courses');
  await expect(page).toHaveURL(/\/teacher\/courses/);

  const courseLink = page.locator('a[href^="/teacher/courses/"]').filter({ hasText: 'Lihat gradebook & nilai peserta' }).first();
  await courseLink.click();
  await expect(page).toHaveURL(/\/teacher\/courses\/.+\/gradebook/);
});
