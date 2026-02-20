import { test, expect } from '@playwright/test';

/**
 * Connector / line e2e tests.
 * Requires being on a board with line/arrow objects (login + open board first).
 * Example flows: create line, switch to arrow, change line style, verify sync in second browser.
 */
test.describe('Connectors', () => {
  test('board redirects to auth when not logged in', async ({ page }) => {
    await page.goto('/board/connectors-test');
    await expect(page).toHaveURL(/\//);
    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
  });
});
