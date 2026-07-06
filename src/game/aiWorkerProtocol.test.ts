import { describe, expect, it } from 'vitest';
import {
  isAiWorkerRequest,
  resolveAiWorkerMessage,
  type AiWorkerRequest,
} from './aiWorkerProtocol';
import { createBoard } from './rules';

const clock = (...ticks: number[]) => {
  let index = 0;

  return () => ticks[index++] ?? ticks[ticks.length - 1] ?? 0;
};

describe('AI worker message protocol', () => {
  it('echoes request ids and returns legal Lines moves', () => {
    const board = createBoard();
    board[0] = 'O';
    board[1] = 'O';
    const request: AiWorkerRequest = {
      board,
      difficulty: 'master',
      id: 42,
      player: 'O',
      ruleset: 'lines',
    };

    expect(isAiWorkerRequest(request)).toBe(true);
    expect(resolveAiWorkerMessage(request, clock(10, 16))).toEqual({
      durationMs: 6,
      id: 42,
      move: 2,
    });
  });

  it('uses the requested ruleset when selecting Classic moves', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    board[13] = 'O';
    const response = resolveAiWorkerMessage(
      {
        board,
        difficulty: 'master',
        id: 7,
        player: 'O',
        ruleset: 'classic',
      },
      clock(20, 23),
    );

    expect(response).toEqual({
      durationMs: 3,
      id: 7,
      move: 2,
    });
  });

  it('rejects malformed messages without losing an integer request id', () => {
    const response = resolveAiWorkerMessage(
      {
        board: createBoard(),
        difficulty: 'master',
        id: 91,
        player: 'O',
        ruleset: 'arcade',
      },
      clock(4, 5),
    );

    expect(isAiWorkerRequest({ id: 91 })).toBe(false);
    expect(response).toEqual({
      durationMs: 1,
      error: 'invalid-request',
      id: 91,
      move: null,
    });
  });

  it('reports no legal move on a full valid board without treating it as an error', () => {
    const board = createBoard();
    board.fill('X');
    const response = resolveAiWorkerMessage(
      {
        board,
        difficulty: 'balanced',
        id: 12,
        player: 'O',
        ruleset: 'lines',
      },
      clock(100, 104),
    );

    expect(response).toEqual({
      durationMs: 4,
      id: 12,
      move: null,
    });
  });
});
