import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

const expectNoMessage = (socket, predicate, label, duration = 180) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve(true);
    }, duration);

    const handleMessage = (data) => {
      const message = JSON.parse(String(data));

      if (predicate(message)) {
        cleanup();
        reject(new Error(`${label} was unexpectedly received`));
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off('message', handleMessage);
    };

    socket.on('message', handleMessage);
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

const sendAndWait = (socket, message, predicate, label) => {
  const waiting = waitFor(socket, predicate, label);

  socket.send(JSON.stringify(message));
  return waiting;
};

const sendAction = async ({ receiver, sender, ...action }) => {
  const acknowledgement = waitFor(
    sender,
    (message) =>
      message.type === 'action-ack' && message.actionId === action.actionId,
    `${action.actionId} acknowledgement`,
  );
  const relayed = waitFor(
    receiver,
    (message) =>
      message.type === action.type && message.actionId === action.actionId,
    `${action.actionId} relay`,
  );

  sender.send(JSON.stringify(action));
  return Promise.all([acknowledgement, relayed]);
};

const expectActionRejected = (
  socket,
  action,
  code,
  label = `${action.actionId ?? action.type} rejection`,
) =>
  sendAndWait(
    socket,
    action,
    (message) =>
      message.type === 'action-rejected' &&
      message.actionId === (action.actionId ?? null) &&
      message.code === code,
    label,
  );

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

const dockerfile = await readFile(
  new URL('../server/Dockerfile', import.meta.url),
  'utf8',
);
const dockerignore = await readFile(
  new URL('../.dockerignore', import.meta.url),
  'utf8',
);

assert.match(
  dockerfile,
  /COPY src\/game\/winningLines\.mjs \.\/src\/game\//,
  'Online server image must include its shared canonical winning-lines module',
);
assert.match(
  dockerignore,
  /!src\/game\/winningLines\.mjs/,
  'Docker build context must retain the shared canonical winning-lines module',
);

const server = await createOnlineServer({
  heartbeatMs: 5000,
  host: '127.0.0.1',
  port: 0,
  rejoinGraceMs: 500,
  roomTtlMs: 300,
});
const url = `ws://127.0.0.1:${server.port}`;
let host = await openClient(url);
let guest = await openClient(url);
const invalidClient = await openClient(url);
const unsupportedPieClient = await openClient(url);
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

  assert.equal(health.ok, true);
  assert.equal(ready.ok, true);

  const invalidRoomCodeRejected = await sendAndWait(
    invalidRoomClient,
    { roomId: 'nope!', type: 'join-room' },
    (message) =>
      message.type === 'error' && message.message === 'Invalid room code',
    'invalid room code rejection',
  );
  invalidRoomClient.close();

  const invalidSettingsRejected = await sendAndWait(
    invalidClient,
    {
      settings: { classicPieRule: false, ruleset: 'arcade' },
      type: 'create-room',
    },
    (message) =>
      message.type === 'error' && message.message === 'Invalid room settings',
    'invalid settings rejection',
  );
  invalidClient.close();

  const unsupportedPieRejected = await sendAndWait(
    unsupportedPieClient,
    {
      settings: { classicPieRule: true, ruleset: 'classic' },
      type: 'create-room',
    },
    (message) =>
      message.type === 'error' && message.message === 'Invalid room settings',
    'unsupported online Pie Rule rejection',
  );
  unsupportedPieClient.close();

  const defaultRoom = await sendAndWait(
    defaultHost,
    { type: 'create-room' },
    (message) =>
      message.type === 'room-created' &&
      message.player === 'X' &&
      message.settings?.ruleset === 'lines' &&
      message.settings?.classicPieRule === false &&
      message.snapshot?.sequence === 0,
    'default lines room-created',
  );
  const defaultPeerJoined = waitFor(
    defaultHost,
    (message) => message.type === 'peer-joined',
    'default peer joined',
  );
  const defaultJoined = await sendAndWait(
    defaultGuest,
    { roomId: defaultRoom.roomId, type: 'join-room' },
    (message) =>
      message.type === 'room-joined' &&
      message.player === 'O' &&
      message.settings?.ruleset === 'lines' &&
      message.settings?.classicPieRule === false &&
      message.snapshot?.board?.every((cell) => cell === null),
    'default lines room-joined',
  );
  await defaultPeerJoined;
  defaultHost.close();
  defaultGuest.close();

  const settings = { classicPieRule: false, ruleset: 'classic' };
  const room = await sendAndWait(
    host,
    { settings, type: 'create-room' },
    (message) =>
      message.type === 'room-created' &&
      message.player === 'X' &&
      typeof message.sessionId === 'string' &&
      message.settings?.ruleset === settings.ruleset &&
      message.snapshot?.currentPlayer === 'X' &&
      message.snapshot?.sequence === 0,
    'room-created',
  );

  const peerJoinedWaiting = waitFor(
    host,
    (message) =>
      message.type === 'peer-joined' &&
      message.settings?.ruleset === settings.ruleset &&
      message.snapshot?.sequence === 0,
    'peer-joined',
  );
  const joined = await sendAndWait(
    guest,
    { roomId: room.roomId, type: 'join-room' },
    (message) =>
      message.type === 'room-joined' &&
      message.player === 'O' &&
      typeof message.sessionId === 'string' &&
      message.settings?.ruleset === settings.ruleset &&
      message.snapshot?.sequence === 0,
    'room-joined',
  );
  const peerJoined = await peerJoinedWaiting;

  const spoofRejected = await expectActionRejected(
    guest,
    {
      actionId: 'spoof-x',
      expectedSequence: 0,
      index: 12,
      player: 'X',
      type: 'move',
    },
    'player-mismatch',
  );

  const [firstMoveAck, firstMove] = await sendAction({
    actionId: 'x-opening',
    expectedSequence: 0,
    index: 13,
    player: 'X',
    receiver: guest,
    sender: host,
    type: 'move',
  });

  assert.equal(firstMoveAck.sequence, 1);
  assert.equal(firstMove.snapshot.board[13], 'X');
  assert.equal(firstMove.snapshot.currentPlayer, 'O');

  const noDuplicateRelay = expectNoMessage(
    guest,
    (message) =>
      message.type === 'move' && message.actionId === 'x-opening',
    'duplicate move relay',
  );
  const duplicateAck = await sendAndWait(
    host,
    {
      actionId: 'x-opening',
      expectedSequence: 0,
      index: 13,
      player: 'X',
      type: 'move',
    },
    (message) =>
      message.type === 'action-ack' && message.actionId === 'x-opening',
    'idempotent duplicate acknowledgement',
  );
  await noDuplicateRelay;
  assert.equal(duplicateAck.sequence, 1);

  const reusedActionRejected = await expectActionRejected(
    host,
    {
      actionId: 'x-opening',
      expectedSequence: 1,
      index: 14,
      player: 'X',
      type: 'move',
    },
    'action-id-reused',
  );

  const outOfTurnRejected = await expectActionRejected(
    host,
    {
      actionId: 'x-out-of-turn',
      expectedSequence: 1,
      index: 14,
      player: 'X',
      type: 'move',
    },
    'out-of-turn',
  );

  const occupiedRejected = await expectActionRejected(
    guest,
    {
      actionId: 'o-occupied',
      expectedSequence: 1,
      index: 13,
      player: 'O',
      type: 'move',
    },
    'cell-occupied',
  );

  const [secondMoveAck] = await sendAction({
    actionId: 'o-response',
    expectedSequence: 1,
    index: 0,
    player: 'O',
    receiver: host,
    sender: guest,
    type: 'move',
  });
  assert.equal(secondMoveAck.sequence, 2);

  const replayRejected = await expectActionRejected(
    guest,
    {
      actionId: 'o-stale-replay',
      expectedSequence: 1,
      index: 1,
      player: 'O',
      type: 'move',
    },
    'sequence-mismatch',
  );

  const hostSawGuestLeave = waitFor(
    host,
    (message) => message.type === 'peer-left',
    'guest peer-left',
  );
  guest.close();
  await hostSawGuestLeave;

  const seatThief = await openClient(url);
  const seatTakeoverRejected = await sendAndWait(
    seatThief,
    { roomId: room.roomId, type: 'join-room' },
    (message) =>
      message.type === 'error' && message.message === 'Room is full',
    'disconnected guest seat reservation',
  );
  seatThief.close();

  const disconnectedMoveRejected = await expectActionRejected(
    host,
    {
      actionId: 'x-without-peer',
      expectedSequence: 2,
      index: 14,
      player: 'X',
      type: 'move',
    },
    'peer-unavailable',
  );
  assert.equal(disconnectedMoveRejected.snapshot.sequence, 2);
  assert.equal(disconnectedMoveRejected.snapshot.board[14], null);

  guest = await openClient(url);
  const hostSawGuestRejoin = waitFor(
    host,
    (message) => message.type === 'peer-joined',
    'guest peer rejoined',
  );
  const guestRejoined = await sendAndWait(
    guest,
    {
      player: 'O',
      roomId: room.roomId,
      sessionId: joined.sessionId,
      type: 'rejoin-room',
    },
    (message) =>
      message.type === 'room-rejoined' && message.player === 'O',
    'guest room-rejoined',
  );
  await hostSawGuestRejoin;
  assert.equal(guestRejoined.snapshot.sequence, 2);
  assert.equal(guestRejoined.snapshot.board[13], 'X');
  assert.equal(guestRejoined.snapshot.board[0], 'O');

  const previousGuest = guest;
  guest = await openClient(url);
  const previousGuestClosed = waitClose(
    previousGuest,
    'superseded guest transport',
  );
  const hostSawGuestTransportReplace = waitFor(
    host,
    (message) => message.type === 'peer-joined',
    'replacement guest peer-joined',
  );
  const replacedGuestSession = await sendAndWait(
    guest,
    {
      player: 'O',
      roomId: room.roomId,
      sessionId: joined.sessionId,
      type: 'rejoin-room',
    },
    (message) => message.type === 'room-rejoined' && message.player === 'O',
    'active guest transport replacement',
  );
  const replacedTransportClose = await previousGuestClosed;
  await hostSawGuestTransportReplace;
  assert.equal(replacedTransportClose.code, 4000);
  assert.equal(replacedGuestSession.snapshot.sequence, 2);

  const moveBeforeAckDisconnect = waitFor(
    guest,
    (message) =>
      message.type === 'move' && message.actionId === 'x-lost-ack',
    'move committed before acknowledgement disconnect',
  );
  const guestSawHostLeave = waitFor(
    guest,
    (message) => message.type === 'peer-left',
    'host peer-left after lost acknowledgement',
  );
  host.send(
    JSON.stringify({
      actionId: 'x-lost-ack',
      expectedSequence: 2,
      index: 14,
      player: 'X',
      type: 'move',
    }),
  );
  host.terminate();
  const committedMove = await moveBeforeAckDisconnect;
  await guestSawHostLeave;
  assert.equal(committedMove.sequence, 3);
  assert.equal(committedMove.snapshot.board[14], 'X');

  host = await openClient(url);
  const guestSawHostRejoin = waitFor(
    guest,
    (message) => message.type === 'peer-joined',
    'host peer rejoined',
  );
  const hostRejoined = await sendAndWait(
    host,
    {
      player: 'X',
      roomId: room.roomId,
      sessionId: room.sessionId,
      type: 'rejoin-room',
    },
    (message) =>
      message.type === 'room-rejoined' && message.player === 'X',
    'host room-rejoined',
  );
  await guestSawHostRejoin;
  assert.equal(hostRejoined.snapshot.sequence, 3);
  assert.equal(hostRejoined.snapshot.board[14], 'X');

  const activeRoundResetRejected = await expectActionRejected(
    guest,
    {
      actionId: 'reset-active-round',
      expectedSequence: 3,
      type: 'reset-round',
    },
    'round-active',
  );
  const activeMatchResetRejected = await expectActionRejected(
    host,
    {
      actionId: 'reset-active-match',
      expectedSequence: 3,
      type: 'reset-match',
    },
    'match-active',
  );

  let sequence = 3;
  const play = async (sender, receiver, index, player, actionId) => {
    const [ack] = await sendAction({
      actionId,
      expectedSequence: sequence,
      index,
      player,
      receiver,
      sender,
      type: 'move',
    });

    sequence = ack.sequence;
    return ack.snapshot;
  };

  await play(guest, host, 1, 'O', 'round-o-1');
  const completedSnapshot = await play(host, guest, 12, 'X', 'round-x-win');

  assert.equal(completedSnapshot.result.winner, 'X');
  assert.equal(completedSnapshot.match.score.X, 1);
  assert.equal(completedSnapshot.match.roundNumber, 1);

  /* Active resets are rejected above; completed rounds can advance. */
  const completedRoundReady = completedSnapshot.result.isComplete;
  assert.equal(completedRoundReady, true);

  const hostSawScoredGuestLeave = waitFor(
    host,
    (message) => message.type === 'peer-left',
    'scored guest peer-left',
  );
  guest.close();
  await hostSawScoredGuestLeave;
  guest = await openClient(url);
  const hostSawScoredGuestRejoin = waitFor(
    host,
    (message) => message.type === 'peer-joined',
    'scored guest peer rejoined',
  );
  const scoredRejoin = await sendAndWait(
    guest,
    {
      player: 'O',
      roomId: room.roomId,
      sessionId: joined.sessionId,
      type: 'rejoin-room',
    },
    (message) => message.type === 'room-rejoined',
    'scored room-rejoined snapshot',
  );
  await hostSawScoredGuestRejoin;
  assert.equal(scoredRejoin.snapshot.sequence, sequence);
  assert.equal(scoredRejoin.snapshot.result.winner, 'X');
  assert.equal(scoredRejoin.snapshot.match.score.X, 1);
  assert.deepEqual(scoredRejoin.settings, settings);
  assert.deepEqual(scoredRejoin.snapshot.board, completedSnapshot.board);

  const [completedRoundReset] = await sendAction({
    actionId: 'advance-round',
    expectedSequence: sequence,
    receiver: host,
    sender: guest,
    type: 'reset-round',
  });
  sequence = completedRoundReset.sequence;
  assert.equal(completedRoundReset.snapshot.match.roundNumber, 2);
  assert.equal(completedRoundReset.snapshot.match.opener, 'O');
  assert.equal(completedRoundReset.snapshot.currentPlayer, 'O');
  assert.equal(completedRoundReset.snapshot.match.score.X, 1);

  await play(guest, host, 0, 'O', 'round-2-o-0');
  await play(host, guest, 12, 'X', 'round-2-x-12');
  await play(guest, host, 1, 'O', 'round-2-o-1');
  await play(host, guest, 13, 'X', 'round-2-x-13');
  await play(guest, host, 3, 'O', 'round-2-o-3');
  const secondCompleted = await play(host, guest, 14, 'X', 'round-2-x-win');
  assert.equal(secondCompleted.match.score.X, 2);

  const [secondRoundReset] = await sendAction({
    actionId: 'advance-round-3',
    expectedSequence: sequence,
    receiver: guest,
    sender: host,
    type: 'reset-round',
  });
  sequence = secondRoundReset.sequence;
  assert.equal(secondRoundReset.snapshot.match.roundNumber, 3);
  assert.equal(secondRoundReset.snapshot.currentPlayer, 'X');

  await play(host, guest, 12, 'X', 'round-3-x-12');
  await play(guest, host, 0, 'O', 'round-3-o-0');
  await play(host, guest, 13, 'X', 'round-3-x-13');
  await play(guest, host, 1, 'O', 'round-3-o-1');
  const matchCompleted = await play(host, guest, 14, 'X', 'round-3-x-win');
  assert.equal(matchCompleted.match.isComplete, true);
  assert.equal(matchCompleted.match.winner, 'X');
  assert.equal(matchCompleted.match.score.X, 3);

  const [matchResetAck, matchReset] = await sendAction({
    actionId: 'reset-match',
    expectedSequence: sequence,
    receiver: guest,
    sender: host,
    type: 'reset-match',
  });
  sequence = matchResetAck.sequence;
  assert.equal(matchReset.snapshot.match.roundNumber, 1);
  assert.deepEqual(matchReset.snapshot.match.score, { O: 0, X: 0, draws: 0 });
  assert.equal(matchReset.snapshot.currentPlayer, 'X');

  const invalidEnvelopeRejected = await expectActionRejected(
    host,
    { index: 3, player: 'X', type: 'move' },
    'invalid-action',
    'legacy unsequenced move rejection',
  );
  assert.equal(invalidEnvelopeRejected.snapshot.sequence, sequence);

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
  const capacityRoom = await sendAndWait(
    capacityHost,
    { type: 'create-room' },
    (message) => message.type === 'room-created',
    'capacity room-created',
  );
  const replacementCapacityRoom = await sendAndWait(
    capacityHost,
    { type: 'create-room' },
    (message) => message.type === 'room-created',
    'same client replaces its abandoned room',
  );
  assert.notEqual(replacementCapacityRoom.roomId, capacityRoom.roomId);
  assert.equal(capacityServer.rooms.has(capacityRoom.roomId), false);
  assert.equal(capacityServer.rooms.size, 1);
  const capacityRejected = await sendAndWait(
    capacityOverflow,
    { type: 'create-room' },
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

  const roomCleanedUp = !server.rooms.has(room.roomId);
  assert.equal(roomCleanedUp, true, 'expired rooms must be removed');

  console.log(
    JSON.stringify(
      {
        acknowledgements: {
          duplicateWasIdempotent: duplicateAck.sequence === 1,
          latestSequence: sequence,
          move: firstMoveAck.type,
        },
        activeResetRejections: {
          match: activeMatchResetRejected.code,
          round: activeRoundResetRejected.code,
        },
        capacityRejected,
        capacityRoom: replacementCapacityRoom.roomId,
        clientLimitRejected,
        defaultJoined: defaultJoined.roomId,
        disconnectRecovery: {
          committedSequence: hostRejoined.snapshot.sequence,
          rejectedWithoutPeer: disconnectedMoveRejected.code,
        },
        health,
        invalidEnvelopeRejected: invalidEnvelopeRejected.code,
        invalidRoomCodeRejected,
        invalidSettingsRejected,
        unsupportedPieRejected,
        originRejected,
        peerJoined: peerJoined.type,
        rejoinMatchScore: scoredRejoin.snapshot.match.score,
        rejectedMoves: {
          occupied: occupiedRejected.code,
          outOfTurn: outOfTurnRejected.code,
          replay: replayRejected.code,
          reusedAction: reusedActionRejected.code,
          spoof: spoofRejected.code,
        },
        roomCleanedUp,
        seatTakeoverRejected: seatTakeoverRejected.message,
      },
      null,
      2,
    ),
  );
} finally {
  host.close();
  guest.close();
  invalidClient.close();
  unsupportedPieClient.close();
  invalidRoomClient.close();
  defaultHost.close();
  defaultGuest.close();
  await server.close();
}
