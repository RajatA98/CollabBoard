import { test, expect } from '@playwright/test';

/**
 * E2E test: add a frame, add every kind of shape (into or next to the frame),
 * then perform move, resize, and rotate transforms.
 *
 * Requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run (same as cursor.spec).
 */

const hasTestCredentials =
  !!process.env.E2E_TEST_EMAIL?.trim() && !!process.env.E2E_TEST_PASSWORD;

async function loginAndCreateBoard(page: import('@playwright/test').Page, boardName: string) {
  await page.goto('/');
  await page.getByLabel('Email').fill(process.env.E2E_TEST_EMAIL!);
  await page.getByLabel('Password').fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page.locator('.dashboard-page')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: '+ Create Board' }).click();
  await expect(page.getByRole('heading', { name: 'Create New Board' })).toBeVisible();
  await page.getByLabel('Board Name').fill(boardName);
  await page.getByRole('button', { name: 'Create Board' }).click();
  await expect(page).toHaveURL(/\/board\/[^/]+/, { timeout: 15000 });
  await expect(page.getByTestId('canvas-area')).toBeVisible({ timeout: 10000 });
}

test.describe('Frame and shapes', () => {
  test('add frame, add every shape type, then move / resize / rotate', async ({ page }) => {
    test.skip(!hasTestCredentials, 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run');

    await loginAndCreateBoard(page, 'E2E Frame and Shapes Board');

    const canvas = page.getByTestId('canvas-area');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Focus canvas so keyboard shortcut is received
    await page.mouse.click(centerX, centerY);

    // 1) Add frame (keyboard shortcut)
    await page.keyboard.press('f');
    await page.waitForTimeout(500);

    // 2) Open shapes panel and add every shape type (click = create at center; they land inside frame)
    await page.getByTestId('shape-bar-shapes-btn').click();
    await expect(page.getByTestId('shape-panel')).toBeVisible();

    const shapeTemplates = [
      'shape-template-sticky',
      'shape-template-text',
      'shape-template-rectangle',
      'shape-template-circle',
      'shape-template-triangle',
      'shape-template-star',
    ] as const;

    for (const testId of shapeTemplates) {
      await page.getByTestId(testId).click();
      await page.waitForTimeout(200);
    }

    // Lines/arrows: drag from panel to canvas center so they land inside frame
    await page.getByTestId('shape-template-line').dragTo(canvas, { targetPosition: { x: box.width / 2, y: box.height / 2 } });
    await page.waitForTimeout(200);
    await page.getByTestId('shape-template-arrow-single').dragTo(canvas, { targetPosition: { x: box.width / 2, y: box.height / 2 } });
    await page.waitForTimeout(200);
    await page.getByTestId('shape-template-arrow-double').dragTo(canvas, { targetPosition: { x: box.width / 2, y: box.height / 2 } });
    await page.waitForTimeout(300);

    // 3) Select something (click canvas center – frame or top shape)
    await page.mouse.click(centerX, centerY);
    await page.waitForTimeout(300);

    // StyleBar should appear when something is selected
    await expect(page.getByTestId('style-bar')).toBeVisible({ timeout: 3000 });

    // 4) Move: drag selected object
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 60, centerY + 40, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    // 5) Resize: change width and height in StyleBar
    const widthInput = page.getByLabel('Width');
    const heightInput = page.getByLabel('Height');
    await widthInput.clear();
    await widthInput.fill('320');
    await widthInput.blur();
    await page.waitForTimeout(200);
    await heightInput.clear();
    await heightInput.fill('240');
    await heightInput.blur();
    await page.waitForTimeout(200);

    // 6) Rotate: change rotation in StyleBar
    const rotationInput = page.getByLabel('Rotation');
    await rotationInput.clear();
    await rotationInput.fill('15');
    await rotationInput.blur();
    await page.waitForTimeout(200);

    // Sanity: StyleBar still visible and transform inputs applied
    await expect(page.getByTestId('style-bar')).toBeVisible();
    await expect(rotationInput).not.toHaveValue('');
  });
});
