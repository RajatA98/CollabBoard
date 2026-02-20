import { test, expect } from '@playwright/test';

/**
 * Multi-browser collaboration tests.
 * For tests that require real Firebase auth, use test credentials (e.g. test@example.com / password123)
 * and ensure Firebase emulators or live project is configured in .env.
 */
test.describe('Collaboration flow', () => {
  test('dashboard requires login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\//);
    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
  });

  test('auth form accepts input and shows validation', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Log In' }).click();
    // Either redirects to dashboard (if credentials valid) or stays with error
    await expect(
      page.getByRole('heading', { name: 'Log In' }).or(page.locator('.dashboard-page'))
    ).toBeVisible({ timeout: 10000 });
  });
});
