import { AI_CENTER_INDEX, chooseAiMove, shouldSwapClassicPie } from './ai';
import {
  Board,
  Difficulty,
  GameRuleset,
  LineScores,
  Player,
  createBoard,
  evaluateBoard,
  getAvailableMoves,
  getNewCompletedLines,
  getOtherPlayer,
} from './rules';

export type SelfPlayScenario = {
  /** @deprecated Prefer forcedOpenings so center and non-center probes are paired. */
  centerOpeningEvery?: number;
  classicPieRule?: boolean;
  forcedOpenings?: readonly (number | null)[];
  games?: number;
  label: string;
  oDifficulty?: Difficulty;
  opener?: Player;
  ruleset: GameRuleset;
  seed?: number;
  xDifficulty: Difficulty;
};

export type SeatOutcomeMetrics = {
  averageLineDifferential: number;
  draws: number;
  games: number;
  losses: number;
  scoreRate: number | null;
  wins: number;
};

export type OpeningOutcomeMetrics = SeatOutcomeMetrics & {
  averageOpeningLineDifferential: number;
};

export type OpeningOutcomeBreakdown = {
  center: OpeningOutcomeMetrics;
  nonCenter: OpeningOutcomeMetrics;
};

export type FinalSixMetrics = {
  averageAbsoluteDifferentialSwing: number;
  games: number;
  leadChangeGames: number;
  leadChangeRate: number | null;
  outcomeChangeGames: number;
  outcomeChangeRate: number | null;
};

export type SelfPlayMetrics = {
  averageDecisionTimeMs: number;
  averageFinalScore: LineScores;
  averageLineDifferential: number;
  centerOpeningWinRate: number | null;
  finalSix: FinalSixMetrics;
  firstPlayerAdvantage: number;
  games: number;
  illegalMoves: number;
  multiLineMoves: number;
  nonCenterOpeningWinRate: number | null;
  openingOutcomes: OpeningOutcomeBreakdown;
  pieSwaps: number;
  seatOutcomes: Record<Player, SeatOutcomeMetrics>;
};

export type SelfPlayReport = {
  label: string;
  metrics: SelfPlayMetrics;
  ruleset: GameRuleset;
  xDifficulty: Difficulty;
  oDifficulty: Difficulty;
};

export type SelfPlaySuiteOptions = {
  gamesPerScenario?: number;
  seed?: number;
};

export type SelfPlayGameOptions = {
  classicPieRule?: boolean;
  forcedOpening?: number | null;
  oDifficulty: Difficulty;
  opener?: Player;
  ruleset: GameRuleset;
  seed: number;
  xDifficulty: Difficulty;
};

export type SelfPlayGameReport = {
  averageDecisionTimeMs: number;
  finalScores: LineScores;
  finalSixAbsoluteDifferentialSwing: number | null;
  finalSixHadLeadChange: boolean | null;
  finalSixOutcomeChanged: boolean | null;
  firstMove: number | null;
  forcedOpening: number | null;
  illegalMoves: number;
  isDraw: boolean;
  moves: number;
  multiLineMoves: number;
  oDifficulty: Difficulty;
  opener: Player;
  openingKind: 'center' | 'nonCenter';
  pieSwaps: number;
  ruleset: GameRuleset;
  seed: number;
  winner: Player | null;
  xDifficulty: Difficulty;
};

export type PairedDifficultyMatchup = {
  classicPieRule?: boolean;
  forcedOpenings?: readonly number[];
  higherDifficulty: Difficulty;
  label: string;
  lowerDifficulty: Difficulty;
  pairs?: number;
  ruleset: GameRuleset;
  seed?: number;
};

export type PairedDifficultySuiteOptions = {
  pairsPerMatchup?: number;
  seed?: number;
};

export type PairedSelfPlayFixture = {
  forcedOpening: number;
  higherAsO: SelfPlayGameReport;
  higherAsX: SelfPlayGameReport;
  seed: number;
};

export type PairedDifficultyReport = {
  combined: SeatOutcomeMetrics;
  finalSix: FinalSixMetrics;
  fixtures: PairedSelfPlayFixture[];
  games: number;
  higherDifficulty: Difficulty;
  illegalMoves: number;
  label: string;
  lowerDifficulty: Difficulty;
  openingOutcomes: OpeningOutcomeBreakdown;
  pairedAverageLineDifferential: number;
  pairs: number;
  ruleset: GameRuleset;
  seatings: {
    higherAsO: SeatOutcomeMetrics;
    higherAsX: SeatOutcomeMetrics;
  };
  strengthExpectationMet: boolean;
};

const DEFAULT_GAMES_PER_SCENARIO = 8;
const DEFAULT_PAIRS_PER_MATCHUP = 8;
const SEED_STEP = 7919;

/**
 * Four center probes paired with four geometrically different non-center probes.
 * Keeping the sequence fixed lets benchmark changes be compared across revisions.
 */
export const DEFAULT_PAIRED_OPENINGS = [
  AI_CENTER_INDEX,
  0,
  AI_CENTER_INDEX,
  4,
  AI_CENTER_INDEX,
  1,
  AI_CENTER_INDEX,
  9,
] as const;

/** Use for release checks that must not depend on a hand-picked opening class. */
export const FULL_BOARD_OPENING_PROBES = [
  AI_CENTER_INDEX,
  ...Array.from({ length: 27 }, (_, index) => index).filter(
    (index) => index !== AI_CENTER_INDEX,
  ),
] as const;

export const DEFAULT_SELF_PLAY_SCENARIOS: SelfPlayScenario[] = [
  {
    forcedOpenings: DEFAULT_PAIRED_OPENINGS,
    label: 'Lines/Casual',
    ruleset: 'lines',
    xDifficulty: 'easy',
  },
  {
    forcedOpenings: DEFAULT_PAIRED_OPENINGS,
    label: 'Lines/Smart',
    ruleset: 'lines',
    xDifficulty: 'balanced',
  },
  {
    forcedOpenings: DEFAULT_PAIRED_OPENINGS,
    label: 'Lines/Hard',
    ruleset: 'lines',
    xDifficulty: 'hard',
  },
  {
    forcedOpenings: DEFAULT_PAIRED_OPENINGS,
    label: 'Lines/Master',
    ruleset: 'lines',
    xDifficulty: 'master',
  },
  {
    classicPieRule: true,
    forcedOpenings: DEFAULT_PAIRED_OPENINGS,
    label: 'Classic/Smart',
    ruleset: 'classic',
    xDifficulty: 'balanced',
  },
  {
    classicPieRule: true,
    forcedOpenings: DEFAULT_PAIRED_OPENINGS,
    label: 'Classic/Master',
    ruleset: 'classic',
    xDifficulty: 'master',
  },
];

export const DEFAULT_PAIRED_DIFFICULTY_MATCHUPS: PairedDifficultyMatchup[] = [
  {
    higherDifficulty: 'balanced',
    label: 'Lines/Smart vs Casual',
    lowerDifficulty: 'easy',
    ruleset: 'lines',
  },
  {
    higherDifficulty: 'hard',
    label: 'Lines/Hard vs Smart',
    lowerDifficulty: 'balanced',
    ruleset: 'lines',
  },
  {
    higherDifficulty: 'master',
    label: 'Lines/Master vs Hard',
    lowerDifficulty: 'hard',
    ruleset: 'lines',
  },
];

const createSeededRandom = (seed: number) => {
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

const average = (value: number, count: number) => (count > 0 ? value / count : 0);

const chooseFallbackMove = (board: Board) => getAvailableMoves(board)[0] ?? null;

const outcomeForPlayer = (
  winner: Player | null,
  isDraw: boolean,
  player: Player,
) => {
  if (isDraw || !winner) {
    return 0;
  }

  return winner === player ? 1 : -1;
};

const getScoreLeader = (scores: LineScores): Player | null => {
  if (scores.X === scores.O) {
    return null;
  }

  return scores.X > scores.O ? 'X' : 'O';
};

const getScenarioForcedOpening = (
  scenario: SelfPlayScenario,
  gameIndex: number,
) => {
  if (scenario.forcedOpenings && scenario.forcedOpenings.length > 0) {
    return scenario.forcedOpenings[gameIndex % scenario.forcedOpenings.length] ?? null;
  }

  return scenario.centerOpeningEvery &&
    scenario.centerOpeningEvery > 0 &&
    gameIndex % scenario.centerOpeningEvery === 0
    ? AI_CENTER_INDEX
    : null;
};

export const runSelfPlayGame = (
  options: SelfPlayGameOptions,
): SelfPlayGameReport => {
  const random = createSeededRandom(options.seed);
  const board = createBoard();
  const opener = options.opener ?? 'X';
  const difficultyByPlayer: Record<Player, Difficulty> = {
    O: options.oDifficulty,
    X: options.xDifficulty,
  };
  let currentPlayer = opener;
  let decisionTimeMs = 0;
  let finalSixAbsoluteDifferentialSwing: number | null = null;
  let finalSixHadLeadChange: boolean | null = null;
  let finalSixOutcomeChanged: boolean | null = null;
  let finalSixStartDifferential: number | null = null;
  let finalSixStartLeader: Player | null = null;
  let firstMove: number | null = null;
  let illegalMoves = 0;
  let lastFinalSixLeader: Player | null = null;
  let moves = 0;
  let multiLineMoves = 0;
  let pieDecisionDone = false;
  let pieSwaps = 0;
  let result = evaluateBoard(board, options.ruleset);

  while (!result.isComplete) {
    const availableMoves = getAvailableMoves(board);

    if (availableMoves.length === 0) {
      break;
    }

    const shouldForceOpening: boolean =
      firstMove === null &&
      options.forcedOpening !== null &&
      options.forcedOpening !== undefined &&
      board[options.forcedOpening] === null;
    const startedAt = now();
    const requestedMove: number | null = shouldForceOpening
      ? (options.forcedOpening as number)
      : chooseAiMove(
          board,
          currentPlayer,
          difficultyByPlayer[currentPlayer],
          options.ruleset,
          { random },
        );

    decisionTimeMs += now() - startedAt;

    const move: number | null =
      requestedMove !== null && board[requestedMove] === null
        ? requestedMove
        : chooseFallbackMove(board);

    if (move === null) {
      break;
    }

    if (requestedMove === null || requestedMove !== move) {
      illegalMoves += 1;
    }

    const previous = [...board];
    board[move] = currentPlayer;
    moves += 1;

    if (firstMove === null) {
      firstMove = move;
    }

    if (getNewCompletedLines(previous, board, currentPlayer).length > 1) {
      multiLineMoves += 1;
    }

    result = evaluateBoard(board, options.ruleset);

    if (options.ruleset === 'lines' && moves === 21) {
      finalSixStartDifferential = result.lineScores.X - result.lineScores.O;
      finalSixStartLeader = getScoreLeader(result.lineScores);
      lastFinalSixLeader = finalSixStartLeader;
      finalSixHadLeadChange = false;
    } else if (options.ruleset === 'lines' && moves > 21) {
      const leader = getScoreLeader(result.lineScores);

      if (
        leader !== null &&
        lastFinalSixLeader !== null &&
        leader !== lastFinalSixLeader
      ) {
        finalSixHadLeadChange = true;
      }

      if (leader !== null) {
        lastFinalSixLeader = leader;
      }
    }

    if (
      options.ruleset === 'classic' &&
      options.classicPieRule &&
      !pieDecisionDone &&
      moves === 1
    ) {
      pieDecisionDone = true;
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

  if (options.ruleset === 'lines' && finalSixStartDifferential !== null) {
    const finalDifferential = result.lineScores.X - result.lineScores.O;
    const finalLeader = getScoreLeader(result.lineScores);

    finalSixAbsoluteDifferentialSwing = Math.abs(
      finalDifferential - finalSixStartDifferential,
    );
    finalSixOutcomeChanged = finalSixStartLeader !== finalLeader;
  }

  return {
    averageDecisionTimeMs: average(decisionTimeMs, moves),
    finalScores: { ...result.lineScores },
    finalSixAbsoluteDifferentialSwing,
    finalSixHadLeadChange,
    finalSixOutcomeChanged,
    firstMove,
    forcedOpening: options.forcedOpening ?? null,
    illegalMoves,
    isDraw: result.isDraw,
    moves,
    multiLineMoves,
    oDifficulty: options.oDifficulty,
    opener,
    openingKind: firstMove === AI_CENTER_INDEX ? 'center' : 'nonCenter',
    pieSwaps,
    ruleset: options.ruleset,
    seed: options.seed,
    winner: result.winner,
    xDifficulty: options.xDifficulty,
  };
};

type OutcomeAccumulator = {
  differential: number;
  draws: number;
  games: number;
  losses: number;
  wins: number;
};

const createOutcomeAccumulator = (): OutcomeAccumulator => ({
  differential: 0,
  draws: 0,
  games: 0,
  losses: 0,
  wins: 0,
});

const addOutcome = (
  accumulator: OutcomeAccumulator,
  game: SelfPlayGameReport,
  player: Player,
) => {
  accumulator.games += 1;
  accumulator.differential +=
    game.finalScores[player] - game.finalScores[getOtherPlayer(player)];

  const outcome = outcomeForPlayer(game.winner, game.isDraw, player);

  if (outcome > 0) {
    accumulator.wins += 1;
  } else if (outcome < 0) {
    accumulator.losses += 1;
  } else {
    accumulator.draws += 1;
  }
};

const finalizeOutcome = (
  accumulator: OutcomeAccumulator,
): SeatOutcomeMetrics => ({
  averageLineDifferential: average(
    accumulator.differential,
    accumulator.games,
  ),
  draws: accumulator.draws,
  games: accumulator.games,
  losses: accumulator.losses,
  scoreRate:
    accumulator.games > 0
      ? (accumulator.wins + accumulator.draws * 0.5) / accumulator.games
      : null,
  wins: accumulator.wins,
});

const aggregateOpeningOutcomes = (
  games: SelfPlayGameReport[],
): OpeningOutcomeBreakdown => {
  const accumulators = {
    center: createOutcomeAccumulator(),
    nonCenter: createOutcomeAccumulator(),
  };

  for (const game of games) {
    addOutcome(accumulators[game.openingKind], game, game.opener);
  }

  const finalizeOpening = (
    accumulator: OutcomeAccumulator,
  ): OpeningOutcomeMetrics => ({
    ...finalizeOutcome(accumulator),
    averageOpeningLineDifferential: average(
      accumulator.differential,
      accumulator.games,
    ),
  });

  return {
    center: finalizeOpening(accumulators.center),
    nonCenter: finalizeOpening(accumulators.nonCenter),
  };
};

const aggregateFinalSix = (games: SelfPlayGameReport[]): FinalSixMetrics => {
  const relevant = games.filter(
    (game) => game.finalSixOutcomeChanged !== null,
  );
  const outcomeChangeGames = relevant.filter(
    (game) => game.finalSixOutcomeChanged,
  ).length;
  const leadChangeGames = relevant.filter(
    (game) => game.finalSixHadLeadChange,
  ).length;
  const absoluteSwing = relevant.reduce(
    (sum, game) => sum + (game.finalSixAbsoluteDifferentialSwing ?? 0),
    0,
  );

  return {
    averageAbsoluteDifferentialSwing: average(absoluteSwing, relevant.length),
    games: relevant.length,
    leadChangeGames,
    leadChangeRate:
      relevant.length > 0 ? leadChangeGames / relevant.length : null,
    outcomeChangeGames,
    outcomeChangeRate:
      relevant.length > 0 ? outcomeChangeGames / relevant.length : null,
  };
};

export const runSelfPlayScenario = (
  scenario: SelfPlayScenario,
  suiteOptions: SelfPlaySuiteOptions = {},
): SelfPlayReport => {
  const games =
    scenario.games ?? suiteOptions.gamesPerScenario ?? DEFAULT_GAMES_PER_SCENARIO;
  const baseSeed = scenario.seed ?? suiteOptions.seed ?? 9109;
  const oDifficulty = scenario.oDifficulty ?? scenario.xDifficulty;
  const opener = scenario.opener ?? 'X';
  const gameReports = Array.from({ length: games }, (_, gameIndex) =>
    runSelfPlayGame({
      classicPieRule: scenario.classicPieRule,
      forcedOpening: getScenarioForcedOpening(scenario, gameIndex),
      oDifficulty,
      opener,
      ruleset: scenario.ruleset,
      seed: baseSeed + gameIndex * SEED_STEP,
      xDifficulty: scenario.xDifficulty,
    }),
  );
  const openingOutcomes = aggregateOpeningOutcomes(gameReports);
  const xOutcomes = createOutcomeAccumulator();
  const oOutcomes = createOutcomeAccumulator();

  for (const game of gameReports) {
    addOutcome(xOutcomes, game, 'X');
    addOutcome(oOutcomes, game, 'O');
  }

  const totalFinalScores = gameReports.reduce<LineScores>(
    (scores, game) => ({
      O: scores.O + game.finalScores.O,
      X: scores.X + game.finalScores.X,
    }),
    { O: 0, X: 0 },
  );
  const totalMoves = gameReports.reduce((sum, game) => sum + game.moves, 0);
  const weightedDecisionTime = gameReports.reduce(
    (sum, game) => sum + game.averageDecisionTimeMs * game.moves,
    0,
  );

  return {
    label: scenario.label,
    metrics: {
      averageDecisionTimeMs: average(weightedDecisionTime, totalMoves),
      averageFinalScore: {
        O: average(totalFinalScores.O, games),
        X: average(totalFinalScores.X, games),
      },
      averageLineDifferential: average(
        gameReports.reduce(
          (sum, game) =>
            sum + Math.abs(game.finalScores.X - game.finalScores.O),
          0,
        ),
        games,
      ),
      centerOpeningWinRate: openingOutcomes.center.scoreRate,
      finalSix: aggregateFinalSix(gameReports),
      firstPlayerAdvantage: average(
        gameReports.reduce(
          (sum, game) =>
            sum + outcomeForPlayer(game.winner, game.isDraw, opener),
          0,
        ),
        games,
      ),
      games,
      illegalMoves: gameReports.reduce(
        (sum, game) => sum + game.illegalMoves,
        0,
      ),
      multiLineMoves: gameReports.reduce(
        (sum, game) => sum + game.multiLineMoves,
        0,
      ),
      nonCenterOpeningWinRate: openingOutcomes.nonCenter.scoreRate,
      openingOutcomes,
      pieSwaps: gameReports.reduce((sum, game) => sum + game.pieSwaps, 0),
      seatOutcomes: {
        O: finalizeOutcome(oOutcomes),
        X: finalizeOutcome(xOutcomes),
      },
    },
    oDifficulty,
    ruleset: scenario.ruleset,
    xDifficulty: scenario.xDifficulty,
  };
};

export const runSelfPlaySuite = (
  options: SelfPlaySuiteOptions = {},
  scenarios = DEFAULT_SELF_PLAY_SCENARIOS,
) => scenarios.map((scenario) => runSelfPlayScenario(scenario, options));

const addHigherDifficultyOutcome = (
  accumulator: OutcomeAccumulator,
  game: SelfPlayGameReport,
  higherSeat: Player,
) => addOutcome(accumulator, game, higherSeat);

export const runPairedDifficultyMatchup = (
  matchup: PairedDifficultyMatchup,
  suiteOptions: PairedDifficultySuiteOptions = {},
): PairedDifficultyReport => {
  const pairs =
    matchup.pairs ??
    suiteOptions.pairsPerMatchup ??
    DEFAULT_PAIRS_PER_MATCHUP;
  const baseSeed = matchup.seed ?? suiteOptions.seed ?? 9109;
  const openings =
    matchup.forcedOpenings && matchup.forcedOpenings.length > 0
      ? matchup.forcedOpenings
      : DEFAULT_PAIRED_OPENINGS;
  const fixtures = Array.from({ length: pairs }, (_, pairIndex) => {
    const seed = baseSeed + pairIndex * SEED_STEP;
    const forcedOpening = openings[pairIndex % openings.length];

    return {
      forcedOpening,
      higherAsO: runSelfPlayGame({
        classicPieRule: matchup.classicPieRule,
        forcedOpening,
        oDifficulty: matchup.higherDifficulty,
        ruleset: matchup.ruleset,
        seed,
        xDifficulty: matchup.lowerDifficulty,
      }),
      higherAsX: runSelfPlayGame({
        classicPieRule: matchup.classicPieRule,
        forcedOpening,
        oDifficulty: matchup.lowerDifficulty,
        ruleset: matchup.ruleset,
        seed,
        xDifficulty: matchup.higherDifficulty,
      }),
      seed,
    };
  });
  const higherAsX = createOutcomeAccumulator();
  const higherAsO = createOutcomeAccumulator();
  const combined = createOutcomeAccumulator();
  const allGames: SelfPlayGameReport[] = [];
  let pairedDifferential = 0;

  for (const fixture of fixtures) {
    addHigherDifficultyOutcome(higherAsX, fixture.higherAsX, 'X');
    addHigherDifficultyOutcome(higherAsO, fixture.higherAsO, 'O');
    addHigherDifficultyOutcome(combined, fixture.higherAsX, 'X');
    addHigherDifficultyOutcome(combined, fixture.higherAsO, 'O');
    allGames.push(fixture.higherAsX, fixture.higherAsO);
    pairedDifferential +=
      (fixture.higherAsX.finalScores.X - fixture.higherAsX.finalScores.O +
        fixture.higherAsO.finalScores.O - fixture.higherAsO.finalScores.X) /
      2;
  }

  const combinedMetrics = finalizeOutcome(combined);
  const pairedAverageLineDifferential = average(pairedDifferential, pairs);

  return {
    combined: combinedMetrics,
    finalSix: aggregateFinalSix(allGames),
    fixtures,
    games: allGames.length,
    higherDifficulty: matchup.higherDifficulty,
    illegalMoves: allGames.reduce((sum, game) => sum + game.illegalMoves, 0),
    label: matchup.label,
    lowerDifficulty: matchup.lowerDifficulty,
    openingOutcomes: aggregateOpeningOutcomes(allGames),
    pairedAverageLineDifferential,
    pairs,
    ruleset: matchup.ruleset,
    seatings: {
      higherAsO: finalizeOutcome(higherAsO),
      higherAsX: finalizeOutcome(higherAsX),
    },
    strengthExpectationMet:
      pairedAverageLineDifferential > 0 &&
      combinedMetrics.scoreRate !== null &&
      combinedMetrics.scoreRate > 0.5,
  };
};

export const runPairedDifficultySuite = (
  options: PairedDifficultySuiteOptions = {},
  matchups = DEFAULT_PAIRED_DIFFICULTY_MATCHUPS,
) => matchups.map((matchup) => runPairedDifficultyMatchup(matchup, options));
