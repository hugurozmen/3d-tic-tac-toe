import { chooseAiMove } from './ai';
import { CELL_COUNT, PLAYERS } from './rules';
import type { Board, Difficulty, GameRuleset, Player } from './rules';

type AiRequest = {
  board: Board;
  difficulty: Difficulty;
  id: number;
  player: Player;
  ruleset: GameRuleset;
};

type AiResponse = {
  durationMs: number;
  error?: string;
  id: number;
  move: number | null;
};

const DIFFICULTIES: Difficulty[] = ['easy', 'balanced', 'hard', 'master'];
const RULESETS: GameRuleset[] = ['lines', 'classic'];

const isBoard = (board: unknown): board is Board =>
  Array.isArray(board) &&
  board.length === CELL_COUNT &&
  board.every((cell) => cell === null || PLAYERS.includes(cell));

const isAiRequest = (value: unknown): value is AiRequest => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const request = value as Partial<AiRequest>;

  return (
    Number.isInteger(request.id) &&
    isBoard(request.board) &&
    PLAYERS.includes(request.player as Player) &&
    DIFFICULTIES.includes(request.difficulty as Difficulty) &&
    RULESETS.includes(request.ruleset as GameRuleset)
  );
};

const postResponse = (response: AiResponse) => {
  self.postMessage(response);
};

const getRequestId = (value: unknown) => {
  if (!value || typeof value !== 'object' || !('id' in value)) {
    return -1;
  }

  const id = (value as { id?: unknown }).id;

  return Number.isInteger(id) ? Number(id) : -1;
};

self.onmessage = (event: MessageEvent<unknown>) => {
  const startedAt = performance.now();

  if (!isAiRequest(event.data)) {
    postResponse({
      durationMs: performance.now() - startedAt,
      error: 'invalid-request',
      id: getRequestId(event.data),
      move: null,
    });
    return;
  }

  const { board, difficulty, id, player, ruleset } = event.data;

  try {
    const move = chooseAiMove(board, player, difficulty, ruleset);

    postResponse({
      durationMs: performance.now() - startedAt,
      id,
      move,
    });
  } catch {
    postResponse({
      durationMs: performance.now() - startedAt,
      error: 'move-failed',
      id,
      move: null,
    });
  }
};
