import { spawn } from 'node:child_process';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const START_APP_PORT = 5180;
const START_ONLINE_PORT = 8790;
const AI_TURN_WARN_MS = 2500;
const AI_TURN_FAIL_MS = 7000;

const themes = [
  ['Glass', 'glass'],
  ['Hologram', 'holo'],
  ['Frosted', 'frosted'],
  ['Crystal', 'crystal'],
  ['Cage', 'cage'],
];

const waitForPort = (startPort) =>
  new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const server = net.createServer();

      server.once('error', () => tryPort(port + 1));
      server.listen(port, '127.0.0.1', () => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(port);
        });
      });
    };

    tryPort(startPort);
  });

const waitForHttp = async (url, label, timeoutMs = 30000) => {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }

      lastError = new Error(`${label} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for ${label}: ${lastError?.message ?? 'no response'}`);
};

const startProcess = (name, command, args, env = {}) => {
  const output = [];
  const child = spawn(command, args, {
    cwd: process.cwd(),
    detached: true,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const capture = (streamName) => (chunk) => {
    const text = String(chunk);
    output.push(`[${streamName}] ${text}`);
    if (output.length > 80) {
      output.shift();
    }
  };

  child.stdout.on('data', capture('out'));
  child.stderr.on('data', capture('err'));

  return {
    name,
    output,
    stop: async () => {
      if (child.exitCode !== null) {
        return;
      }

      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }

      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        delay(2500),
      ]);

      if (child.exitCode === null) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }
    },
  };
};

const fail = (message) => {
  throw new Error(message);
};

const expectText = async (locator, text, label) => {
  const content = (await locator.textContent())?.replace(/\s+/g, ' ').trim() ?? '';

  if (!content.includes(text)) {
    fail(`${label} expected "${text}" in "${content}"`);
  }

  return content;
};

const getTurnText = async (page) =>
  (await page.locator('.turn-badge').textContent())?.replace(/\s+/g, ' ').trim() ?? '';

const isRoundComplete = async (page) => (await page.locator('.round-result').count()) > 0;

const showFloor = async (page, floor) => {
  const rail = page.locator(`.scanner-stop[aria-label^="Floor ${floor}"]`);
  await rail.click();
};

const floorForCell = (cell) => Math.floor((cell - 1) / 9) + 1;

const place = async (page, player, cell) => {
  await showFloor(page, floorForCell(cell));
  await page.locator(`button[data-cell-index="${cell - 1}"][aria-label^="Place ${player} at cell"]`).click();
};

const clickButton = async (page, name) => {
  await page.getByRole('button', { exact: true, name }).click();
};

const setRuleset = async (page, ruleset) => {
  await clickButton(page, ruleset);
  await expectText(page.locator('.ruleset-control button.active'), ruleset, 'active ruleset');
};

const setMode = async (page, mode) => {
  await clickButton(page, mode);
};

const setDifficulty = async (page, difficulty) => {
  await clickButton(page, difficulty);
};

const setHumanSide = async (page, side) => {
  const group = page.locator('.control-group').filter({ hasText: 'You play' });
  await group.getByRole('button', { exact: true, name: side }).click();
};

const getHumanSide = async (page) => {
  const group = page.locator('.control-group').filter({ hasText: 'You play' });
  const text = (await group.locator('button.active').textContent())?.trim();

  return text === 'O' ? 'O' : 'X';
};

const waitForTurnOrResult = async (page, player, timeoutMs = AI_TURN_FAIL_MS) => {
  const startedAt = Date.now();

  await page.waitForFunction(
    ({ player: expectedPlayer }) => {
      const result = document.querySelector('.round-result');
      const turn = document.querySelector('.turn-badge')?.textContent ?? '';

      return Boolean(result) || turn.includes(`${expectedPlayer} turn`);
    },
    { player },
    { timeout: timeoutMs },
  );

  return Date.now() - startedAt;
};

const waitForAnyHumanTurnOrResult = async (page, timeoutMs = AI_TURN_FAIL_MS) => {
  const startedAt = Date.now();

  await page.waitForFunction(
    () => {
      const result = document.querySelector('.round-result');
      const turn = document.querySelector('.turn-badge')?.textContent ?? '';

      return Boolean(result) || turn.includes('X turn') || turn.includes('O turn');
    },
    undefined,
    { timeout: timeoutMs },
  );

  return Date.now() - startedAt;
};

const waitForPiePromptOrTurn = async (page, player, timeoutMs = AI_TURN_FAIL_MS) => {
  const startedAt = Date.now();

  await page.waitForFunction(
    ({ player: expectedPlayer }) => {
      const result = document.querySelector('.round-result');
      const pieDialog = document.querySelector('[aria-label="Pie Rule decision"]');
      const turn = document.querySelector('.turn-badge')?.textContent ?? '';

      return Boolean(result) || Boolean(pieDialog) || turn.includes(`${expectedPlayer} turn`);
    },
    { player },
    { timeout: timeoutMs },
  );

  return Date.now() - startedAt;
};

const firstAvailableCell = async (page, player) => {
  for (const floor of [1, 2, 3]) {
    await showFloor(page, floor);
    const available = page.locator(`button[data-cell-index][aria-label^="Place ${player} at cell"]`);
    const count = await available.count();

    if (count > 0) {
      const cell = Number(await available.first().getAttribute('data-cell-index')) + 1;
      await available.first().click();
      return cell;
    }
  }

  return null;
};

const boardMarkCount = async (page) => {
  let total = 0;

  for (const floor of [1, 2, 3]) {
    await showFloor(page, floor);
    total += await page
      .locator('button[data-cell-index][aria-label^="Cell "][aria-label*=", floor"]')
      .count();
  }

  return total;
};

const waitForAiOpeningIfNeeded = async (page, humanSide, notes) => {
  const turn = await getTurnText(page);

  if (turn.includes(`${humanSide} turn`)) {
    return;
  }

  const duration = await waitForTurnOrResult(page, humanSide);
  notes.aiDurations.push(duration);
};

const handlePiePromptIfVisible = async (page, choice = 'Keep sides?', timeoutMs = 0) => {
  const prompt = page.getByRole('dialog', { name: 'Pie Rule decision' });

  if (timeoutMs > 0) {
    try {
      await prompt.waitFor({ state: 'visible', timeout: timeoutMs });
    } catch {
      return false;
    }
  } else if ((await prompt.count()) === 0) {
    return false;
  }

  await prompt.getByRole('button', { exact: true, name: choice }).click();
  return true;
};

const playSoloRound = async (page, notes, { maxHumanMoves = 16, untilComplete = true } = {}) => {
  let moves = 0;

  while (!(await isRoundComplete(page)) && moves < maxHumanMoves) {
    let humanSide = await getHumanSide(page);
    await handlePiePromptIfVisible(page);
    humanSide = await getHumanSide(page);

    const turn = await getTurnText(page);

    if (!turn.includes(`${humanSide} turn`)) {
      const duration = await waitForTurnOrResult(page, humanSide);
      notes.aiDurations.push(duration);

      if (duration > AI_TURN_WARN_MS) {
        notes.observations.push(`AI turn took ${duration}ms`);
      }

      continue;
    }

    const cell = await firstAvailableCell(page, humanSide);

    if (cell === null) {
      break;
    }

    moves += 1;

    if (!(await isRoundComplete(page))) {
      const duration = await waitForTurnOrResult(page, humanSide);
      notes.aiDurations.push(duration);

      if (duration > AI_TURN_WARN_MS) {
        notes.observations.push(`AI turn after cell ${cell} took ${duration}ms`);
      }
    }

    if (!untilComplete && moves >= maxHumanMoves) {
      break;
    }
  }

  if (untilComplete && !(await isRoundComplete(page))) {
    fail(`round did not complete after ${moves} human moves`);
  }

  return {
    moves,
    result: (await page.locator('.round-result').textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim(),
  };
};

const pageMetrics = async (page) =>
  page.evaluate(() => {
    const grid = document.querySelector('.scanner-grid')?.getBoundingClientRect();
    const stage = document.querySelector('.game-stage')?.getBoundingClientRect();
    const panel = document.querySelector('.game-panel')?.getBoundingClientRect();

    return {
      bodyScrollWidth: document.body.scrollWidth,
      gridWidth: grid?.width ?? 0,
      innerWidth: window.innerWidth,
      panelWidth: panel?.width ?? 0,
      stageHeight: stage?.height ?? 0,
    };
  });

const makePage = async (browser, appUrl, label, options = {}) => {
  const context = await browser.newContext({
    viewport: options.viewport ?? { height: 720, width: 1280 },
  });
  const page = await context.newPage();
  const notes = {
    aiDurations: [],
    browserErrors: [],
    dialogs: [],
    observations: [],
  };

  page.on('console', (message) => {
    if (message.type() === 'error') {
      notes.browserErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => notes.browserErrors.push(error.message));
  page.on('dialog', async (dialog) => {
    notes.dialogs.push(`${dialog.type()}: ${dialog.message()}`);
    await dialog.dismiss();
  });
  await page.addInitScript(({ layout }) => {
    window.localStorage.clear();
    window.localStorage.setItem('3dxox-guide', 'done');
    if (layout) {
      window.localStorage.setItem('3dxox-layout', layout);
    }
  }, { layout: options.layout ?? 'scanner' });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('.app-shell').waitFor({ state: 'visible' });

  return { context, label, notes, page };
};

const runSession = async (browser, appUrl, label, callback, options = {}) => {
  const startedAt = Date.now();
  const fixture = await makePage(browser, appUrl, label, options);

  try {
    const details = await callback(fixture.page, fixture.notes);
    const metrics = await pageMetrics(fixture.page).catch(() => null);

    if (fixture.notes.browserErrors.length > 0) {
      fail(`${label} logged browser errors: ${fixture.notes.browserErrors.join(' | ')}`);
    }

    return {
      details,
      durationMs: Date.now() - startedAt,
      label,
      metrics,
      notes: fixture.notes,
      status: 'passed',
    };
  } finally {
    await fixture.context.close();
  }
};

const runSoloLines = (difficulty, humanSide) => async (page, notes) => {
  await setDifficulty(page, difficulty);
  await setHumanSide(page, humanSide);
  await expectText(page.locator('.ruleset-control button.active'), 'Lines', 'Lines default');
  await expectText(page.locator('.line-score-card'), 'X lines', 'Lines score card');
  await waitForAiOpeningIfNeeded(page, humanSide, notes);
  const details = await playSoloRound(page, notes, { maxHumanMoves: 16 });

  if (!details.result?.includes('by lines')) {
    fail(`Lines result did not explain line score: ${details.result}`);
  }

  return details;
};

const runClassicPiePlayerFirst = async (page, notes) => {
  await setRuleset(page, 'Classic');
  await setDifficulty(page, 'Smart');
  await setHumanSide(page, 'X');
  await place(page, 'X', 14);
  await waitForAnyHumanTurnOrResult(page);
  const activeSide = await getHumanSide(page);
  notes.observations.push(`After center opener, human side is ${activeSide}`);
  const details = await playSoloRound(page, notes, { maxHumanMoves: 8 });

  if (!details.result?.includes('round')) {
    fail(`Classic result text missing round context: ${details.result}`);
  }

  return details;
};

const runClassicPieAiFirst = async (page, notes) => {
  await setRuleset(page, 'Classic');
  await setDifficulty(page, 'Smart');
  await setHumanSide(page, 'O');
  const duration = await waitForPiePromptOrTurn(page, 'O');
  notes.aiDurations.push(duration);
  const sawPie = await handlePiePromptIfVisible(page, 'Keep sides?');

  if (!sawPie) {
    fail('AI-first Classic did not show the Pie Rule decision');
  }

  const details = await playSoloRound(page, notes, { maxHumanMoves: 8 });

  if (!details.result?.includes('round')) {
    fail(`Classic result text missing round context: ${details.result}`);
  }

  return { ...details, pieDecision: 'kept sides' };
};

const runTwoPlayerLinesScanner = async (page) => {
  await setMode(page, '2P');
  await place(page, 'X', 10);
  await place(page, 'O', 13);
  await place(page, 'X', 11);
  await place(page, 'O', 14);
  await place(page, 'X', 12);
  await expectText(page.locator('.stage-toast.notice-score'), 'X +1 line', 'Lines scoring toast');

  if (await isRoundComplete(page)) {
    fail('Lines scoring ended the round too early');
  }

  return {
    lineScore: (await page.locator('.line-score-card').textContent())?.replace(/\s+/g, ' ').trim(),
  };
};

const runTwoPlayerClassicCube = async (page) => {
  await setRuleset(page, 'Classic');
  await setMode(page, '2P');
  await clickButton(page, 'Cube');
  await page.locator('canvas').waitFor({ state: 'visible' });
  const canvas = page.locator('canvas');
  const waitForCanvasBox = async () => {
    await page.waitForFunction(
      () => {
        const canvasElement = document.querySelector('canvas');
        const rect = canvasElement?.getBoundingClientRect();

        return Boolean(rect && rect.width > 500 && rect.height > 400);
      },
      undefined,
      { timeout: 5000 },
    );

    const box = await page.evaluate(() => {
      const canvasElement = document.querySelector('canvas');
      const rect = canvasElement?.getBoundingClientRect();

      if (!rect) {
        return null;
      }

      return {
        height: rect.height,
        width: rect.width,
        x: rect.left,
        y: rect.top,
      };
    });

    if (!box) {
      fail('Cube canvas did not expose a bounding box');
    }

    return box;
  };

  const candidates = [];

  for (const x of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
    for (const y of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
      candidates.push([x, y]);
    }
  }

  for (const [xRatio, yRatio] of candidates) {
    await clickButton(page, 'Cube');
    const box = await waitForCanvasBox();
    await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
    await delay(200);
    await handlePiePromptIfVisible(page, 'Keep sides?', 500);
    await clickButton(page, 'Scanner');

    const marks = await boardMarkCount(page);

    if (marks > 0) {
      return { cubeMarksAfterClick: marks };
    }
  }

  fail('Cube canvas click did not place a Classic 2P mark');
};

const runDailyPuzzle = async (page) => {
  const card = page.locator('.daily-puzzle-card');
  await expectText(card, 'Daily #', 'Daily puzzle card');
  const enabledCell = card.locator('.daily-cell:not([disabled])').first();
  const label = await enabledCell.getAttribute('aria-label');
  await enabledCell.click();
  await expectText(card.locator('.daily-puzzle-result'), 'Best move', 'Daily puzzle result');
  await expectText(card.locator('.daily-puzzle-result'), 'Your move', 'Daily puzzle result');

  return {
    picked: label,
    result: (await card.locator('.daily-puzzle-result').textContent())?.replace(/\s+/g, ' ').trim(),
  };
};

const runMobileScanner = async (page) => {
  await setMode(page, '2P');
  await place(page, 'X', 10);
  await place(page, 'O', 13);
  const metrics = await pageMetrics(page);

  if (metrics.bodyScrollWidth > metrics.innerWidth) {
    fail(`Mobile overflow: scrollWidth ${metrics.bodyScrollWidth}, innerWidth ${metrics.innerWidth}`);
  }

  if (metrics.gridWidth < 280 || metrics.stageHeight < 430) {
    fail(`Mobile scanner too small: ${JSON.stringify(metrics)}`);
  }

  return metrics;
};

const runThemeSwitching = async (page) => {
  const seen = [];

  for (const [label, id] of themes) {
    await clickButton(page, label);
    const activeTheme = await page.locator('.app-shell').getAttribute('data-theme');

    if (activeTheme !== id) {
      fail(`Theme ${label} expected ${id}, got ${activeTheme}`);
    }

    await expectText(page.locator('.theme-option.active'), label, 'active theme');
    seen.push(id);
  }

  return { seen };
};

const runOnlineSession = (ruleset) => async (_page, _notes, browser, appUrl) => {
  const hostFixture = await makePage(browser, appUrl, `${ruleset} host`, { layout: 'scanner' });
  const guestFixture = await makePage(browser, appUrl, `${ruleset} guest`, { layout: 'scanner' });
  const { page: host, notes: hostNotes, context: hostContext } = hostFixture;
  const { page: guest, notes: guestNotes, context: guestContext } = guestFixture;

  try {
    if (ruleset === 'Classic') {
      await setRuleset(host, 'Classic');
    }

    await clickButton(host, 'Online');
    await clickButton(host, 'Host');
    const room = host.locator('.online-card').getByRole('textbox', { name: 'Room' });
    await room.waitFor();
    const roomCode = await room.inputValue();

    if (!/^[A-Z0-9]{5}$/.test(roomCode)) {
      fail(`Invalid room code ${roomCode}`);
    }

    await clickButton(guest, 'Online');
    await guest.locator('.online-card').getByRole('textbox', { name: 'Join' }).fill(roomCode);
    await guest.locator('.online-card').getByRole('button', { name: 'Join' }).click();
    await expectText(host.locator('.online-card'), 'connected', `${ruleset} host online`);
    await expectText(guest.locator('.online-card'), 'connected', `${ruleset} guest online`);
    await expectText(host.locator('.online-card'), `${ruleset} room`, `${ruleset} host room`);
    await expectText(guest.locator('.online-card'), `${ruleset} room`, `${ruleset} guest room`);
    await expectText(guest.locator('.ruleset-control button.active'), ruleset, `${ruleset} guest ruleset`);

    await place(host, 'X', 10);
    await showFloor(guest, 2);
    await guest.locator('button[aria-label*="Cell 10, X"]').waitFor({ state: 'visible' });
    await place(guest, 'O', 13);
    await showFloor(host, 2);
    await host.locator('button[aria-label*="Cell 13, O"]').waitFor({ state: 'visible' });

    const hostRoom = (await host.locator('.online-card').textContent())?.replace(/\s+/g, ' ').trim() ?? '';

    if (ruleset === 'Lines' && hostRoom.includes('Pie')) {
      fail(`Lines online room should not mention Pie settings: ${hostRoom}`);
    }

    if (ruleset === 'Classic' && !hostRoom.includes('Pie off')) {
      fail(`Classic online room should show Pie setting: ${hostRoom}`);
    }

    if (hostNotes.browserErrors.length || guestNotes.browserErrors.length) {
      fail(`Online ${ruleset} browser errors`);
    }

    return {
      hostRoom,
      roomCode,
    };
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
};

const main = async () => {
  const appPort = await waitForPort(START_APP_PORT);
  const onlinePort = await waitForPort(START_ONLINE_PORT);
  const appUrl = `http://127.0.0.1:${appPort}/`;
  const onlineUrl = `ws://127.0.0.1:${onlinePort}`;
  const processes = [
    startProcess('online-server', 'node', ['server/online-server.mjs'], {
      HOST: '127.0.0.1',
      PORT: String(onlinePort),
    }),
    startProcess('vite', 'npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(appPort)], {
      VITE_ONLINE_SERVER_URL: onlineUrl,
    }),
  ];
  let browser = null;

  try {
    await waitForHttp(`http://127.0.0.1:${onlinePort}/health`, 'online server');
    await waitForHttp(appUrl, 'Vite app');
    browser = await chromium.launch();

    const results = [];

    const session = async (label, callback, options = {}) => {
      const result = await runSession(
        browser,
        appUrl,
        label,
        (page, notes) => callback(page, notes, browser, appUrl),
        options,
      );
      results.push(result);
      console.log(`PASS ${label} (${result.durationMs}ms)`);
    };

    await session('Lines vs Casual, player first', runSoloLines('Casual', 'X'));
    await session('Lines vs Casual, AI first', runSoloLines('Casual', 'O'));
    await session('Lines vs Smart', runSoloLines('Smart', 'X'));
    await session('Lines vs Master', runSoloLines('Master', 'X'));
    await session('Classic with Pie Rule, player first', runClassicPiePlayerFirst);
    await session('Classic with Pie Rule, AI first', runClassicPieAiFirst);
    await session('2P Lines in Scanner', runTwoPlayerLinesScanner);
    await session('2P Classic in Cube', runTwoPlayerClassicCube, { layout: 'cube' });
    await session('Online Lines', runOnlineSession('Lines'));
    await session('Online Classic', runOnlineSession('Classic'));
    await session('Daily Puzzle', runDailyPuzzle);
    await session('Mobile Scanner', runMobileScanner, {
      viewport: { height: 844, width: 390 },
    });
    await session('Theme switching', runThemeSwitching);

    const aiDurations = results.flatMap((result) => result.notes.aiDurations);
    const maxAiDuration = aiDurations.length ? Math.max(...aiDurations) : 0;

    if (maxAiDuration > AI_TURN_FAIL_MS) {
      fail(`Slow AI turn exceeded ${AI_TURN_FAIL_MS}ms: ${maxAiDuration}ms`);
    }

    console.log(
      JSON.stringify(
        {
          appUrl,
          maxAiDuration,
          onlineUrl,
          results,
          sessions: results.length,
        },
        null,
        2,
      ),
    );
  } finally {
    if (browser) {
      await browser.close();
    }

    await Promise.all(processes.map((processInfo) => processInfo.stop()));
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
