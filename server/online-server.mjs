import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';

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
  typeof settings.classicPieRule === 'boolean';

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

const isMoveMessage = (message) =>
  message?.type === 'move' &&
  Number.isInteger(message.index) &&
  message.index >= 0 &&
  message.index < 27 &&
  (message.player === 'X' || message.player === 'O');

const isRelayMessage = (message) =>
  isMoveMessage(message) ||
  message?.type === 'reset-round' ||
  message?.type === 'reset-match';

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

    const leaveRoom = (socket, { notifyPeer = true } = {}) => {
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

        if (notifyPeer) {
          send(room.guest, { type: 'peer-left' });
        }
      } else if (room.guest === socket) {
        room.guest = null;

        if (notifyPeer) {
          send(room.host, { type: 'peer-left' });
        }
      }

      if (!room.host && !room.guest) {
        room.emptySince = Date.now();
      }

      touchRoom(room);
      socket.roomId = null;
      socket.player = null;
      socket.sessionId = null;
    };

    const relayToPeer = (socket, message) => {
      const room = rooms.get(socket.roomId);

      if (!room) {
        send(socket, { message: 'Room not found', type: 'error' });
        return;
      }

      if (message.type === 'move' && message.player !== socket.player) {
        send(socket, { message: 'Player mismatch', type: 'error' });
        return;
      }

      const peer = socket === room.host ? room.guest : room.host;

      if (!peer) {
        send(socket, { message: 'Waiting for peer', type: 'error' });
        return;
      }

      touchRoom(room);
      send(peer, message);
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

          leaveRoom(socket);
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
            guestSessionId: null,
            host: socket,
            hostSessionId: sessionId,
            settings,
            updatedAt: now,
          });
          socket.roomId = roomId;
          socket.player = 'X';
          socket.sessionId = sessionId;
          send(socket, {
            player: 'X',
            roomId,
            sessionId,
            settings,
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

          if (room.guest) {
            send(socket, { message: 'Room is full', type: 'error' });
            return;
          }

          leaveRoom(socket);
          const sessionId = makeSessionId();

          room.guest = socket;
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
            type: 'room-joined',
          });
          send(room.host, { settings: room.settings, type: 'peer-joined' });
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

          if (room[sessionSlot] !== sessionId) {
            send(socket, { message: 'Session expired', type: 'error' });
            return;
          }

          if (room[playerSlot]?.readyState === WebSocket.OPEN) {
            send(socket, { message: 'Session already active', type: 'error' });
            return;
          }

          leaveRoom(socket, { notifyPeer: false });
          room[playerSlot] = socket;
          socket.roomId = roomId;
          socket.player = player;
          socket.sessionId = sessionId;
          touchRoom(room);

          const peer = player === 'X' ? room.guest : room.host;

          send(socket, {
            peerConnected: Boolean(peer),
            player,
            roomId,
            sessionId,
            settings: room.settings,
            type: 'room-rejoined',
          });

          if (peer) {
            send(peer, { settings: room.settings, type: 'peer-joined' });
          }

          return;
        }

        if (isRelayMessage(message)) {
          relayToPeer(socket, message);
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
