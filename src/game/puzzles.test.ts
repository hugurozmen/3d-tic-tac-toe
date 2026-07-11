import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateDailyPuzzleMove,
  findClassicWinningMove,
  findClassicWinInTwo,
  findClassicWinInTwoMoves,
  getDailyPuzzle,
  loadDailyPuzzleResult,
  saveDailyPuzzleResult,
} from './puzzles';
import {
  createBoard,
  evaluateClassicBoard,
  getAvailableMoves,
} from './rules';

describe('daily puzzle selection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('rejects a saved answer from an older puzzle revision', () => {
    const values = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    vi.stubGlobal('window', { localStorage });
    const puzzle = getDailyPuzzle(new Date(2026, 0, 4));
    const result = evaluateDailyPuzzleMove(puzzle, puzzle.bestMove ?? 0);

    saveDailyPuzzleResult(result);
    expect(loadDailyPuzzleResult(puzzle)).toEqual(result);

    values.set(
      '3dxox-daily-puzzle-result',
      JSON.stringify({ ...result, puzzleKey: `${result.puzzleKey}-old` }),
    );
    expect(loadDailyPuzzleResult(puzzle)).toBeNull();
  });
});

describe('Classic win-in-two puzzles', () => {
  it('enumerates every immediate winning move in the plural helper', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    board[3] = 'X';

    expect(findClassicWinInTwoMoves(board, 'X')).toEqual([2, 6]);
  });

  it('rejects a fork when the opponent can win instead of answering it', () => {
    const board = createBoard();
    board[0] = 'X';
    board[2] = 'X';
    board[1] = 'O';
    board[10] = 'O';

    const unsafeFork = [...board];
    unsafeFork[4] = 'X';
    const winningReply = [...unsafeFork];
    winningReply[19] = 'O';

    expect(evaluateClassicBoard(winningReply).winner).toBe('O');
    expect(findClassicWinInTwo(board, 'X')).toBeNull();
  });

  it('validates every opponent reply in the recurring forced win-in-two', () => {
    const puzzle = getDailyPuzzle(new Date(2026, 0, 4));

    expect(puzzle.kind).toBe('classic-win-two');
    expect(puzzle.bestMove).toBe(6);
    expect(findClassicWinningMove(puzzle.board, 'X')).toBeNull();
    expect(findClassicWinInTwo(puzzle.board, 'X')).toBe(puzzle.bestMove);
    expect(findClassicWinInTwoMoves(puzzle.board, 'X')).toEqual([
      puzzle.bestMove,
    ]);

    const afterFirstMove = [...puzzle.board];
    afterFirstMove[puzzle.bestMove as number] = 'X';
    expect(evaluateClassicBoard(afterFirstMove).isComplete).toBe(false);

    const replies = getAvailableMoves(afterFirstMove);
    expect(replies.length).toBeGreaterThan(0);

    for (const replyMove of replies) {
      const afterReply = [...afterFirstMove];
      afterReply[replyMove] = 'O';
      const replyLabel = `O reply at cell ${replyMove + 1}`;

      expect(evaluateClassicBoard(afterReply).isComplete, replyLabel).toBe(false);

      const winningMove = findClassicWinningMove(afterReply, 'X');
      expect(winningMove, replyLabel).not.toBeNull();

      const finish = [...afterReply];
      finish[winningMove as number] = 'X';
      expect(evaluateClassicBoard(finish).winner, replyLabel).toBe('X');
    }
  });
});
