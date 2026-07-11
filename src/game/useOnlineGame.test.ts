import { describe, expect, it } from 'vitest';
import {
  isOnlineGameSnapshot,
  parseOnlineServerMessage,
  resolveOnlineServerConfig,
  type OnlineGameSnapshot,
} from './useOnlineGame';

const createSnapshot = (
  sequence = 0,
  overrides: Partial<OnlineGameSnapshot> = {},
): OnlineGameSnapshot => ({
  board: Array(27).fill(null),
  currentPlayer: 'X',
  lastMove: null,
  match: {
    isComplete: false,
    nextOpener: 'O',
    opener: 'X',
    roundNumber: 1,
    score: { O: 0, X: 0, draws: 0 },
    targetWins: 3,
    winner: null,
  },
  result: {
    isComplete: false,
    isDraw: false,
    lineScores: { O: 0, X: 0 },
    winner: null,
  },
  sequence,
  version: 1,
  ...overrides,
});

describe('resolveOnlineServerConfig', () => {
  it('uses the local fallback only for local hosts', () => {
    expect(
      resolveOnlineServerConfig({
        hostname: '127.0.0.1',
        protocol: 'http:',
      }),
    ).toEqual({
      error: null,
      isConfigured: true,
      source: 'local',
      url: 'ws://127.0.0.1:8787',
    });
  });

  it('requires explicit server config on hosted domains', () => {
    const config = resolveOnlineServerConfig({
      hostname: '3d-xox.vercel.app',
      protocol: 'https:',
    });

    expect(config.isConfigured).toBe(false);
    expect(config.source).toBe('missing');
    expect(config.error).toContain('VITE_ONLINE_SERVER_URL');
  });

  it('accepts a production wss server URL', () => {
    expect(
      resolveOnlineServerConfig({
        configured: 'wss://rooms.example.com/socket',
        hostname: '3d-xox.vercel.app',
        protocol: 'https:',
      }),
    ).toEqual({
      error: null,
      isConfigured: true,
      source: 'env',
      url: 'wss://rooms.example.com/socket',
    });
  });

  it('rejects non-WebSocket URLs', () => {
    const config = resolveOnlineServerConfig({
      configured: 'https://rooms.example.com',
      hostname: '3d-xox.vercel.app',
      protocol: 'https:',
    });

    expect(config.isConfigured).toBe(false);
    expect(config.source).toBe('invalid');
    expect(config.error).toContain('ws:// or wss://');
  });

  it('rejects insecure remote ws on HTTPS pages', () => {
    const config = resolveOnlineServerConfig({
      configured: 'ws://rooms.example.com',
      hostname: '3d-xox.vercel.app',
      protocol: 'https:',
    });

    expect(config.isConfigured).toBe(false);
    expect(config.source).toBe('invalid');
    expect(config.error).toContain('wss://');
  });
});

describe('online authoritative protocol parsing', () => {
  it('accepts a complete authoritative snapshot', () => {
    const board = Array(27).fill(null);

    board[13] = 'X';
    const snapshot = createSnapshot(1, {
      board,
      currentPlayer: 'O',
      lastMove: 13,
    });

    expect(isOnlineGameSnapshot(snapshot)).toBe(true);
  });

  it('parses a sequenced move acknowledgement', () => {
    const snapshot = createSnapshot(1);
    const message = parseOnlineServerMessage(
      JSON.stringify({
        action: 'move',
        actionId: 'move-x-1',
        sequence: 1,
        snapshot,
        type: 'action-ack',
      }),
    );

    expect(message).toMatchObject({
      action: 'move',
      actionId: 'move-x-1',
      sequence: 1,
      type: 'action-ack',
    });
  });

  it('rejects acknowledgements whose sequence disagrees with the snapshot', () => {
    expect(
      parseOnlineServerMessage(
        JSON.stringify({
          action: 'move',
          actionId: 'move-x-1',
          sequence: 2,
          snapshot: createSnapshot(1),
          type: 'action-ack',
        }),
      ),
    ).toBeNull();
  });

  it('parses action rejection snapshots for client rollback', () => {
    const message = parseOnlineServerMessage(
      JSON.stringify({
        actionId: 'stale-move',
        code: 'sequence-mismatch',
        message: 'Action sequence is stale; restore the room snapshot',
        snapshot: createSnapshot(4),
        type: 'action-rejected',
      }),
    );

    expect(message).toMatchObject({
      actionId: 'stale-move',
      code: 'sequence-mismatch',
      type: 'action-rejected',
    });
  });

  it('parses a scored match snapshot on rejoin and preserves room settings', () => {
    const board = Array(27).fill(null);

    board[0] = 'X';
    board[1] = 'X';
    board[2] = 'X';
    const snapshot = createSnapshot(9, {
      board,
      currentPlayer: 'O',
      lastMove: 2,
      match: {
        isComplete: false,
        nextOpener: 'O',
        opener: 'X',
        roundNumber: 1,
        score: { O: 0, X: 1, draws: 0 },
        targetWins: 3,
        winner: null,
      },
      result: {
        isComplete: true,
        isDraw: false,
        lineScores: { O: 0, X: 1 },
        winner: 'X',
      },
    });
    const message = parseOnlineServerMessage(
      JSON.stringify({
        peerConnected: true,
        player: 'O',
        roomId: 'ABCDE',
        sessionId: 'guest-session',
        settings: { classicPieRule: false, ruleset: 'classic' },
        snapshot,
        type: 'room-rejoined',
      }),
    );

    expect(message).toMatchObject({
      peerConnected: true,
      settings: { classicPieRule: false, ruleset: 'classic' },
      snapshot: {
        match: { score: { X: 1 } },
        result: { winner: 'X' },
        sequence: 9,
      },
      type: 'room-rejoined',
    });
  });

  it('rejects malformed or partial rejoin snapshots', () => {
    const malformed = {
      ...createSnapshot(2),
      board: Array(26).fill(null),
    };

    expect(isOnlineGameSnapshot(malformed)).toBe(false);
    expect(
      parseOnlineServerMessage(
        JSON.stringify({
          peerConnected: true,
          player: 'X',
          roomId: 'ABCDE',
          sessionId: 'host-session',
          settings: { classicPieRule: false, ruleset: 'lines' },
          snapshot: malformed,
          type: 'room-rejoined',
        }),
      ),
    ).toBeNull();
  });

  it('rejects Pie-on rooms until online side swapping is implemented', () => {
    expect(
      parseOnlineServerMessage(
        JSON.stringify({
          player: 'X',
          roomId: 'ABCDE',
          sessionId: 'host-session',
          settings: { classicPieRule: true, ruleset: 'classic' },
          snapshot: createSnapshot(0),
          type: 'room-created',
        }),
      ),
    ).toBeNull();
  });
});
