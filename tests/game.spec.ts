import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

const appUrl = 'http://127.0.0.1:5173/';

async function openGame(
  page: Page,
  {
    guide = 'done',
    layout,
    viewport = { height: 720, width: 1280 },
  }: {
    guide?: 'done' | 'pending';
    layout?: 'cube' | 'floors' | 'scanner';
    viewport?: { height: number; width: number };
  } = {},
) {
  await page.setViewportSize(viewport);
  await page.addInitScript(({ preferredGuide, preferredLayout }) => {
    window.localStorage.clear();

    if (preferredGuide === 'done') {
      window.localStorage.setItem('3dxox-guide', 'done');
    }

    if (preferredLayout) {
      window.localStorage.setItem('3dxox-layout', preferredLayout);
    }
  }, { preferredGuide: guide, preferredLayout: layout });
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

async function keepPieIfVisible(page: Page) {
  const keepSides = page.getByRole('button', { name: 'Keep sides?' });

  try {
    await keepSides.waitFor({ state: 'visible', timeout: 1000 });
    await keepSides.click();
  } catch {
    // Online Classic has Pie disabled, so there may be no prompt.
  }
}

async function winClassicRoundForX(page: Page, opener: 'X' | 'O') {
  if (opener === 'X') {
    await showFloor(page, 2);
    await place(page, 'X', 10);
    await keepPieIfVisible(page);
    await place(page, 'O', 13);
    await place(page, 'X', 11);
    await place(page, 'O', 14);
    await place(page, 'X', 12);
    return;
  }

  await showFloor(page, 1);
  await place(page, 'O', 1);
  await showFloor(page, 2);
  await place(page, 'X', 10);
  await showFloor(page, 1);
  await place(page, 'O', 2);
  await showFloor(page, 2);
  await place(page, 'X', 11);
  await showFloor(page, 1);
  await place(page, 'O', 4);
  await showFloor(page, 2);
  await place(page, 'X', 12);
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

test('first-time guide teaches Lines, views, Coach, and 3D diagonals', async ({
  page,
}) => {
  await openGame(page, { guide: 'pending', layout: 'scanner' });

  const guide = page.getByRole('dialog', { name: 'How to play' });

  await expect(guide).toBeVisible();
  await expect(guide.locator('.guide-list li').first()).toContainText(
    'Lines is the main game',
  );
  await expect(guide).toContainText('all 27 cells fill');
  await expect(guide).toContainText('Classic is a variant');
  await expect(guide).toContainText('Cells 1, 14, and 27');
  await expect(guide).toContainText('Coach hints');
  await expect(guide).toContainText('Scanner is fastest');
  await expect(guide).toContainText('Cube shows the shape');
  await expect(guide).toContainText('Floors compares layers');

  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(guide).toHaveCount(0);
  await place(page, 'X', 10);
  await expect(page.getByRole('button', { name: /Cell 10, X/ })).toBeVisible();
});

test('desktop 3D cube renders real canvas pixels', async ({ page }) => {
  await openGame(page, { layout: 'cube' });

  await expectCanvasHasPixels(page);
  await page.getByRole('button', { name: 'Rotate board right' }).click();
  await expectCanvasHasPixels(page);
});

test('solo panel shows local progress and the daily puzzle', async ({ page }) => {
  await openGame(page, { layout: 'scanner' });

  await expect(page.locator('.progress-card')).toContainText('Progress');
  await expect(page.locator('.progress-card')).toContainText('Total lines');
  await expect(page.locator('.progress-card')).toContainText('Master wins');
  await expect(page.locator('.progress-card')).toContainText('Theme accents');
  await expect(page.locator('.daily-puzzle-card')).toContainText(/Daily #\d+/);
  await expect(page.locator('.daily-puzzle-card')).toContainText(/Find the|Score the/);
  await expect(page.locator('.daily-cell')).toHaveCount(27);
});

test('first few games offer a non-blocking Try Coach prompt', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });

  const prompt = page.locator('.coach-prompt');

  await expect(prompt).toContainText('Try Coach');
  await expect(prompt).toContainText('cross-floor threats');
  await prompt.getByRole('button', { name: 'Try Coach' }).click();
  await expect(prompt).toHaveCount(0);
  await expect(page.locator('.coach-legend')).toContainText('Score');
  await expect(page.locator('.coach-legend')).toContainText('Block');
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

test('best-of-5 match alternates openers and ends at 3 wins', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await page.getByRole('button', { name: 'Classic' }).click();
  await chooseTwoPlayer(page);

  await expect(page.locator('.score-row')).toContainText('X wins');
  await expect(page.locator('.match-card')).toContainText('Race to 3');
  await expect(page.locator('.match-card')).toContainText('X opens');

  await winClassicRoundForX(page, 'X');
  await expect(page.getByText('Round 1: X wins the round')).toBeVisible();
  await expect(page.getByText('X opened - O opens next')).toBeVisible();
  await expect(page.locator('.score-x strong')).toHaveText('1');

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('.match-card')).toContainText('O opens');

  await winClassicRoundForX(page, 'O');
  await expect(page.getByText('Round 2: X wins the round')).toBeVisible();
  await expect(page.getByText('O opened - X opens next')).toBeVisible();
  await expect(page.locator('.score-x strong')).toHaveText('2');

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('.match-card')).toContainText('X opens');

  await winClassicRoundForX(page, 'X');
  await expect(page.getByText('Round 3: X wins the round')).toBeVisible();
  await expect(page.getByText('X wins the match, 3–0')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New match' })).toBeVisible();
  await expect(page.locator('.score-x strong')).toHaveText('3');

  await page.getByRole('button', { name: 'New match' }).click();
  await expect(page.locator('.score-x strong')).toHaveText('0');
  await expect(page.locator('.match-card')).toContainText('Lifetime');
  await expect(page.locator('.match-card')).toContainText('3-0');
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

  await expect(hostOnlineCard).toContainText('Lines room');
  await expect(hostOnlineCard).toContainText('Locked');
  await expect(
    host.locator('.ruleset-control').getByRole('button', { name: 'Classic' }),
  ).toBeDisabled();
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
    await expect(guest.locator('.online-card')).toContainText('Lines room');
    await expect(
      guest.locator('.ruleset-control').getByRole('button', { name: 'Classic' }),
    ).toBeDisabled();

    await place(host, 'X', 10);
    await expect(guest.getByRole('button', { name: /Cell 10, X/ }))
      .toBeVisible();
  } finally {
    await guestContext.close();
  }
});

test('online guest adopts host Classic room settings and locks rules', async ({
  browser,
  page: host,
}) => {
  await openGame(host, { layout: 'scanner' });
  await host.getByRole('button', { name: 'Classic' }).click();
  await host.getByRole('button', { name: 'Online' }).click();
  await host.getByRole('button', { name: 'Host' }).click();

  const hostOnlineCard = host.locator('.online-card');
  const roomField = hostOnlineCard.getByRole('textbox', { name: 'Room' });

  await expect(hostOnlineCard).toContainText('Classic room');
  await expect(hostOnlineCard).toContainText('Pie off');
  await expect(roomField).toHaveValue(/[A-Z0-9]{5}/);
  const roomCode = await roomField.inputValue();

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();

  try {
    await openGame(guest, { layout: 'scanner' });
    await expect(
      guest.locator('.ruleset-control button.active'),
    ).toContainText('Lines');

    await guest.getByRole('button', { name: 'Online' }).click();
    await guest
      .locator('.online-card')
      .getByRole('textbox', { name: 'Join' })
      .fill(roomCode);
    await guest.getByRole('button', { name: /^Join$/ }).click();

    await expect(guest.locator('.online-card')).toContainText('Classic room');
    await expect(
      guest.locator('.ruleset-control button.active'),
    ).toContainText('Classic');
    await expect(
      guest.locator('.ruleset-control').getByRole('button', { name: 'Lines' }),
    ).toBeDisabled();
    await expect(guest.locator('.line-score-card')).toHaveCount(0);

    await place(host, 'X', 10);
    await expect(guest.getByRole('button', { name: /Cell 10, X/ }))
      .toBeVisible();
  } finally {
    await guestContext.close();
  }
});
