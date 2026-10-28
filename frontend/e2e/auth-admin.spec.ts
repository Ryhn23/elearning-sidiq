import { test, expect } from '@playwright/test';

test('Admin login → dashboard → halaman admin users', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@elearning.com');
  await page.locator('input[type="password"]').fill('password123');
  await page.getByRole('button', { name: 'Masuk' }).click();

  // Setelah login diarahkan ke /dashboard (atau /admin/*)
  await page.waitForURL(/dashboard|admin/);

  // Admin dapat membuka halaman user management
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/admin\/users/);
});
