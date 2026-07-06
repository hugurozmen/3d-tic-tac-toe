import { describe, expect, it } from 'vitest';
import { chooseAiMove } from './ai';
import { createBoard } from './rules';

describe('Lines Mode AI scoring feel', () => {
  it('prefers an immediate scoring move over taking the center', () => {
    const board = createBoard();
    board[0] = 'O';
    board[1] = 'O';

    expect(chooseAiMove(board, 'O', 'master', 'lines')).toBe(2);
  });

  it('blocks an obvious opponent scoring move', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    board[13] = 'O';

    expect(chooseAiMove(board, 'O', 'master', 'lines')).toBe(2);
  });

  it('recognizes a multi-line scoring move as special', () => {
    const board = createBoard();

    for (const index of [0, 2, 6, 8, 18, 20, 24, 26]) {
      board[index] = 'O';
    }

    for (const index of [1, 3, 5, 7]) {
      board[index] = 'X';
    }

    expect(chooseAiMove(board, 'O', 'master', 'lines')).toBe(13);
  });
});
