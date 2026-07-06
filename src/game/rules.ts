export type Player = 'X' | 'O';
export type CellValue = Player | null;
export type Board = CellValue[];
export type Coordinate = {
  x: number;
  y: number;
  z: number;
};

export type GameMode = 'solo' | 'duo' | 'online';
export type GameRuleset = 'lines' | 'classic';
export type Difficulty = 'easy' | 'balanced' | 'hard' | 'master';

export const BOARD_SIZE = 3;
export const CELL_COUNT = BOARD_SIZE ** 3;
export const PLAYERS: Player[] = ['X', 'O'];

export type LineScores = Record<Player, number>;
export type CompletedLines = Record<Player, number[][]>;

export type GameResult = {
  ruleset: GameRuleset;
  winner: Player | null;
  winningLine: number[];
  isDraw: boolean;
  isComplete: boolean;
  lineScores: LineScores;
  completedLines: CompletedLines;
  remainingCells: number;
};

export type ClassicResult = GameResult & {
  ruleset: 'classic';
};

export type LinesResult = GameResult & {
  ruleset: 'lines';
  winningLines: number[][];
};

const inBounds = ({ x, y, z }: Coordinate) =>
  x >= 0 &&
  y >= 0 &&
  z >= 0 &&
  x < BOARD_SIZE &&
  y < BOARD_SIZE &&
  z < BOARD_SIZE;

export const toIndex = ({ x, y, z }: Coordinate) =>
  z * BOARD_SIZE * BOARD_SIZE + y * BOARD_SIZE + x;

export const toCoordinate = (index: number): Coordinate => {
  const z = Math.floor(index / (BOARD_SIZE * BOARD_SIZE));
  const local = index % (BOARD_SIZE * BOARD_SIZE);
  const y = Math.floor(local / BOARD_SIZE);
  const x = local % BOARD_SIZE;

  return { x, y, z };
};

const directions: Coordinate[] = [];

for (let x = -1; x <= 1; x += 1) {
  for (let y = -1; y <= 1; y += 1) {
    for (let z = -1; z <= 1; z += 1) {
      if (x === 0 && y === 0 && z === 0) {
        continue;
      }

      const vector = [x, y, z];
      const firstNonZero = vector.find((value) => value !== 0);

      if (firstNonZero === 1) {
        directions.push({ x, y, z });
      }
    }
  }
}

const createWinningLines = () =>
  Array.from({ length: CELL_COUNT }, (_, index) =>
    toCoordinate(index),
  ).flatMap((start) =>
    directions.flatMap((direction) => {
      const previous = {
        x: start.x - direction.x,
        y: start.y - direction.y,
        z: start.z - direction.z,
      };

      if (inBounds(previous)) {
        return [];
      }

      const line = Array.from({ length: BOARD_SIZE }, (_, step) => ({
        x: start.x + direction.x * step,
        y: start.y + direction.y * step,
        z: start.z + direction.z * step,
      }));

      return line.every(inBounds) ? [line.map(toIndex)] : [];
    }),
  );

const lineKey = (line: number[]) => [...line].sort((a, b) => a - b).join('-');

const assertWinningLines = (lines: number[][]) => {
  const unique = new Set(lines.map(lineKey));

  if (
    lines.length !== 49 ||
    unique.size !== 49 ||
    lines.some((line) => line.length !== BOARD_SIZE)
  ) {
    throw new Error('3D XOX requires exactly 49 unique 3-cell lines.');
  }
};

export const WINNING_LINES = createWinningLines();

assertWinningLines(WINNING_LINES);

export const getAllLines = () => WINNING_LINES.map((line) => [...line]);

export const createBoard = (): Board => Array<CellValue>(CELL_COUNT).fill(null);

export const getOtherPlayer = (player: Player): Player =>
  player === 'X' ? 'O' : 'X';

export const getAvailableMoves = (board: Board) =>
  board.reduce<number[]>((moves, cell, index) => {
    if (!cell) {
      moves.push(index);
    }

    return moves;
  }, []);

export const countMarks = (board: Board, player: Player) =>
  board.filter((cell) => cell === player).length;

export const getCompletedLines = (board: Board, player: Player) =>
  WINNING_LINES.filter((line) => line.every((index) => board[index] === player));

export const getLineScores = (board: Board): LineScores => ({
  X: getCompletedLines(board, 'X').length,
  O: getCompletedLines(board, 'O').length,
});

export const getCompletedLineKeys = (board: Board) => ({
  X: new Set(getCompletedLines(board, 'X').map(lineKey)),
  O: new Set(getCompletedLines(board, 'O').map(lineKey)),
});

export const getNewCompletedLines = (
  previous: Board,
  next: Board,
  player: Player,
) => {
  const previousKeys = new Set(getCompletedLines(previous, player).map(lineKey));

  return getCompletedLines(next, player).filter(
    (line) => !previousKeys.has(lineKey(line)),
  );
};

const createCompletedLines = (board: Board): CompletedLines => ({
  X: getCompletedLines(board, 'X'),
  O: getCompletedLines(board, 'O'),
});

export const evaluateClassicBoard = (board: Board): ClassicResult => {
  const completedLines = createCompletedLines(board);
  const lineScores = {
    X: completedLines.X.length,
    O: completedLines.O.length,
  };

  for (const line of WINNING_LINES) {
    const [first, second, third] = line;
    const value = board[first];

    if (value && value === board[second] && value === board[third]) {
      return {
        ruleset: 'classic',
        winner: value,
        winningLine: line,
        isDraw: false,
        isComplete: true,
        lineScores,
        completedLines,
        remainingCells: getAvailableMoves(board).length,
      };
    }
  }

  const remainingCells = getAvailableMoves(board).length;

  return {
    ruleset: 'classic',
    winner: null,
    winningLine: [],
    isDraw: remainingCells === 0,
    isComplete: remainingCells === 0,
    lineScores,
    completedLines,
    remainingCells,
  };
};

export const evaluateLinesBoard = (board: Board): LinesResult => {
  const completedLines = createCompletedLines(board);
  const lineScores = {
    X: completedLines.X.length,
    O: completedLines.O.length,
  };
  const remainingCells = getAvailableMoves(board).length;
  const isComplete = remainingCells === 0;
  const winner =
    isComplete && lineScores.X !== lineScores.O
      ? lineScores.X > lineScores.O
        ? 'X'
        : 'O'
      : null;

  return {
    ruleset: 'lines',
    winner,
    winningLine: [],
    winningLines: winner ? completedLines[winner] : [],
    isDraw: isComplete && lineScores.X === lineScores.O,
    isComplete,
    lineScores,
    completedLines,
    remainingCells,
  };
};

export const evaluateBoard = (
  board: Board,
  ruleset: GameRuleset = 'classic',
): GameResult =>
  ruleset === 'lines' ? evaluateLinesBoard(board) : evaluateClassicBoard(board);

export const getLineThreats = (board: Board, player: Player) =>
  WINNING_LINES.filter((line) => {
    const values = line.map((index) => board[index]);
    return (
      values.filter((value) => value === player).length === BOARD_SIZE - 1 &&
      values.includes(null)
    );
  });

export const getThreatCells = (board: Board, player: Player) =>
  Array.from(
    new Set(
      getLineThreats(board, player)
        .map((line) => line.find((index) => board[index] === null))
        .filter((index): index is number => index !== undefined),
    ),
  );

export const getBlockingCells = (board: Board, player: Player) =>
  getThreatCells(board, getOtherPlayer(player));
