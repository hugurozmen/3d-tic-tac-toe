import { describe, expect, it } from 'vitest';
import { chooseAiMove } from './ai';
import {
  DIFFICULTY_OPTIONS,
  RULESET_OPTIONS,
} from './options';
import { Board, createBoard } from './rules';

const randomSequence = (values: number[]) => {
  let index = 0;

  return () => values[index++] ?? values[values.length - 1] ?? 0.5;
};

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
    expect(chooseAiMove(board, 'O', 'balanced', 'lines')).toBe(2);
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

  it('keeps Casual line-aware without making it purely deterministic', () => {
    const board = createBoard();
    board[0] = 'O';
    board[1] = 'O';

    expect(
      chooseAiMove(board, 'O', 'easy', 'lines', {
        random: randomSequence([0.99, 0.01]),
      }),
    ).toBe(2);
  });
});

describe('Classic AI tactics', () => {
  it('takes immediate wins and blocks immediate losses on stronger levels', () => {
    const winBoard = createBoard();
    winBoard[9] = 'O';
    winBoard[10] = 'O';

    expect(chooseAiMove(winBoard, 'O', 'master', 'classic')).toBe(11);

    const blockBoard = createBoard();
    blockBoard[0] = 'X';
    blockBoard[1] = 'X';
    blockBoard[13] = 'O';

    expect(chooseAiMove(blockBoard, 'O', 'balanced', 'classic')).toBe(2);
    expect(chooseAiMove(blockBoard, 'O', 'master', 'classic')).toBe(2);
  });
});

describe('AI legal move guardrails', () => {
  it('returns legal moves across rulesets and difficulties', () => {
    const board: Board = createBoard();

    for (const index of [0, 4, 8, 10, 13, 21]) {
      board[index] = index % 2 === 0 ? 'X' : 'O';
    }

    for (const ruleset of RULESET_OPTIONS) {
      for (const difficulty of DIFFICULTY_OPTIONS) {
        const move = chooseAiMove(board, 'O', difficulty, ruleset, {
          random: randomSequence([0.93, 0.2, 0.7]),
        });

        expect(move).not.toBeNull();
        expect(board[move as number]).toBeNull();
      }
    }
  });
});
