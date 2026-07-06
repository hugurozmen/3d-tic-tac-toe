import { describe, expect, it } from 'vitest';
import {
  advanceMatchRound,
  createMatchState,
  recordMatchRound,
} from './match';

describe('best-of-5 match state', () => {
  it('tracks wins separately from draws and ends at 3 round wins', () => {
    let match = createMatchState('X');

    match = recordMatchRound(match, null, true);
    expect(match.score).toEqual({ X: 0, O: 0, draws: 1 });
    expect(match.winner).toBeNull();

    match = advanceMatchRound(match);
    match = recordMatchRound(match, 'X', false);
    match = advanceMatchRound(match);
    match = recordMatchRound(match, 'O', false);
    match = advanceMatchRound(match);
    match = recordMatchRound(match, 'X', false);
    match = advanceMatchRound(match);
    match = recordMatchRound(match, 'X', false);

    expect(match.score).toEqual({ X: 3, O: 1, draws: 1 });
    expect(match.isComplete).toBe(true);
    expect(match.winner).toBe('X');
  });

  it('alternates openers when advancing completed rounds', () => {
    let match = createMatchState('X');

    expect(match.roundNumber).toBe(1);
    expect(match.opener).toBe('X');
    expect(match.nextOpener).toBe('O');

    match = recordMatchRound(match, 'X', false);
    match = advanceMatchRound(match);

    expect(match.roundNumber).toBe(2);
    expect(match.opener).toBe('O');
    expect(match.nextOpener).toBe('X');
  });
});
