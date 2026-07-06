import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

const appUrl = 'http://127.0.0.1:5173/';

async function openGame(
  page: Page,
  {
    layout,
    viewport = { height: 720, width: 1280 },
  }: {
    layout?: 'cube' | 'floors' | 'scanner';
    viewport?: { height: number; width: number };
  } = {},
) {
  await page.setViewportSize(viewport);
  await page.addInitScript((preferredLayout) => {
    window.localStorage.clear();
    window.localStorage.setItem('3dxox-guide', 'done');

    if (preferredLayout) {
      window.localStorage.setItem('3dxox-layout', preferredLayout);
    }
  }, layout);
  await page.goto(appUrl);
}

async function chooseTwoPlayer(page: Page) {
  await page.getByRole('button', { name: '2P' }).click();
}

async function place(page: Page, player: 'X' | 'O', cell: number) {
  await page
    .getByRole('button', {
      name: new RegExp(`Place ${player} at cell ${cell}\\b`),
    })
    .click();
}

async function expectCanvasHasPixels(page: Page) {
  const canvas = page.locator('canvas');

  await expect(canvas).toBeVisible();
  await page.waitForTimeout(250);

  const screenshot = await canvas.screenshot();
  const png = PNG.sync.read(screenshot);
  const background = [png.data[0], png.data[1], png.data[2]];
  const colorBuckets = new Set<string>();
  let foregroundSamples = 0;
  const stepX = Math.max(1, Math.floor(png.width / 40));
  const stepY = Math.max(1, Math.floor(png.height / 40));

  for (let y = 0; y < png.height; y += stepY) {
    for (let x = 0; x < png.width; x += stepX) {
      const index = (png.width * y + x) * 4;
      const red = png.data[index];
      const green = png.data[index + 1];
      const blue = png.data[index + 2];
      const alpha = png.data[index + 3];

      if (alpha === 0) {
        continue;
      }

      colorBuckets.add(`${red >> 4}-${green >> 4}-${blue >> 4}`);

      const delta =
        Math.abs(red - background[0]) +
        Math.abs(green - background[1]) +
        Math.abs(blue - background[2]);

      if (delta > 35) {
        foregroundSamples += 1;
      }
    }
  }

  expect(screenshot.length).toBeGreaterThan(1000);
  expect(colorBuckets.size).toBeGreaterThan(3);
  expect(foregroundSamples).toBeGreaterThan(10);
}

test('mobile first run starts on the playable scanner board', async ({ page }) => {
  await openGame(page, {
    viewport: { height: 844, width: 390 },
  });

  await expect(page.locator('.scanner-grid')).toBeVisible();
  await expect(page.locator('.stage-actions')).toHaveCount(0);

  const metrics = await page.evaluate(() => {
    const stage = document.querySelector('.game-stage')?.getBoundingClientRect();
    const grid = document.querySelector('.scanner-grid')?.getBoundingClientRect();

    return {
      bodyScrollWidth: document.body.scrollWidth,
      gridWidth: grid?.width ?? 0,
      innerWidth: window.innerWidth,
      stageHeight: stage?.height ?? 0,
    };
  });

  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
  expect(metrics.stageHeight).toBeGreaterThanOrEqual(430);
  expect(metrics.gridWidth).toBeGreaterThanOrEqual(280);
});

test('desktop 3D cube renders real canvas pixels', async ({ page }) => {
  await openGame(page, { layout: 'cube' });

  await expectCanvasHasPixels(page);
  await page.getByRole('button', { name: 'Rotate board right' }).click();
  await expectCanvasHasPixels(page);
});

test('scanner board supports a complete 2P winning round', async ({ page }) => {
  await openGame(page, { layout: 'scanner' });
  await page.getByRole('button', { name: 'Classic' }).click();
  await chooseTwoPlayer(page);

  await place(page, 'X', 10);
  await page.getByRole('button', { name: 'Keep sides?' }).click();
  await place(page, 'O', 13);
  await place(page, 'X', 11);
  await place(page, 'O', 14);
  await place(page, 'X', 12);

  await expect(page.getByText('X wins the round')).toBeVisible();
  await expect(page.getByRole('button', { name: /Cell 10, X, winning line/ }))
    .toBeVisible();
});

test('lines mode scores completed lines without ending the round', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);

  await place(page, 'X', 10);
  await place(page, 'O', 13);
  await place(page, 'X', 11);
  await place(page, 'O', 14);
  await place(page, 'X', 12);

  await expect(page.locator('.line-score-card')).toContainText('X lines');
  await expect(page.locator('.line-score-card')).toContainText('1');
  await expect(page.getByText('X +1 line')).toBeVisible();
  await expect(page.getByText(/wins the round/i)).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /Place O at cell 15\b/ }),
  ).toBeVisible();
});

test('coach mode marks blocking cells on the scanner board', async ({ page }) => {
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);
  await page.getByRole('button', { name: 'On', exact: true }).click();

  await place(page, 'X', 10);
  await place(page, 'O', 13);
  await place(page, 'X', 11);

  await expect(
    page.getByRole('button', { name: /Place O at cell 12\b.*blocks a line/ }),
  ).toBeVisible();
});

test('mobile view selector can enter and leave the 3D board', async ({ page }) => {
  await openGame(page, {
    layout: 'scanner',
    viewport: { height: 844, width: 390 },
  });

  await page.getByRole('button', { name: 'Cube' }).click();
  await expectCanvasHasPixels(page);
  await expect(page.locator('.stage-actions')).toBeVisible();

  await page.getByRole('button', { name: 'Scanner' }).click();
  await expect(page.locator('.scanner-grid')).toBeVisible();
});

test('online host and guest can join and relay a scanner move', async ({
  browser,
  page: host,
}) => {
  await openGame(host, { layout: 'scanner' });
  await host.getByRole('button', { name: 'Online' }).click();
  await host.getByRole('button', { name: 'Host' }).click();

  const hostOnlineCard = host.locator('.online-card');
  const roomField = hostOnlineCard.getByRole('textbox', { name: 'Room' });

  await expect(roomField).toHaveValue(/[A-Z0-9]{5}/);
  const roomCode = await roomField.inputValue();

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();

  try {
    await openGame(guest, { layout: 'scanner' });
    await guest.getByRole('button', { name: 'Online' }).click();
    await guest
      .locator('.online-card')
      .getByRole('textbox', { name: 'Join' })
      .fill(roomCode);
    await guest.getByRole('button', { name: /^Join$/ }).click();

    await expect(host.locator('.online-card')).toContainText('connected');
    await expect(guest.locator('.online-card')).toContainText('connected');

    await place(host, 'X', 10);
    await expect(guest.getByRole('button', { name: /Cell 10, X/ }))
      .toBeVisible();
  } finally {
    await guestContext.close();
  }
});
