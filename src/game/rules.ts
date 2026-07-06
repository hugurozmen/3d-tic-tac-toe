export type Player = 'X' | 'O';
export type CellValue = Player | null;
export type Board = CellValue[];
export type Coordinate = {
  x: number;
  y: number;
  z: number;
};

export type GameMode = 'solo' | 'duo' | 'online';
export type Difficulty = 'easy' | 'balanced' | 'hard' | 'master';

export const BOARD_SIZE = 3;
export const CELL_COUNT = BOARD_SIZE ** 3;
export const PLAYERS: Player[] = ['X', 'O'];

export type GameResult = {
  winner: Player | null;
  winningLine: number[];
  isDraw: boolean;
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

export const WINNING_LINES = Array.from({ length: CELL_COUNT }, (_, index) =>
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

export const createBoard = (): Board => Array<CellValue>(CELL_COUNT).fill(null);

export const getOtherPlayer = (player: Player): Player =>
  player === 'X' ? 'O' : 'X';

export const evaluateBoard = (board: Board): GameResult => {
  for (const line of WINNING_LINES) {
    const [first, second, third] = line;
    const value = board[first];

    if (value && value === board[second] && value === board[third]) {
      return {
        winner: value,
        winningLine: line,
        isDraw: false,
      };
    }
  }

  return {
    winner: null,
    winningLine: [],
    isDraw: board.every(Boolean),
  };
};

export const getAvailableMoves = (board: Board) =>
  board.reduce<number[]>((moves, cell, index) => {
    if (!cell) {
      moves.push(index);
    }

    return moves;
  }, []);

export const countMarks = (board: Board, player: Player) =>
  board.filter((cell) => cell === player).length;

export const getLineThreats = (board: Board, player: Player) =>
  WINNING_LINES.filter((line) => {
    const values = line.map((index) => board[index]);
    return (
      values.filter((value) => value === player).length === BOARD_SIZE - 1 &&
      values.includes(null)
    );
  });
