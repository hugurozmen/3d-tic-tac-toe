import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';

const DEFAULT_HOST = process.env.HOST ?? '0.0.0.0';
const DEFAULT_PORT = Number(process.env.PORT ?? 8787);
const DEFAULT_HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS ?? 30000);
const DEFAULT_REJOIN_GRACE_MS = Number(process.env.REJOIN_GRACE_MS ?? 45000);
const DEFAULT_ROOM_TTL_MS = Number(process.env.ROOM_TTL_MS ?? 30 * 60 * 1000);

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

export const createOnlineServer = ({
  heartbeatMs = DEFAULT_HEARTBEAT_MS,
  host = DEFAULT_HOST,
  port = DEFAULT_PORT,
  rejoinGraceMs = DEFAULT_REJOIN_GRACE_MS,
  roomTtlMs = DEFAULT_ROOM_TTL_MS,
} = {}) =>
  new Promise((resolve, reject) => {
    const rooms = new Map();
    const httpServer = http.createServer((request, response) => {
      if (request.url === '/health') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            ok: true,
            rooms: rooms.size,
            service: '3d-xox-online',
          }),
        );
        return;
      }

      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not-found' }));
    });
    const wss = new WebSocketServer({ server: httpServer });

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
      socket.isAlive = true;
      socket.roomId = null;
      socket.player = null;
      socket.sessionId = null;

      socket.on('pong', () => {
        socket.isAlive = true;
      });

      socket.on('message', (data) => {
        const message = parse(data);

        if (message?.type === 'create-room') {
          const settings = normalizeRoomSettings(message.settings);

          if (!settings) {
            send(socket, { message: 'Invalid room settings', type: 'error' });
            return;
          }

          leaveRoom(socket);
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
          const roomId = String(message.roomId ?? '').trim().toUpperCase();
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
          const roomId = String(message.roomId ?? '').trim().toUpperCase();
          const player = message.player;
          const sessionId = String(message.sessionId ?? '');
          const room = rooms.get(roomId);

          if (!room || (player !== 'X' && player !== 'O')) {
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
            wss.close(() => {
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
}
