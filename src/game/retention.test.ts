import { describe, expect, it } from 'vitest';
import {
  createRetentionStats,
  getThemeUnlockProgress,
  updateDifficultyStreak,
  updateRetentionStats,
} from './retention';
import { createBoard, evaluateClassicBoard, evaluateLinesBoard } from './rules';

describe('visible retention progress', () => {
  it('tracks Lines totals and best human win margin separately', () => {
    const board = createBoard();
    board.fill('X');

    const stats = updateRetentionStats(createRetentionStats(), {
      difficulty: 'balanced',
      humanSide: 'X',
      outcome: 'win',
      result: evaluateLinesBoard(board),
    });

    expect(stats.totalLinesScored).toBe(49);
    expect(stats.bestLinesWinMargin).toBe(49);
    expect(stats.masterWins).toBe(0);
  });

  it('counts Master wins without adding Classic rounds to Lines totals', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    board[2] = 'X';

    const stats = updateRetentionStats(createRetentionStats(), {
      difficulty: 'master',
      humanSide: 'X',
      outcome: 'win',
      result: evaluateClassicBoard(board),
    });

    expect(stats.masterWins).toBe(1);
    expect(stats.totalLinesScored).toBe(0);
    expect(stats.bestLinesWinMargin).toBe(0);
  });

  it('resets only the active difficulty streak on non-wins', () => {
    const streaks = { easy: 2, balanced: 3, hard: 1, master: 0 };

    expect(updateDifficultyStreak(streaks, 'balanced', 'draw')).toEqual({
      easy: 2,
      balanced: 0,
      hard: 1,
      master: 0,
    });
  });

  it('makes theme accent progress visible before unlocks land', () => {
    const progress = getThemeUnlockProgress({
      easy: 0,
      balanced: 2,
      hard: 0,
      master: 0,
    });

    expect(progress[0]).toMatchObject({
      id: 'ranked-focus',
      unlocked: false,
      valueText: '2/3 Smart',
    });
    expect(progress[0].progress).toBeGreaterThan(0.6);
  });

  it('keeps persisted theme accents visible after a streak reset', () => {
    const progress = getThemeUnlockProgress(
      {
        easy: 0,
        balanced: 0,
        hard: 0,
        master: 0,
      },
      ['ranked-focus'],
    );

    expect(progress[0]).toMatchObject({
      id: 'ranked-focus',
      unlocked: true,
      valueText: 'Accent ready',
    });
  });
});
