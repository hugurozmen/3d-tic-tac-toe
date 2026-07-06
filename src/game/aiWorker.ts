import { chooseAiMove } from './ai';
import type { Board, Difficulty, Player } from './rules';

type AiRequest = {
  board: Board;
  difficulty: Difficulty;
  id: number;
  player: Player;
};

self.onmessage = (event: MessageEvent<AiRequest>) => {
  const { board, difficulty, id, player } = event.data;
  const move = chooseAiMove(board, player, difficulty);

  self.postMessage({ id, move });
};
