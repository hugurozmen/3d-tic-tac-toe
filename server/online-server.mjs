import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { CELL_COUNT, WINNING_LINES } from '../src/game/winningLines.mjs';

const numberFromEnv = (value, fallback, { allowZero = false } = {}) => {
  const parsed = Number(value);

  if (
    Number.isInteger(parsed) &&
    (allowZero ? parsed >= 0 : parsed > 0)
  ) {
    return parsed;
  }

  return fallback;
};

const parseAllowedOrigins = (value) => {
  if (!value) {
    return new Set();
  }

  if (value instanceof Set) {
    return new Set(value);
  }

  if (Array.isArray(value)) {
    return new Set(value.map(String).map((origin) => origin.trim()).filter(Boolean));
  }

  return new Set(
    String(value)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
};

const DEFAULT_HOST = process.env.HOST ?? '0.0.0.0';
const DEFAULT_PORT = numberFromEnv(process.env.PORT, 8787, { allowZero: true });
const DEFAULT_HEARTBEAT_MS = numberFromEnv(process.env.HEARTBEAT_MS, 30000);
const DEFAULT_MAX_CLIENTS = numberFromEnv(process.env.MAX_CLIENTS, 200);
const DEFAULT_MAX_MESSAGE_BYTES = numberFromEnv(
  process.env.MAX_MESSAGE_BYTES,
  4096,
);
const DEFAULT_MAX_ROOMS = numberFromEnv(process.env.MAX_ROOMS, 100);
const DEFAULT_REJOIN_GRACE_MS = numberFromEnv(
  process.env.REJOIN_GRACE_MS,
  45000,
);
const DEFAULT_ROOM_TTL_MS = numberFromEnv(
  process.env.ROOM_TTL_MS,
  30 * 60 * 1000,
);
const DEFAULT_ALLOWED_ORIGINS = parseAllowedOrigins(
  process.env.ONLINE_ALLOWED_ORIGINS,
);
const ROOM_ID_PATTERN = /^[A-Z0-9]{5}$/;
const ACTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const MATCH_TARGET_WINS = 3;
const ROOM_ACTION_TYPES = new Set(['move', 'reset-round', 'reset-match']);

const send = (socket, message) => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

const makeRoomId = (rooms) => {
  let id = '';

  do {
    id = Math.random().toString(36).slice(2, 7).toUpperCase();
  } while (rooms.has(id));

  return id;
};

const makeSessionId = () => randomUUID().replaceAll('-', '').slice(0, 24);

const normalizeRoomId = (value) => {
  const roomId = String(value ?? '').trim().toUpperCase();

  return ROOM_ID_PATTERN.test(roomId) ? roomId : null;
};

const DEFAULT_ROOM_SETTINGS = {
  classicPieRule: false,
  ruleset: 'lines',
};

const isRoomSettings = (settings) =>
  settings &&
  (settings.ruleset === 'lines' || settings.ruleset === 'classic') &&
  settings.classicPieRule === false;

const normalizeRoomSettings = (settings) => {
  if (settings === undefined) {
    return DEFAULT_ROOM_SETTINGS;
  }

  if (!isRoomSettings(settings)) {
    return null;
  }

  return {
    classicPieRule: settings.classicPieRule,
    ruleset: settings.ruleset,
  };
};

const getOtherPlayer = (player) => (player === 'X' ? 'O' : 'X');

const createMatchSnapshot = (opener = 'X') => ({
  isComplete: false,
  nextOpener: getOtherPlayer(opener),
  opener,
  roundNumber: 1,
  score: { O: 0, X: 0, draws: 0 },
  targetWins: MATCH_TARGET_WINS,
  winner: null,
});

const createEmptyResult = () => ({
  isComplete: false,
  isDraw: false,
  lineScores: { O: 0, X: 0 },
  winner: null,
});

const createGameSnapshot = ({ sequence = 0 } = {}) => ({
  board: Array(CELL_COUNT).fill(null),
  currentPlayer: 'X',
  lastMove: null,
  match: createMatchSnapshot(),
  result: createEmptyResult(),
  sequence,
  version: 1,
});

const getLineScores = (board) => ({
  O: WINNING_LINES.filter((line) =>
    line.every((index) => board[index] === 'O'),
  ).length,
  X: WINNING_LINES.filter((line) =>
    line.every((index) => board[index] === 'X'),
  ).length,
});

const evaluateSnapshotBoard = (board, ruleset) => {
  const lineScores = getLineScores(board);
  const remainingCells = board.filter((cell) => cell === null).length;

  if (ruleset === 'classic') {
    const winningLine = WINNING_LINES.find((line) => {
      const player = board[line[0]];

      return player && line.every((index) => board[index] === player);
    });
    const winner = winningLine ? board[winningLine[0]] : null;

    return {
      isComplete: Boolean(winner) || remainingCells === 0,
      isDraw: !winner && remainingCells === 0,
      lineScores,
      winner,
    };
  }

  const isComplete = remainingCells === 0;
  const winner =
    isComplete && lineScores.X !== lineScores.O
      ? lineScores.X > lineScores.O
        ? 'X'
        : 'O'
      : null;

  return {
    isComplete,
    isDraw: isComplete && !winner,
    lineScores,
    winner,
  };
};

const recordCompletedRound = (match, result) => {
  if (!result.isComplete || match.isComplete) {
    return match;
  }

  const score = { ...match.score };

  if (result.winner) {
    score[result.winner] += 1;
  } else if (result.isDraw) {
    score.draws += 1;
  }

  const winner =
    score.X >= match.targetWins
      ? 'X'
      : score.O >= match.targetWins
        ? 'O'
        : null;

  return {
    ...match,
    isComplete: Boolean(winner),
    score,
    winner,
  };
};

const applySnapshotMove = (snapshot, index, player, ruleset) => {
  const board = [...snapshot.board];

  board[index] = player;
  const result = evaluateSnapshotBoard(board, ruleset);

  return {
    ...snapshot,
    board,
    currentPlayer: getOtherPlayer(player),
    lastMove: index,
    match: recordCompletedRound(snapshot.match, result),
    result,
    sequence: snapshot.sequence + 1,
  };
};

const resetSnapshotRound = (snapshot) => {
  const roundFinished = snapshot.result.isComplete;
  const opener = roundFinished
    ? snapshot.match.nextOpener
    : snapshot.match.opener;
  const match = roundFinished
    ? {
        ...snapshot.match,
        nextOpener: getOtherPlayer(opener),
        opener,
        roundNumber: snapshot.match.roundNumber + 1,
      }
    : {
        ...snapshot.match,
        nextOpener: getOtherPlayer(opener),
        opener,
      };

  return {
    ...snapshot,
    board: Array(CELL_COUNT).fill(null),
    currentPlayer: opener,
    lastMove: null,
    match,
    result: createEmptyResult(),
    sequence: snapshot.sequence + 1,
  };
};

const resetSnapshotMatch = (snapshot) => ({
  ...createGameSnapshot({ sequence: snapshot.sequence + 1 }),
});

const isActionEnvelope = (message) =>
  message &&
  ROOM_ACTION_TYPES.has(message.type) &&
  typeof message.actionId === 'string' &&
  ACTION_ID_PATTERN.test(message.actionId) &&
  Number.isInteger(message.expectedSequence) &&
  message.expectedSequence >= 0;

const actionFingerprint = (message) =>
  JSON.stringify({
    expectedSequence: message.expectedSequence,
    index: message.type === 'move' ? message.index : undefined,
    player: message.type === 'move' ? message.player : undefined,
    type: message.type,
  });

const parse = (data) => {
  try {
    return JSON.parse(String(data));
  } catch {
    return null;
  }
};

const roomPlayerSlot = (player) => (player === 'X' ? 'host' : 'guest');
const roomSessionSlot = (player) =>
  player === 'X' ? 'hostSessionId' : 'guestSessionId';
const roomDisconnectedSlot = (player) =>
  player === 'X' ? 'hostDisconnectedAt' : 'guestDisconnectedAt';

const isOriginAllowed = (origin, allowedOrigins) =>
  allowedOrigins.size === 0 ||
  allowedOrigins.has('*') ||
  (origin ? allowedOrigins.has(origin) : false);

export const createOnlineServer = ({
  allowedOrigins = DEFAULT_ALLOWED_ORIGINS,
  heartbeatMs = DEFAULT_HEARTBEAT_MS,
  host = DEFAULT_HOST,
  maxClients = DEFAULT_MAX_CLIENTS,
  maxMessageBytes = DEFAULT_MAX_MESSAGE_BYTES,
  maxRooms = DEFAULT_MAX_ROOMS,
  port = DEFAULT_PORT,
  rejoinGraceMs = DEFAULT_REJOIN_GRACE_MS,
  roomTtlMs = DEFAULT_ROOM_TTL_MS,
} = {}) =>
  new Promise((resolve, reject) => {
    const originAllowlist = parseAllowedOrigins(allowedOrigins);
    const rooms = new Map();
    const httpServer = http.createServer((request, response) => {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;

      if (request.method === 'GET' && (pathname === '/health' || pathname === '/ready')) {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            clients: wss.clients.size,
            maxClients,
            maxRooms,
            ok: true,
            rooms: rooms.size,
            service: '3d-xox-online',
            uptimeSeconds: Math.round(process.uptime()),
          }),
        );
        return;
      }

      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not-found' }));
    });
    const wss = new WebSocketServer({
      maxPayload: maxMessageBytes,
      server: httpServer,
      verifyClient: ({ origin }, done) => {
        if (isOriginAllowed(origin, originAllowlist)) {
          done(true);
          return;
        }

        done(false, 403, 'Forbidden origin');
      },
    });

    const touchRoom = (room) => {
      room.updatedAt = Date.now();
      room.expiresAt = room.updatedAt + roomTtlMs;

      if (room.host || room.guest) {
        room.emptySince = null;
      }
    };

    const cleanupRooms = () => {
      const now = Date.now();

      for (const [roomId, room] of rooms) {
        const hostGraceExpired =
          !room.host &&
          room.hostSessionId &&
          room.hostDisconnectedAt !== null &&
          now - room.hostDisconnectedAt > rejoinGraceMs;
        const guestGraceExpired =
          !room.guest &&
          room.guestSessionId &&
          room.guestDisconnectedAt !== null &&
          now - room.guestDisconnectedAt > rejoinGraceMs;

        // A room cannot continue after its host reservation expires. Tell the
        // remaining guest before removing the stale room.
        if (hostGraceExpired) {
          send(room.guest, {
            message: 'Host session expired. Host a new room to keep playing.',
            type: 'error',
          });
          rooms.delete(roomId);
          continue;
        }

        // A guest seat is reserved only for the advertised rejoin window.
        if (guestGraceExpired) {
          room.guestSessionId = null;
          room.guestDisconnectedAt = null;
        }

        const emptyExpired =
          !room.host &&
          !room.guest &&
          room.emptySince !== null &&
          now - room.emptySince > rejoinGraceMs;

        const ttlExpired = now > room.expiresAt && (!room.host || !room.guest);

        if (emptyExpired || ttlExpired) {
          rooms.delete(roomId);
        }
      }
    };

    const leaveRoom = (
      socket,
      { abandonIfEmpty = false, notifyPeer = true } = {},
    ) => {
      if (!socket.roomId) {
        return;
      }

      const room = rooms.get(socket.roomId);

      if (!room) {
        socket.roomId = null;
        socket.player = null;
        return;
      }

      if (room.host === socket) {
        room.host = null;
        room.hostDisconnectedAt = Date.now();

        if (notifyPeer) {
          send(room.guest, { snapshot: room.snapshot, type: 'peer-left' });
        }
      } else if (room.guest === socket) {
        room.guest = null;
        room.guestDisconnectedAt = Date.now();

        if (notifyPeer) {
          send(room.host, { snapshot: room.snapshot, type: 'peer-left' });
        }
      }

      if (!room.host && !room.guest) {
        room.emptySince = Date.now();
      }

      if (abandonIfEmpty && !room.host && !room.guest) {
        rooms.delete(socket.roomId);
      } else {
        touchRoom(room);
      }
      socket.roomId = null;
      socket.player = null;
      socket.sessionId = null;
    };

    const rejectAction = (
      socket,
      room,
      message,
      code,
      reason,
    ) => {
      send(socket, {
        actionId:
          typeof message?.actionId === 'string' ? message.actionId : null,
        code,
        message: reason,
        snapshot: room?.snapshot,
        type: 'action-rejected',
      });
    };

    const handleRoomAction = (socket, message) => {
      const room = rooms.get(socket.roomId);

      if (!room) {
        send(socket, { message: 'Room not found', type: 'error' });
        return;
      }

      if (!isActionEnvelope(message)) {
        rejectAction(
          socket,
          room,
          message,
          'invalid-action',
          'Invalid action envelope',
        );
        return;
      }

      const actionKey = `${socket.player}:${message.actionId}`;
      const fingerprint = actionFingerprint(message);
      const processed = room.processedActions.get(actionKey);

      if (processed) {
        if (processed.fingerprint !== fingerprint) {
          rejectAction(
            socket,
            room,
            message,
            'action-id-reused',
            'Action ID was already used for a different action',
          );
          return;
        }

        send(socket, processed.acknowledgement);
        return;
      }

      const peer = socket === room.host ? room.guest : room.host;

      if (!peer || peer.readyState !== WebSocket.OPEN) {
        rejectAction(
          socket,
          room,
          message,
          'peer-unavailable',
          'Waiting for peer',
        );
        return;
      }

      if (message.expectedSequence !== room.snapshot.sequence) {
        rejectAction(
          socket,
          room,
          message,
          'sequence-mismatch',
          'Action sequence is stale; restore the room snapshot',
        );
        return;
      }

      if (message.type === 'move') {
        if (
          !Number.isInteger(message.index) ||
          message.index < 0 ||
          message.index >= CELL_COUNT ||
          (message.player !== 'X' && message.player !== 'O')
        ) {
          rejectAction(
            socket,
            room,
            message,
            'invalid-move',
            'Invalid move',
          );
          return;
        }

        if (message.player !== socket.player) {
          rejectAction(
            socket,
            room,
            message,
            'player-mismatch',
            'Player mismatch',
          );
          return;
        }

        if (room.snapshot.result.isComplete) {
          rejectAction(
            socket,
            room,
            message,
            'round-complete',
            'The round is complete',
          );
          return;
        }

        if (room.snapshot.currentPlayer !== socket.player) {
          rejectAction(
            socket,
            room,
            message,
            'out-of-turn',
            'It is not your turn',
          );
          return;
        }

        if (room.snapshot.board[message.index] !== null) {
          rejectAction(
            socket,
            room,
            message,
            'cell-occupied',
            'Cell is already occupied',
          );
          return;
        }

        room.snapshot = applySnapshotMove(
          room.snapshot,
          message.index,
          message.player,
          room.settings.ruleset,
        );
      } else if (message.type === 'reset-round') {
        if (room.snapshot.match.isComplete) {
          rejectAction(
            socket,
            room,
            message,
            'match-complete',
            'Reset the completed match instead of its round',
          );
          return;
        }

        if (!room.snapshot.result.isComplete) {
          rejectAction(
            socket,
            room,
            message,
            'round-active',
            'Finish the active round before starting the next one',
          );
          return;
        }

        room.snapshot = resetSnapshotRound(room.snapshot);
      } else {
        if (!room.snapshot.match.isComplete) {
          rejectAction(
            socket,
            room,
            message,
            'match-active',
            'Finish the active best-of-five before resetting the match',
          );
          return;
        }

        room.snapshot = resetSnapshotMatch(room.snapshot);
      }

      const acknowledgement = {
        action: message.type,
        actionId: message.actionId,
        sequence: room.snapshot.sequence,
        snapshot: room.snapshot,
        type: 'action-ack',
      };
      const peerMessage = {
        actionId: message.actionId,
        sequence: room.snapshot.sequence,
        snapshot: room.snapshot,
        type: message.type,
        ...(message.type === 'move'
          ? { index: message.index, player: message.player }
          : {}),
      };

      room.processedActions.set(actionKey, {
        acknowledgement,
        fingerprint,
      });

      if (room.processedActions.size > 128) {
        const oldestKey = room.processedActions.keys().next().value;

        if (oldestKey) {
          room.processedActions.delete(oldestKey);
        }
      }

      touchRoom(room);
      send(socket, acknowledgement);
      send(peer, peerMessage);
    };

    const cleanupInterval = setInterval(cleanupRooms, Math.min(60000, roomTtlMs));
    const heartbeatInterval = setInterval(() => {
      for (const socket of wss.clients) {
        if (socket.isAlive === false) {
          socket.terminate();
          continue;
        }

        socket.isAlive = false;
        socket.ping();
      }
    }, heartbeatMs);

    wss.on('connection', (socket) => {
      if (wss.clients.size > maxClients) {
        socket.close(1013, 'Server busy');
        return;
      }

      socket.isAlive = true;
      socket.roomId = null;
      socket.player = null;
      socket.sessionId = null;

      socket.on('pong', () => {
        socket.isAlive = true;
      });

      socket.on('message', (data) => {
        if (Buffer.byteLength(String(data)) > maxMessageBytes) {
          send(socket, { message: 'Message too large', type: 'error' });
          socket.close(1009, 'Message too large');
          return;
        }

        const message = parse(data);

        if (message?.type === 'create-room') {
          const settings = normalizeRoomSettings(message.settings);

          if (!settings) {
            send(socket, { message: 'Invalid room settings', type: 'error' });
            return;
          }

          leaveRoom(socket, { abandonIfEmpty: true });
          cleanupRooms();

          if (rooms.size >= maxRooms) {
            send(socket, { message: 'Server is full', type: 'error' });
            return;
          }

          const roomId = makeRoomId(rooms);
          const sessionId = makeSessionId();
          const now = Date.now();

          rooms.set(roomId, {
            emptySince: null,
            expiresAt: now + roomTtlMs,
            guest: null,
            guestDisconnectedAt: null,
            guestSessionId: null,
            host: socket,
            hostDisconnectedAt: null,
            hostSessionId: sessionId,
            processedActions: new Map(),
            settings,
            snapshot: createGameSnapshot(),
            updatedAt: now,
          });
          const room = rooms.get(roomId);

          socket.roomId = roomId;
          socket.player = 'X';
          socket.sessionId = sessionId;
          send(socket, {
            player: 'X',
            roomId,
            sessionId,
            settings,
            snapshot: room.snapshot,
            type: 'room-created',
          });
          return;
        }

        if (message?.type === 'join-room') {
          const roomId = normalizeRoomId(message.roomId);

          if (!roomId) {
            send(socket, { message: 'Invalid room code', type: 'error' });
            return;
          }

          const room = rooms.get(roomId);

          if (!room) {
            send(socket, { message: 'Room not found', type: 'error' });
            return;
          }

          if (!room.host) {
            send(socket, {
              message: 'Host disconnected. Ask them to reconnect or host a new room.',
              type: 'error',
            });
            return;
          }

          cleanupRooms();

          if (!rooms.has(roomId)) {
            send(socket, { message: 'Room not found', type: 'error' });
            return;
          }

          if (room.guest || room.guestSessionId) {
            send(socket, { message: 'Room is full', type: 'error' });
            return;
          }

          leaveRoom(socket, { abandonIfEmpty: true });
          const sessionId = makeSessionId();

          room.guest = socket;
          room.guestDisconnectedAt = null;
          room.guestSessionId = sessionId;
          socket.roomId = roomId;
          socket.player = 'O';
          socket.sessionId = sessionId;
          touchRoom(room);
          send(socket, {
            player: 'O',
            roomId,
            sessionId,
            settings: room.settings,
            snapshot: room.snapshot,
            type: 'room-joined',
          });
          send(room.host, {
            settings: room.settings,
            snapshot: room.snapshot,
            type: 'peer-joined',
          });
          return;
        }

        if (message?.type === 'rejoin-room') {
          const roomId = normalizeRoomId(message.roomId);
          const player = message.player;
          const sessionId = String(message.sessionId ?? '');

          if (!roomId || (player !== 'X' && player !== 'O')) {
            send(socket, { message: 'Room not found', type: 'error' });
            return;
          }

          const room = rooms.get(roomId);

          if (!room) {
            send(socket, { message: 'Room not found', type: 'error' });
            return;
          }

          const playerSlot = roomPlayerSlot(player);
          const sessionSlot = roomSessionSlot(player);
          const disconnectedSlot = roomDisconnectedSlot(player);

          if (room[sessionSlot] !== sessionId) {
            send(socket, { message: 'Session expired', type: 'error' });
            return;
          }

          const previousSocket = room[playerSlot];

          if (previousSocket?.readyState === WebSocket.OPEN) {
            // Possession of the private session id authorizes a reconnect to
            // replace a transport that has not finished closing yet.
            previousSocket.roomId = null;
            previousSocket.player = null;
            previousSocket.sessionId = null;
            previousSocket.close(4000, 'Session reconnected elsewhere');
          }

          leaveRoom(socket, {
            abandonIfEmpty: true,
            notifyPeer: false,
          });
          room[playerSlot] = socket;
          room[disconnectedSlot] = null;
          socket.roomId = roomId;
          socket.player = player;
          socket.sessionId = sessionId;
          touchRoom(room);

          const peer = player === 'X' ? room.guest : room.host;
          const peerConnected = peer?.readyState === WebSocket.OPEN;

          send(socket, {
            peerConnected,
            player,
            roomId,
            sessionId,
            settings: room.settings,
            snapshot: room.snapshot,
            type: 'room-rejoined',
          });

          if (peerConnected) {
            send(peer, {
              settings: room.settings,
              snapshot: room.snapshot,
              type: 'peer-joined',
            });
          }

          return;
        }

        if (ROOM_ACTION_TYPES.has(message?.type)) {
          handleRoomAction(socket, message);
          return;
        }

        send(socket, { message: 'Unknown message', type: 'error' });
      });

      socket.on('close', () => leaveRoom(socket));
    });

    httpServer.once('error', reject);
    httpServer.listen(port, host, () => {
      const address = httpServer.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;

      resolve({
        close: () =>
          new Promise((closeResolve) => {
            clearInterval(cleanupInterval);
            clearInterval(heartbeatInterval);
            for (const client of wss.clients) {
              client.close(1001, 'Server shutdown');
            }

            const terminateTimer = setTimeout(() => {
              for (const client of wss.clients) {
                client.terminate();
              }
            }, 1000);

            wss.close(() => {
              clearTimeout(terminateTimer);
              httpServer.close(() => closeResolve());
            });
          }),
        host,
        port: actualPort,
        rooms,
        server: httpServer,
        wss,
      });
    });
  });

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const server = await createOnlineServer();
  console.log(`3D XOX online server listening on ws://${server.host}:${server.port}`);

  const shutdown = async (signal) => {
    console.log(`3D XOX online server received ${signal}, shutting down`);
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
