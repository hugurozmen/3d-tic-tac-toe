import { describe, expect, it } from 'vitest';
import {
  CENTER_NORMALIZED_LINE_WEIGHT,
  getLineVariantWeight,
  getVariantScoresForBoard,
  getVariantWinner,
} from './linesVariant';
import { createBoard } from './rules';

describe('audit-only Lines variants', () => {
  it('keeps standard line weights unchanged', () => {
    expect(getLineVariantWeight([0, 13, 26], 'standard')).toBe(1);
    expect(getLineVariantWeight([0, 1, 2], 'standard')).toBe(1);
  });

  it('discounts center-crossing lines only in the center-normalized variant', () => {
    expect(getLineVariantWeight([0, 13, 26], 'center-normalized')).toBe(
      CENTER_NORMALIZED_LINE_WEIGHT,
    );
    expect(getLineVariantWeight([0, 1, 2], 'center-normalized')).toBe(1);
  });

  it('can score a completed board without changing default rules', () => {
    const board = createBoard();
    board[0] = 'X';
    board[13] = 'X';
    board[26] = 'X';
    board[3] = 'O';
    board[4] = 'O';
    board[5] = 'O';

    expect(getVariantScoresForBoard(board, 'standard')).toEqual({ O: 1, X: 1 });
    expect(getVariantScoresForBoard(board, 'center-normalized')).toEqual({
      O: 1,
      X: CENTER_NORMALIZED_LINE_WEIGHT,
    });
    expect(getVariantWinner(getVariantScoresForBoard(board, 'center-normalized'))).toBe(
      'O',
    );
  });
});
