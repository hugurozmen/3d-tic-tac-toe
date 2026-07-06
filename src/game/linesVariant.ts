import {
  Board,
  CompletedLines,
  LineScores,
  Player,
  getCompletedLines,
} from './rules';

export type LinesVariant = 'standard' | 'center-normalized';

export type VariantLineScores = Record<Player, number>;

export const CENTER_NORMALIZED_LINE_WEIGHT = 0.75;
export const CENTER_CELL_INDEX = 13;

export const getLineVariantWeight = (
  line: number[],
  variant: LinesVariant = 'standard',
) =>
  variant === 'center-normalized' && line.includes(CENTER_CELL_INDEX)
    ? CENTER_NORMALIZED_LINE_WEIGHT
    : 1;

export const getVariantLineScores = (
  completedLines: CompletedLines,
  variant: LinesVariant = 'standard',
): VariantLineScores => ({
  X: completedLines.X.reduce(
    (score, line) => score + getLineVariantWeight(line, variant),
    0,
  ),
  O: completedLines.O.reduce(
    (score, line) => score + getLineVariantWeight(line, variant),
    0,
  ),
});

export const getVariantScoresForBoard = (
  board: Board,
  variant: LinesVariant = 'standard',
): VariantLineScores =>
  getVariantLineScores(
    {
      O: getCompletedLines(board, 'O'),
      X: getCompletedLines(board, 'X'),
    },
    variant,
  );

export const normalizeVariantScore = (
  scores: VariantLineScores,
): LineScores => ({
  O: Number(scores.O.toFixed(2)),
  X: Number(scores.X.toFixed(2)),
});

export const getVariantWinner = (
  scores: VariantLineScores,
): Player | null => {
  if (scores.X === scores.O) {
    return null;
  }

  return scores.X > scores.O ? 'X' : 'O';
};
