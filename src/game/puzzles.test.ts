import { describe, expect, it } from 'vitest';
import { evaluateDailyPuzzleMove, getDailyPuzzle } from './puzzles';

describe('daily puzzle selection', () => {
  it('uses a deterministic local date seed', () => {
    const puzzle = getDailyPuzzle(new Date(2026, 0, 1));
    const sameDay = getDailyPuzzle(new Date(2026, 0, 1, 22, 45));

    expect(puzzle.id).toBe(1);
    expect(puzzle.dateKey).toBe('2026-01-01');
    expect(sameDay.id).toBe(puzzle.id);
    expect(sameDay.kind).toBe(puzzle.kind);
  });

  it('rotates through every visible puzzle type', () => {
    const puzzles = [0, 1, 2, 3].map((offset) =>
      getDailyPuzzle(new Date(2026, 0, 1 + offset)),
    );

    expect(puzzles.map((puzzle) => puzzle.prompt)).toEqual([
      'Find the best Lines move',
      'Score the most lines',
      'Find the Classic win',
      'Find the Classic win in two',
    ]);
    expect(puzzles.every((puzzle) => puzzle.bestMove !== null)).toBe(true);
  });

  it('reports the best move, player move, explanation, and share text', () => {
    const puzzle = getDailyPuzzle(new Date(2026, 0, 2));
    const result = evaluateDailyPuzzleMove(puzzle, puzzle.bestMove ?? 0);

    expect(result.solved).toBe(true);
    expect(result.bestMove).toBe(puzzle.bestMove);
    expect(result.move).toBe(puzzle.bestMove);
    expect(result.explanation).toContain('is right');
    expect(result.shareText).toBe('3D XOX Daily #2 — solved in 1');
  });

  it('keeps a missed answer explanatory', () => {
    const puzzle = getDailyPuzzle(new Date(2026, 0, 3));
    const wrongMove = puzzle.board.findIndex((cell, index) => {
      return !cell && index !== puzzle.bestMove;
    });
    const result = evaluateDailyPuzzleMove(puzzle, wrongMove);

    expect(result.solved).toBe(false);
    expect(result.explanation).toContain('was the best move');
  });
});
