import { describe, expect, it } from 'vitest';
import { getCoachHints } from './coach';
import { getCoachLadder } from './coachLadder';
import { createBoard } from './rules';

describe('Coach auto ladder', () => {
  it('shows full Auto hints during early local rounds', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    const hints = getCoachHints(board, 'X');

    const ladder = getCoachLadder({
      completedLocalRounds: 0,
      hints,
      mode: 'solo',
      setting: 'auto',
    });

    expect(ladder.enabled).toBe(true);
    expect(ladder.phase).toBe('full');
    expect(ladder.hints.every((hint) => hint.visibility === 'full')).toBe(true);
    expect(ladder.softScoreCells).toEqual([]);
  });

  it('softens score-only Auto hints after early local rounds', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    const hints = getCoachHints(board, 'X');

    const ladder = getCoachLadder({
      completedLocalRounds: 3,
      hints,
      mode: 'solo',
      setting: 'auto',
    });

    expect(ladder.phase).toBe('ladder');
    expect(ladder.softScoreCells).toEqual([2]);
    expect(ladder.fullHints).toEqual([]);
  });

  it('keeps block and combined hints explicit in Auto ladder mode', () => {
    const board = createBoard();
    board[0] = 'O';
    board[1] = 'O';
    board[5] = 'X';
    board[8] = 'X';
    const hints = getCoachHints(board, 'O');

    const ladder = getCoachLadder({
      completedLocalRounds: 7,
      hints,
      mode: 'solo',
      setting: 'auto',
    });

    expect(ladder.fullHints.map((hint) => hint.cell)).toContain(2);
    expect(ladder.hints.find((hint) => hint.cell === 2)?.visibility).toBe('full');
  });

  it('keeps Coach On fully explicit regardless of local round count', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    const hints = getCoachHints(board, 'X');

    const ladder = getCoachLadder({
      completedLocalRounds: 12,
      hints,
      mode: 'solo',
      setting: 'on',
    });

    expect(ladder.phase).toBe('full');
    expect(ladder.softScoreCells).toEqual([]);
  });
});
