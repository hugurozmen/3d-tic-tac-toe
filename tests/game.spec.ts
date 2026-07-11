import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

const appUrl = 'http://127.0.0.1:5173/';

async function openGame(
  page: Page,
  {
    guide = 'done',
    language = 'en',
    layout,
    localScore,
    scannerHint = 'done',
    screen = 'game',
    viewport = { height: 720, width: 1280 },
  }: {
    guide?: 'done' | 'pending';
    language?: 'en' | 'tr';
    layout?: 'cube' | 'floors' | 'scanner';
    localScore?: { draws: number; O: number; X: number };
    scannerHint?: 'done' | 'pending';
    screen?: 'game' | 'menu';
    viewport?: { height: number; width: number };
  } = {},
) {
  await page.setViewportSize(viewport);
  await page.goto(appUrl);
  await page.evaluate(
    ({
      preferredGuide,
      preferredLanguage,
      preferredLayout,
      preferredScannerHint,
      preferredScore,
    }) => {
      window.localStorage.clear();
      window.localStorage.setItem('3dxox-language', preferredLanguage);
      window.localStorage.setItem('3dxox-scanner-hint', preferredScannerHint);

      if (preferredGuide === 'done') {
        window.localStorage.setItem('3dxox-guide', 'done');
      }

      if (preferredLayout) {
        window.localStorage.setItem('3dxox-layout', preferredLayout);
      }

      if (preferredScore) {
        window.localStorage.setItem(
          '3dxox-score',
          JSON.stringify(preferredScore),
        );
      }
    },
    {
      preferredGuide: guide,
      preferredLanguage: language,
      preferredLayout: layout,
      preferredScannerHint: scannerHint,
      preferredScore: localScore,
    },
  );
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-screen',
    'menu',
  );

  if (screen === 'game' && guide === 'done') {
    await enterGame(page);
  }
}

async function enterGame(page: Page) {
  if (
    (await page.locator('.app-shell').getAttribute('data-screen')) === 'menu'
  ) {
    await page.locator('.menu-play-action').click();
  }

  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-screen',
    'game',
  );
  await expect(page.locator('.play-screen')).toBeVisible();
}

async function openMenu(page: Page) {
  if (
    (await page.locator('.app-shell').getAttribute('data-screen')) === 'game'
  ) {
    await page.locator('.stage-menu-button').click();
  }

  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-screen',
    'menu',
  );
  await expect(page.locator('.menu-screen')).toBeVisible();
}

async function configureFromMenu(page: Page, configure: () => Promise<void>) {
  const resumeAfter =
    (await page.locator('.app-shell').getAttribute('data-screen')) === 'game';

  await openMenu(page);
  await configure();

  if (resumeAfter) {
    await enterGame(page);
  }
}

async function chooseTwoPlayer(page: Page) {
  await configureFromMenu(page, async () => {
    await page.getByRole('button', { name: '2P' }).click();
  });
}

async function chooseRuleset(page: Page, label: 'Classic' | 'Lines') {
  await configureFromMenu(page, async () => {
    await page
      .locator('.ruleset-control')
      .getByRole('button', { name: label, exact: true })
      .click();
  });
}

async function openOptions(page: Page) {
  await openMenu(page);
  const section = page.locator('.panel-section-options');
  const options = page.locator('.panel-section-options summary');

  if ((await section.getAttribute('open')) === null) {
    await options.click();
  }
}

async function showFloor(page: Page, floor: 1 | 2 | 3) {
  await page
    .locator('.scanner-stop')
    .filter({ hasText: `${floor}` })
    .click();
}

async function place(page: Page, player: 'X' | 'O', cell: number) {
  await page
    .getByRole('button', {
      name: new RegExp(`Place ${player} at cell ${cell}\\b`),
    })
    .click();
}

async function keepPieIfVisible(page: Page) {
  const keepSides = page.getByRole('button', { name: 'Keep sides' });

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

async function winClassicRoundForO(page: Page, opener: 'X' | 'O') {
  if (opener === 'X') {
    await showFloor(page, 1);
    await place(page, 'X', 1);
    await keepPieIfVisible(page);
    await showFloor(page, 2);
    await place(page, 'O', 10);
    await showFloor(page, 1);
    await place(page, 'X', 2);
    await showFloor(page, 2);
    await place(page, 'O', 11);
    await showFloor(page, 1);
    await place(page, 'X', 4);
    await showFloor(page, 2);
    await place(page, 'O', 12);
    return;
  }

  await showFloor(page, 2);
  await place(page, 'O', 10);
  await showFloor(page, 1);
  await place(page, 'X', 1);
  await showFloor(page, 2);
  await place(page, 'O', 11);
  await showFloor(page, 1);
  await place(page, 'X', 2);
  await showFloor(page, 2);
  await place(page, 'O', 12);
}

async function expectCanvasHasPixels(page: Page) {
  let lastMetrics: {
    colorBuckets: number;
    foregroundSamples: number;
    screenshotLength: number;
  } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await expect(page.locator('canvas')).toBeVisible();
      await page.waitForTimeout(350);
      const screenshot = await page.locator('canvas').screenshot();
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

      lastMetrics = {
        colorBuckets: colorBuckets.size,
        foregroundSamples,
        screenshotLength: screenshot.length,
      };

      if (
        lastMetrics.screenshotLength > 1000 &&
        lastMetrics.colorBuckets > 3 &&
        lastMetrics.foregroundSamples > 10
      ) {
        return;
      }
    } catch (error) {
      if (attempt === 4) {
        throw error;
      }
    }

    await page.waitForTimeout(300);
  }

  expect(lastMetrics?.screenshotLength ?? 0).toBeGreaterThan(1000);
  expect(lastMetrics?.colorBuckets ?? 0).toBeGreaterThan(3);
  expect(lastMetrics?.foregroundSamples ?? 0).toBeGreaterThan(10);
}

async function expectCurrentCanvasContextHealthy(page: Page) {
  const contextHandle = await page.waitForFunction(
    () => {
      const canvas =
        document.querySelector<HTMLCanvasElement>('.game-stage canvas');
      const gl =
        canvas?.getContext('webgl2') ?? canvas?.getContext('webgl') ?? null;

      if (!canvas || !gl || gl.isContextLost()) {
        return false;
      }

      return {
        hasCanvas: true,
        hasContext: true,
        isLost: false,
      };
    },
    null,
    { timeout: 4000 },
  );
  const context = (await contextHandle.jsonValue()) as {
    hasCanvas: boolean;
    hasContext: boolean;
    isLost: boolean;
  };

  expect(context.hasCanvas).toBe(true);
  expect(context.hasContext).toBe(true);
  expect(context.isLost).toBe(false);
}

async function expectMenuModalCoversViewport(page: Page) {
  await expect(page.locator('.confirm-overlay')).toBeVisible();
  await expect(page.locator('.panel-modal-card')).toBeVisible();
  await page.waitForFunction(() => {
    const card = document.querySelector('.panel-modal-card');
    const transform = card ? window.getComputedStyle(card).transform : '';

    return transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)';
  });

  const metrics = await page.evaluate(() => {
    const overlay = document
      .querySelector('.confirm-overlay')
      ?.getBoundingClientRect();
    const card = document
      .querySelector('.panel-modal-card')
      ?.getBoundingClientRect();
    const cardElement = document.querySelector('.panel-modal-card');

    if (!overlay || !card || !cardElement) {
      throw new Error('Menu modal geometry could not be measured');
    }

    return {
      cardCenterX: card.left + card.width / 2,
      cardCenterY: card.top + card.height / 2,
      cardHeight: card.height,
      cardWidth: card.width,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      overlayHeight: overlay.height,
      overlayLeft: overlay.left,
      overlayTop: overlay.top,
      overlayWidth: overlay.width,
    };
  });
  const expectedCardWidth = Math.min(760, metrics.innerWidth - 32);

  expect(metrics.overlayLeft).toBeLessThanOrEqual(1);
  expect(metrics.overlayTop).toBeLessThanOrEqual(1);
  expect(metrics.overlayWidth).toBeGreaterThanOrEqual(metrics.innerWidth - 1);
  expect(metrics.overlayHeight).toBeGreaterThanOrEqual(metrics.innerHeight - 1);
  expect(metrics.cardWidth).toBeGreaterThanOrEqual(expectedCardWidth - 2);
  expect(metrics.cardWidth).toBeLessThanOrEqual(expectedCardWidth + 2);
  expect(
    Math.abs(metrics.cardCenterX - metrics.innerWidth / 2),
  ).toBeLessThanOrEqual(8);
  expect(
    Math.abs(metrics.cardCenterY - metrics.innerHeight / 2),
  ).toBeLessThanOrEqual(8);
}

test('mobile starts on a document-flow menu before entering the game', async ({
  page,
}) => {
  await openGame(page, {
    screen: 'menu',
    viewport: { height: 844, width: 390 },
  });

  await expect(page.getByRole('heading', { name: 'TicTacube' })).toBeVisible();
  await expect(page.locator('.menu-play-action')).toHaveText('Play');
  await expect(page.getByText('Setup')).toBeVisible();
  await expect(page.getByText('Options')).toBeVisible();
  await expect(page.getByRole('button', { name: /Daily #\d+/ })).toBeVisible();
  await expect(page.locator('.game-panel')).toHaveCount(0);
  await expect(page.locator('.play-screen')).toBeHidden();

  const menuMetrics = await page.evaluate(() => {
    const menu = document
      .querySelector('.menu-screen')
      ?.getBoundingClientRect();
    const pageScroller = document.scrollingElement;

    return {
      bodyScrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth,
      menuHeight: menu?.height ?? 0,
      pageClientHeight: pageScroller?.clientHeight ?? 0,
      pageScrollHeight: pageScroller?.scrollHeight ?? 0,
    };
  });

  expect(menuMetrics.bodyScrollWidth).toBeLessThanOrEqual(
    menuMetrics.innerWidth,
  );
  expect(menuMetrics.menuHeight).toBeGreaterThanOrEqual(
    menuMetrics.pageClientHeight,
  );
  expect(menuMetrics.pageScrollHeight).toBeGreaterThanOrEqual(
    menuMetrics.pageClientHeight,
  );

  await enterGame(page);
  await expect(page.locator('.scanner-grid')).toBeVisible();
  await expect(page.locator('.stage-actions')).toHaveCount(0);
  await expect(page.locator('.stage-hud')).toBeVisible();
  await expect(page.locator('.stage-hud-turn')).toContainText('X turn');
  await expect(page.locator('.stage-hud-lines')).toContainText('0–0');
  await expect(page.locator('.stage-hud-match')).toContainText('You 0 · AI 0');
  await expect(page.locator('.stage-hud-remaining')).toContainText('27');

  const metrics = await page.evaluate(() => {
    const stage = document
      .querySelector('.game-stage')
      ?.getBoundingClientRect();
    const grid = document
      .querySelector('.scanner-grid')
      ?.getBoundingClientRect();
    const hud = document.querySelector('.stage-hud')?.getBoundingClientRect();

    return {
      bodyScrollWidth: document.body.scrollWidth,
      gridTop: grid?.top ?? 0,
      gridWidth: grid?.width ?? 0,
      hudBottom: hud?.bottom ?? 0,
      innerWidth: window.innerWidth,
      stageHeight: stage?.height ?? 0,
    };
  });

  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
  expect(metrics.stageHeight).toBeGreaterThanOrEqual(430);
  expect(metrics.gridWidth).toBeGreaterThanOrEqual(230);
  expect(metrics.hudBottom).toBeLessThanOrEqual(metrics.gridTop);

  await openMenu(page);
  await expect(page.locator('.menu-play-action')).toHaveText('Resume');
});

test('game screen is full-stage HUD-only at every breakpoint', async ({
  page,
}) => {
  for (const viewport of [
    { height: 667, width: 375 },
    { height: 800, width: 1280 },
  ]) {
    await openGame(page, { layout: 'scanner', viewport });

    await expect(page.locator('.stage-hud')).toBeVisible();
    await expect(page.locator('.stage-menu-button')).toBeVisible();
    await expect(page.locator('.stage-view-selector')).toBeVisible();
    await expect(page.locator('.menu-screen')).toBeHidden();
    await expect(page.locator('.game-panel')).toHaveCount(0);

    const metrics = await page.evaluate(() => {
      const stage = document
        .querySelector('.game-stage')
        ?.getBoundingClientRect();

      return {
        height: stage?.height ?? 0,
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        width: stage?.width ?? 0,
      };
    });

    expect(metrics.height).toBeGreaterThanOrEqual(metrics.innerHeight - 1);
    expect(metrics.width).toBeGreaterThanOrEqual(metrics.innerWidth - 1);
  }
});

test('menu preserves the mounted round and persisted screen supports resume', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);
  await place(page, 'X', 10);
  await page.getByRole('button', { name: 'Cube' }).click();
  await expectCanvasHasPixels(page);
  await page.evaluate(() => {
    const canvas =
      document.querySelector<HTMLCanvasElement>('.game-stage canvas');

    if (!canvas) {
      throw new Error('3D canvas was not mounted');
    }

    canvas.dataset.mountIdentity = 'preserved';
  });

  await openMenu(page);
  await expect(page.locator('.menu-play-action')).toHaveText('Resume');
  await expect(page.locator('.play-screen')).toBeHidden();
  await expect(page.locator('.play-screen')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  await expect(page.locator('.play-screen')).toHaveAttribute('inert', '');
  const hiddenCanvasState = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '.game-stage canvas',
    );
    const bounds = canvas?.getBoundingClientRect();

    return {
      cameraDistance: canvas?.dataset.cameraDistance ?? null,
      height: bounds?.height ?? 0,
      width: bounds?.width ?? 0,
    };
  });

  expect(hiddenCanvasState.width).toBeGreaterThan(0);
  expect(hiddenCanvasState.height).toBeGreaterThan(0);
  expect(
    await page
      .locator('.game-stage canvas')
      .getAttribute('data-mount-identity'),
  ).toBe('preserved');

  await enterGame(page);
  await expect(page.locator('.game-stage canvas')).toHaveAttribute(
    'data-mount-identity',
    'preserved',
  );
  expect(
    await page.locator('.game-stage canvas').getAttribute('data-camera-distance'),
  ).toBe(hiddenCanvasState.cameraDistance);
  await page.getByRole('button', { name: 'Scanner' }).click();
  await expect(page.getByRole('button', { name: /Cell 10, X/ })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-screen',
    'game',
  );
  await expect(page.locator('.stage-hud')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('3dxox-screen'))).toBe(
    'game',
  );
});

test('first-time tutorial is five-step, skippable, and never blocks play', async ({
  page,
}) => {
  await openGame(page, { guide: 'pending', layout: 'scanner', screen: 'menu' });

  const guide = page.locator('.tutorial-card');

  await expect(guide).toBeVisible();
  await expect(guide).toContainText('One cube, three floors');
  await expect(guide).toContainText('Step 1 of 5');
  await expect(guide.locator('.tutorial-progress-dot')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Next' })).toBeFocused();

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(guide).toContainText('Score every line');
  await expect(guide).toContainText('all 27 cells fill');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(guide).toContainText('Cells 1, 14, and 27');

  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(guide).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('3dxox-guide'))).toBe(
    'done',
  );

  await enterGame(page);
  await place(page, 'X', 10);
  await expect(page.getByRole('button', { name: /Cell 10, X/ })).toBeVisible();
});

test('tutorial can be reopened, traps focus, and returns focus on Escape', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner', screen: 'menu' });

  const helpButton = page.locator('.menu-guide-action');

  await helpButton.click();
  const guide = page.locator('.tutorial-card');
  await expect(guide).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next' })).toBeFocused();

  await page.getByRole('button', { name: 'Skip' }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Next' })).toBeFocused();

  for (let step = 1; step < 5; step += 1) {
    await page.getByRole('button', { name: 'Next' }).click();
  }

  await expect(guide).toContainText('Choose your view');
  await expect(guide).toContainText('Step 5 of 5');
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(guide).toContainText('Tap, then confirm');

  await page.keyboard.press('Escape');
  await expect(guide).toHaveCount(0);
  await expect(helpButton).toBeFocused();
});

test('Lines is the default ruleset and all themes remain switchable', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner', screen: 'menu' });

  await expect(page.locator('.ruleset-control button.active')).toContainText(
    'Lines',
  );
  await expect(page.locator('.line-score-card')).toBeVisible();

  await chooseRuleset(page, 'Classic');
  await expect(page.locator('.ruleset-control button.active')).toContainText(
    'Classic',
  );
  await expect(page.locator('.line-score-card')).toHaveCount(0);

  await chooseRuleset(page, 'Lines');
  await expect(page.locator('.ruleset-control button.active')).toContainText(
    'Lines',
  );
  await expect(page.locator('.line-score-card')).toBeVisible();

  const expectedThemes = [
    ['Glass', 'glass'],
    ['Hologram', 'holo'],
    ['Frosted', 'frosted'],
    ['Crystal', 'crystal'],
    ['Cage', 'cage'],
  ] as const;

  await openOptions(page);

  for (const [label, themeId] of expectedThemes) {
    await page.getByRole('button', { name: label }).click();
    await expect(page.locator('.app-shell')).toHaveAttribute(
      'data-theme',
      themeId,
    );
    await expect(page.locator('.theme-option.active')).toContainText(label);
  }

  await enterGame(page);
  await expect(
    page.getByRole('button', { name: /Place X at cell 10\b/ }),
  ).toBeVisible();
});

test('language switching localizes the game controls to Turkish', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await openOptions(page);

  await page.getByRole('button', { name: 'Türkçe' }).click();

  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await expect(page.getByText('Kurulum')).toBeVisible();
  await expect(page.getByText('Seçenekler')).toBeVisible();
  await expect(page.locator('.menu-play-action')).toHaveText('Devam et');
  await enterGame(page);
  await expect(
    page.getByRole('button', { name: /X işaretini hücre \d+/ }).first(),
  ).toBeVisible();
});

test('desktop 3D cube renders real canvas pixels', async ({ page }) => {
  await openGame(page, { layout: 'cube' });

  await expectCanvasHasPixels(page);
  await expectCurrentCanvasContextHealthy(page);
  await page.getByRole('button', { name: 'Rotate board right' }).click();
  await expectCanvasHasPixels(page);
  await expectCurrentCanvasContextHealthy(page);
});

test('3D board recovers from a WebGL context loss event', async ({ page }) => {
  await openGame(page, { layout: 'cube' });
  await expect(page.locator('canvas')).toBeVisible();
  await expectCurrentCanvasContextHealthy(page);
  await page.waitForTimeout(250);

  const loss = await page.evaluate(() => {
    const canvas =
      document.querySelector<HTMLCanvasElement>('.game-stage canvas');
    (
      window as unknown as { __lostBoardCanvas?: HTMLCanvasElement | null }
    ).__lostBoardCanvas = canvas;
    const event = new Event('webglcontextlost', { cancelable: true });

    canvas?.dispatchEvent(event);

    return {
      defaultPrevented: event.defaultPrevented,
    };
  });

  expect(loss.defaultPrevented).toBe(true);

  await page.waitForFunction(
    () => {
      const canvas =
        document.querySelector<HTMLCanvasElement>('.game-stage canvas');
      const lostCanvas = (
        window as unknown as { __lostBoardCanvas?: HTMLCanvasElement | null }
      ).__lostBoardCanvas;

      return Boolean(canvas && lostCanvas && canvas !== lostCanvas);
    },
    null,
    { polling: 100, timeout: 7000 },
  );

  await expectCanvasHasPixels(page);
  await expectCurrentCanvasContextHealthy(page);
});

test('compact desktop gives Cube and Floors the full stage width', async ({
  page,
}) => {
  await openGame(page, {
    layout: 'scanner',
    viewport: { height: 720, width: 1000 },
  });
  await expect(page.locator('.stage-hud')).toBeVisible();

  for (const view of ['Cube', 'Floors']) {
    await page.getByRole('button', { name: view }).click();
    await expect(page.locator('.app-shell')).toHaveAttribute(
      'data-layout',
      view.toLowerCase(),
    );
    await expectCanvasHasPixels(page);

    const metrics = await page.evaluate(() => {
      const selector = document
        .querySelector('.stage-view-selector')
        ?.getBoundingClientRect();
      const stage = document
        .querySelector('.game-stage')
        ?.getBoundingClientRect();

      return {
        bodyScrollWidth: document.body.scrollWidth,
        innerWidth: window.innerWidth,
        selectorHeight: selector?.height ?? 0,
        stageWidth: stage?.width ?? 0,
      };
    });

    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
    expect(metrics.stageWidth).toBeGreaterThanOrEqual(940);
    expect(metrics.selectorHeight).toBeGreaterThan(40);
  }
});

test('narrow persisted 3D views refresh without rewriting saved layout', async ({
  page,
}) => {
  for (const view of ['cube', 'floors'] as const) {
    await page.setViewportSize({ height: 863, width: 599 });
    await page.goto(appUrl);
    await page.evaluate((preferredLayout) => {
      window.localStorage.clear();
      window.localStorage.setItem('3dxox-guide', 'done');
      window.localStorage.setItem(
        '3dxox-layout',
        JSON.stringify(preferredLayout),
      );
    }, view);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enterGame(page);

    await expect(page.locator('.app-shell')).toHaveAttribute(
      'data-layout',
      view,
    );
    await expectCanvasHasPixels(page);
    await expectCurrentCanvasContextHealthy(page);
    expect(
      await page.evaluate(() => window.localStorage.getItem('3dxox-layout')),
    ).toBe(view);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator('.app-shell')).toHaveAttribute(
      'data-layout',
      view,
    );
    await expectCanvasHasPixels(page);
    await expectCurrentCanvasContextHealthy(page);
    expect(
      await page.evaluate(() => window.localStorage.getItem('3dxox-layout')),
    ).toBe(view);
  }
});

test('solo panel shows local progress and the daily puzzle', async ({
  page,
}) => {
  for (const viewport of [
    { height: 900, width: 1440 },
    { height: 812, width: 375 },
  ]) {
    await openGame(page, { layout: 'scanner', screen: 'menu', viewport });

    const dailyEntry = page.getByRole('button', { name: /Daily #\d+/ });
    const progressEntry = page.getByRole('button', { name: /Progress/ });

    await expect(dailyEntry).toBeVisible();
    await expect(progressEntry).toBeVisible();

    await progressEntry.click();
    await expectMenuModalCoversViewport(page);
    await expect(page.locator('.progress-card')).toContainText('Total lines');
    await expect(page.locator('.progress-card')).toContainText('Master wins');
    await expect(page.locator('.progress-card')).toContainText('Theme accents');
    await expect(page.locator('.progress-card')).toContainText('Lifetime');
    await page.getByRole('button', { name: 'Close' }).click();

    await dailyEntry.click();
    await expectMenuModalCoversViewport(page);
    await expect(page.locator('.daily-puzzle-card')).toContainText(
      /Find the|Score the/,
    );
    await expect(page.locator('.daily-puzzle-instructions')).toContainText(
      'X to move',
    );
    await expect(page.locator('.daily-puzzle-floor')).toHaveCount(3);
    await expect(page.locator('.daily-cell')).toHaveCount(27);
    await expect(page.getByLabel('Puzzle floor 1')).toContainText('Floor 1');

    const puzzleBoardLayout = await page
      .locator('.daily-puzzle-board')
      .evaluate((board) => {
        const floors = Array.from(
          board.querySelectorAll<HTMLElement>('.daily-puzzle-floor'),
        );
        const cells = Array.from(
          board.querySelectorAll<HTMLElement>('.daily-cell'),
        );
        const firstGrid =
          board.querySelector<HTMLElement>('.daily-puzzle-grid');
        const floorRects = floors.map((floor) => floor.getBoundingClientRect());

        return {
          gridColumnCount: firstGrid
            ? getComputedStyle(firstGrid).gridTemplateColumns.split(' ').length
            : 0,
          minCellHeight: Math.min(
            ...cells.map((cell) => cell.getBoundingClientRect().height),
          ),
          minCellWidth: Math.min(
            ...cells.map((cell) => cell.getBoundingClientRect().width),
          ),
          stacked:
            floorRects.length > 1 &&
            floorRects[1].top >= floorRects[0].bottom - 1,
        };
      });

    expect(puzzleBoardLayout.gridColumnCount).toBe(3);
    expect(puzzleBoardLayout.minCellHeight).toBeGreaterThanOrEqual(44);
    expect(puzzleBoardLayout.minCellWidth).toBeGreaterThanOrEqual(44);
    expect(puzzleBoardLayout.stacked).toBe(viewport.width <= 680);
    await page.locator('.daily-cell:not(:disabled)').first().click();
    await expect(
      page.locator('.daily-result-announcement[role="status"]'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
  }
});

async function createCoachScoreAndBlockPosition(page: Page) {
  await chooseTwoPlayer(page);
  await showFloor(page, 1);
  await place(page, 'X', 1);
  await showFloor(page, 2);
  await place(page, 'O', 13);
  await showFloor(page, 1);
  await place(page, 'X', 2);
  await showFloor(page, 2);
  await place(page, 'O', 14);
  await showFloor(page, 1);
  await place(page, 'X', 4);
}

test('Coach Auto starts explicit then softens score-only hints', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await createCoachScoreAndBlockPosition(page);

  await expect(page.locator('.coach-prompt')).toHaveCount(0);
  await expect(page.locator('.coach-legend')).toContainText('Score');
  await expect(page.locator('.coach-legend')).toContainText('Block');
  await showFloor(page, 2);
  await expect(
    page.getByRole('button', {
      name: /Place O at cell 15, floor 2.*completes a line/,
    }),
  ).toBeVisible();

  await openGame(page, {
    layout: 'scanner',
    localScore: { O: 1, X: 2, draws: 0 },
  });
  await createCoachScoreAndBlockPosition(page);
  await showFloor(page, 2);

  await expect(
    page.getByRole('button', {
      name: /Place O at cell 15, floor 2.*score hint available on focus/,
    }),
  ).toBeVisible();
  await expect(page.locator('.scanner-cell.coach-soft-score')).toBeVisible();

  await showFloor(page, 1);
  await expect(
    page.getByRole('button', {
      name: /Place O at cell 3, floor 1.*blocks X through cells 1-2-3/,
    }),
  ).toBeVisible();
});

test('scanner supports keyboard navigation between cells and floors', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await showFloor(page, 2);

  await page.getByRole('button', { name: /Place X at cell 10\b/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('button', { name: /Place X at cell 11\b/ }),
  ).toBeFocused();

  await page.keyboard.press('PageUp');
  await expect(
    page.getByRole('button', { name: /Place X at cell 20\b/ }),
  ).toBeFocused();
});

test('scanner mini-grids switch floors and its first-use hint stays dismissed', async ({
  page,
}) => {
  await openGame(page, {
    layout: 'scanner',
    scannerHint: 'pending',
    viewport: { height: 844, width: 390 },
  });

  await expect(page.getByTestId('scanner-overview')).toBeVisible();
  await expect(page.locator('.scanner-floor-thumbnail')).toHaveCount(2);
  await expect(page.getByTestId('scanner-grid')).toHaveAttribute(
    'data-active-floor',
    '2',
  );
  await expect(page.getByTestId('scanner-first-use-hint')).toContainText(
    'Floor 2 of 3 — lines can cross floors.',
  );

  const floorOne = page.getByTestId('scanner-floor-thumbnail-1');
  const floorOneAccent = await floorOne.evaluate((thumbnail) =>
    getComputedStyle(thumbnail)
      .getPropertyValue('--scanner-floor-accent')
      .trim(),
  );
  await floorOne.click();
  await expect(page.getByTestId('scanner-grid')).toHaveAttribute(
    'data-active-floor',
    '1',
  );
  expect(floorOneAccent).not.toBe('');

  await page.getByTestId('scanner-hint-dismiss').click();
  await expect(page.getByTestId('scanner-first-use-hint')).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem('3dxox-scanner-hint')),
  ).toBe('done');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app-shell')).toHaveAttribute(
    'data-screen',
    'game',
  );
  await expect(page.getByTestId('scanner-first-use-hint')).toHaveCount(0);
});

test('scanner mini-grids retain completed cross-floor lines with Coach off', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);
  await openOptions(page);
  await page
    .locator('.coach-control')
    .getByRole('button', { name: 'Off', exact: true })
    .click();
  await enterGame(page);

  await showFloor(page, 1);
  await place(page, 'X', 1);
  await place(page, 'O', 2);
  await showFloor(page, 2);
  await place(page, 'X', 10);
  await place(page, 'O', 11);
  await showFloor(page, 3);
  await place(page, 'X', 19);

  await expect(page.locator('.coach-legend')).toHaveCount(0);
  await expect(
    page.locator('.scanner-cell[data-cell-index="18"].cross-floor-scored'),
  ).toBeVisible();
  await expect(
    page
      .getByTestId('scanner-floor-thumbnail-1')
      .locator('[data-cell-index="0"][data-cross-floor-scored="true"]'),
  ).toBeVisible();
  await expect(
    page
      .getByTestId('scanner-floor-thumbnail-2')
      .locator('[data-cell-index="9"][data-cross-floor-scored="true"]'),
  ).toBeVisible();
});

test('scanner board supports a complete 2P winning round', async ({ page }) => {
  await openGame(page, { layout: 'scanner' });
  await chooseRuleset(page, 'Classic');
  await chooseTwoPlayer(page);

  await place(page, 'X', 10);
  await page.getByRole('button', { name: 'Keep sides' }).click();
  await place(page, 'O', 13);
  await place(page, 'X', 11);
  await place(page, 'O', 14);
  await place(page, 'X', 12);

  await expect(page.getByText('X wins the round')).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /Cell 10, X, winning line, floor 2/,
    }),
  ).toBeVisible();
});

test('best-of-5 match alternates openers and ends at 3 wins', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await chooseRuleset(page, 'Classic');
  await chooseTwoPlayer(page);

  await expect(page.locator('.stage-hud-match')).toContainText('X 0 · O 0');
  await openMenu(page);
  await expect(page.locator('.panel-scoreboard')).toContainText('Round');
  await expect(page.locator('.scoreboard-opener')).toContainText('X opens');
  await enterGame(page);

  await winClassicRoundForX(page, 'X');
  await expect(page.getByText('Round 1: X wins the round')).toBeVisible();
  await expect(page.getByText('X opened - O opens next')).toBeVisible();
  await expect(page.locator('.stage-hud-match')).toContainText('X 1 · O 0');

  await page.getByRole('button', { name: 'Play again' }).click();
  await openMenu(page);
  await expect(page.locator('.scoreboard-opener')).toContainText('O opens');
  await enterGame(page);

  await winClassicRoundForX(page, 'O');
  await expect(page.getByText('Round 2: X wins the round')).toBeVisible();
  await expect(page.getByText('O opened - X opens next')).toBeVisible();
  await expect(page.locator('.stage-hud-match')).toContainText('X 2 · O 0');

  await page.getByRole('button', { name: 'Play again' }).click();
  await openMenu(page);
  await expect(page.locator('.scoreboard-opener')).toContainText('X opens');
  await enterGame(page);

  await winClassicRoundForX(page, 'X');
  await expect(page.getByText('Round 3: X wins the round')).toBeVisible();
  await expect(page.getByText('X wins the match, 3–0')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New match' })).toBeVisible();
  await expect(page.locator('.stage-hud-match')).toContainText('X 3 · O 0');

  await page.getByRole('button', { name: 'New match' }).click();
  await expect(page.locator('.stage-hud-match')).toContainText('X 0 · O 0');
  await openMenu(page);
  await page.getByRole('button', { name: /Progress/ }).click();
  await expect(page.locator('.progress-card')).toContainText('Lifetime');
  await expect(page.locator('.progress-card')).toContainText('3-0');
});

test('an O match victory reports the winner-first score', async ({ page }) => {
  await openGame(page, { layout: 'scanner' });
  await chooseRuleset(page, 'Classic');
  await chooseTwoPlayer(page);

  await winClassicRoundForO(page, 'X');
  await page.getByRole('button', { name: 'Play again' }).click();
  await winClassicRoundForO(page, 'O');
  await page.getByRole('button', { name: 'Play again' }).click();
  await winClassicRoundForO(page, 'X');

  await expect(page.getByText('O wins the match, 3–0')).toBeVisible();
  await expect(page.locator('.stage-hud-match')).toContainText('X 0 · O 3');
});

test('changing participants resets match identity instead of reassigning wins', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await chooseRuleset(page, 'Classic');
  await chooseTwoPlayer(page);
  await winClassicRoundForX(page, 'X');

  await expect(page.locator('.stage-hud-match')).toContainText('X 1 · O 0');

  await openMenu(page);
  await page.getByRole('button', { name: 'AI', exact: true }).click();
  const modeReset = page.getByRole('dialog', {
    name: 'Reset the active match?',
  });
  await expect(modeReset).toContainText(
    'Switching to AI mode resets the active best of 5.',
  );
  await modeReset.getByRole('button', { name: 'Switch' }).click();
  await expect(page.locator('.scoreboard-match-score strong')).toHaveText(
    'You 0 · AI 0',
  );

  await chooseRuleset(page, 'Lines');
  await enterGame(page);
  await showFloor(page, 2);
  await place(page, 'X', 10);
  await expect(page.locator('.stage-hud-turn')).toContainText('X turn', {
    timeout: 3000,
  });

  await openMenu(page);
  const sideGroup = page
    .locator('.control-group')
    .filter({ hasText: 'You play' });
  await sideGroup.getByRole('button', { name: 'O', exact: true }).click();
  const sideReset = page.getByRole('dialog', {
    name: 'Reset the active match?',
  });
  await expect(sideReset).toContainText(
    'Switching sides resets the active best of 5.',
  );
  await sideReset.getByRole('button', { name: 'Switch' }).click();

  await expect(page.locator('.scoreboard-match-score strong')).toHaveText(
    'You 0 · AI 0',
  );
  await expect(page.locator('.scoreboard-opener')).toContainText('AI opens');
});

test('changing AI difficulty can be cancelled or starts a clean match', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await showFloor(page, 2);
  await place(page, 'X', 10);
  await expect(page.locator('.stage-hud-turn')).toContainText('X turn', {
    timeout: 3000,
  });

  await openMenu(page);
  const difficulty = page.locator('.difficulty-control');
  await difficulty.getByRole('button', { name: 'Hard', exact: true }).click();
  const resetDialog = page.getByRole('dialog', {
    name: 'Reset the active match?',
  });
  await expect(resetDialog).toContainText(
    'Changing AI difficulty resets the active best of 5.',
  );
  await resetDialog.getByRole('button', { name: 'Keep playing' }).click();
  await expect(
    difficulty.getByRole('button', { name: 'Smart', exact: true }),
  ).toHaveClass(/active/);
  await enterGame(page);
  await expect(page.getByRole('button', { name: /Cell 10, X/ })).toBeVisible();

  await openMenu(page);
  await difficulty.getByRole('button', { name: 'Hard', exact: true }).click();
  await resetDialog.getByRole('button', { name: 'Switch' }).click();
  await expect(
    difficulty.getByRole('button', { name: 'Hard', exact: true }),
  ).toHaveClass(/active/);
  await enterGame(page);
  await expect(
    page.getByRole('button', { name: /Place X at cell 10/ }),
  ).toBeVisible();
  await expect(page.locator('.stage-hud-match')).toContainText('You 0 · AI 0');
});

test('Classic Pie swap preserves participant opener identity', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await chooseRuleset(page, 'Classic');
  await showFloor(page, 2);
  await place(page, 'X', 14);

  await expect(page.locator('.stage-toast')).toContainText('AI swapped sides');
  await openMenu(page);
  const sideGroup = page
    .locator('.control-group')
    .filter({ hasText: 'You play' });
  await expect(
    sideGroup.getByRole('button', { name: 'O', exact: true }),
  ).toHaveClass(/active/);
  await expect(page.locator('.scoreboard-opener')).toContainText('You open');
  await expect(page.locator('.scoreboard-next')).toContainText('AI opens');
  await enterGame(page);
  await expect(page.locator('.stage-hud-turn')).toContainText('O turn');
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

  await expect(page.locator('.stage-hud-lines')).toContainText('1–0');
  await expect(page.getByText('X +1 line')).toBeVisible();
  await expect(page.locator('.scanner-cell.score-event').first()).toBeVisible();
  await expect(
    page.locator('.scanner-cell.score-line-step[data-line-step="2"]').first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /Cell 12, X, scored line, scoring animation active, floor 2/,
    }),
  ).toBeVisible();
  await expect(page.getByText(/wins the round/i)).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /Place O at cell 15\b/ }),
  ).toBeVisible();
});

test('blocking a threat gets red scanner feedback', async ({ page }) => {
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);
  await showFloor(page, 2);

  await place(page, 'X', 13);
  await place(page, 'O', 10);
  await place(page, 'X', 14);
  await place(page, 'O', 11);
  await place(page, 'X', 12);

  await expect(page.locator('.scanner-cell.block-event').first()).toBeVisible();
  await expect(
    page
      .locator('.scanner-cell.block-line-step[data-line-event="block"]')
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /Cell 12, X, block animation active, floor 2/,
    }),
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
  await expect(page.locator('.stage-hud-lines')).toContainText('4–1');
  await expect(page.locator('.scanner-cell.score-event').first()).toBeVisible();
  await expect(
    page
      .locator('.scanner-cell.combo-line-step:not([data-line-sequence="0"])')
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /Cell 14, X, scored line, scoring animation active, floor 2/,
    }),
  ).toBeVisible();
});

test('reduced motion keeps animation states without large scanner motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);

  await place(page, 'X', 10);
  await place(page, 'O', 13);
  await place(page, 'X', 11);
  await place(page, 'O', 14);
  await place(page, 'X', 12);

  const scoreEvent = page.locator('.scanner-cell.score-event').first();

  await expect(scoreEvent).toBeVisible();
  await expect(scoreEvent).toHaveCSS('animation-name', 'none');
});

test('coach mode marks blocking and combined cells on the scanner board', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);
  await openOptions(page);
  await page
    .locator('.coach-control')
    .getByRole('button', { name: 'On', exact: true })
    .click();

  await expect(page.locator('.coach-legend')).toContainText('Score');
  await expect(page.locator('.coach-legend')).toContainText('Block');
  await expect(page.locator('.coach-legend')).toContainText('Score + block');
  await enterGame(page);

  await place(page, 'X', 10);
  await place(page, 'O', 13);
  await place(page, 'X', 11);

  await expect(
    page.getByRole('button', {
      name: /Place O at cell 12, floor 2.*blocks X through cells 10-11-12/,
    }),
  ).toBeVisible();

  await openMenu(page);
  await page.getByRole('button', { name: 'New round' }).click();
  await enterGame(page);
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
      name: /Place O at cell 3, floor 1.*completes a line.*blocks X/,
    }),
  ).toBeVisible();
  await expect(
    page.locator('.scanner-hint-glyph.hint-glyph-both'),
  ).toContainText('S+B');
});

test('scanner coach explains cross-floor threats with rail and connector cues', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);
  await openOptions(page);
  await page
    .locator('.coach-control')
    .getByRole('button', { name: 'On', exact: true })
    .click();
  await enterGame(page);

  await showFloor(page, 1);
  await place(page, 'X', 1);
  await place(page, 'O', 4);
  await showFloor(page, 2);
  await place(page, 'X', 10);
  await showFloor(page, 1);

  await expect(
    page.getByRole('button', { name: /Floor 3, block hint/ }),
  ).toBeVisible();
  await expect(
    page.locator('.scanner-cell.coach-connector-block'),
  ).toBeVisible();
  await expect(page.locator('.scanner-coach-note.note-block')).toContainText(
    'Cell 19 blocks X',
  );
});

test('lines final result explains the score and filled board', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);

  for (const floor of [1, 2, 3] as const) {
    await showFloor(page, floor);

    const start = (floor - 1) * 9 + 1;

    for (let cell = start; cell < start + 9; cell += 1) {
      await place(page, cell % 2 === 1 ? 'X' : 'O', cell);

      if (cell === 21) {
        await expect(page.locator('.final-phase-cue')).toContainText('Final 6');
        await expect(page.locator('.line-tension-note')).toContainText(
          'Final 6',
        );
        await expect(
          page.getByRole('button', {
            name: /Place O at cell 22, floor 3.*final-6 scoring move/,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', {
            name: /Place O at cell 25, floor 3.*final-6 blocking move/,
          }),
        ).toBeVisible();
      }

      if (cell === 22) {
        await expect(page.locator('.stage-hud-remaining.tense')).toContainText(
          '5',
        );
      }
    }
  }

  await expect(page.getByText('X wins by lines, 12–6')).toBeVisible();
  await expect(page.getByText('Final board filled - X opened')).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /Cell 27, X, final winning line, floor 3/,
    }),
  ).toBeVisible();
});

test('an O Lines victory reports the winner-first score', async ({ page }) => {
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);

  const xCells = [4, 5, 6, 7, 8, 9, 10, 12, 13, 15, 16, 19, 25, 26];
  const oCells = [1, 2, 3, 11, 14, 17, 18, 20, 21, 22, 23, 24, 27];

  for (let turn = 0; turn < xCells.length; turn += 1) {
    const xCell = xCells[turn];
    await showFloor(page, Math.ceil(xCell / 9) as 1 | 2 | 3);
    await place(page, 'X', xCell);

    const oCell = oCells[turn];
    if (oCell !== undefined) {
      await showFloor(page, Math.ceil(oCell / 9) as 1 | 2 | 3);
      await place(page, 'O', oCell);
    }
  }

  await expect(page.getByText('O wins by lines, 7–5')).toBeVisible();
  await expect(page.locator('.stage-hud')).toContainText('O wins 7–5');
});

test('local Lines Final Six Powers choose board targets and add bonus score', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);
  await openMenu(page);
  await page.getByRole('button', { name: 'Final Six Powers (beta)' }).click();
  await expect(page.locator('.line-score-card')).toContainText('X total');
  await expect(page.locator('.line-score-card')).toContainText('Bonus');
  await expect(page.locator('.power-card')).toContainText(
    'choose on the board',
  );
  await expect(page.locator('.power-options')).toHaveCount(0);
  await enterGame(page);

  for (const floor of [1, 2, 3] as const) {
    await showFloor(page, floor);

    const start = (floor - 1) * 9 + 1;
    const end = floor === 3 ? 22 : start + 9;

    for (let cell = start; cell < end; cell += 1) {
      await place(page, cell % 2 === 1 ? 'X' : 'O', cell);
    }
  }

  await expect(page.locator('.game-stage.final-six-animating')).toBeVisible();
  await expect(
    page
      .locator('.stage-toast.notice-system')
      .getByText('Final Six: cube charged'),
  ).toBeVisible();
  await openMenu(page);
  await expect(page.locator('.power-draft-status')).toContainText('O chooses');
  const powerOptions = page.locator('.power-options');

  await powerOptions.getByRole('button', { name: 'Shield' }).click();
  await enterGame(page);
  await expect(
    page.locator('.scanner-cell.power-preview-line-shield-line').first(),
  ).toBeVisible();
  await expect(
    page.locator('.scanner-cell.power-preview-shield-cell').first(),
  ).toBeVisible();
  await openMenu(page);
  await powerOptions.getByRole('button', { name: 'Charge' }).click();
  await enterGame(page);
  await expect(
    page.getByRole('button', {
      name: /Place O at cell 22, floor 3.*\+2 preview for Charged Cell/,
    }),
  ).toBeVisible();
  await expect(page.locator('.scanner-board.power-charged')).toBeVisible();
  await place(page, 'O', 22);

  await openMenu(page);
  await expect(page.locator('.power-draft-status')).toContainText('X chooses');
  await enterGame(page);
  await expect(
    page.getByRole('button', {
      name: /Place X at cell 25, floor 3.*\+2 preview for Charged Cell/,
    }),
  ).toBeVisible();
  await place(page, 'X', 25);

  await openMenu(page);
  await expect(page.locator('.power-card')).toContainText('O Power');
  await expect(page.locator('.power-card')).toContainText('Charged Cell');
  await enterGame(page);
  await expect(page.locator('.scanner-cell.power-cell')).toHaveCount(2);

  await place(page, 'O', 22);

  await expect(page.getByText(/Charged Cell \+2/)).toBeVisible();
  await expect(page.locator('.scanner-cell.power-event').first()).toBeVisible();
  await expect(
    page.locator('.scanner-cell.power-line-step').first(),
  ).toBeVisible();
  await expect(page.locator('.scanner-power-float.bonus')).toContainText('+2');
  await openMenu(page);
  await expect(
    page.locator('.line-score-bonus.power-bonus-bump'),
  ).toBeVisible();
  await expect(page.locator('.power-card')).toContainText('Bonus 0-2');
  await expect(page.locator('.line-bonus-note')).toContainText('Bonus 0-2');
  await expect(page.locator('.line-bonus-note')).toContainText('Lines');
  await expect(page.locator('.line-bonus-note')).toContainText('Total');
});

test('mobile view selector can enter and leave the 3D board', async ({
  page,
}) => {
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

test('mobile 3D camera preserves player zoom across viewport resize', async ({
  page,
}) => {
  await openGame(page, {
    layout: 'cube',
    viewport: { height: 700, width: 375 },
  });

  const canvas = page.locator('canvas');
  const cameraDistance = () =>
    canvas.evaluate((element) =>
      Number((element as HTMLCanvasElement).dataset.cameraDistance),
    );
  const fittedDistance = () =>
    canvas.evaluate((element) =>
      Number((element as HTMLCanvasElement).dataset.cameraFitDistance),
    );

  await expect(canvas).toBeVisible();
  await expect.poll(cameraDistance).toBeGreaterThan(0);
  await expect
    .poll(async () =>
      Math.abs((await cameraDistance()) - (await fittedDistance())),
    )
    .toBeLessThan(0.02);

  await page.getByRole('button', { name: 'Zoom board in' }).click();
  await expect
    .poll(async () => (await fittedDistance()) - (await cameraDistance()))
    .toBeGreaterThan(0.5);
  const zoomedDistance = await cameraDistance();

  await page.setViewportSize({ height: 650, width: 375 });
  await expect
    .poll(async () => Math.abs((await cameraDistance()) - zoomedDistance))
    .toBeLessThan(0.02);

  await page.getByRole('button', { name: 'Reset board view' }).click();
  await expect
    .poll(async () =>
      Math.abs((await cameraDistance()) - (await fittedDistance())),
    )
    .toBeLessThan(0.02);
});

test('online host and guest can join and relay a scanner move', async ({
  browser,
  page: host,
}) => {
  await openGame(host, { layout: 'scanner', screen: 'menu' });
  await host.getByRole('button', { name: 'Online' }).click();

  await expect(host.locator('.online-card')).toContainText(
    'Coach disabled online',
  );
  await expect(host.locator('.online-card')).toContainText(
    'Final Six Powers are local prototype only',
  );
  await host.locator('.panel-section-options summary').click();
  await expect(
    host.locator('.coach-control').getByRole('button', { name: /Auto/ }),
  ).toBeDisabled();
  await expect(
    host
      .locator('.endgame-control')
      .getByRole('button', { name: 'Final Six Powers (beta)' }),
  ).toBeDisabled();

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
    await openGame(guest, { layout: 'scanner', screen: 'menu' });
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
      guest
        .locator('.ruleset-control')
        .getByRole('button', { name: 'Classic' }),
    ).toBeDisabled();
    await expect(
      host.getByRole('button', { name: 'New round', exact: true }),
    ).toBeDisabled();
    await expect(
      host.getByRole('button', { name: 'Reset match', exact: true }),
    ).toBeDisabled();

    await enterGame(host);
    await enterGame(guest);
    await expect(host.locator('.stage-hud-turn')).toContainText(
      'Your turn · X',
    );
    await expect(guest.locator('.stage-hud-turn')).toContainText(
      "Opponent's turn · X",
    );
    await expect(host.locator('.game-stage')).not.toHaveClass(/online-waiting/);
    await expect(guest.locator('.game-stage')).toHaveClass(/online-waiting/);
    await expect(
      guest.getByRole('button', { name: /Cell 10, empty, floor 2/ }),
    ).toBeDisabled();

    await place(host, 'X', 10);
    await expect(
      guest.getByRole('button', { name: /Cell 10, X/ }),
    ).toBeVisible();
    await expect(host.locator('.stage-hud-turn')).toContainText(
      "Opponent's turn · O",
    );
    await expect(guest.locator('.stage-hud-turn')).toContainText(
      'Your turn · O',
    );
    await expect(guest.locator('.stage-hud-turn')).toHaveClass(
      /online-turn-handover/,
    );
    await expect(host.locator('.game-stage')).toHaveClass(/online-waiting/);
    await expect(guest.locator('.game-stage')).not.toHaveClass(
      /online-waiting/,
    );
    await expect(
      host.getByRole('button', { name: /Cell 11, empty, floor 2/ }),
    ).toBeDisabled();
    await expect(
      guest.getByRole('button', { name: /Place O at cell 11\b/ }),
    ).toBeEnabled();

    await openMenu(host);
    await host.getByRole('button', { name: 'AI', exact: true }).click();
    const leaveRoomDialog = host.getByRole('dialog', {
      name: 'Reset the active match?',
    });
    await leaveRoomDialog.getByRole('button', { name: 'Switch' }).click();
    await expect(
      host.getByRole('button', { name: 'AI', exact: true }),
    ).toHaveClass(/active/);
    await openMenu(guest);
    await expect(guest.locator('.online-card')).toContainText('peer away');
    await expect(guest.locator('.online-card')).toContainText(
      'waiting for the other player to return',
    );
  } finally {
    await guestContext.close();
  }
});

test('online guest adopts host Classic room settings and locks rules', async ({
  browser,
  page: host,
}) => {
  await openGame(host, { layout: 'scanner', screen: 'menu' });
  await chooseRuleset(host, 'Classic');
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
    await openGame(guest, { layout: 'scanner', screen: 'menu' });
    await expect(guest.locator('.ruleset-control button.active')).toContainText(
      'Lines',
    );

    await guest.getByRole('button', { name: 'Online' }).click();
    await guest
      .locator('.online-card')
      .getByRole('textbox', { name: 'Join' })
      .fill(roomCode);
    await guest.getByRole('button', { name: /^Join$/ }).click();

    await expect(guest.locator('.online-card')).toContainText('Classic room');
    await expect(guest.locator('.ruleset-control button.active')).toContainText(
      'Classic',
    );
    await expect(
      guest.locator('.ruleset-control').getByRole('button', { name: 'Lines' }),
    ).toBeDisabled();
    await expect(guest.locator('.line-score-card')).toHaveCount(0);

    await enterGame(host);
    await enterGame(guest);
    await expect(host.locator('.stage-hud-turn')).toContainText(
      'Your turn · X',
    );
    await expect(guest.locator('.stage-hud-turn')).toContainText(
      "Opponent's turn · X",
    );
    await place(host, 'X', 10);
    await expect(
      guest.getByRole('button', { name: /Cell 10, X/ }),
    ).toBeVisible();
    await expect(host.locator('.stage-hud-turn')).toContainText(
      "Opponent's turn · O",
    );
    await expect(guest.locator('.stage-hud-turn')).toContainText(
      'Your turn · O',
    );
  } finally {
    await guestContext.close();
  }
});
