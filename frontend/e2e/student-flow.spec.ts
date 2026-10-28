import { test, expect } from '@playwright/test';

test('Murid: dashboard + katalog + course player', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('budi@student.com');
  await page.locator('input[type="password"]').fill('password123');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/dashboard|student/);

  // ---------- Dashboard murid ----------
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/dashboard|student/);

  // ---------- Katalog ----------
  await page.goto('/courses');
  await expect(page).toHaveURL(/\/courses/);

  // ---------- Course player (buka kursus) ----------
  await page.goto('/courses/dasar-pemrograman-web/learn');
  await expect(page).toHaveURL(/\/courses\/.+learn/);
});
