import {
  Board,
  Player,
  getAvailableMoves,
  getLineThreats,
  getNewCompletedLines,
  getOtherPlayer,
} from './rules';

export type LinesEndgameCell = {
  blockLines: number;
  cell: number;
  scoreLines: number;
};

export type LinesEndgameAnalysis = {
  blockingCells: number[];
  cells: LinesEndgameCell[];
  maxBlockLines: number;
  maxScoreLines: number;
  remainingCells: number;
  scoringCells: number[];
  text: string;
};

export const getLinesEndgameAnalysis = (
  board: Board,
  currentPlayer: Player,
): LinesEndgameAnalysis | null => {
  const availableMoves = getAvailableMoves(board);
  const remainingCells = availableMoves.length;

  if (remainingCells === 0 || remainingCells > 6) {
    return null;
  }

  const rival = getOtherPlayer(currentPlayer);
  const rivalThreats = getLineThreats(board, rival);
  const cells = availableMoves.map<LinesEndgameCell>((cell) => {
    const next = [...board];

    next[cell] = currentPlayer;

    return {
      blockLines: rivalThreats.filter((line) => {
        const emptyCell = line.find((index) => board[index] === null);

        return emptyCell === cell;
      }).length,
      cell,
      scoreLines: getNewCompletedLines(board, next, currentPlayer).length,
    };
  });
  const maxScoreLines = Math.max(0, ...cells.map((cell) => cell.scoreLines));
  const maxBlockLines = Math.max(0, ...cells.map((cell) => cell.blockLines));
  const scoringCells = cells
    .filter((cell) => cell.scoreLines > 0)
    .map((cell) => cell.cell);
  const blockingCells = cells
    .filter((cell) => cell.blockLines > 0)
    .map((cell) => cell.cell);
  const swingText =
    maxScoreLines > 0 && maxBlockLines > 0
      ? `up to +${maxScoreLines} and ${maxBlockLines} block`
      : maxScoreLines > 0
        ? `up to +${maxScoreLines} line${maxScoreLines === 1 ? '' : 's'}`
        : maxBlockLines > 0
          ? `${maxBlockLines} block${maxBlockLines === 1 ? '' : 's'} live`
          : 'every cell matters';

  return {
    blockingCells,
    cells,
    maxBlockLines,
    maxScoreLines,
    remainingCells,
    scoringCells,
    text: `Final ${remainingCells}: ${swingText}`,
  };
};
