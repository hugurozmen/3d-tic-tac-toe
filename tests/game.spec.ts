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

async function showFloor(page: Page, floor: 1 | 2 | 3) {
  await page.locator('.scanner-stop').filter({ hasText: `${floor}` }).click();
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

test('multi-line scoring gets special scanner feedback', async ({ page }) => {
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);

  await showFloor(page, 1);
  await place(page, 'X', 1);
  await place(page, 'O', 2);
  await place(page, 'X', 3);
  await place(page, 'O', 4);
  await place(page, 'X', 7);
  await place(page, 'O', 5);
  await place(page, 'X', 9);
  await place(page, 'O', 6);
  await showFloor(page, 3);
  await place(page, 'X', 19);
  await place(page, 'O', 20);
  await place(page, 'X', 21);
  await place(page, 'O', 22);
  await place(page, 'X', 25);
  await place(page, 'O', 24);
  await place(page, 'X', 27);
  await place(page, 'O', 26);
  await showFloor(page, 2);
  await place(page, 'X', 14);

  await expect(page.locator('.stage-toast.notice-score.multi')).toContainText(
    'X +4 lines',
  );
  await expect(page.locator('.line-score-x.score-bump.multi-line')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Cell 14, X, scored line/ }),
  ).toBeVisible();
});

test('coach mode marks blocking and combined cells on the scanner board', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);
  await page.getByRole('button', { name: 'On', exact: true }).click();

  await expect(page.locator('.coach-legend')).toContainText('Score');
  await expect(page.locator('.coach-legend')).toContainText('Block');
  await expect(page.locator('.coach-legend')).toContainText('Score + block');

  await place(page, 'X', 10);
  await place(page, 'O', 13);
  await place(page, 'X', 11);

  await expect(
    page.getByRole('button', {
      name: /Place O at cell 12\b.*blocks X through cells 10-11-12/,
    }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'New round' }).click();
  await showFloor(page, 1);
  await place(page, 'X', 6);
  await place(page, 'O', 1);
  await place(page, 'X', 9);
  await place(page, 'O', 2);
  await showFloor(page, 2);
  await place(page, 'X', 10);
  await showFloor(page, 1);

  await expect(
    page.getByRole('button', {
      name: /Place O at cell 3\b.*completes a line.*blocks X/,
    }),
  ).toBeVisible();
});

test('scanner coach explains cross-floor threats with rail and connector cues', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);
  await page.getByRole('button', { name: 'On', exact: true }).click();

  await showFloor(page, 1);
  await place(page, 'X', 1);
  await place(page, 'O', 4);
  await showFloor(page, 2);
  await place(page, 'X', 10);
  await showFloor(page, 1);

  await expect(
    page.getByRole('button', { name: /Floor 3, block hint/ }),
  ).toBeVisible();
  await expect(page.locator('.scanner-cell.coach-connector-block')).toBeVisible();
  await expect(page.locator('.scanner-coach-note.note-block')).toContainText(
    'Cell 19 blocks X',
  );
});

test('lines final result explains the score and filled board', async ({ page }) => {
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);

  for (const floor of [1, 2, 3] as const) {
    await showFloor(page, floor);

    const start = (floor - 1) * 9 + 1;

    for (let cell = start; cell < start + 9; cell += 1) {
      await place(page, cell % 2 === 1 ? 'X' : 'O', cell);

      if (cell === 22) {
        await expect(page.locator('.line-score-empty.tension')).toContainText('5');
      }
    }
  }

  await expect(page.getByText('X wins by lines, 12–6')).toBeVisible();
  await expect(page.getByText('Final board filled - X opened')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Cell 27, X, final winning line/ }),
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

  await page.getByRole('button', { name: 'Floors' }).click();
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
