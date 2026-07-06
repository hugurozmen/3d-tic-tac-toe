import { chooseAiMove } from './ai';
import {
  Board,
  GameRuleset,
  Player,
  evaluateClassicBoard,
  getAvailableMoves,
  getLineScores,
  getNewCompletedLines,
  getOtherPlayer,
} from './rules';

export type PuzzleMove = {
  move: number | null;
  score: number;
};

const scoreDeltaAfterMove = (board: Board, player: Player, move: number) => {
  const before = getLineScores(board);
  const next = [...board];
  next[move] = player;
  const after = getLineScores(next);
  const rival = getOtherPlayer(player);

  return after[player] - before[player] - (after[rival] - before[rival]);
};

const findClassicWinningMove = (board: Board, player: Player) =>
  getAvailableMoves(board).find((move) => {
    const next = [...board];
    next[move] = player;
    return evaluateClassicBoard(next).winner === player;
  }) ?? null;

export const findMaxLineMove = (board: Board, player: Player): PuzzleMove => {
  const ranked = getAvailableMoves(board)
    .map((move) => {
      const next = [...board];
      next[move] = player;

      return {
        move,
        score:
          getNewCompletedLines(board, next, player).length * 100 +
          scoreDeltaAfterMove(board, player, move),
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0] ?? { move: null, score: 0 };
};

export const findBestScoringMove = (
  board: Board,
  player: Player,
  ruleset: GameRuleset = 'lines',
): PuzzleMove => {
  if (ruleset === 'classic') {
    const move = chooseAiMove(board, player, 'master', 'classic');
    return { move, score: move === null ? 0 : 1 };
  }

  const maxLineMove = findMaxLineMove(board, player);

  if (maxLineMove.score > 0) {
    return maxLineMove;
  }

  const move = chooseAiMove(board, player, 'master', 'lines');
  return { move, score: move === null ? 0 : scoreDeltaAfterMove(board, player, move) };
};

export const findClassicWinInTwo = (board: Board, player: Player) => {
  const immediate = findClassicWinningMove(board, player);

  if (immediate !== null) {
    return immediate;
  }

  const rival = getOtherPlayer(player);

  return (
    getAvailableMoves(board).find((move) => {
      const next = [...board];
      next[move] = player;

      return getAvailableMoves(next).every((rivalMove) => {
        const reply = [...next];
        reply[rivalMove] = rival;
        return findClassicWinningMove(reply, player) !== null;
      });
    }) ?? null
  );
};
