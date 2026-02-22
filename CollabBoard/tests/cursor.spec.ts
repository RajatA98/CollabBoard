import { test, expect } from '@playwright/test';

/**
 * Cursor simulation e2e tests.
 *
 * These tests simulate mouse movement over the canvas to verify pointer/cursor
 * handling (e.g. cursor sync, selection, pan). The app uses pointermove on the
 * canvas container to broadcast cursor position via useCursors.
 *
 * Run from CollabBoard/ (frontend app dir): npm run test:e2e -- tests/cursor.spec.ts
 *
 * - Start the dev server first (npm run dev). If Vite uses a different port
 *   (e.g. 5176), set PLAYWRIGHT_BASE_URL=http://localhost:5176.
 * - To run the full flow (login → board → cursor simulation), set:
 *   E2E_TEST_EMAIL=your-test-user@example.com
 *   E2E_TEST_PASSWORD=your-password
 *   and ensure Firebase (or emulator) is configured so login succeeds.
 *   If these are not set, the two "when logged in" tests are skipped.
 */

const hasTestCredentials =
  !!process.env.E2E_TEST_EMAIL?.trim() && !!process.env.E2E_TEST_PASSWORD;

test.describe('Cursor simulation', () => {
  test('unauthenticated user cannot access board', async ({ page }) => {
    await page.goto('/board/any-board-id', { timeout: 15000 });
    // Wait for redirect to auth (ProtectedRoute sends unauthenticated users to /)
    await expect(page).toHaveURL(/\//, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible({ timeout: 10000 });
  });

  test('simulates cursor movement over canvas when logged in', async ({ page }) => {
    test.skip(!hasTestCredentials, 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run cursor simulation');

    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;

    await page.goto('/', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page.locator('.dashboard-page')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: '+ Create Board' }).click();
    await expect(page.getByRole('heading', { name: 'Create New Board' })).toBeVisible({ timeout: 5000 });
    await page.getByLabel('Board Name').fill('E2E Cursor Test Board');
    await page.getByRole('button', { name: 'Create Board' }).click();

    await expect(page).toHaveURL(/\/board\/[^/]+/, { timeout: 15000 });
    const canvas = page.getByTestId('canvas-area');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const padding = 40;
    const left = box.x + padding;
    const right = box.x + box.width - padding;
    const top = box.y + padding;
    const bottom = box.y + box.height - padding;

    await page.mouse.move(centerX, centerY);
    await page.mouse.move(left, top);
    await page.mouse.move(right, top);
    await page.mouse.move(right, bottom);
    await page.mouse.move(left, bottom);
    await page.mouse.move(centerX, centerY);

    await expect(canvas).toBeVisible();
  });

  test('simulates cursor in a circular path over canvas (when logged in)', async ({ page }) => {
    test.skip(!hasTestCredentials, 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run');

    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;

    await page.goto('/', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page.locator('.dashboard-page')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: '+ Create Board' }).click();
    await expect(page.getByRole('heading', { name: 'Create New Board' })).toBeVisible({ timeout: 5000 });
    await page.getByLabel('Board Name').fill('E2E Cursor Path Board');
    await page.getByRole('button', { name: 'Create Board' }).click();

    await expect(page).toHaveURL(/\/board\/[^/]+/, { timeout: 15000 });
    const canvas = page.getByTestId('canvas-area');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    const steps = 12;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const r = Math.min(box.width, box.height) / 3;

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2 * Math.PI;
      await page.mouse.move(cx + r * Math.cos(t), cy + r * Math.sin(t));
    }

    await expect(canvas).toBeVisible();
  });
});
