import { expect, test } from '@playwright/test';

test('Cube and Floors reuse the same WebGL canvas while morphing', async ({
  page,
}) => {
  await page.setViewportSize({ height: 720, width: 1100 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem('3dxox-guide', 'done');
    window.localStorage.setItem('3dxox-layout', 'cube');
  });
  await page.goto('/');

  const play = page.locator('.menu-play-action');

  if (await play.isVisible()) {
    await play.click();
  }

  const canvas = page.locator('.game-stage canvas');

  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-board-layout', 'cube');
  await canvas.evaluate((element) => {
    (
      window as unknown as { __layoutMorphCanvas?: HTMLCanvasElement }
    ).__layoutMorphCanvas = element;
  });

  await page.getByRole('button', { name: 'Floors', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-board-layout', 'floors');

  expect(
    await page.evaluate(
      () =>
        document.querySelector('.game-stage canvas') ===
        (
          window as unknown as { __layoutMorphCanvas?: HTMLCanvasElement }
        ).__layoutMorphCanvas,
    ),
  ).toBe(true);
});
