import { chooseAiMove } from './ai';
import {
  Board,
  createBoard,
  evaluateClassicBoard,
  GameRuleset,
  Player,
  getAvailableMoves,
  getLineScores,
  getNewCompletedLines,
  getOtherPlayer,
} from './rules';

export type PuzzleMove = {
  move: number | null;
  score: number;
};
export type DailyPuzzleKind =
  | 'best-lines'
  | 'classic-win'
  | 'classic-win-two'
  | 'max-lines';
export type DailyPuzzle = {
  bestMove: number | null;
  board: Board;
  dateKey: string;
  explanation: string;
  id: number;
  kind: DailyPuzzleKind;
  player: Player;
  puzzleKey: string;
  prompt: string;
  ruleset: GameRuleset;
  shareText: string;
  title: string;
};
export type DailyPuzzleResult = {
  bestMove: number | null;
  dateKey: string;
  explanation: string;
  move: number | null;
  puzzleKey: string;
  shareText: string;
  solved: boolean;
};

const DAILY_RESULT_KEY = '3dxox-daily-puzzle-result';
const DAILY_PUZZLE_REVISION = 2;
const DAILY_EPOCH = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

const scoreDeltaAfterMove = (board: Board, player: Player, move: number) => {
  const before = getLineScores(board);
  const next = [...board];
  next[move] = player;
  const after = getLineScores(next);
  const rival = getOtherPlayer(player);

  return after[player] - before[player] - (after[rival] - before[rival]);
};

export const findClassicWinningMove = (board: Board, player: Player) =>
  getAvailableMoves(board).find((move) => {
    const next = [...board];
    next[move] = player;
    return evaluateClassicBoard(next).winner === player;
  }) ?? null;

export const findMaxLineMove = (board: Board, player: Player): PuzzleMove => {
  const ranked = getAvailableMoves(board)
    .map((move) => {
      const next = [...board];
      next[move] = player;

      return {
        move,
        score:
          getNewCompletedLines(board, next, player).length * 100 +
          scoreDeltaAfterMove(board, player, move),
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0] ?? { move: null, score: 0 };
};

export const findBestScoringMove = (
  board: Board,
  player: Player,
  ruleset: GameRuleset = 'lines',
): PuzzleMove => {
  if (ruleset === 'classic') {
    const move = chooseAiMove(board, player, 'master', 'classic');
    return { move, score: move === null ? 0 : 1 };
  }

  const maxLineMove = findMaxLineMove(board, player);

  if (maxLineMove.score > 0) {
    return maxLineMove;
  }

  const move = chooseAiMove(board, player, 'master', 'lines');
  return { move, score: move === null ? 0 : scoreDeltaAfterMove(board, player, move) };
};

export const findClassicWinInTwoMoves = (board: Board, player: Player) => {
  const immediate = getAvailableMoves(board).filter((move) => {
    const next = [...board];
    next[move] = player;
    return evaluateClassicBoard(next).winner === player;
  });

  if (immediate.length > 0) {
    return immediate;
  }

  const rival = getOtherPlayer(player);

  return getAvailableMoves(board).filter((move) => {
    const next = [...board];
    next[move] = player;
    const rivalMoves = getAvailableMoves(next);

    return (
      rivalMoves.length > 0 &&
      rivalMoves.every((rivalMove) => {
        const reply = [...next];
        reply[rivalMove] = rival;

        if (evaluateClassicBoard(reply).isComplete) {
          return false;
        }

        return findClassicWinningMove(reply, player) !== null;
      })
    );
  });
};

export const findClassicWinInTwo = (board: Board, player: Player) =>
  findClassicWinInTwoMoves(board, player)[0] ?? null;

const boardWithMarks = (marks: Array<[number, Player]>) => {
  const board = createBoard();

  for (const [index, player] of marks) {
    board[index] = player;
  }

  return board;
};

const formatCell = (move: number | null) => (move === null ? '-' : `${move + 1}`);
const createPuzzleKey = (dateKey: string, kind: DailyPuzzleKind) =>
  `${dateKey}:${kind}:v${DAILY_PUZZLE_REVISION}`;

const createDateSeed = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(
    day,
  ).padStart(2, '0')}`;
  const localDay = Date.UTC(year, month, day);
  const id = Math.max(1, Math.floor((localDay - DAILY_EPOCH) / DAY_MS) + 1);

  return { dateKey, id };
};

const createBestLinesPuzzle = (
  dateKey: string,
  id: number,
): DailyPuzzle => {
  const board = boardWithMarks([
    [0, 'X'],
    [1, 'X'],
    [13, 'O'],
    [26, 'O'],
  ]);
  const best = findBestScoringMove(board, 'X', 'lines');

  return {
    bestMove: best.move,
    board,
    dateKey,
    explanation: `Cell ${formatCell(best.move)} completes the cleanest Lines score and protects the margin.`,
    id,
    kind: 'best-lines',
    player: 'X',
    puzzleKey: createPuzzleKey(dateKey, 'best-lines'),
    prompt: 'Find the best Lines move',
    ruleset: 'lines',
    shareText: `TicTacube Daily #${id} \u2014 solved in 1`,
    title: 'Best Lines move',
  };
};

const createMaxLinesPuzzle = (
  dateKey: string,
  id: number,
): DailyPuzzle => {
  const board = boardWithMarks([
    [0, 'X'],
    [2, 'X'],
    [6, 'X'],
    [8, 'X'],
    [18, 'X'],
    [20, 'X'],
    [24, 'X'],
    [26, 'X'],
    [1, 'O'],
    [3, 'O'],
    [5, 'O'],
    [7, 'O'],
  ]);
  const best = findMaxLineMove(board, 'X');

  return {
    bestMove: best.move,
    board,
    dateKey,
    explanation: `Cell ${formatCell(best.move)} scores four space diagonals at once.`,
    id,
    kind: 'max-lines',
    player: 'X',
    puzzleKey: createPuzzleKey(dateKey, 'max-lines'),
    prompt: 'Score the most lines',
    ruleset: 'lines',
    shareText: `TicTacube Daily #${id} \u2014 solved in 1`,
    title: 'Most lines',
  };
};

const createClassicWinPuzzle = (
  dateKey: string,
  id: number,
): DailyPuzzle => {
  const board = boardWithMarks([
    [9, 'X'],
    [10, 'X'],
    [13, 'O'],
    [14, 'O'],
  ]);
  const bestMove = findClassicWinningMove(board, 'X');

  return {
    bestMove,
    board,
    dateKey,
    explanation: `Cell ${formatCell(bestMove)} finishes the middle-floor row for X.`,
    id,
    kind: 'classic-win',
    player: 'X',
    puzzleKey: createPuzzleKey(dateKey, 'classic-win'),
    prompt: 'Find the Classic win',
    ruleset: 'classic',
    shareText: `TicTacube Daily #${id} \u2014 solved in 1`,
    title: 'Classic finish',
  };
};

const createClassicWinInTwoPuzzle = (
  dateKey: string,
  id: number,
): DailyPuzzle => {
  const board = boardWithMarks([
    [4, 'X'],
    [15, 'X'],
    [12, 'O'],
    [18, 'O'],
  ]);
  const bestMove = findClassicWinInTwo(board, 'X');

  return {
    bestMove,
    board,
    dateKey,
    explanation: `Cell ${formatCell(bestMove)} creates two Classic threats, so O cannot cover both.`,
    id,
    kind: 'classic-win-two',
    player: 'X',
    puzzleKey: createPuzzleKey(dateKey, 'classic-win-two'),
    prompt: 'Find the Classic win in two',
    ruleset: 'classic',
    shareText: `TicTacube Daily #${id} \u2014 solved in 1`,
    title: 'Win in two',
  };
};

const dailyPuzzleFactories = [
  createBestLinesPuzzle,
  createMaxLinesPuzzle,
  createClassicWinPuzzle,
  createClassicWinInTwoPuzzle,
];

export const getDailyPuzzle = (date = new Date()): DailyPuzzle => {
  const { dateKey, id } = createDateSeed(date);
  const factory = dailyPuzzleFactories[(id - 1) % dailyPuzzleFactories.length];

  return factory(dateKey, id);
};

export const evaluateDailyPuzzleMove = (
  puzzle: DailyPuzzle,
  move: number,
): DailyPuzzleResult => {
  const solved = move === puzzle.bestMove;
  const playerMoveText = `Cell ${formatCell(move)}`;
  const bestMoveText = `Cell ${formatCell(puzzle.bestMove)}`;
  const explanation = solved
    ? `${playerMoveText} is right. ${puzzle.explanation}`
    : `${bestMoveText} was the best move. ${puzzle.explanation}`;

  return {
    bestMove: puzzle.bestMove,
    dateKey: puzzle.dateKey,
    explanation,
    move,
    puzzleKey: puzzle.puzzleKey,
    shareText: puzzle.shareText,
    solved,
  };
};

export const loadDailyPuzzleResult = (
  puzzle: Pick<DailyPuzzle, 'bestMove' | 'dateKey' | 'puzzleKey'>,
): DailyPuzzleResult | null => {
  try {
    const raw = window.localStorage.getItem(DAILY_RESULT_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as DailyPuzzleResult;

    if (
      parsed?.dateKey === puzzle.dateKey &&
      parsed?.puzzleKey === puzzle.puzzleKey &&
      parsed?.bestMove === puzzle.bestMove &&
      (typeof parsed.move === 'number' || parsed.move === null) &&
      (typeof parsed.bestMove === 'number' || parsed.bestMove === null) &&
      typeof parsed.explanation === 'string' &&
      typeof parsed.puzzleKey === 'string' &&
      typeof parsed.shareText === 'string' &&
      typeof parsed.solved === 'boolean'
    ) {
      return parsed;
    }
  } catch {
    // best-effort persistence only
  }

  return null;
};

export const saveDailyPuzzleResult = (result: DailyPuzzleResult) => {
  try {
    window.localStorage.setItem(DAILY_RESULT_KEY, JSON.stringify(result));
  } catch {
    // best-effort persistence only
  }
};
