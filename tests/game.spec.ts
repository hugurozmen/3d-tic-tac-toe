import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

const appUrl = 'http://127.0.0.1:5173/';

async function openGame(
  page: Page,
  {
    guide = 'done',
    layout,
    localScore,
    viewport = { height: 720, width: 1280 },
  }: {
    guide?: 'done' | 'pending';
    layout?: 'cube' | 'floors' | 'scanner';
    localScore?: { draws: number; O: number; X: number };
    viewport?: { height: number; width: number };
  } = {},
) {
  await page.setViewportSize(viewport);
  await page.addInitScript(({ preferredGuide, preferredLayout, preferredScore }) => {
    window.localStorage.clear();

    if (preferredGuide === 'done') {
      window.localStorage.setItem('3dxox-guide', 'done');
    }

    if (preferredLayout) {
      window.localStorage.setItem('3dxox-layout', preferredLayout);
    }

    if (preferredScore) {
      window.localStorage.setItem('3dxox-score', JSON.stringify(preferredScore));
    }
  }, { preferredGuide: guide, preferredLayout: layout, preferredScore: localScore });
  await page.goto(appUrl);
}

async function chooseTwoPlayer(page: Page) {
  await page.getByRole('button', { name: '2P' }).click();
}

async function openOptions(page: Page) {
  const section = page.locator('.panel-section-options');
  const options = page.locator('.panel-section-options summary');

  if ((await section.getAttribute('open')) === null) {
    await options.click();
  }
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
      const canvas = document.querySelector<HTMLCanvasElement>(
        '.game-stage canvas',
      );
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

async function expectPanelModalCoversViewport(page: Page) {
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
    const panel = document.querySelector('.game-panel');
    const panelBounds = panel?.getBoundingClientRect();
    const cardElement = document.querySelector('.panel-modal-card');

    if (!overlay || !card || !panelBounds || !panel || !cardElement) {
      throw new Error('Panel modal geometry could not be measured');
    }

    return {
      cardCenterX: card.left + card.width / 2,
      cardCenterY: card.top + card.height / 2,
      cardHeight: card.height,
      cardWidth: card.width,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      modalInPanel: panel.contains(cardElement),
      overlayHeight: overlay.height,
      overlayLeft: overlay.left,
      overlayTop: overlay.top,
      overlayWidth: overlay.width,
      panelWidth: panelBounds.width,
    };
  });
  const expectedCardWidth = Math.min(760, metrics.innerWidth - 32);

  expect(metrics.modalInPanel).toBe(false);
  expect(metrics.overlayLeft).toBeLessThanOrEqual(1);
  expect(metrics.overlayTop).toBeLessThanOrEqual(1);
  expect(metrics.overlayWidth).toBeGreaterThanOrEqual(metrics.innerWidth - 1);
  expect(metrics.overlayHeight).toBeGreaterThanOrEqual(metrics.innerHeight - 1);
  expect(metrics.cardWidth).toBeGreaterThanOrEqual(expectedCardWidth - 2);
  expect(metrics.cardWidth).toBeLessThanOrEqual(expectedCardWidth + 2);
  expect(Math.abs(metrics.cardCenterX - metrics.innerWidth / 2)).toBeLessThanOrEqual(
    8,
  );
  expect(Math.abs(metrics.cardCenterY - metrics.innerHeight / 2)).toBeLessThanOrEqual(
    8,
  );

  if (metrics.innerWidth >= 900) {
    expect(metrics.cardWidth).toBeGreaterThan(metrics.panelWidth);
  }
}

async function expectStackedPanelUsesPageScroll(page: Page) {
  await openOptions(page);

  const scrollMetrics = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('.game-panel');
    const panelScroll = document.querySelector<HTMLElement>('.panel-scroll');
    const stickyActions = document.querySelector<HTMLElement>(
      '.panel-sticky-actions',
    );
    const stickyTop = document.querySelector<HTMLElement>('.panel-sticky-top');
    const pageScroller = document.scrollingElement;

    if (!panel || !panelScroll || !stickyActions || !stickyTop || !pageScroller) {
      throw new Error('Stacked panel metrics could not be measured');
    }

    panelScroll.scrollTop = 120;

    return {
      actionsPosition: window.getComputedStyle(stickyActions).position,
      pageClientHeight: pageScroller.clientHeight,
      pageScrollHeight: pageScroller.scrollHeight,
      panelHeight: panel.getBoundingClientRect().height,
      panelOverflow: window.getComputedStyle(panel).overflowY,
      panelScrollClientHeight: panelScroll.clientHeight,
      panelScrollHeight: panelScroll.scrollHeight,
      panelScrollOverflow: window.getComputedStyle(panelScroll).overflowY,
      panelScrollTop: panelScroll.scrollTop,
      stickyTopPosition: window.getComputedStyle(stickyTop).position,
    };
  });

  expect(scrollMetrics.panelOverflow).toBe('visible');
  expect(scrollMetrics.panelScrollOverflow).toBe('visible');
  expect(scrollMetrics.panelScrollTop).toBe(0);
  expect(scrollMetrics.panelScrollHeight).toBeLessThanOrEqual(
    scrollMetrics.panelScrollClientHeight + 1,
  );
  expect(scrollMetrics.pageScrollHeight).toBeGreaterThan(
    scrollMetrics.pageClientHeight,
  );
  expect(scrollMetrics.panelHeight).toBeGreaterThan(
    scrollMetrics.panelScrollClientHeight,
  );
  expect(scrollMetrics.stickyTopPosition).toBe('sticky');
  expect(scrollMetrics.actionsPosition).toBe('sticky');

  await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('.game-panel');

    if (!panel) {
      throw new Error('Panel was not found');
    }

    window.scrollTo(0, window.scrollY + panel.getBoundingClientRect().top + 220);
  });

  const stickyMetrics = await page.evaluate(() => {
    const actions = document
      .querySelector<HTMLElement>('.panel-sticky-actions')
      ?.getBoundingClientRect();
    const panel = document
      .querySelector<HTMLElement>('.game-panel')
      ?.getBoundingClientRect();
    const stickyTop = document
      .querySelector<HTMLElement>('.panel-sticky-top')
      ?.getBoundingClientRect();

    if (!actions || !panel || !stickyTop) {
      throw new Error('Sticky panel metrics could not be measured');
    }

    return {
      actionsBottom: actions.bottom,
      innerHeight: window.innerHeight,
      panelBottom: panel.bottom,
      panelTop: panel.top,
      stickyTopTop: stickyTop.top,
    };
  });

  expect(stickyMetrics.panelTop).toBeLessThan(0);
  expect(stickyMetrics.panelBottom).toBeGreaterThan(stickyMetrics.innerHeight);
  expect(stickyMetrics.stickyTopTop).toBeGreaterThanOrEqual(-1);
  expect(stickyMetrics.stickyTopTop).toBeLessThanOrEqual(1);
  expect(stickyMetrics.actionsBottom).toBeGreaterThanOrEqual(
    stickyMetrics.innerHeight - 1,
  );
  expect(stickyMetrics.actionsBottom).toBeLessThanOrEqual(
    stickyMetrics.innerHeight + 1,
  );
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

  await page.evaluate(() => {
    document.querySelector('.game-panel')?.scrollIntoView();
  });

  const panelMetrics = await page.evaluate(() => {
    const actions = document
      .querySelector('.panel-sticky-actions')
      ?.getBoundingClientRect();
    const panel = document.querySelector('.game-panel')?.getBoundingClientRect();
    const scoreboard = document
      .querySelector('.panel-scoreboard')
      ?.getBoundingClientRect();

    return {
      actionsBottom: actions?.bottom ?? 0,
      panelBottom: panel?.bottom ?? 0,
      panelTop: panel?.top ?? 0,
      scoreboardTop: scoreboard?.top ?? 0,
    };
  });

  expect(panelMetrics.scoreboardTop).toBeGreaterThanOrEqual(
    panelMetrics.panelTop,
  );
  expect(panelMetrics.actionsBottom).toBeLessThanOrEqual(
    panelMetrics.panelBottom,
  );
});

test('stacked panel uses the page scroll instead of a nested panel scroller', async ({
  page,
}) => {
  await openGame(page, {
    layout: 'scanner',
    viewport: { height: 667, width: 375 },
  });
  await expectStackedPanelUsesPageScroll(page);

  await openGame(page, {
    layout: 'cube',
    viewport: { height: 820, width: 1024 },
  });
  await expectCanvasHasPixels(page);
  await expectStackedPanelUsesPageScroll(page);
});

test('desktop panel keeps its internal scroll model', async ({ page }) => {
  await openGame(page, {
    layout: 'scanner',
    viewport: { height: 800, width: 1280 },
  });
  await openOptions(page);

  const metrics = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('.game-panel');
    const panelScroll = document.querySelector<HTMLElement>('.panel-scroll');
    const stickyActions = document.querySelector<HTMLElement>(
      '.panel-sticky-actions',
    );
    const stickyTop = document.querySelector<HTMLElement>('.panel-sticky-top');

    if (!panel || !panelScroll || !stickyActions || !stickyTop) {
      throw new Error('Desktop panel metrics could not be measured');
    }

    panelScroll.scrollTop = 120;

    return {
      actionsPosition: window.getComputedStyle(stickyActions).position,
      innerHeight: window.innerHeight,
      panelHeight: panel.getBoundingClientRect().height,
      panelOverflow: window.getComputedStyle(panel).overflowY,
      panelScrollClientHeight: panelScroll.clientHeight,
      panelScrollHeight: panelScroll.scrollHeight,
      panelScrollOverflow: window.getComputedStyle(panelScroll).overflowY,
      panelScrollTop: panelScroll.scrollTop,
      stickyTopPosition: window.getComputedStyle(stickyTop).position,
    };
  });

  expect(metrics.panelHeight).toBeGreaterThanOrEqual(metrics.innerHeight - 1);
  expect(metrics.panelHeight).toBeLessThanOrEqual(metrics.innerHeight + 1);
  expect(metrics.panelOverflow).toBe('hidden');
  expect(metrics.panelScrollOverflow).toBe('auto');
  expect(metrics.panelScrollHeight).toBeGreaterThan(
    metrics.panelScrollClientHeight,
  );
  expect(metrics.panelScrollTop).toBeGreaterThan(0);
  expect(metrics.stickyTopPosition).toBe('relative');
  expect(metrics.actionsPosition).toBe('relative');
});

test('first-time guide teaches Lines scoring and 3D diagonals', async ({
  page,
}) => {
  await openGame(page, { guide: 'pending', layout: 'scanner' });

  const guide = page.getByRole('dialog', { name: 'How to play' });

  await expect(guide).toBeVisible();
  await expect(guide.locator('.guide-list li').first()).toContainText(
    'Lines is the main game',
  );
  await expect(guide).toContainText('all 27 cells fill');
  await expect(guide).toContainText('Cells 1, 14, and 27');
  await expect(guide.locator('.guide-list li')).toHaveCount(2);

  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(guide).toHaveCount(0);
  await place(page, 'X', 10);
  await expect(page.getByRole('button', { name: /Cell 10, X/ })).toBeVisible();
});

test('guide dialog closes with Escape and returns focus', async ({ page }) => {
  await openGame(page, { layout: 'scanner' });

  const helpButton = page.getByRole('button', { name: 'How to play' });

  await helpButton.click();
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Got it' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'How to play' })).toHaveCount(0);
  await expect(helpButton).toBeFocused();
});

test('Lines is the default ruleset and all themes remain switchable', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });

  await expect(
    page.locator('.ruleset-control button.active'),
  ).toContainText('Lines');
  await expect(page.locator('.line-score-card')).toBeVisible();

  await page.getByRole('button', { name: 'Classic' }).click();
  await expect(
    page.locator('.ruleset-control button.active'),
  ).toContainText('Classic');
  await expect(page.locator('.line-score-card')).toHaveCount(0);

  await page
    .locator('.ruleset-control')
    .getByRole('button', { name: 'Lines', exact: true })
    .click();
  await expect(
    page.locator('.ruleset-control button.active'),
  ).toContainText('Lines');
  await expect(page.locator('.line-score-card')).toBeVisible();

  const expectedThemes = [
    ['Glass', 'glass'],
    ['Hologram', 'holo'],
    ['Frosted', 'frosted'],
    ['Crystal', 'crystal'],
    ['Cage', 'cage'],
  ] as const;

  await page.locator('.panel-section-options summary').click();

  for (const [label, themeId] of expectedThemes) {
    await page.getByRole('button', { name: label }).click();
    await expect(page.locator('.app-shell')).toHaveAttribute(
      'data-theme',
      themeId,
    );
    await expect(page.locator('.theme-option.active')).toContainText(label);
    await expect(
      page.getByRole('button', { name: /Place X at cell 10\b/ }),
    ).toBeVisible();
  }
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
    const canvas = document.querySelector<HTMLCanvasElement>(
      '.game-stage canvas',
    );
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
      const canvas = document.querySelector<HTMLCanvasElement>(
        '.game-stage canvas',
      );
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
  await openOptions(page);

  for (const view of ['Cube', 'Floors']) {
    await page.getByRole('button', { name: view }).click();
    await expect(page.locator('.app-shell')).toHaveAttribute(
      'data-layout',
      view.toLowerCase(),
    );
    await expectCanvasHasPixels(page);

    const metrics = await page.evaluate(() => {
      const panel = document.querySelector('.game-panel')?.getBoundingClientRect();
      const selector = document
        .querySelector('.mobile-view-selector')
        ?.getBoundingClientRect();
      const stage = document.querySelector('.game-stage')?.getBoundingClientRect();

      return {
        bodyScrollWidth: document.body.scrollWidth,
        innerWidth: window.innerWidth,
        panelTop: panel?.top ?? 0,
        selectorHeight: selector?.height ?? 0,
        stageBottom: stage?.bottom ?? 0,
        stageWidth: stage?.width ?? 0,
      };
    });

    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
    expect(metrics.stageWidth).toBeGreaterThanOrEqual(940);
    expect(metrics.selectorHeight).toBeGreaterThan(40);
    expect(metrics.panelTop).toBeGreaterThan(metrics.stageBottom);
  }
});

test('narrow persisted 3D views refresh without rewriting saved layout', async ({
  page,
}) => {
  for (const view of ['cube', 'floors'] as const) {
    await page.setViewportSize({ height: 863, width: 599 });
    await page.addInitScript((preferredLayout) => {
      window.localStorage.clear();
      window.localStorage.setItem('3dxox-guide', 'done');
      window.localStorage.setItem(
        '3dxox-layout',
        JSON.stringify(preferredLayout),
      );
    }, view);
    await page.goto(appUrl);

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

test('solo panel shows local progress and the daily puzzle', async ({ page }) => {
  for (const viewport of [
    { height: 900, width: 1440 },
    { height: 812, width: 375 },
  ]) {
    await openGame(page, { layout: 'scanner', viewport });

    const dailyEntry = page.getByRole('button', { name: /Daily #\d+/ });
    const progressEntry = page.getByRole('button', { name: /Progress/ });

    await expect(dailyEntry).toBeVisible();
    await expect(progressEntry).toBeVisible();

    await progressEntry.click();
    await expectPanelModalCoversViewport(page);
    await expect(page.locator('.progress-card')).toContainText('Total lines');
    await expect(page.locator('.progress-card')).toContainText('Master wins');
    await expect(page.locator('.progress-card')).toContainText('Theme accents');
    await expect(page.locator('.progress-card')).toContainText('Lifetime');
    await page.getByRole('button', { name: 'Close' }).click();

    await dailyEntry.click();
    await expectPanelModalCoversViewport(page);
    await expect(page.locator('.daily-puzzle-card')).toContainText(
      /Find the|Score the/,
    );
    await expect(page.locator('.daily-cell')).toHaveCount(27);
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

test('scanner board supports a complete 2P winning round', async ({ page }) => {
  await openGame(page, { layout: 'scanner' });
  await page.getByRole('button', { name: 'Classic' }).click();
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
  await page.getByRole('button', { name: 'Classic' }).click();
  await chooseTwoPlayer(page);

  await expect(page.locator('.panel-scoreboard')).toContainText('Round');
  await expect(page.locator('.scoreboard-match-score strong')).toHaveText('0-0');
  await expect(page.locator('.scoreboard-opener')).toContainText('X opens');

  await winClassicRoundForX(page, 'X');
  await expect(page.getByText('Round 1: X wins the round')).toBeVisible();
  await expect(page.getByText('X opened - O opens next')).toBeVisible();
  await expect(page.locator('.scoreboard-match-score strong')).toHaveText('1-0');

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('.scoreboard-opener')).toContainText('O opens');

  await winClassicRoundForX(page, 'O');
  await expect(page.getByText('Round 2: X wins the round')).toBeVisible();
  await expect(page.getByText('O opened - X opens next')).toBeVisible();
  await expect(page.locator('.scoreboard-match-score strong')).toHaveText('2-0');

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.locator('.scoreboard-opener')).toContainText('X opens');

  await winClassicRoundForX(page, 'X');
  await expect(page.getByText('Round 3: X wins the round')).toBeVisible();
  await expect(page.getByText('X wins the match, 3–0')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New match' })).toBeVisible();
  await expect(page.locator('.scoreboard-match-score strong')).toHaveText('X');

  await page.getByRole('button', { name: 'New match' }).click();
  await expect(page.locator('.scoreboard-match-score strong')).toHaveText('0-0');
  await page.getByRole('button', { name: /Progress/ }).click();
  await expect(page.locator('.progress-card')).toContainText('Lifetime');
  await expect(page.locator('.progress-card')).toContainText('3-0');
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
    page.locator('.scanner-cell.block-line-step[data-line-event="block"]').first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /Cell 12, X, block animation active, floor 2/,
    }),
  ).toBeVisible();
  await expect(page.locator('.line-score-card.block-event')).toBeVisible();
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

  await place(page, 'X', 10);
  await place(page, 'O', 13);
  await place(page, 'X', 11);

  await expect(
    page.getByRole('button', {
      name: /Place O at cell 12, floor 2.*blocks X through cells 10-11-12/,
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
      name: /Place O at cell 3, floor 1.*completes a line.*blocks X/,
    }),
  ).toBeVisible();
  await expect(page.locator('.scanner-hint-glyph.hint-glyph-both')).toContainText(
    'S+B',
  );
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

      if (cell === 21) {
        await expect(page.locator('.final-phase-cue')).toContainText('Final 6');
        await expect(page.locator('.line-tension-note')).toContainText('Final 6');
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
        await expect(page.locator('.line-score-empty.tension')).toContainText('5');
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

test('local Lines Final Six Powers choose board targets and add bonus score', async ({
  page,
}) => {
  await openGame(page, { layout: 'scanner' });
  await chooseTwoPlayer(page);
  await page.getByRole('button', { name: 'Final Six Powers (beta)' }).click();
  await expect(page.locator('.line-score-card')).toContainText('X total');
  await expect(page.locator('.line-score-card')).toContainText('Bonus');
  await expect(page.locator('.power-card')).toContainText(
    'choose on the board',
  );
  await expect(page.locator('.power-options')).toHaveCount(0);

  for (const floor of [1, 2, 3] as const) {
    await showFloor(page, floor);

    const start = (floor - 1) * 9 + 1;
    const end = floor === 3 ? 22 : start + 9;

    for (let cell = start; cell < end; cell += 1) {
      await place(page, cell % 2 === 1 ? 'X' : 'O', cell);
    }
  }

  await expect(page.locator('.power-draft-status')).toContainText('O chooses');
  await expect(page.locator('.game-stage.final-six-animating')).toBeVisible();
  await expect(
    page.locator('.stage-toast.notice-system').getByText('Final Six: cube charged'),
  ).toBeVisible();
  const powerOptions = page.locator('.power-options');

  await powerOptions.getByRole('button', { name: 'Shield' }).click();
  await expect(
    page.locator('.scanner-cell.power-preview-line-shield-line').first(),
  ).toBeVisible();
  await expect(
    page.locator('.scanner-cell.power-preview-shield-cell').first(),
  ).toBeVisible();
  await powerOptions.getByRole('button', { name: 'Charge' }).click();
  await expect(
    page.getByRole('button', {
      name: /Place O at cell 22, floor 3.*\+2 preview for Charged Cell/,
    }),
  ).toBeVisible();
  await expect(page.locator('.scanner-board.power-charged')).toBeVisible();
  await place(page, 'O', 22);

  await expect(page.locator('.power-draft-status')).toContainText('X chooses');
  await expect(
    page.getByRole('button', {
      name: /Place X at cell 25, floor 3.*\+2 preview for Charged Cell/,
    }),
  ).toBeVisible();
  await place(page, 'X', 25);

  await expect(page.locator('.power-card')).toContainText('O Power');
  await expect(page.locator('.power-card')).toContainText('Charged Cell');
  await expect(page.locator('.scanner-cell.power-cell')).toHaveCount(2);

  await place(page, 'O', 22);

  await expect(page.getByText(/Charged Cell \+2/)).toBeVisible();
  await expect(page.locator('.scanner-cell.power-event').first()).toBeVisible();
  await expect(page.locator('.scanner-cell.power-line-step').first()).toBeVisible();
  await expect(page.locator('.scanner-power-float.bonus')).toContainText('+2');
  await expect(page.locator('.line-score-bonus.power-bonus-bump')).toBeVisible();
  await expect(page.locator('.power-card')).toContainText('Bonus 0-2');
  await expect(page.locator('.line-bonus-note')).toContainText(
    'Bonus 0-2',
  );
  await expect(page.locator('.line-bonus-note')).toContainText('Lines');
  await expect(page.locator('.line-bonus-note')).toContainText(
    'Total',
  );
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
