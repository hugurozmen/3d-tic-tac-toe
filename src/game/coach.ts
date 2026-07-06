import {
  Board,
  Player,
  getLineThreats,
  getOtherPlayer,
  toCoordinate,
} from './rules';

export type CoachHintKind = 'score' | 'block' | 'both';
export type CoachLineKind = 'score' | 'block';

export type CoachHint = {
  accessibleLabel: string;
  blockLines: number[][];
  cell: number;
  explanation: string;
  floorSpan: number[];
  isCrossFloor: boolean;
  kind: CoachHintKind;
  primaryLine: number[];
  primaryLineKind: CoachLineKind;
  scoreLines: number[][];
  shortLabel: string;
};

const floorOf = (index: number) => toCoordinate(index).z + 1;

const formatCells = (line: number[]) =>
  line.map((index) => index + 1).join('-');

const getFloorSpan = (line: number[]) =>
  Array.from(new Set(line.map(floorOf))).sort((a, b) => a - b);

const lineText = (line: number[]) => {
  const floors = getFloorSpan(line);
  const floorText =
    floors.length === 1 ? `floor ${floors[0]}` : `floors ${floors.join('-')}`;

  return `cells ${formatCells(line)} on ${floorText}`;
};

const combineKind = (hasScore: boolean, hasBlock: boolean): CoachHintKind => {
  if (hasScore && hasBlock) {
    return 'both';
  }

  return hasScore ? 'score' : 'block';
};

const getEmptyCell = (board: Board, line: number[]) =>
  line.find((index) => board[index] === null);

export const getCoachHints = (
  board: Board,
  player: Player,
): CoachHint[] => {
  const rival = getOtherPlayer(player);
  const hintMap = new Map<number, { blockLines: number[][]; scoreLines: number[][] }>();

  for (const line of getLineThreats(board, player)) {
    const cell = getEmptyCell(board, line);

    if (cell === undefined) {
      continue;
    }

    const hint = hintMap.get(cell) ?? { blockLines: [], scoreLines: [] };
    hint.scoreLines.push(line);
    hintMap.set(cell, hint);
  }

  for (const line of getLineThreats(board, rival)) {
    const cell = getEmptyCell(board, line);

    if (cell === undefined) {
      continue;
    }

    const hint = hintMap.get(cell) ?? { blockLines: [], scoreLines: [] };
    hint.blockLines.push(line);
    hintMap.set(cell, hint);
  }

  return Array.from(hintMap.entries())
    .map(([cell, hint]) => {
      const hasScore = hint.scoreLines.length > 0;
      const hasBlock = hint.blockLines.length > 0;
      const kind = combineKind(hasScore, hasBlock);
      const primaryLine = hint.scoreLines[0] ?? hint.blockLines[0] ?? [];
      const primaryLineKind: CoachLineKind = hint.scoreLines[0]
        ? 'score'
        : 'block';
      const floorSpan = getFloorSpan(primaryLine);
      const isCrossFloor = floorSpan.length > 1;
      const scoreText = hint.scoreLines[0]
        ? `scores on ${lineText(hint.scoreLines[0])}`
        : '';
      const blockText = hint.blockLines[0]
        ? `blocks ${rival} on ${lineText(hint.blockLines[0])}`
        : '';
      const explanation =
        kind === 'both'
          ? `Cell ${cell + 1} ${scoreText} and ${blockText}.`
          : kind === 'score'
            ? `Cell ${cell + 1} ${scoreText}.`
            : `Cell ${cell + 1} ${blockText}.`;
      const accessibleLabel =
        kind === 'both'
          ? `completes a line through ${lineText(
              hint.scoreLines[0],
            )} and blocks ${rival} through ${lineText(hint.blockLines[0])}`
          : kind === 'score'
            ? `completes a line through ${lineText(hint.scoreLines[0])}`
            : `blocks ${rival} through ${lineText(hint.blockLines[0])}`;
      const shortLabel =
        kind === 'both'
          ? `Score + block: ${formatCells(primaryLine)}`
          : kind === 'score'
            ? `Score: ${formatCells(primaryLine)}`
            : `Block: ${formatCells(primaryLine)}`;

      return {
        accessibleLabel,
        blockLines: hint.blockLines,
        cell,
        explanation,
        floorSpan,
        isCrossFloor,
        kind,
        primaryLine,
        primaryLineKind,
        scoreLines: hint.scoreLines,
        shortLabel,
      };
    })
    .sort((a, b) => {
      const rank: Record<CoachHintKind, number> = {
        both: 0,
        score: 1,
        block: 2,
      };

      return rank[a.kind] - rank[b.kind] || a.cell - b.cell;
    });
};
