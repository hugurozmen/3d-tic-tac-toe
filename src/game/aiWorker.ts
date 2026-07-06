import { chooseAiMove } from './ai';
import type { Board, Difficulty, GameRuleset, Player } from './rules';

type AiRequest = {
  board: Board;
  difficulty: Difficulty;
  id: number;
  player: Player;
  ruleset: GameRuleset;
};

self.onmessage = (event: MessageEvent<AiRequest>) => {
  const { board, difficulty, id, player, ruleset } = event.data;
  const move = chooseAiMove(board, player, difficulty, ruleset);

  self.postMessage({ id, move });
};
