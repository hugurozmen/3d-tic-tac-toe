import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });

  module._compile(outputText, filename);
};

const {
  AI_CENTER_INDEX,
  chooseAiMove,
  shouldSwapClassicPie,
} = require('../src/game/ai.ts');
const { getCoachHints } = require('../src/game/coach.ts');
const {
  createBoard,
  evaluateBoard,
  getAvailableMoves,
  getNewCompletedLines,
  getOtherPlayer,
} = require('../src/game/rules.ts');
const {
  getVariantScoresForBoard,
  getVariantWinner,
} = require('../src/game/linesVariant.ts');
const {
  WILDCARDS,
  activateWildcard,
  canActivateWildcard,
  chooseWildcardDraft,
  chooseWildcardMove,
  consumeActiveWildcard,
  createWildcardDraft,
  getRemainingDraftOptions,
  pickWildcard,
} = require('../src/game/wildcards.ts');

const DIFFICULTY_LABELS = {
  easy: 'Casual',
  balanced: 'Smart',
  hard: 'Hard',
  master: 'Master',
};

const DIFFICULTY_ORDER = ['easy', 'balanced', 'hard', 'master'];
const OPENING_PROBES = [null, AI_CENTER_INDEX, 0, 4];
const DEFAULT_GAMES = 24;
const DEFAULT_SEED = 20260707;
const DEFAULT_OUTPUT = 'docs/design-validation.md';
const DEFAULT_VARIANT_MODE = 'both';
const REPORT_TIME_ZONE = process.env.TZ || 'Europe/Istanbul';
const STANDARD_LINES_VARIANT = 'standard';
const CENTER_NORMALIZED_VARIANT = 'center-normalized';
const FINAL_SIX_WILDCARDS_VARIANT = 'final-six-wildcards';
const VARIANT_MODES = [
  STANDARD_LINES_VARIANT,
  CENTER_NORMALIZED_VARIANT,
  FINAL_SIX_WILDCARDS_VARIANT,
  'both',
];
const WILDCARD_IDS = [
  'double-line',
  'block-bonus',
  'corner-spark',
  'last-word',
];

const linesScenarios = [
  ['Casual vs Casual', 'easy', 'easy'],
  ['Smart vs Smart', 'balanced', 'balanced'],
  ['Hard vs Hard', 'hard', 'hard'],
  ['Master vs Master', 'master', 'master'],
  ['Smart vs Casual', 'balanced', 'easy'],
  ['Casual vs Smart', 'easy', 'balanced'],
  ['Hard vs Smart', 'hard', 'balanced'],
  ['Smart vs Hard', 'balanced', 'hard'],
  ['Master vs Hard', 'master', 'hard'],
  ['Hard vs Master', 'hard', 'master'],
];

const classicScenarios = [
  ['Classic Casual mirror', 'easy', 'easy'],
  ['Classic Smart mirror', 'balanced', 'balanced'],
  ['Classic Hard mirror', 'hard', 'hard'],
  ['Classic Master mirror', 'master', 'master'],
];

const readNumberOption = (name, fallback) => {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  const value = Number(process.argv[index + 1]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const readStringOption = (name, fallback) => {
  const index = process.argv.indexOf(name);

  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
};

const readVariantMode = () => {
  const value = readStringOption('--variant', DEFAULT_VARIANT_MODE);

  return VARIANT_MODES.includes(value) ? value : DEFAULT_VARIANT_MODE;
};

const createSeededRandom = (seed) => {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const now = () => {
  if (typeof performance !== 'undefined') {
    return performance.now();
  }

  return Date.now();
};

const average = (values) =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

const averageNullable = (values) => {
  const numericValues = values.filter((value) => value !== null);

  return numericValues.length > 0 ? average(numericValues) : null;
};

const pct = (value, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const fixed = (value, digits = 2) => Number(value).toFixed(digits);
const signed = (value, digits = 2) =>
  `${value >= 0 ? '+' : ''}${Number(value).toFixed(digits)}`;

const scoreLeader = (lineScores) => {
  if (lineScores.X === lineScores.O) {
    return null;
  }

  return lineScores.X > lineScores.O ? 'X' : 'O';
};

const createBonusScores = () => ({ O: 0, X: 0 });

const addScores = (lineScores, bonusScores) => ({
  O: lineScores.O + bonusScores.O,
  X: lineScores.X + bonusScores.X,
});

const evaluateAuditBoard = (
  board,
  ruleset,
  linesVariant = STANDARD_LINES_VARIANT,
  bonusScores = createBonusScores(),
) => {
  const result = evaluateBoard(board, ruleset);

  if (ruleset !== 'lines') {
    return result;
  }

  const baseLineScores =
    linesVariant === STANDARD_LINES_VARIANT
      ? result.lineScores
      : getVariantScoresForBoard(board, linesVariant);
  const lineScores = addScores(baseLineScores, bonusScores);
  const winner =
    result.remainingCells === 0 ? getVariantWinner(lineScores) : null;

  return {
    ...result,
    completedLines: result.completedLines,
    isComplete: result.remainingCells === 0,
    isDraw: result.remainingCells === 0 && winner === null,
    lineScores,
    winner,
    winningLines: winner ? result.completedLines[winner] : [],
  };
};

const canStillReachWinOrDraw = ({
  board,
  currentPlayer,
  linesVariant,
  targetPlayer,
}) => {
  const availableMoves = getAvailableMoves(board);

  if (availableMoves.length === 0) {
    const result = evaluateAuditBoard(board, 'lines', linesVariant);

    return result.winner === targetPlayer || result.isDraw;
  }

  return availableMoves.some((move) => {
    const next = [...board];
    next[move] = currentPlayer;

    return canStillReachWinOrDraw({
      board: next,
      currentPlayer: getOtherPlayer(currentPlayer),
      linesVariant,
      targetPlayer,
    });
  });
};

const resultScoreFor = (winner, player, isDraw) => {
  if (isDraw || !winner) {
    return 0.5;
  }

  return winner === player ? 1 : 0;
};

const getMarginDistribution = (games) => {
  const buckets = {
    '0': 0,
    '1': 0,
    '2': 0,
    '3+': 0,
  };

  for (const game of games) {
    const margin = Math.abs(game.finalScores.X - game.finalScores.O);

    if (margin < 0.5) {
      buckets['0'] += 1;
    } else if (margin < 1.5) {
      buckets['1'] += 1;
    } else if (margin < 2.5) {
      buckets['2'] += 1;
    } else {
      buckets['3+'] += 1;
    }
  }

  return Object.fromEntries(
    Object.entries(buckets).map(([bucket, count]) => [
      bucket,
      games.length > 0 ? count / games.length : 0,
    ]),
  );
};

const chooseFallbackMove = (board) => getAvailableMoves(board)[0] ?? null;

const getOpeningProbe = (gameIndex) => OPENING_PROBES[gameIndex % OPENING_PROBES.length];

const getReportDate = () =>
  new Intl.DateTimeFormat('sv-SE', {
    day: '2-digit',
    month: '2-digit',
    timeZone: REPORT_TIME_ZONE,
    year: 'numeric',
  }).format(new Date());

const createWildcardMetricState = () => ({
  bonusByType: Object.fromEntries(WILDCARD_IDS.map((wildcard) => [wildcard, 0])),
  bonusScores: createBonusScores(),
  changedOutcome: false,
  enabled: false,
  picks: { O: null, X: null },
  used: [],
});

const draftAuditWildcards = ({
  board,
  currentPlayer,
  lineScores,
  roundNumber,
  wildcardState,
}) => {
  let nextState = createWildcardDraft({
    currentPlayer,
    lineScores,
    roundNumber,
  });
  const picks = { O: null, X: null };

  while (nextState.phase === 'drafting') {
    const picker = nextState.pickOrder[nextState.pickIndex];
    const choice = chooseWildcardDraft(
      board,
      picker,
      getRemainingDraftOptions(nextState),
    );

    if (!choice) {
      break;
    }

    picks[picker] = choice;
    nextState = pickWildcard(nextState, picker, choice);
  }

  return {
    ...nextState,
    bonusScores: wildcardState.bonusScores,
    metricPicks: picks,
  };
};

const maybeChooseWildcardMove = ({ board, currentPlayer, requestedMove, wildcardState }) => {
  if (
    !wildcardState ||
    wildcardState.phase !== 'active' ||
    !canActivateWildcard(wildcardState, currentPlayer)
  ) {
    return { move: requestedMove, wildcardState };
  }

  const wildcard = wildcardState.players[currentPlayer].picked;
  const wildcardMove = wildcard
    ? chooseWildcardMove(board, currentPlayer, wildcard)
    : null;

  if (wildcardMove === null) {
    return { move: requestedMove, wildcardState };
  }

  return {
    move: wildcardMove,
    wildcardState: activateWildcard(wildcardState, currentPlayer),
  };
};

const outcomeKey = (result) =>
  result.isDraw || !result.winner ? 'draw' : result.winner;

const simulateGame = ({
  auditRoundNumber = 1,
  classicPieRule = false,
  endgameVariant = null,
  forcedOpening = null,
  linesVariant = STANDARD_LINES_VARIANT,
  opener = 'X',
  oDifficulty,
  random,
  ruleset,
  xDifficulty,
}) => {
  const board = createBoard();
  const difficultyByPlayer = {
    O: oDifficulty,
    X: xDifficulty,
  };
  const coach = {
    anyHintTurns: 0,
    blockTurns: 0,
    bothTurns: 0,
    oneHintTurns: 0,
    scoreTurns: 0,
    topHintFollowed: 0,
    totalHints: 0,
    turns: 0,
  };
  const coachByDifficulty = Object.fromEntries(
    DIFFICULTY_ORDER.map((difficulty) => [
      difficulty,
      {
        oneHintTurns: 0,
        topHintFollowed: 0,
        turns: 0,
      },
    ]),
  );
  const scoreSnapshots = {
    9: null,
    18: null,
    21: null,
    26: null,
    27: null,
  };
  const wildcardEnabled =
    ruleset === 'lines' && endgameVariant === FINAL_SIX_WILDCARDS_VARIANT;
  const wildcardMetric = createWildcardMetricState();
  let auditWildcardState = null;
  let boardAtMove21 = null;
  let currentPlayerAtMove21 = null;
  const openingPlayer = opener;
  let currentPlayer = opener;
  let decisionTimeMs = 0;
  let firstMove = null;
  let firstMovePlayer = null;
  let illegalMoves = 0;
  let lastNonTieLeader = null;
  let leadChanges = 0;
  let moveCount = 0;
  let multiLineMoves = 0;
  let pieSwaps = 0;
  let result = evaluateAuditBoard(board, ruleset, linesVariant);

  wildcardMetric.enabled = wildcardEnabled;

  while (!result.isComplete) {
    const availableMoves = getAvailableMoves(board);

    if (availableMoves.length === 0) {
      break;
    }

    if (
      wildcardEnabled &&
      auditWildcardState === null &&
      result.remainingCells === 6
    ) {
      const draft = draftAuditWildcards({
        board,
        currentPlayer,
        lineScores: evaluateAuditBoard(board, ruleset, linesVariant).lineScores,
        roundNumber: auditRoundNumber,
        wildcardState: wildcardMetric,
      });

      wildcardMetric.picks = draft.metricPicks;
      delete draft.metricPicks;
      auditWildcardState = draft;
    }

    const hints =
      ruleset === 'lines' ? getCoachHints(board, currentPlayer) : [];

    if (ruleset === 'lines') {
      const activeCoachRecord = coachByDifficulty[difficultyByPlayer[currentPlayer]];
      coach.turns += 1;
      coach.totalHints += hints.length;
      activeCoachRecord.turns += 1;

      if (hints.length > 0) {
        coach.anyHintTurns += 1;
      }

      if (hints.length === 1) {
        coach.oneHintTurns += 1;
        activeCoachRecord.oneHintTurns += 1;
      }

      if (hints.some((hint) => hint.kind === 'score')) {
        coach.scoreTurns += 1;
      }

      if (hints.some((hint) => hint.kind === 'block')) {
        coach.blockTurns += 1;
      }

      if (hints.some((hint) => hint.kind === 'both')) {
        coach.bothTurns += 1;
      }
    }

    const shouldForceOpening =
      firstMove === null &&
      forcedOpening !== null &&
      board[forcedOpening] === null;
    const startedAt = now();
    let requestedMove = shouldForceOpening
      ? forcedOpening
      : chooseAiMove(
          board,
          currentPlayer,
          difficultyByPlayer[currentPlayer],
          ruleset,
          { random },
        );
    const durationMs = now() - startedAt;
    const wildcardChoice = maybeChooseWildcardMove({
      board,
      currentPlayer,
      requestedMove,
      wildcardState: auditWildcardState,
    });

    requestedMove = wildcardChoice.move;
    auditWildcardState = wildcardChoice.wildcardState;

    const move =
      requestedMove !== null && board[requestedMove] === null
        ? requestedMove
        : chooseFallbackMove(board);

    decisionTimeMs += durationMs;

    if (move === null) {
      break;
    }

    if (requestedMove === null || requestedMove !== move) {
      illegalMoves += 1;
    }

    if (hints[0]?.cell === move) {
      coach.topHintFollowed += 1;
      if (ruleset === 'lines') {
        coachByDifficulty[difficultyByPlayer[currentPlayer]].topHintFollowed += 1;
      }
    }

    const previous = [...board];
    board[move] = currentPlayer;
    moveCount += 1;

    if (auditWildcardState?.players[currentPlayer]?.active) {
      const consumed = consumeActiveWildcard(
        auditWildcardState,
        currentPlayer,
        move,
        previous,
      );

      auditWildcardState = consumed.nextState;
      wildcardMetric.bonusScores = consumed.nextState.bonusScores;

      if (consumed.wildcard) {
        wildcardMetric.used.push({
          bonus: consumed.bonus.bonus,
          player: currentPlayer,
          wildcard: consumed.wildcard,
        });
        wildcardMetric.bonusByType[consumed.wildcard] += consumed.bonus.bonus;
      }
    }

    if (firstMove === null) {
      firstMove = move;
      firstMovePlayer = currentPlayer;
    }

    const newLineCount = getNewCompletedLines(
      previous,
      board,
      currentPlayer,
    ).length;

    if (newLineCount > 1) {
      multiLineMoves += 1;
    }

    result = evaluateAuditBoard(
      board,
      ruleset,
      linesVariant,
      wildcardMetric.bonusScores,
    );

    if (scoreSnapshots[moveCount] === null && moveCount in scoreSnapshots) {
      scoreSnapshots[moveCount] = { ...result.lineScores };
    }

    if (ruleset === 'lines' && moveCount === 21) {
      boardAtMove21 = [...board];
      currentPlayerAtMove21 = getOtherPlayer(currentPlayer);
    }

    const leader = scoreLeader(result.lineScores);

    if (leader && leader !== lastNonTieLeader) {
      if (lastNonTieLeader !== null) {
        leadChanges += 1;
      }

      lastNonTieLeader = leader;
    }

    if (
      ruleset === 'classic' &&
      classicPieRule &&
      pieSwaps === 0 &&
      moveCount === 1
    ) {
      const decider = getOtherPlayer(currentPlayer);

      if (shouldSwapClassicPie(board, difficultyByPlayer[decider])) {
        const xDifficulty = difficultyByPlayer.X;
        difficultyByPlayer.X = difficultyByPlayer.O;
        difficultyByPlayer.O = xDifficulty;
        pieSwaps += 1;
      }
    }

    currentPlayer = getOtherPlayer(currentPlayer);
  }

  const baseFinalResult = evaluateAuditBoard(board, ruleset, linesVariant);
  const finalScores = { ...result.lineScores };

  if (wildcardEnabled) {
    wildcardMetric.changedOutcome =
      outcomeKey(baseFinalResult) !== outcomeKey(result);
  }

  if (scoreSnapshots[27] === null && moveCount >= 27) {
    scoreSnapshots[27] = finalScores;
  }

  const finalSixStart = scoreSnapshots[21];
  const finalMoveStart = scoreSnapshots[26];
  const leaderAtFinalSix = finalSixStart ? scoreLeader(finalSixStart) : null;
  const leaderBeforeFinalMove = finalMoveStart
    ? scoreLeader(finalMoveStart)
    : null;
  const finalLeader = scoreLeader(finalScores);
  const trailingAtFinalSix =
    leaderAtFinalSix === null ? null : getOtherPlayer(leaderAtFinalSix);
  const finalSixChangedOutcome =
    ruleset === 'lines' &&
    finalSixStart !== null &&
    leaderAtFinalSix !== finalLeader;
  const finalSixPredictable =
    ruleset === 'lines' &&
    finalSixStart !== null &&
    finalLeader !== null &&
    leaderAtFinalSix === finalLeader;
  const finalSixDiffSwing =
    finalSixStart === null
      ? null
      : finalScores.X -
        finalScores.O -
        (finalSixStart.X - finalSixStart.O);
  const finalMoveChangedOutcome =
    ruleset === 'lines' &&
    finalMoveStart !== null &&
    leaderBeforeFinalMove !== finalLeader;
  const comebackAfterMove21 =
    ruleset === 'lines' &&
    finalSixStart !== null &&
    leaderAtFinalSix !== null
      ? finalLeader !== leaderAtFinalSix
      : null;
  const comebackAvailableAtMove21 =
    ruleset === 'lines' &&
    boardAtMove21 !== null &&
    currentPlayerAtMove21 !== null &&
    trailingAtFinalSix !== null
      ? canStillReachWinOrDraw({
          board: boardAtMove21,
          currentPlayer: currentPlayerAtMove21,
          linesVariant,
          targetPlayer: trailingAtFinalSix,
        })
      : null;

  return {
    board,
    centerOwner: board[AI_CENTER_INDEX],
    centerOpening: firstMove === AI_CENTER_INDEX,
    centerOpeningOwner: firstMove === AI_CENTER_INDEX ? firstMovePlayer : null,
    coach,
    coachByDifficulty,
    comebackAfterMove21,
    comebackAvailableAtMove21,
    decisionTimeMs,
    endgameVariant,
    finalLeader,
    finalMoveChangedOutcome,
    finalScores,
    finalSixChangedOutcome,
    finalSixDiffSwing,
    finalSixPredictable,
    firstMove,
    firstMovePlayer,
    illegalMoves,
    leadChanges,
    moveCount,
    multiLineMoves,
    opener: openingPlayer,
    pieSwaps,
    result,
    scoreSnapshots,
    leaderAtFinalSix,
    leaderBeforeFinalMove,
    wildcard: wildcardMetric,
  };
};

const runScenario = ({
  classicPieRule = false,
  endgameVariant = null,
  games,
  label,
  linesVariant = STANDARD_LINES_VARIANT,
  ruleset,
  scenarioIndex,
  seed,
  xDifficulty,
  oDifficulty,
}) => {
  const gameResults = [];

  for (let gameIndex = 0; gameIndex < games; gameIndex += 1) {
    const random = createSeededRandom(seed + scenarioIndex * 100003 + gameIndex * 7919);
    const opener = gameIndex % 2 === 0 ? 'X' : 'O';
    const forcedOpening = ruleset === 'lines' ? getOpeningProbe(gameIndex) : null;

    gameResults.push(
      simulateGame({
        auditRoundNumber: gameIndex + 1,
        classicPieRule,
        endgameVariant,
        forcedOpening,
        linesVariant,
        opener,
        oDifficulty,
        random,
        ruleset,
        xDifficulty,
      }),
    );
  }

  return summarizeScenario({
    games: gameResults,
    endgameVariant,
    label,
    linesVariant,
    oDifficulty,
    ruleset,
    xDifficulty,
  });
};

const summarizeScenario = ({
  endgameVariant = null,
  games,
  label,
  linesVariant = STANDARD_LINES_VARIANT,
  oDifficulty,
  ruleset,
  xDifficulty,
}) => {
  const xWins = games.filter((game) => game.result.winner === 'X').length;
  const oWins = games.filter((game) => game.result.winner === 'O').length;
  const draws = games.filter((game) => game.result.isDraw).length;
  const centerGames = games.filter((game) => game.centerOpening);
  const nonCenterGames = games.filter((game) => !game.centerOpening);
  const centerOwnerGames = games.filter((game) => game.centerOwner !== null);
  const gamesWithLeaderAt21 = games.filter(
    (game) => game.leaderAtFinalSix !== null,
  );
  const openerScores = games.map((game) =>
    resultScoreFor(game.result.winner, game.opener, game.result.isDraw),
  );
  const centerScores = centerGames.map((game) =>
    resultScoreFor(
      game.result.winner,
      game.centerOpeningOwner,
      game.result.isDraw,
    ),
  );
  const centerOwnerScores = centerOwnerGames.map((game) =>
    resultScoreFor(game.result.winner, game.centerOwner, game.result.isDraw),
  );
  const nonCenterOpenerScores = nonCenterGames.map((game) =>
    resultScoreFor(game.result.winner, game.opener, game.result.isDraw),
  );
  const coachTurns = games.reduce((sum, game) => sum + game.coach.turns, 0);
  const coach = games.reduce(
    (totals, game) => ({
      anyHintTurns: totals.anyHintTurns + game.coach.anyHintTurns,
      blockTurns: totals.blockTurns + game.coach.blockTurns,
      bothTurns: totals.bothTurns + game.coach.bothTurns,
      oneHintTurns: totals.oneHintTurns + game.coach.oneHintTurns,
      scoreTurns: totals.scoreTurns + game.coach.scoreTurns,
      topHintFollowed: totals.topHintFollowed + game.coach.topHintFollowed,
      totalHints: totals.totalHints + game.coach.totalHints,
      turns: totals.turns + game.coach.turns,
    }),
    {
      anyHintTurns: 0,
      blockTurns: 0,
      bothTurns: 0,
      oneHintTurns: 0,
      scoreTurns: 0,
      topHintFollowed: 0,
      totalHints: 0,
      turns: 0,
    },
  );
  const coachByDifficulty = Object.fromEntries(
    DIFFICULTY_ORDER.map((difficulty) => {
      const totals = games.reduce(
        (record, game) => {
          const gameRecord = game.coachByDifficulty[difficulty];

          record.oneHintTurns += gameRecord.oneHintTurns;
          record.topHintFollowed += gameRecord.topHintFollowed;
          record.turns += gameRecord.turns;

          return record;
        },
        { oneHintTurns: 0, topHintFollowed: 0, turns: 0 },
      );

      return [
        difficulty,
        {
          oneHintRate:
            totals.turns > 0 ? totals.oneHintTurns / totals.turns : null,
          topHintFollowRate:
            totals.turns > 0 ? totals.topHintFollowed / totals.turns : null,
          turns: totals.turns,
        },
      ];
    }),
  );
  const finalSixSwings = games
    .map((game) => game.finalSixDiffSwing)
    .filter((value) => value !== null);
  const wildcardDraftedCount = games.reduce(
    (sum, game) =>
      sum +
      (game.wildcard.enabled
        ? Number(game.wildcard.picks.X !== null) +
          Number(game.wildcard.picks.O !== null)
        : 0),
    0,
  );
  const wildcardUses = games.flatMap((game) => game.wildcard.used);
  const wildcardBonusByType = Object.fromEntries(
    WILDCARD_IDS.map((wildcard) => [
      wildcard,
      games.reduce(
        (sum, game) => sum + (game.wildcard.bonusByType[wildcard] ?? 0),
        0,
      ),
    ]),
  );

  return {
    averageDecisionTimeMs:
      games.reduce((sum, game) => sum + game.decisionTimeMs, 0) /
      Math.max(1, games.reduce((sum, game) => sum + game.moveCount, 0)),
    averageFinalScore: {
      O: average(games.map((game) => game.finalScores.O)),
      X: average(games.map((game) => game.finalScores.X)),
    },
    averageFinalTotalLines: average(
      games.map((game) => game.finalScores.X + game.finalScores.O),
    ),
    averageLeadChanges: average(games.map((game) => game.leadChanges)),
    averageLineDifferential: average(
      games.map((game) => Math.abs(game.finalScores.X - game.finalScores.O)),
    ),
    averageMoveCount: average(games.map((game) => game.moveCount)),
    averageMultiLineMoves: average(games.map((game) => game.multiLineMoves)),
    averageScoreByMove: {
      9: averageNullable(
        games.map((game) =>
          game.scoreSnapshots[9]
            ? game.scoreSnapshots[9].X + game.scoreSnapshots[9].O
            : null,
        ),
      ),
      18: averageNullable(
        games.map((game) =>
          game.scoreSnapshots[18]
            ? game.scoreSnapshots[18].X + game.scoreSnapshots[18].O
            : null,
        ),
      ),
      21: averageNullable(
        games.map((game) =>
          game.scoreSnapshots[21]
            ? game.scoreSnapshots[21].X + game.scoreSnapshots[21].O
            : null,
        ),
      ),
      26: averageNullable(
        games.map((game) =>
          game.scoreSnapshots[26]
            ? game.scoreSnapshots[26].X + game.scoreSnapshots[26].O
            : null,
        ),
      ),
      27: averageNullable(
        games.map((game) =>
          game.scoreSnapshots[27]
            ? game.scoreSnapshots[27].X + game.scoreSnapshots[27].O
            : null,
        ),
      ),
    },
    centerOpeningGames: centerGames.length,
    centerOpeningLossRate:
      centerScores.length > 0
        ? centerGames.filter(
            (game) =>
              game.centerOpeningOwner !== null &&
              game.result.winner !== null &&
              game.result.winner !== game.centerOpeningOwner,
          ).length / centerGames.length
        : null,
    centerOpeningWinRate:
      centerGames.length > 0
        ? centerGames.filter(
            (game) => game.result.winner === game.centerOpeningOwner,
          ).length / centerGames.length
        : null,
    centerOpeningScoreRate:
      centerScores.length > 0 ? average(centerScores) : null,
    centerOwnerGames: centerOwnerGames.length,
    centerOwnerLossRate:
      centerOwnerGames.length > 0
        ? centerOwnerGames.filter(
            (game) =>
              game.centerOwner !== null &&
              game.result.winner !== null &&
              game.result.winner !== game.centerOwner,
          ).length / centerOwnerGames.length
        : null,
    centerOwnerScoreRate:
      centerOwnerScores.length > 0 ? average(centerOwnerScores) : null,
    centerOwnerWinRate:
      centerOwnerGames.length > 0
        ? centerOwnerGames.filter(
            (game) => game.result.winner === game.centerOwner,
          ).length / centerOwnerGames.length
        : null,
    coach: {
      anyHintRate: coachTurns > 0 ? coach.anyHintTurns / coachTurns : null,
      avgHintsPerTurn: coachTurns > 0 ? coach.totalHints / coachTurns : null,
      blockTurnRate: coachTurns > 0 ? coach.blockTurns / coachTurns : null,
      bothTurnRate: coachTurns > 0 ? coach.bothTurns / coachTurns : null,
      oneHintRate: coachTurns > 0 ? coach.oneHintTurns / coachTurns : null,
      scoreTurnRate: coachTurns > 0 ? coach.scoreTurns / coachTurns : null,
      topHintFollowRate: coachTurns > 0 ? coach.topHintFollowed / coachTurns : null,
      turns: coachTurns,
    },
    coachByDifficulty,
    comebackAvailableAtMove21Rate:
      ruleset === 'lines'
        ? averageNullable(
            games.map((game) =>
              game.comebackAvailableAtMove21 === null
                ? null
                : game.comebackAvailableAtMove21
                  ? 1
                  : 0,
            ),
          )
        : null,
    comebackAfterMove21Rate:
      ruleset === 'lines'
        ? averageNullable(
            games.map((game) =>
              game.comebackAfterMove21 === null
                ? null
                : game.comebackAfterMove21
                  ? 1
                  : 0,
            ),
          )
        : null,
    drawRate: draws / games.length,
    endgameVariant,
    finalMoveChangedOutcomeRate:
      ruleset === 'lines'
        ? games.filter((game) => game.finalMoveChangedOutcome).length /
          games.length
        : null,
    finalSixChangedOutcomeRate:
      ruleset === 'lines'
        ? games.filter((game) => game.finalSixChangedOutcome).length / games.length
        : null,
    finalSixPredictableRate:
      ruleset === 'lines'
        ? games.filter((game) => game.finalSixPredictable).length / games.length
        : null,
    finalSixSwing: averageNullable(games.map((game) => game.finalSixDiffSwing)),
    finalSixAbsSwing: average(finalSixSwings.map((value) => Math.abs(value))),
    games: games.length,
    illegalMoves: games.reduce((sum, game) => sum + game.illegalMoves, 0),
    label,
    leaderAt21HeldRate:
      gamesWithLeaderAt21.length > 0
        ? gamesWithLeaderAt21.filter(
            (game) => game.leaderAtFinalSix === game.finalLeader,
          ).length / gamesWithLeaderAt21.length
        : null,
    leaderAt21LostRate:
      gamesWithLeaderAt21.length > 0
        ? gamesWithLeaderAt21.filter(
            (game) =>
              game.finalLeader !== null &&
              game.leaderAtFinalSix !== game.finalLeader,
          ).length / gamesWithLeaderAt21.length
        : null,
    leaderAt21ToDrawRate:
      gamesWithLeaderAt21.length > 0
        ? gamesWithLeaderAt21.filter((game) => game.finalLeader === null)
            .length / gamesWithLeaderAt21.length
        : null,
    linesVariant,
    marginDistribution: getMarginDistribution(games),
    nonCenterOpeningGames: nonCenterGames.length,
    nonCenterOpenerWinRate:
      nonCenterGames.length > 0
        ? nonCenterGames.filter((game) => game.result.winner === game.opener)
            .length / nonCenterGames.length
        : null,
    nonCenterOpenerScoreRate:
      nonCenterOpenerScores.length > 0 ? average(nonCenterOpenerScores) : null,
    openerScoreRate: average(openerScores),
    openerWinRate:
      games.filter((game) => game.result.winner === game.opener).length /
      games.length,
    oDifficulty,
    oWinRate: oWins / games.length,
    pieSwaps: games.reduce((sum, game) => sum + game.pieSwaps, 0),
    ruleset,
    xDifficulty,
    xWinRate: xWins / games.length,
    wildcard:
      endgameVariant === FINAL_SIX_WILDCARDS_VARIANT
        ? {
            bonusByType: wildcardBonusByType,
            changedOutcomeRate:
              games.filter((game) => game.wildcard.changedOutcome).length /
              games.length,
            draftedCount: wildcardDraftedCount,
            gameUsedRate:
              games.filter((game) => game.wildcard.used.length > 0).length /
              games.length,
            useRate:
              wildcardDraftedCount > 0
                ? wildcardUses.length / wildcardDraftedCount
                : null,
            uses: wildcardUses.length,
          }
        : null,
  };
};

const aggregateDifficultyRecords = (scenarios) => {
  const records = new Map(
    DIFFICULTY_ORDER.map((difficulty) => [
      difficulty,
      { draws: 0, games: 0, lineDiff: 0, losses: 0, wins: 0 },
    ]),
  );

  for (const scenario of scenarios) {
    for (const side of ['X', 'O']) {
      const difficulty = side === 'X' ? scenario.xDifficulty : scenario.oDifficulty;
      const record = records.get(difficulty);
      const sideWinRate = side === 'X' ? scenario.xWinRate : scenario.oWinRate;
      const sideLossRate = side === 'X' ? scenario.oWinRate : scenario.xWinRate;
      const signedLineDiff =
        side === 'X'
          ? scenario.averageFinalScore.X - scenario.averageFinalScore.O
          : scenario.averageFinalScore.O - scenario.averageFinalScore.X;

      record.games += scenario.games;
      record.wins += sideWinRate * scenario.games;
      record.losses += sideLossRate * scenario.games;
      record.draws += scenario.drawRate * scenario.games;
      record.lineDiff += signedLineDiff * scenario.games;
    }
  }

  return Array.from(records.entries()).map(([difficulty, record]) => ({
    difficulty,
    drawRate: record.draws / Math.max(1, record.games),
    games: record.games,
    scoreRate:
      (record.wins + record.draws * 0.5) / Math.max(1, record.games),
    signedLineDiff: record.lineDiff / Math.max(1, record.games),
    winRate: record.wins / Math.max(1, record.games),
  }));
};

const aggregateCoachDifficultyRecords = (scenarios) =>
  DIFFICULTY_ORDER.map((difficulty) => {
    const totals = scenarios.reduce(
      (record, scenario) => {
        const scenarioRecord = scenario.coachByDifficulty[difficulty];

        record.oneHintTurns +=
          (scenarioRecord.oneHintRate ?? 0) * scenarioRecord.turns;
        record.topHintFollowed +=
          (scenarioRecord.topHintFollowRate ?? 0) * scenarioRecord.turns;
        record.turns += scenarioRecord.turns;

        return record;
      },
      { oneHintTurns: 0, topHintFollowed: 0, turns: 0 },
    );

    return {
      difficulty,
      oneHintRate:
        totals.turns > 0 ? totals.oneHintTurns / totals.turns : null,
      topHintFollowRate:
        totals.turns > 0 ? totals.topHintFollowed / totals.turns : null,
      turns: totals.turns,
    };
  });

const simulateMatch = ({
  baseSeed,
  classicPieRule = false,
  matchIndex,
  oDifficulty,
  ruleset,
  scenarioIndex,
  xDifficulty,
}) => {
  const score = { O: 0, X: 0 };
  const rounds = [];

  for (let round = 0; round < 5 && score.X < 3 && score.O < 3; round += 1) {
    const opener = round % 2 === 0 ? 'X' : 'O';
    const random = createSeededRandom(
      baseSeed + scenarioIndex * 180001 + matchIndex * 9973 + round * 137,
    );
    const game = simulateGame({
      classicPieRule,
      forcedOpening: ruleset === 'lines' ? getOpeningProbe(round + matchIndex) : null,
      opener,
      oDifficulty,
      random,
      ruleset,
      xDifficulty,
    });

    rounds.push(game);

    if (game.result.winner) {
      score[game.result.winner] += 1;
    }
  }

  const firstRoundWinner = rounds[0]?.result.winner ?? null;
  const matchWinner =
    score.X === score.O ? null : score.X > score.O ? 'X' : 'O';

  return {
    firstRoundLoserWon:
      firstRoundWinner !== null &&
      matchWinner !== null &&
      matchWinner !== firstRoundWinner,
    matchWinner,
    rounds: rounds.length,
    score,
    wentFullFive: rounds.length === 5,
  };
};

const summarizeMatches = ({ matches, label, oDifficulty, xDifficulty }) => ({
  averageRounds: average(matches.map((match) => match.rounds)),
  firstRoundLoserWonRate:
    matches.filter((match) => match.firstRoundLoserWon).length / matches.length,
  label,
  matches: matches.length,
  oDifficulty,
  wentFullFiveRate:
    matches.filter((match) => match.wentFullFive).length / matches.length,
  xDifficulty,
  xMatchScoreRate:
    matches.reduce(
      (sum, match) =>
        sum + resultScoreFor(match.matchWinner, 'X', match.matchWinner === null),
      0,
    ) / matches.length,
});

const runMatchAudit = ({ games, seed }) => {
  const matchesPerScenario = Math.max(1, Math.floor(games / 3));
  const focusScenarios = linesScenarios.filter(([label]) =>
    [
      'Smart vs Smart',
      'Hard vs Hard',
      'Master vs Master',
      'Hard vs Smart',
      'Master vs Hard',
    ].includes(label),
  );

  return focusScenarios.map(([label, xDifficulty, oDifficulty], scenarioIndex) => {
    const matches = [];

    for (let matchIndex = 0; matchIndex < matchesPerScenario; matchIndex += 1) {
      matches.push(
        simulateMatch({
          baseSeed: seed,
          matchIndex,
          oDifficulty,
          ruleset: 'lines',
          scenarioIndex,
          xDifficulty,
        }),
      );
    }

    return summarizeMatches({
      label,
      matches,
      oDifficulty,
      xDifficulty,
    });
  });
};

const makeLinesTable = (scenarios) => [
  '| Scenario | Games | X/O | Opener win | Opener score | Center score | Non-center opener | Avg final score | Avg diff | Lead changes | Multi-line | Final-6 changed | Lines by 9/18/27 |',
  '| --- | ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |',
  ...scenarios.map((scenario) =>
    `| ${[
      scenario.label,
      scenario.games,
      `${DIFFICULTY_LABELS[scenario.xDifficulty]}/${DIFFICULTY_LABELS[scenario.oDifficulty]}`,
      pct(scenario.openerWinRate),
      pct(scenario.openerScoreRate),
      scenario.centerOpeningScoreRate === null
        ? 'n/a'
        : pct(scenario.centerOpeningScoreRate),
      scenario.nonCenterOpenerScoreRate === null
        ? 'n/a'
        : pct(scenario.nonCenterOpenerScoreRate),
      `${fixed(scenario.averageFinalScore.X)}-${fixed(scenario.averageFinalScore.O)}`,
      fixed(scenario.averageLineDifferential),
      fixed(scenario.averageLeadChanges),
      fixed(scenario.averageMultiLineMoves),
      scenario.finalSixChangedOutcomeRate === null
        ? 'n/a'
        : pct(scenario.finalSixChangedOutcomeRate),
      `${fixed(scenario.averageScoreByMove[9] ?? 0)}/${fixed(
        scenario.averageScoreByMove[18] ?? 0,
      )}/${fixed(scenario.averageScoreByMove[27] ?? 0)}`,
    ].join(' | ')} |`,
  ),
].join('\n');

const makeClassicTable = (scenarios) => [
  '| Scenario | Games | Opener win | Opener score | Center score | Avg line score | Avg diff | Avg moves | Pie swaps |',
  '| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |',
  ...scenarios.map((scenario) =>
    `| ${[
      scenario.label,
      scenario.games,
      pct(scenario.openerWinRate),
      pct(scenario.openerScoreRate),
      scenario.centerOpeningScoreRate === null
        ? 'n/a'
        : pct(scenario.centerOpeningScoreRate),
      `${fixed(scenario.averageFinalScore.X)}-${fixed(scenario.averageFinalScore.O)}`,
      fixed(scenario.averageLineDifferential),
      fixed(scenario.averageMoveCount),
      scenario.pieSwaps,
    ].join(' | ')} |`,
  ),
].join('\n');

const makeCenterEndgameTable = (scenarios) => [
  '| Scenario | Center owner W/S/L | Center opener W/S | Non-center opener W/S | Leader@21 held/lost/draw | Comeback available@21 | Final move changed | Final-6 swing |',
  '| --- | --- | --- | --- | --- | ---: | ---: | --- |',
  ...scenarios.map((scenario) =>
    `| ${[
      scenario.label,
      `${pct(scenario.centerOwnerWinRate ?? 0)}/${pct(
        scenario.centerOwnerScoreRate ?? 0,
      )}/${pct(scenario.centerOwnerLossRate ?? 0)}`,
      `${pct(scenario.centerOpeningWinRate ?? 0)}/${pct(
        scenario.centerOpeningScoreRate ?? 0,
      )}`,
      `${pct(scenario.nonCenterOpenerWinRate ?? 0)}/${pct(
        scenario.nonCenterOpenerScoreRate ?? 0,
      )}`,
      `${pct(scenario.leaderAt21HeldRate ?? 0)}/${pct(
        scenario.leaderAt21LostRate ?? 0,
      )}/${pct(scenario.leaderAt21ToDrawRate ?? 0)}`,
      scenario.comebackAvailableAtMove21Rate === null
        ? 'n/a'
        : pct(scenario.comebackAvailableAtMove21Rate),
      scenario.finalMoveChangedOutcomeRate === null
        ? 'n/a'
        : pct(scenario.finalMoveChangedOutcomeRate),
      `${signed(scenario.finalSixSwing ?? 0)}/${fixed(
        scenario.finalSixAbsSwing ?? 0,
      )} abs`,
    ].join(' | ')} |`,
  ),
].join('\n');

const makeDifficultyTable = (records) => [
  '| Difficulty | Participant games | Win rate | Score rate | Avg signed line diff | Draw rate |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
  ...records.map((record) =>
    `| ${[
      DIFFICULTY_LABELS[record.difficulty],
      record.games,
      pct(record.winRate),
      pct(record.scoreRate),
      signed(record.signedLineDiff),
      pct(record.drawRate),
    ].join(' | ')} |`,
  ),
].join('\n');

const makeCoachTable = (scenarios) => [
  '| Scenario | Coach turns | Any hint | Avg hints/turn | One-hint turns | Top hint followed | Score hints | Block hints | Both hints |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...scenarios.map((scenario) =>
    `| ${[
      scenario.label,
      scenario.coach.turns,
      pct(scenario.coach.anyHintRate ?? 0),
      fixed(scenario.coach.avgHintsPerTurn ?? 0),
      pct(scenario.coach.oneHintRate ?? 0),
      pct(scenario.coach.topHintFollowRate ?? 0),
      pct(scenario.coach.scoreTurnRate ?? 0),
      pct(scenario.coach.blockTurnRate ?? 0),
      pct(scenario.coach.bothTurnRate ?? 0),
    ].join(' | ')} |`,
  ),
].join('\n');

const makeCoachDifficultyTable = (records) => [
  '| Difficulty | Coach turns | Top hint followed | One-obvious-move turns |',
  '| --- | ---: | ---: | ---: |',
  ...records.map((record) =>
    `| ${[
      DIFFICULTY_LABELS[record.difficulty],
      record.turns,
      record.topHintFollowRate === null ? 'n/a' : pct(record.topHintFollowRate),
      record.oneHintRate === null ? 'n/a' : pct(record.oneHintRate),
    ].join(' | ')} |`,
  ),
].join('\n');

const makeMarginTable = (scenarios) => [
  '| Scenario | 0 lines | 1 line | 2 lines | 3+ lines |',
  '| --- | ---: | ---: | ---: | ---: |',
  ...scenarios.map((scenario) =>
    `| ${[
      scenario.label,
      pct(scenario.marginDistribution['0']),
      pct(scenario.marginDistribution['1']),
      pct(scenario.marginDistribution['2']),
      pct(scenario.marginDistribution['3+']),
    ].join(' | ')} |`,
  ),
].join('\n');

const makeVariantComparisonTable = (standardReports, variantReports) => [
  '| Scenario | Standard opener score | Variant opener score | Standard center owner score | Variant center owner score | Standard avg diff | Variant avg diff | Standard final-6 changed | Variant final-6 changed |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...standardReports.map((standard) => {
    const variant = getScenario(variantReports, standard.label);

    return `| ${[
      standard.label,
      pct(standard.openerScoreRate),
      variant ? pct(variant.openerScoreRate) : 'n/a',
      pct(standard.centerOwnerScoreRate ?? 0),
      variant ? pct(variant.centerOwnerScoreRate ?? 0) : 'n/a',
      fixed(standard.averageLineDifferential),
      variant ? fixed(variant.averageLineDifferential) : 'n/a',
      standard.finalSixChangedOutcomeRate === null
        ? 'n/a'
        : pct(standard.finalSixChangedOutcomeRate),
      variant?.finalSixChangedOutcomeRate === null || !variant
        ? 'n/a'
        : pct(variant.finalSixChangedOutcomeRate),
    ].join(' | ')} |`;
  }),
].join('\n');

const formatWildcardBonus = (scenario) =>
  WILDCARD_IDS.map((wildcard) => {
    const total = scenario.wildcard?.bonusByType[wildcard] ?? 0;

    return `${WILDCARDS[wildcard].name} ${fixed(total / scenario.games, 2)}/g`;
  }).join('; ');

const makeWildcardTable = (scenarios) => [
  '| Scenario | First-player score | Center-owner score | Avg final margin | Final-6 changed | Final move changed | Comeback after 21 | Wildcard used | Winner/tie changed | Bonus points by type |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ...scenarios.map((scenario) =>
    `| ${[
      scenario.label,
      pct(scenario.openerScoreRate),
      scenario.centerOwnerScoreRate === null
        ? 'n/a'
        : pct(scenario.centerOwnerScoreRate),
      fixed(scenario.averageLineDifferential),
      scenario.finalSixChangedOutcomeRate === null
        ? 'n/a'
        : pct(scenario.finalSixChangedOutcomeRate),
      scenario.finalMoveChangedOutcomeRate === null
        ? 'n/a'
        : pct(scenario.finalMoveChangedOutcomeRate),
      scenario.comebackAfterMove21Rate === null
        ? 'n/a'
        : pct(scenario.comebackAfterMove21Rate),
      scenario.wildcard?.useRate === null || !scenario.wildcard
        ? 'n/a'
        : `${pct(scenario.wildcard.useRate)} used/draft, ${pct(
            scenario.wildcard.gameUsedRate,
          )} games`,
      scenario.wildcard
        ? pct(scenario.wildcard.changedOutcomeRate)
        : 'n/a',
      scenario.wildcard ? formatWildcardBonus(scenario) : 'n/a',
    ].join(' | ')} |`,
  ),
].join('\n');

const makeMatchTable = (matches) => [
  '| Matchup | Matches | Avg rounds | Went to 5 | First-round loser won | X match score rate |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
  ...matches.map((match) =>
    `| ${[
      match.label,
      match.matches,
      fixed(match.averageRounds),
      pct(match.wentFullFiveRate),
      pct(match.firstRoundLoserWonRate),
      pct(match.xMatchScoreRate),
    ].join(' | ')} |`,
  ),
].join('\n');

const getScenario = (scenarios, label) =>
  scenarios.find((scenario) => scenario.label === label);

const buildAssessment = ({
  classicReports,
  difficultyRecords,
  lineReports,
  matchReports,
  variantReports,
}) => {
  const smartMirror = getScenario(lineReports, 'Smart vs Smart');
  const hardSmart = getScenario(lineReports, 'Hard vs Smart');
  const masterHard = getScenario(lineReports, 'Master vs Hard');
  const classicSmart = getScenario(classicReports, 'Classic Smart mirror');
  const lineMirrorReports = lineReports.filter((scenario) =>
    scenario.label.endsWith('vs ' + scenario.label.split(' vs ')[0]),
  );
  const avgLinesOpenerScore = average(lineMirrorReports.map((scenario) => scenario.openerScoreRate));
  const avgClassicOpenerScore = average(classicReports.map((scenario) => scenario.openerScoreRate));
  const avgFinalSixChanged = average(
    lineReports.map((scenario) => scenario.finalSixChangedOutcomeRate ?? 0),
  );
  const avgCenterScore = average(
    lineReports
      .map((scenario) => scenario.centerOpeningScoreRate)
      .filter((value) => value !== null),
  );
  const avgNonCenterScore = average(
    lineReports
      .map((scenario) => scenario.nonCenterOpenerScoreRate)
      .filter((value) => value !== null),
  );
  const avgVariantCenterScore = average(
    variantReports
      .map((scenario) => scenario.centerOwnerScoreRate)
      .filter((value) => value !== null),
  );
  const avgVariantOpenerScore = average(
    variantReports.map((scenario) => scenario.openerScoreRate),
  );
  const avgVariantFinalSixChanged = average(
    variantReports.map((scenario) => scenario.finalSixChangedOutcomeRate ?? 0),
  );
  const smartRecord = difficultyRecords.find((record) => record.difficulty === 'balanced');
  const masterRecord = difficultyRecords.find((record) => record.difficulty === 'master');
  const averageComebackRate = average(
    matchReports.map((match) => match.firstRoundLoserWonRate),
  );

  const standardNeedsTuning =
    avgLinesOpenerScore > 0.6 ||
    avgCenterScore > 0.6 ||
    avgFinalSixChanged <= 0.2 ||
    Math.abs((smartRecord?.scoreRate ?? 0.5) - 0.5) > 0.18;
  const variantImprovesPressure =
    variantReports.length > 0 &&
    (avgVariantCenterScore + 0.04 < avgCenterScore ||
      avgVariantOpenerScore + 0.04 < avgLinesOpenerScore ||
      avgVariantFinalSixChanged > avgFinalSixChanged + 0.04);
  const recommendation = !standardNeedsTuning
    ? 'keep standard Lines Mode'
    : variantImprovesPressure
      ? 'prototype center-normalized Lines variant'
      : 'tune Lines Mode';

  return {
    averageComebackRate,
    avgCenterScore,
    avgClassicOpenerScore,
    avgFinalSixChanged,
    avgLinesOpenerScore,
    avgNonCenterScore,
    avgVariantCenterScore,
    avgVariantFinalSixChanged,
    avgVariantOpenerScore,
    classicSmart,
    hardSmart,
    masterHard,
    masterRecord,
    recommendation,
    smartMirror,
    smartRecord,
  };
};

const makeReport = ({
  classicReports,
  coachDifficultyRecords,
  difficultyRecords,
  games,
  lineReports,
  matchReports,
  seed,
  variantMode,
  variantReports,
  wildcardReports,
}) => {
  const assessment = buildAssessment({
    classicReports,
    difficultyRecords,
    lineReports,
    matchReports,
    variantReports,
  });
  const generatedAt = getReportDate();

  return `# Design Validation Report

Source of truth: [GitHub issue #15](https://github.com/hugurozmen/3d-tic-tac-toe/issues/15)  
Generated (${REPORT_TIME_ZONE}): ${generatedAt}  
Command: \`npm run design:audit -- --variant ${variantMode} --games ${games} --seed ${seed}\`
Variant mode: \`${variantMode}\`

## Scope

This report validates the current design before any rules changes. It focuses on
Lines Mode and uses deterministic AI self-play plus automated Coach-hint
analysis. It does not add retention, cosmetics, permanent rules changes, or AI
balance changes.

Human subjective playtest evidence is still missing, so issue #15 should remain
open after this report. The automated data can identify design risk, but it
cannot fully answer confusion, satisfaction, frustration, or replay desire.

## Tooling Notes

- \`npm run design:audit\` is the source of the fairness, scoring, Coach, and
  Best-of-5 metrics below.
- \`npm run product:final-pass\` remains useful release/playability smoke
  coverage, but it does not emit design-fun or design-fairness metrics. It
  should not replace human playtest notes for issue #15.
- \`--variant final-six-wildcards\` runs the same deterministic Lines matrix
  with local-only Wildcard draft/use rules and includes bonus scores in final
  totals.

## Recommendation

Recommendation: **${assessment.recommendation}**.

The automated data should be treated as a design signal, not a final verdict. If
the next human playtest confirms the same risks, prototype a small Lines Mode
tune rather than changing the rule permanently.

## Lines Mode Self-Play Matrix

${makeLinesTable(lineReports)}

Notes:

- Opener score gives the first mover 1.0 for a win, 0.5 for a draw, and 0 for a
  loss.
- Center score is the same score rate for the side that opened on cell 14.
- Non-center opener uses forced corner/floor-center opening probes mixed with
  natural openings.
- Each matchup alternates X/O openers across games to approximate player-first
  and AI-first equivalents where possible.
- Final-6 changed means the leader or tie state at move 21 did not match the
  final winner.

## Center And Endgame Diagnostics

${makeCenterEndgameTable(lineReports)}

Diagnostics notes:

- Center owner includes whoever eventually owns cell 14, not only games that
  opened center.
- Leader@21 held/lost/draw compares the move-21 leader to the final result.
- Comeback available@21 is an optimistic exact search of the final six cells:
  at least one legal continuation still lets the trailing side win or draw.
- Final-6 swing is signed X-minus-O score swing from move 21 to the final board;
  the second value is absolute swing.

## Classic Comparison

${makeClassicTable(classicReports)}

Classic runs use the current Classic AI and Pie Rule model. They are included
only as a fairness baseline; this report does not recommend removing Classic.

## Win Rate By Difficulty

${makeDifficultyTable(difficultyRecords)}

Participant games count both sides of each Lines scenario, so mirror matches add
equal wins and losses to the same difficulty. The signed line differential is
from that difficulty's perspective.

## Coach Proxy Metrics

${makeCoachTable(lineReports)}

## Coach Follow Rate By Difficulty

${makeCoachDifficultyTable(coachDifficultyRecords)}

Coach proxy interpretation:

- Any hint rate estimates how often Coach has tactical advice to show.
- One-hint turns estimate how often Coach may feel like a single obvious answer.
- Top hint followed estimates how often the AI chose the first Coach-listed
  cell, which is a rough proxy for Coach over-solving the move.
- One-obvious-move turns are turns where Coach had exactly one tactical cell to
  show.

## Margin Distributions

${makeMarginTable([
  getScenario(lineReports, 'Smart vs Casual'),
  getScenario(lineReports, 'Master vs Hard'),
].filter(Boolean))}

## Audit-Only Center-Normalized Variant

${variantReports.length > 0
  ? makeVariantComparisonTable(lineReports, variantReports)
  : 'Variant comparison not run for this audit.'}

The center-normalized variant is a non-player-facing audit hook. It discounts
completed lines that pass through cell 14 during report scoring only. Standard
Lines remains the default game ruleset and UI ruleset.

## Final Six Wildcards Experimental Variant

${wildcardReports.length > 0
  ? makeWildcardTable(wildcardReports)
  : 'Final Six Wildcards audit not run for this report.'}

Wildcard audit notes:

- The draft is deterministic: at six empty cells, three Wildcards are revealed,
  the trailing player by Lines score picks first, then the other player picks
  from the remaining options.
- The audit uses a Wildcard only when a deterministic bonus-scoring move exists.
- Final scores include normal Lines plus Wildcard bonus points; standard Lines
  remains the default player-facing ruleset.
- Winner/tie changed compares the final board result before Wildcard bonus to
  the final total after Wildcard bonus.

## Best-of-5 Match Simulation

${makeMatchTable(matchReports)}

Best-of-5 simulations alternate openers by round and end when one side reaches
3 round wins.

## Answers To Issue #15 Questions

1. **Is Lines Mode actually fairer than Classic?**  
   Automated evidence says Lines Mode is fairer on sudden-death pressure but not
   automatically opener-neutral. Mirror Lines opener score averaged
   ${pct(assessment.avgLinesOpenerScore)}, while Classic mirror opener score
   averaged ${pct(assessment.avgClassicOpenerScore)}. Lines also uses the full
   board, whereas Classic mirror rounds ended in about
   ${fixed(average(classicReports.map((scenario) => scenario.averageMoveCount)))}
   moves on average.

2. **Does center still dominate?**  
   Center is still very strong. Across Lines scenarios, center-opening score
   averaged ${pct(assessment.avgCenterScore)} versus ${pct(assessment.avgNonCenterScore)}
   for non-center opening probes. That is useful strategic gravity, but it is a
   design risk if human playtests show players feel forced into center.

3. **Are matches decided too early?**  
   Not always. The final 6 cells changed the actual winner/tie state in
   ${pct(assessment.avgFinalSixChanged)} of Lines rounds on average, and Lines
   rounds averaged ${fixed(average(lineReports.map((scenario) => scenario.averageLeadChanges)))}
   lead changes. If human players still feel the outcome is obvious early, tune
   endgame scoring tension rather than assuming the math is solved.

4. **Is Coach helping or over-solving the game?**  
   Coach is informative but has over-solving risk. Across the matrix, Coach had
   at least one hint on ${pct(average(lineReports.map((scenario) => scenario.coach.anyHintRate ?? 0)))}
   of turns, exactly one hint on ${pct(average(lineReports.map((scenario) => scenario.coach.oneHintRate ?? 0)))}
   of turns, and the AI followed the top hint on
   ${pct(average(lineReports.map((scenario) => scenario.coach.topHintFollowRate ?? 0)))}
   of turns. This supports keeping Coach as a learning layer, while playtesting
   whether always-visible hints should taper after onboarding.

5. **Is Smart the right default AI?**  
   Smart remains plausible as the default. Its aggregate Lines score rate was
   ${pct(assessment.smartRecord?.scoreRate ?? 0)}, with an average signed line
   differential of ${signed(assessment.smartRecord?.signedLineDiff ?? 0)}. In
   Smart mirror rounds, average score was
   ${fixed(assessment.smartMirror?.averageFinalScore.X ?? 0)}-${fixed(
     assessment.smartMirror?.averageFinalScore.O ?? 0,
   )}. It should feel competent without being the final boss.

6. **Is Master strong without making the game feel pointless?**  
   Master is strong, but the current data does not prove it is oppressive.
   Master aggregate score rate was ${pct(assessment.masterRecord?.scoreRate ?? 0)}
   with signed line differential ${signed(assessment.masterRecord?.signedLineDiff ?? 0)}.
   In Master vs Hard, X score rate was
   ${pct(assessment.masterHard?.xWinRate ?? 0)} as the listed stronger side,
   and average final score was
   ${fixed(assessment.masterHard?.averageFinalScore.X ?? 0)}-${fixed(
     assessment.masterHard?.averageFinalScore.O ?? 0,
   )}. Human frustration notes are still required.

7. **Does Best-of-5 improve the story?**  
   Automated match simulations support Best-of-5 as useful framing. First-round
   losers won the match in ${pct(assessment.averageComebackRate)} of simulated
   focus matches, and ${pct(average(matchReports.map((match) => match.wentFullFiveRate)))}
   went to five rounds. That gives opener alternation and comeback language more
   work to do than isolated rounds.

8. **Recommended design changes, if any.**  
   Do not change rules permanently yet. The next step should be a human
   playtest cycle focused on center pressure, Coach dependency, and whether the
   final third feels alive. If those playtests agree with the automated risks,
   prototype a small Lines Mode tune: late-game combo emphasis, limited Coach
   ladder, or center normalization. Avoid retention or cosmetics as substitutes.

## Remaining Design Risks

- Center may still be psychologically mandatory even if non-center probes can
  win some games.
- Coach may make tactical turns too explicit for experienced players.
- Product-final-pass and self-play prove mechanics; they do not prove that
  players can explain wins/losses or want another match.
- No human 2P playtest notes are included here, so replay interest remains
  unproven.

## Decision

Decision: **${assessment.recommendation}**.

Do not close issue #15 from this report alone. Close it only after adding human
playtest notes or explicitly accepting automated validation as sufficient for
this release.
`;
};

const main = () => {
  const games = readNumberOption('--games', DEFAULT_GAMES);
  const seed = readNumberOption('--seed', DEFAULT_SEED);
  const outputPath = readStringOption('--out', DEFAULT_OUTPUT);
  const variantMode = readVariantMode();
  const shouldRunCenterNormalized =
    variantMode === 'both' || variantMode === CENTER_NORMALIZED_VARIANT;
  const shouldRunWildcards = variantMode === FINAL_SIX_WILDCARDS_VARIANT;

  const lineReports = linesScenarios.map(([label, xDifficulty, oDifficulty], index) =>
    runScenario({
      games,
      label,
      oDifficulty,
      ruleset: 'lines',
      scenarioIndex: index,
      seed,
      xDifficulty,
    }),
  );
  const classicReports = classicScenarios.map(
    ([label, xDifficulty, oDifficulty], index) =>
      runScenario({
        classicPieRule: true,
        games,
        label,
        oDifficulty,
        ruleset: 'classic',
        scenarioIndex: index + lineReports.length,
        seed,
        xDifficulty,
      }),
  );
  const variantReports = shouldRunCenterNormalized
    ? linesScenarios.map(([label, xDifficulty, oDifficulty], index) =>
        runScenario({
          games,
          label,
          linesVariant: CENTER_NORMALIZED_VARIANT,
          oDifficulty,
          ruleset: 'lines',
          scenarioIndex: index,
          seed,
          xDifficulty,
        }),
      )
    : [];
  const wildcardReports = shouldRunWildcards
    ? linesScenarios.map(([label, xDifficulty, oDifficulty], index) =>
        runScenario({
          endgameVariant: FINAL_SIX_WILDCARDS_VARIANT,
          games,
          label,
          oDifficulty,
          ruleset: 'lines',
          scenarioIndex: index,
          seed,
          xDifficulty,
        }),
      )
    : [];
  const difficultyRecords = aggregateDifficultyRecords(lineReports);
  const coachDifficultyRecords = aggregateCoachDifficultyRecords(lineReports);
  const matchReports = runMatchAudit({ games, seed });
  const report = makeReport({
    classicReports,
    coachDifficultyRecords,
    difficultyRecords,
    games,
    lineReports,
    matchReports,
    seed,
    variantMode,
    variantReports,
    wildcardReports,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, report);

  console.log(`Wrote ${outputPath}`);
  console.log(`Lines scenarios: ${lineReports.length} x ${games} games`);
  console.log(`Variant mode: ${variantMode}`);
  console.log(
    `Center-normalized audit scenarios: ${variantReports.length} x ${games} games`,
  );
  console.log(
    `Final Six Wildcards audit scenarios: ${wildcardReports.length} x ${games} games`,
  );
  console.log(`Classic scenarios: ${classicReports.length} x ${games} games`);
  console.log(`Best-of-5 focus scenarios: ${matchReports.length}`);
};

main();
