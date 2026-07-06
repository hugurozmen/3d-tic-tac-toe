import { describe, expect, it } from 'vitest';
import { getCoachHints } from './coach';
import { createBoard } from './rules';

describe('Coach geometry hints', () => {
  it('explains a scoring cell with its exact line', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';

    const hints = getCoachHints(board, 'X');
    const hint = hints.find((candidate) => candidate.cell === 2);

    expect(hint?.kind).toBe('score');
    expect(hint?.primaryLine).toEqual([0, 1, 2]);
    expect(hint?.accessibleLabel).toContain('completes a line');
    expect(hint?.explanation).toContain('cells 1-2-3');
  });

  it('explains a blocking cell with the opponent line', () => {
    const board = createBoard();
    board[0] = 'X';
    board[9] = 'X';

    const hints = getCoachHints(board, 'O');
    const hint = hints.find((candidate) => candidate.cell === 18);

    expect(hint?.kind).toBe('block');
    expect(hint?.primaryLine).toEqual([0, 9, 18]);
    expect(hint?.isCrossFloor).toBe(true);
    expect(hint?.floorSpan).toEqual([1, 2, 3]);
    expect(hint?.accessibleLabel).toContain('blocks X');
  });

  it('combines score and block reasons for the same cell', () => {
    const board = createBoard();
    board[0] = 'O';
    board[1] = 'O';
    board[5] = 'X';
    board[8] = 'X';

    const hints = getCoachHints(board, 'O');
    const hint = hints.find((candidate) => candidate.cell === 2);

    expect(hint?.kind).toBe('both');
    expect(hint?.scoreLines).toEqual([[0, 1, 2]]);
    expect(hint?.blockLines).toEqual([[2, 5, 8]]);
    expect(hint?.accessibleLabel).toContain('completes a line');
    expect(hint?.accessibleLabel).toContain('blocks X');
  });
});
