import { test, expect } from '@playwright/test';

test.describe('Auth page', () => {
  test('loads and shows login form', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('CollabBoard');
    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
  });

  test('can switch to sign up', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Sign Up').click();
    await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible();
  });

  test('protected route redirects to auth when not logged in', async ({ page }) => {
    await page.goto('/board/test-board-id');
    await expect(page).toHaveURL(/\//);
    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
  });
});
