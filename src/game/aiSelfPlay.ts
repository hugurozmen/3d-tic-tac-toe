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
  centerOpeningEvery?: number;
  classicPieRule?: boolean;
  games?: number;
  label: string;
  oDifficulty?: Difficulty;
  ruleset: GameRuleset;
  seed?: number;
  xDifficulty: Difficulty;
};

export type SelfPlayMetrics = {
  averageDecisionTimeMs: number;
  averageFinalScore: LineScores;
  averageLineDifferential: number;
  centerOpeningWinRate: number | null;
  firstPlayerAdvantage: number;
  games: number;
  illegalMoves: number;
  multiLineMoves: number;
  pieSwaps: number;
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

const DEFAULT_GAMES_PER_SCENARIO = 8;

export const DEFAULT_SELF_PLAY_SCENARIOS: SelfPlayScenario[] = [
  {
    centerOpeningEvery: 4,
    label: 'Lines/Casual',
    ruleset: 'lines',
    xDifficulty: 'easy',
  },
  {
    centerOpeningEvery: 4,
    label: 'Lines/Smart',
    ruleset: 'lines',
    xDifficulty: 'balanced',
  },
  {
    centerOpeningEvery: 4,
    label: 'Lines/Hard',
    ruleset: 'lines',
    xDifficulty: 'hard',
  },
  {
    centerOpeningEvery: 4,
    label: 'Lines/Master',
    ruleset: 'lines',
    xDifficulty: 'master',
  },
  {
    classicPieRule: true,
    label: 'Classic/Smart',
    ruleset: 'classic',
    xDifficulty: 'balanced',
  },
  {
    classicPieRule: true,
    label: 'Classic/Master',
    ruleset: 'classic',
    xDifficulty: 'master',
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

const outcomeForX = (winner: Player | null, isDraw: boolean) => {
  if (isDraw || !winner) {
    return 0;
  }

  return winner === 'X' ? 1 : -1;
};

const shouldForceCenterOpening = (scenario: SelfPlayScenario, gameIndex: number) =>
  Boolean(
    scenario.centerOpeningEvery &&
      scenario.centerOpeningEvery > 0 &&
      gameIndex % scenario.centerOpeningEvery === 0,
  );

export const runSelfPlayScenario = (
  scenario: SelfPlayScenario,
  suiteOptions: SelfPlaySuiteOptions = {},
): SelfPlayReport => {
  const games =
    scenario.games ?? suiteOptions.gamesPerScenario ?? DEFAULT_GAMES_PER_SCENARIO;
  const baseSeed = scenario.seed ?? suiteOptions.seed ?? 9109;
  const oDifficulty = scenario.oDifficulty ?? scenario.xDifficulty;
  const totals = {
    centerOpeningScore: 0,
    centerOpenings: 0,
    decisionTimeMs: 0,
    finalScores: { O: 0, X: 0 },
    firstPlayerAdvantage: 0,
    illegalMoves: 0,
    lineDifferential: 0,
    moves: 0,
    multiLineMoves: 0,
    pieSwaps: 0,
  };

  for (let gameIndex = 0; gameIndex < games; gameIndex += 1) {
    const random = createSeededRandom(baseSeed + gameIndex * 7919);
    const board = createBoard();
    const difficultyByPlayer: Record<Player, Difficulty> = {
      O: oDifficulty,
      X: scenario.xDifficulty,
    };
    let currentPlayer: Player = 'X';
    let firstMove: number | null = null;
    let pieDecisionDone = false;
    let result = evaluateBoard(board, scenario.ruleset);

    while (!result.isComplete) {
      const availableMoves = getAvailableMoves(board);

      if (availableMoves.length === 0) {
        break;
      }

      const forcedCenter: boolean =
        firstMove === null &&
        shouldForceCenterOpening(scenario, gameIndex) &&
        board[AI_CENTER_INDEX] === null;
      const startedAt = now();
      const requestedMove: number | null = forcedCenter
        ? AI_CENTER_INDEX
        : chooseAiMove(
            board,
            currentPlayer,
            difficultyByPlayer[currentPlayer],
            scenario.ruleset,
            { random },
          );
      const durationMs = now() - startedAt;
      const move: number | null =
        requestedMove !== null && board[requestedMove] === null
          ? requestedMove
          : chooseFallbackMove(board);

      totals.decisionTimeMs += durationMs;
      totals.moves += 1;

      if (move === null) {
        break;
      }

      if (requestedMove === null || requestedMove !== move) {
        totals.illegalMoves += 1;
      }

      const previous = [...board];
      board[move] = currentPlayer;

      if (firstMove === null) {
        firstMove = move;
      }

      const newLineCount = getNewCompletedLines(
        previous,
        board,
        currentPlayer,
      ).length;

      if (newLineCount > 1) {
        totals.multiLineMoves += 1;
      }

      result = evaluateBoard(board, scenario.ruleset);

      if (
        scenario.ruleset === 'classic' &&
        scenario.classicPieRule &&
        !pieDecisionDone &&
        board.filter(Boolean).length === 1
      ) {
        pieDecisionDone = true;

        if (shouldSwapClassicPie(board, difficultyByPlayer.O)) {
          const xDifficulty = difficultyByPlayer.X;
          difficultyByPlayer.X = difficultyByPlayer.O;
          difficultyByPlayer.O = xDifficulty;
          totals.pieSwaps += 1;
        }
      }

      currentPlayer = getOtherPlayer(currentPlayer);
    }

    totals.finalScores.X += result.lineScores.X;
    totals.finalScores.O += result.lineScores.O;
    totals.firstPlayerAdvantage += outcomeForX(result.winner, result.isDraw);
    totals.lineDifferential += Math.abs(result.lineScores.X - result.lineScores.O);

    if (firstMove === AI_CENTER_INDEX) {
      totals.centerOpenings += 1;
      totals.centerOpeningScore += outcomeForX(result.winner, result.isDraw);
    }
  }

  return {
    label: scenario.label,
    metrics: {
      averageDecisionTimeMs: average(totals.decisionTimeMs, totals.moves),
      averageFinalScore: {
        O: average(totals.finalScores.O, games),
        X: average(totals.finalScores.X, games),
      },
      averageLineDifferential: average(totals.lineDifferential, games),
      centerOpeningWinRate:
        totals.centerOpenings > 0
          ? (totals.centerOpeningScore / totals.centerOpenings + 1) / 2
          : null,
      firstPlayerAdvantage: average(totals.firstPlayerAdvantage, games),
      games,
      illegalMoves: totals.illegalMoves,
      multiLineMoves: totals.multiLineMoves,
      pieSwaps: totals.pieSwaps,
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
