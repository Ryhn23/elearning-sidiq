import { test, expect } from '@playwright/test';

test('Admin: buat user baru + setup kategori e-learning', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@elearning.com');
  await page.locator('input[type="password"]').fill('password123');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL(/dashboard|admin/);

  // ---------- Admin: buat user baru ----------
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/admin\/users/);

  await page.getByRole('button', { name: /Tambah User/i }).click();

  const newEmail = `qa.e2e.admin.${Date.now()}@test.com`;
  await page.getByPlaceholder('Contoh: Budi Santoso').fill('QA Admin Teacher');
  await page.getByPlaceholder('budi@example.com').fill(newEmail);
  await page.getByPlaceholder('Minimal 8 karakter').fill('password123');
  await page.locator('form select').selectOption('teacher');
  await page.getByRole('button', { name: 'Simpan User' }).click();

  // User baru harus muncul di list
  await expect(page.getByText(newEmail)).toBeVisible();

  // ---------- Admin: setup kategori ----------
  await page.goto('/admin/categories');
  await expect(page).toHaveURL(/\/admin\/categories/);

  await page.getByPlaceholder('mis. Pengembangan Web').fill('QA E2E Kategori');
  await page.getByPlaceholder('pengembangan-web').fill(`qa-e2e-cat-${Date.now()}`);
  await page.getByRole('button', { name: /Tambah/i }).click();

  await expect(page.getByText('QA E2E Kategori')).toBeVisible();
});
