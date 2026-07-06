import WebSocket from 'ws';
import { createOnlineServer } from '../server/online-server.mjs';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitOpen = (socket) =>
  new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

const waitFor = (socket, predicate, label) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${label}`));
    }, 5000);

    const handleMessage = (data) => {
      const message = JSON.parse(String(data));

      if (predicate(message)) {
        cleanup();
        resolve(message);
      }
    };

    const handleError = (error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off('message', handleMessage);
      socket.off('error', handleError);
    };

    socket.on('message', handleMessage);
    socket.once('error', handleError);
  });

const openClient = async (url) => {
  const socket = new WebSocket(url);

  await waitOpen(socket);
  return socket;
};

const server = await createOnlineServer({
  heartbeatMs: 5000,
  host: '127.0.0.1',
  port: 0,
  rejoinGraceMs: 120,
  roomTtlMs: 300,
});
const url = `ws://127.0.0.1:${server.port}`;
let host = await openClient(url);
const guest = await openClient(url);

try {
  const health = await fetch(`http://127.0.0.1:${server.port}/health`).then(
    (response) => response.json(),
  );

  host.send(JSON.stringify({ type: 'create-room' }));
  const room = await waitFor(
    host,
    (message) =>
      message.type === 'room-created' &&
      message.player === 'X' &&
      typeof message.sessionId === 'string',
    'room-created',
  );

  guest.send(JSON.stringify({ roomId: room.roomId, type: 'join-room' }));

  const [joined, peerJoined] = await Promise.all([
    waitFor(
      guest,
      (message) =>
        message.type === 'room-joined' &&
        message.player === 'O' &&
        typeof message.sessionId === 'string',
      'room-joined',
    ),
    waitFor(host, (message) => message.type === 'peer-joined', 'peer-joined'),
  ]);

  guest.send(JSON.stringify({ index: 12, player: 'X', type: 'move' }));
  const spoofRejected = await waitFor(
    guest,
    (message) =>
      message.type === 'error' && message.message === 'Player mismatch',
    'spoof rejection',
  );

  host.send(JSON.stringify({ index: 13, player: 'X', type: 'move' }));
  const move = await waitFor(
    guest,
    (message) =>
      message.type === 'move' && message.index === 13 && message.player === 'X',
    'move relay',
  );

  host.close();
  await waitFor(guest, (message) => message.type === 'peer-left', 'peer-left');

  host = await openClient(url);
  host.send(
    JSON.stringify({
      player: 'X',
      roomId: room.roomId,
      sessionId: room.sessionId,
      type: 'rejoin-room',
    }),
  );

  const [rejoined, rejoinSeenByGuest] = await Promise.all([
    waitFor(
      host,
      (message) =>
        message.type === 'room-rejoined' &&
        message.player === 'X' &&
        message.peerConnected === true,
      'room-rejoined',
    ),
    waitFor(
      guest,
      (message) => message.type === 'peer-joined',
      'peer rejoined',
    ),
  ]);

  host.send(JSON.stringify({ index: 14, player: 'X', type: 'move' }));
  const moveAfterRejoin = await waitFor(
    guest,
    (message) =>
      message.type === 'move' && message.index === 14 && message.player === 'X',
    'move relay after rejoin',
  );

  guest.send(JSON.stringify({ type: 'reset-round' }));
  const reset = await waitFor(
    host,
    (message) => message.type === 'reset-round',
    'reset relay',
  );

  host.close();
  guest.close();
  await wait(700);

  console.log(
    JSON.stringify(
      {
        health,
        joined,
        move,
        moveAfterRejoin,
        peerJoined,
        rejoinSeenByGuest,
        rejoined,
        reset,
        roomCleanedUp: !server.rooms.has(room.roomId),
        roomId: room.roomId,
        spoofRejected,
      },
      null,
      2,
    ),
  );
} finally {
  host.close();
  guest.close();
  await server.close();
}
