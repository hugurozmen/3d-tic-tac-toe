import { getOtherPlayer, type Player } from './rules';

export type Score = Record<Player | 'draws', number>;

export type MatchState = {
  isComplete: boolean;
  nextOpener: Player;
  opener: Player;
  roundNumber: number;
  score: Score;
  targetWins: number;
  winner: Player | null;
};

export const MATCH_TARGET_WINS = 3;

export const createScore = (): Score => ({
  X: 0,
  O: 0,
  draws: 0,
});

export const createMatchState = (opener: Player = 'X'): MatchState => ({
  isComplete: false,
  nextOpener: getOtherPlayer(opener),
  opener,
  roundNumber: 1,
  score: createScore(),
  targetWins: MATCH_TARGET_WINS,
  winner: null,
});

export const recordMatchRound = (
  match: MatchState,
  winner: Player | null,
  isDraw: boolean,
): MatchState => {
  if (match.isComplete) {
    return match;
  }

  const score = { ...match.score };

  if (winner) {
    score[winner] += 1;
  } else if (isDraw) {
    score.draws += 1;
  }

  const matchWinner =
    score.X >= match.targetWins ? 'X' : score.O >= match.targetWins ? 'O' : null;

  return {
    ...match,
    isComplete: Boolean(matchWinner),
    score,
    winner: matchWinner,
  };
};

export const advanceMatchRound = (
  match: MatchState,
  opener: Player = match.nextOpener,
): MatchState => ({
  ...match,
  nextOpener: getOtherPlayer(opener),
  opener,
  roundNumber: match.roundNumber + 1,
});

/**
 * The match engine records wins by mark, while Solo presents them by
 * participant. When the Classic Pie Rule swaps who controls X and O, remap
 * score and opener mark buckets so earlier wins and alternation stay with the
 * same people.
 */
export const remapMatchForSideSwap = (match: MatchState): MatchState => ({
  ...match,
  nextOpener: getOtherPlayer(match.nextOpener),
  opener: getOtherPlayer(match.opener),
  score: {
    X: match.score.O,
    O: match.score.X,
    draws: match.score.draws,
  },
  winner: match.winner ? getOtherPlayer(match.winner) : null,
});
