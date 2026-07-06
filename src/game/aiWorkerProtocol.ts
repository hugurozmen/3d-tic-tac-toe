import { chooseAiMove } from './ai';
import { CELL_COUNT, PLAYERS } from './rules';
import type { Board, Difficulty, GameRuleset, Player } from './rules';

export type AiWorkerRequest = {
  board: Board;
  difficulty: Difficulty;
  id: number;
  player: Player;
  ruleset: GameRuleset;
};

export type AiWorkerResponse = {
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

export const isAiWorkerRequest = (value: unknown): value is AiWorkerRequest => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const request = value as Partial<AiWorkerRequest>;

  return (
    Number.isInteger(request.id) &&
    isBoard(request.board) &&
    PLAYERS.includes(request.player as Player) &&
    DIFFICULTIES.includes(request.difficulty as Difficulty) &&
    RULESETS.includes(request.ruleset as GameRuleset)
  );
};

const getRequestId = (value: unknown) => {
  if (!value || typeof value !== 'object' || !('id' in value)) {
    return -1;
  }

  const id = (value as { id?: unknown }).id;

  return Number.isInteger(id) ? Number(id) : -1;
};

export const resolveAiWorkerMessage = (
  value: unknown,
  now: () => number = () => performance.now(),
): AiWorkerResponse => {
  const startedAt = now();

  if (!isAiWorkerRequest(value)) {
    return {
      durationMs: now() - startedAt,
      error: 'invalid-request',
      id: getRequestId(value),
      move: null,
    };
  }

  const { board, difficulty, id, player, ruleset } = value;

  try {
    return {
      durationMs: now() - startedAt,
      id,
      move: chooseAiMove(board, player, difficulty, ruleset),
    };
  } catch {
    return {
      durationMs: now() - startedAt,
      error: 'move-failed',
      id,
      move: null,
    };
  }
};
