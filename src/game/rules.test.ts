import { describe, expect, it } from 'vitest';
import {
  CELL_COUNT,
  createBoard,
  evaluateClassicBoard,
  evaluateLinesBoard,
  getAllLines,
  getBlockingCells,
  getLineScores,
  getThreatCells,
} from './rules';

describe('3D XOX rules engine', () => {
  it('defines exactly 49 unique 3-cell lines', () => {
    const lines = getAllLines();
    const keys = new Set(lines.map((line) => [...line].sort((a, b) => a - b).join('-')));

    expect(lines).toHaveLength(49);
    expect(keys.size).toBe(49);

    for (const line of lines) {
      expect(line).toHaveLength(3);
      expect(new Set(line).size).toBe(3);
      expect(line.every((index) => index >= 0 && index < CELL_COUNT)).toBe(true);
    }

    expect(keys.has('0-1-2')).toBe(true);
    expect(keys.has('0-9-18')).toBe(true);
    expect(keys.has('0-13-26')).toBe(true);
  });

  it('keeps Classic as sudden death', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    board[2] = 'X';

    const result = evaluateClassicBoard(board);

    expect(result.winner).toBe('X');
    expect(result.winningLine).toEqual([0, 1, 2]);
    expect(result.isDraw).toBe(false);
  });

  it('scores a completed line in Lines without ending the round', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    board[2] = 'X';

    const result = evaluateLinesBoard(board);

    expect(result.winner).toBeNull();
    expect(result.isComplete).toBe(false);
    expect(result.remainingCells).toBe(24);
    expect(result.lineScores).toEqual({ X: 1, O: 0 });
  });

  it('finishes Lines only when the board is full and uses line score', () => {
    const board = createBoard();
    board.fill('X');
    const result = evaluateLinesBoard(board);

    expect(result.isComplete).toBe(true);
    expect(result.isDraw).toBe(false);
    expect(result.winner).toBe('X');
    expect(getLineScores(board)).toEqual({ X: 49, O: 0 });
  });

  it('returns shared coach threat and blocking cells', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';

    expect(getThreatCells(board, 'X')).toContain(2);
    expect(getBlockingCells(board, 'O')).toContain(2);
  });
});
