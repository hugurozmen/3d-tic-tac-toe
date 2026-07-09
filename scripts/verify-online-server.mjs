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

const waitClose = (socket, label) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${label}`));
    }, 5000);

    const handleClose = (code, reason) => {
      cleanup();
      resolve({ code, reason: String(reason) });
    };

    const handleError = (error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off('close', handleClose);
      socket.off('error', handleError);
    };

    socket.once('close', handleClose);
    socket.once('error', handleError);
  });

const openClient = async (url, options = {}) => {
  const socket = new WebSocket(url, options);

  await waitOpen(socket);
  return socket;
};

const expectOpenRejected = (url, options, label) =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url, options);
    const timeout = setTimeout(() => {
      cleanup();
      socket.terminate();
      reject(new Error(`Timed out waiting for ${label}`));
    }, 5000);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off('open', handleOpen);
      socket.off('error', handleError);
    };

    const handleOpen = () => {
      cleanup();
      socket.close();
      reject(new Error(`${label} unexpectedly opened`));
    };

    const handleError = (error) => {
      cleanup();
      resolve({ message: error.message });
    };

    socket.once('open', handleOpen);
    socket.once('error', handleError);
  });

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
const invalidClient = await openClient(url);
const defaultHost = await openClient(url);
const defaultGuest = await openClient(url);
const invalidRoomClient = await openClient(url);

try {
  const health = await fetch(`http://127.0.0.1:${server.port}/health`).then(
    (response) => response.json(),
  );
  const ready = await fetch(`http://127.0.0.1:${server.port}/ready`).then(
    (response) => response.json(),
  );

  invalidRoomClient.send(
    JSON.stringify({ roomId: 'nope!', type: 'join-room' }),
  );
  const invalidRoomCodeRejected = await waitFor(
    invalidRoomClient,
    (message) =>
      message.type === 'error' && message.message === 'Invalid room code',
    'invalid room code rejection',
  );
  invalidRoomClient.close();

  invalidClient.send(
    JSON.stringify({
      settings: { classicPieRule: false, ruleset: 'arcade' },
      type: 'create-room',
    }),
  );
  const invalidSettingsRejected = await waitFor(
    invalidClient,
    (message) =>
      message.type === 'error' && message.message === 'Invalid room settings',
    'invalid settings rejection',
  );
  invalidClient.close();

  defaultHost.send(JSON.stringify({ type: 'create-room' }));
  const defaultRoom = await waitFor(
    defaultHost,
    (message) =>
      message.type === 'room-created' &&
      message.player === 'X' &&
      message.settings?.ruleset === 'lines' &&
      message.settings?.classicPieRule === false,
    'default lines room-created',
  );

  defaultGuest.send(
    JSON.stringify({ roomId: defaultRoom.roomId, type: 'join-room' }),
  );
  const defaultJoined = await waitFor(
    defaultGuest,
    (message) =>
      message.type === 'room-joined' &&
      message.player === 'O' &&
      message.settings?.ruleset === 'lines' &&
      message.settings?.classicPieRule === false,
    'default lines room-joined',
  );
  defaultHost.close();
  defaultGuest.close();

  const settings = { classicPieRule: false, ruleset: 'classic' };

  host.send(JSON.stringify({ settings, type: 'create-room' }));
  const room = await waitFor(
    host,
    (message) =>
      message.type === 'room-created' &&
      message.player === 'X' &&
      typeof message.sessionId === 'string' &&
      message.settings?.ruleset === settings.ruleset &&
      message.settings?.classicPieRule === settings.classicPieRule,
    'room-created',
  );

  guest.send(JSON.stringify({ roomId: room.roomId, type: 'join-room' }));

  const [joined, peerJoined] = await Promise.all([
    waitFor(
      guest,
      (message) =>
      message.type === 'room-joined' &&
      message.player === 'O' &&
      typeof message.sessionId === 'string' &&
      message.settings?.ruleset === settings.ruleset &&
      message.settings?.classicPieRule === settings.classicPieRule,
      'room-joined',
    ),
    waitFor(
      host,
      (message) =>
        message.type === 'peer-joined' &&
        message.settings?.ruleset === settings.ruleset,
      'peer-joined',
    ),
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
        message.peerConnected === true &&
        message.settings?.ruleset === settings.ruleset &&
        message.settings?.classicPieRule === settings.classicPieRule,
      'room-rejoined',
    ),
    waitFor(
      guest,
      (message) =>
        message.type === 'peer-joined' &&
        message.settings?.ruleset === settings.ruleset,
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

  const restrictedServer = await createOnlineServer({
    allowedOrigins: ['https://game.example'],
    heartbeatMs: 5000,
    host: '127.0.0.1',
    port: 0,
    rejoinGraceMs: 120,
    roomTtlMs: 300,
  });
  const restrictedUrl = `ws://127.0.0.1:${restrictedServer.port}`;
  const originAllowedClient = await openClient(restrictedUrl, {
    headers: { Origin: 'https://game.example' },
  });
  const originRejected = await expectOpenRejected(
    restrictedUrl,
    { headers: { Origin: 'https://evil.example' } },
    'origin rejection',
  );
  originAllowedClient.close();
  await restrictedServer.close();

  const capacityServer = await createOnlineServer({
    heartbeatMs: 5000,
    host: '127.0.0.1',
    maxRooms: 1,
    port: 0,
    rejoinGraceMs: 120,
    roomTtlMs: 300,
  });
  const capacityUrl = `ws://127.0.0.1:${capacityServer.port}`;
  const capacityHost = await openClient(capacityUrl);
  const capacityOverflow = await openClient(capacityUrl);

  capacityHost.send(JSON.stringify({ type: 'create-room' }));
  const capacityRoom = await waitFor(
    capacityHost,
    (message) => message.type === 'room-created',
    'capacity room-created',
  );
  capacityOverflow.send(JSON.stringify({ type: 'create-room' }));
  const capacityRejected = await waitFor(
    capacityOverflow,
    (message) => message.type === 'error' && message.message === 'Server is full',
    'capacity rejection',
  );
  capacityHost.close();
  capacityOverflow.close();
  await capacityServer.close();

  const clientLimitServer = await createOnlineServer({
    heartbeatMs: 5000,
    host: '127.0.0.1',
    maxClients: 1,
    port: 0,
    rejoinGraceMs: 120,
    roomTtlMs: 300,
  });
  const clientLimitUrl = `ws://127.0.0.1:${clientLimitServer.port}`;
  const allowedClient = await openClient(clientLimitUrl);
  const rejectedClient = new WebSocket(clientLimitUrl);
  const clientLimitRejected = await waitClose(
    rejectedClient,
    'client limit rejection',
  );
  allowedClient.close();
  await clientLimitServer.close();

  console.log(
    JSON.stringify(
      {
        capacityRejected,
        capacityRoom,
        clientLimitRejected,
        defaultJoined,
        defaultRoom,
        health,
        invalidRoomCodeRejected,
        invalidSettingsRejected,
        joined,
        move,
        moveAfterRejoin,
        originRejected,
        peerJoined,
        ready,
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
  invalidClient.close();
  invalidRoomClient.close();
  defaultHost.close();
  defaultGuest.close();
  await server.close();
}
