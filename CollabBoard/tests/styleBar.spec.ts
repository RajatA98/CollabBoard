import { test, expect } from '@playwright/test';

/**
 * Style bar e2e tests.
 * These require being on a board with at least one object selected.
 * Use after logging in and creating/opening a board (see collaborationFlow for auth).
 */
test.describe('Style bar', () => {
  test('board page redirects to auth when not logged in', async ({ page }) => {
    await page.goto('/board/e2e-test-board');
    await expect(page).toHaveURL(/\//);
    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
  });
});
