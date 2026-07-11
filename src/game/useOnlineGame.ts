import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatchState } from './match';
import type { Board, GameRuleset, Player } from './rules';

type OnlineRole = 'guest' | 'host';
export type OnlineStatus =
  | 'idle'
  | 'connecting'
  | 'waiting'
  | 'peer-waiting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export type OnlineActionType = 'move' | 'reset-match' | 'reset-round';

export type OnlineGameSnapshot = {
  board: Board;
  currentPlayer: Player;
  lastMove: number | null;
  match: MatchState;
  result: {
    isComplete: boolean;
    isDraw: boolean;
    lineScores: Record<Player, number>;
    winner: Player | null;
  };
  sequence: number;
  version: 1;
};

export type OnlineSnapshotReason =
  | 'peer-joined'
  | 'rejected'
  | 'resync'
  | 'room-created'
  | 'room-joined'
  | 'room-rejoined';

export type PendingOnlineAction = {
  actionId: string;
  index?: number;
  player?: Player;
  type: OnlineActionType;
};

export type OnlineActionRejection = {
  actionId: string | null;
  code: string;
  message: string;
};

type RemoteActionMessage =
  | {
      actionId: string;
      index: number;
      player: Player;
      sequence: number;
      snapshot: OnlineGameSnapshot;
      type: 'move';
    }
  | {
      actionId: string;
      sequence: number;
      snapshot: OnlineGameSnapshot;
      type: 'reset-round';
    }
  | {
      actionId: string;
      sequence: number;
      snapshot: OnlineGameSnapshot;
      type: 'reset-match';
    };

export type OnlineRoomSettings = {
  classicPieRule: boolean;
  ruleset: GameRuleset;
};

type RoomMessage = {
  player: Player;
  roomId: string;
  sessionId: string;
  settings: OnlineRoomSettings;
  snapshot: OnlineGameSnapshot;
} & ({ type: 'room-created' } | { type: 'room-joined' });

type RejoinedMessage = {
  peerConnected: boolean;
  player: Player;
  roomId: string;
  sessionId: string;
  settings: OnlineRoomSettings;
  snapshot: OnlineGameSnapshot;
  type: 'room-rejoined';
};

type ServerMessage =
  | RoomMessage
  | RejoinedMessage
  | {
      settings?: OnlineRoomSettings;
      snapshot: OnlineGameSnapshot;
      type: 'peer-joined';
    }
  | {
      snapshot?: OnlineGameSnapshot;
      type: 'peer-left';
    }
  | {
      action: OnlineActionType;
      actionId: string;
      sequence: number;
      snapshot: OnlineGameSnapshot;
      type: 'action-ack';
    }
  | {
      actionId: string | null;
      code: string;
      message: string;
      snapshot: OnlineGameSnapshot;
      type: 'action-rejected';
    }
  | {
      message: string;
      type: 'error';
    }
  | RemoteActionMessage;

export type OnlineHandlers = {
  onAuthoritativeSnapshot?: (
    snapshot: OnlineGameSnapshot,
    reason: OnlineSnapshotReason,
  ) => void;
  onLocalMatchResetAcknowledged?: (snapshot: OnlineGameSnapshot) => void;
  onLocalMoveAcknowledged?: (
    index: number,
    player: Player,
    snapshot: OnlineGameSnapshot,
  ) => void;
  onLocalRoundResetAcknowledged?: (snapshot: OnlineGameSnapshot) => void;
  onRemoteMatchReset: (snapshot: OnlineGameSnapshot) => void;
  onRemoteMove: (
    index: number,
    player: Player,
    snapshot: OnlineGameSnapshot,
  ) => void;
  onRemoteRoundReset: (snapshot: OnlineGameSnapshot) => void;
  onRoomSettings: (settings: OnlineRoomSettings) => void;
};

const DEFAULT_SERVER_PORT = '8787';
const ACTION_ACK_TIMEOUT_MS = 8000;
const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
const ONLINE_SERVER_MISSING =
  'Online server is not configured. Set VITE_ONLINE_SERVER_URL to a wss:// room server before publishing Online mode.';

export type OnlineServerConfig =
  | {
      error: null;
      isConfigured: true;
      source: 'env' | 'local';
      url: string;
    }
  | {
      error: string;
      isConfigured: false;
      source: 'invalid' | 'missing';
      url: null;
    };

const isLocalHostname = (hostname: string) =>
  LOCAL_HOSTS.has(hostname) ||
  hostname.endsWith('.localhost') ||
  hostname.endsWith('.local');

const isLocalWebSocketUrl = (url: URL) => isLocalHostname(url.hostname);

export const resolveOnlineServerConfig = ({
  configured,
  hostname,
  protocol,
}: {
  configured?: string;
  hostname: string;
  protocol: string;
}): OnlineServerConfig => {
  const trimmed = configured?.trim();

  if (trimmed) {
    try {
      const parsed = new URL(trimmed);

      if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
        return {
          error: 'Online server URL must start with ws:// or wss://.',
          isConfigured: false,
          source: 'invalid',
          url: null,
        };
      }

      if (
        protocol === 'https:' &&
        parsed.protocol === 'ws:' &&
        !isLocalWebSocketUrl(parsed)
      ) {
        return {
          error:
            'Online server must use wss:// when the game is served over HTTPS.',
          isConfigured: false,
          source: 'invalid',
          url: null,
        };
      }

      return {
        error: null,
        isConfigured: true,
        source: 'env',
        url: parsed.toString(),
      };
    } catch {
      return {
        error: 'Online server URL is invalid.',
        isConfigured: false,
        source: 'invalid',
        url: null,
      };
    }
  }

  const host = hostname || '127.0.0.1';

  if (isLocalHostname(host)) {
    const socketProtocol = protocol === 'https:' ? 'wss' : 'ws';

    return {
      error: null,
      isConfigured: true,
      source: 'local',
      url: `${socketProtocol}://${host}:${DEFAULT_SERVER_PORT}`,
    };
  }

  return {
    error: ONLINE_SERVER_MISSING,
    isConfigured: false,
    source: 'missing',
    url: null,
  };
};

const isPlayer = (value: unknown): value is Player =>
  value === 'X' || value === 'O';

const isRuleset = (value: unknown): value is GameRuleset =>
  value === 'lines' || value === 'classic';

const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0;

const isRoomSettings = (value: unknown): value is OnlineRoomSettings => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const settings = value as Partial<OnlineRoomSettings>;

  return (
    isRuleset(settings.ruleset) &&
    settings.classicPieRule === false
  );
};

const roleForPlayer = (player: Player): OnlineRole =>
  player === 'X' ? 'host' : 'guest';

const playerForRole = (role: OnlineRole): Player =>
  role === 'host' ? 'X' : 'O';

const isScore = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const score = value as Partial<MatchState['score']>;

  return (
    isNonNegativeInteger(score.X) &&
    isNonNegativeInteger(score.O) &&
    isNonNegativeInteger(score.draws)
  );
};

const isLineScores = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const scores = value as Partial<Record<Player, number>>;

  return isNonNegativeInteger(scores.X) && isNonNegativeInteger(scores.O);
};

const isMatchSnapshot = (value: unknown): value is MatchState => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const match = value as Partial<MatchState>;

  return (
    typeof match.isComplete === 'boolean' &&
    isPlayer(match.nextOpener) &&
    isPlayer(match.opener) &&
    isNonNegativeInteger(match.roundNumber) &&
    Number(match.roundNumber) >= 1 &&
    isScore(match.score) &&
    isNonNegativeInteger(match.targetWins) &&
    Number(match.targetWins) >= 1 &&
    (match.winner === null || isPlayer(match.winner))
  );
};

export const isOnlineGameSnapshot = (
  value: unknown,
): value is OnlineGameSnapshot => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const snapshot = value as Partial<OnlineGameSnapshot>;
  const result = snapshot.result as
    | Partial<OnlineGameSnapshot['result']>
    | undefined;

  return (
    snapshot.version === 1 &&
    isNonNegativeInteger(snapshot.sequence) &&
    Array.isArray(snapshot.board) &&
    snapshot.board.length === 27 &&
    snapshot.board.every((cell) => cell === null || isPlayer(cell)) &&
    isPlayer(snapshot.currentPlayer) &&
    (snapshot.lastMove === null ||
      (Number.isInteger(snapshot.lastMove) &&
        Number(snapshot.lastMove) >= 0 &&
        Number(snapshot.lastMove) < 27)) &&
    isMatchSnapshot(snapshot.match) &&
    Boolean(result) &&
    typeof result?.isComplete === 'boolean' &&
    typeof result.isDraw === 'boolean' &&
    (result.winner === null || isPlayer(result.winner)) &&
    isLineScores(result.lineScores)
  );
};

const isActionType = (value: unknown): value is OnlineActionType =>
  value === 'move' || value === 'reset-round' || value === 'reset-match';

const hasAuthoritativeActionEnvelope = (message: {
  [key: string]: unknown;
}) =>
  typeof message.actionId === 'string' &&
  isNonNegativeInteger(message.sequence) &&
  isOnlineGameSnapshot(message.snapshot) &&
  message.sequence === message.snapshot.sequence;

const isRemoteActionMessage = (
  value: unknown,
): value is RemoteActionMessage => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as { [key: string]: unknown };

  if (!hasAuthoritativeActionEnvelope(message)) {
    return false;
  }

  if (message.type === 'reset-round' || message.type === 'reset-match') {
    return true;
  }

  return (
    message.type === 'move' &&
    typeof message.index === 'number' &&
    Number.isInteger(message.index) &&
    message.index >= 0 &&
    message.index < 27 &&
    isPlayer(message.player)
  );
};

const isRoomMessage = (message: {
  [key: string]: unknown;
}): message is RoomMessage =>
  (message.type === 'room-created' || message.type === 'room-joined') &&
  typeof message.roomId === 'string' &&
  typeof message.sessionId === 'string' &&
  isRoomSettings(message.settings) &&
  isOnlineGameSnapshot(message.snapshot) &&
  isPlayer(message.player);

export const parseOnlineServerMessage = (
  data: string,
): ServerMessage | null => {
  try {
    const message = JSON.parse(data);

    if (!message || typeof message !== 'object') {
      return null;
    }

    if (isRemoteActionMessage(message)) {
      return message;
    }

    if (isRoomMessage(message)) {
      return message;
    }

    if (
      message.type === 'room-rejoined' &&
      typeof message.roomId === 'string' &&
      typeof message.sessionId === 'string' &&
      typeof message.peerConnected === 'boolean' &&
      isRoomSettings(message.settings) &&
      isOnlineGameSnapshot(message.snapshot) &&
      isPlayer(message.player)
    ) {
      return message;
    }

    if (
      message.type === 'peer-joined' &&
      (message.settings === undefined || isRoomSettings(message.settings)) &&
      isOnlineGameSnapshot(message.snapshot)
    ) {
      return message;
    }

    if (
      message.type === 'peer-left' &&
      (message.snapshot === undefined || isOnlineGameSnapshot(message.snapshot))
    ) {
      return message;
    }

    if (
      message.type === 'action-ack' &&
      isActionType(message.action) &&
      hasAuthoritativeActionEnvelope(message)
    ) {
      return message;
    }

    if (
      message.type === 'action-rejected' &&
      (message.actionId === null || typeof message.actionId === 'string') &&
      typeof message.code === 'string' &&
      typeof message.message === 'string' &&
      isOnlineGameSnapshot(message.snapshot)
    ) {
      return message;
    }

    if (message.type === 'error' && typeof message.message === 'string') {
      return message;
    }

    return null;
  } catch {
    return null;
  }
};

export function useOnlineGame(handlers: OnlineHandlers) {
  const handlersRef = useRef(handlers);
  const socketRef = useRef<WebSocket | null>(null);
  const snapshotRef = useRef<OnlineGameSnapshot | null>(null);
  const pendingActionRef = useRef<PendingOnlineAction | null>(null);
  const actionCounterRef = useRef(0);
  const serverConfig = useMemo(
    () =>
      resolveOnlineServerConfig({
        configured: import.meta.env.VITE_ONLINE_SERVER_URL,
        hostname: window.location.hostname,
        protocol: window.location.protocol,
      }),
    [],
  );
  const serverUrl = serverConfig.url ?? '';
  const [authoritativeSnapshot, setAuthoritativeSnapshot] =
    useState<OnlineGameSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRejection, setLastRejection] =
    useState<OnlineActionRejection | null>(null);
  const [pendingAction, setPendingAction] =
    useState<PendingOnlineAction | null>(null);
  const [role, setRole] = useState<OnlineRole | null>(null);
  const [roomId, setRoomId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [settings, setSettings] = useState<OnlineRoomSettings | null>(null);
  const [status, setStatus] = useState<OnlineStatus>('idle');

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const storeSnapshot = useCallback((snapshot: OnlineGameSnapshot) => {
    snapshotRef.current = snapshot;
    setAuthoritativeSnapshot(snapshot);
  }, []);

  const reconcileSnapshot = useCallback(
    (snapshot: OnlineGameSnapshot, reason: OnlineSnapshotReason) => {
      storeSnapshot(snapshot);
      handlersRef.current.onAuthoritativeSnapshot?.(snapshot, reason);
    },
    [storeSnapshot],
  );

  const rememberPendingAction = useCallback(
    (next: PendingOnlineAction | null) => {
      pendingActionRef.current = next;
      setPendingAction(next);
    },
    [],
  );

  const disconnectCurrentSocket = useCallback(() => {
    const socket = socketRef.current;

    socketRef.current = null;

    if (!socket) {
      return;
    }

    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;

    if (
      socket.readyState === WebSocket.CONNECTING ||
      socket.readyState === WebSocket.OPEN
    ) {
      socket.close();
    }
  }, []);

  useEffect(() => {
    if (!pendingAction) {
      return;
    }

    const actionId = pendingAction.actionId;
    const timeout = window.setTimeout(() => {
      if (pendingActionRef.current?.actionId !== actionId) {
        return;
      }

      const message = 'Room confirmation timed out. Reconnect before playing.';

      rememberPendingAction(null);
      setLastRejection({ actionId, code: 'ack-timeout', message });
      setError(message);
      setStatus('disconnected');
      disconnectCurrentSocket();
    }, ACTION_ACK_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [disconnectCurrentSocket, pendingAction, rememberPendingAction]);

  const rememberSession = useCallback(
    (
      message: Pick<
        RoomMessage,
        'player' | 'roomId' | 'sessionId' | 'settings'
      >,
    ) => {
      setRole(roleForPlayer(message.player));
      setRoomId(message.roomId);
      setSessionId(message.sessionId);
      setSettings(message.settings);
      handlersRef.current.onRoomSettings(message.settings);
    },
    [],
  );

  const clearSession = useCallback(() => {
    setRole(null);
    setRoomId('');
    setSessionId('');
    setSettings(null);
    snapshotRef.current = null;
    pendingActionRef.current = null;
    setAuthoritativeSnapshot(null);
    setPendingAction(null);
    setLastRejection(null);
  }, []);

  const close = useCallback(() => {
    disconnectCurrentSocket();
    clearSession();
    setError(null);
    setStatus('idle');
  }, [clearSession, disconnectCurrentSocket]);

  useEffect(
    () => () => {
      disconnectCurrentSocket();
    },
    [disconnectCurrentSocket],
  );

  const sendRaw = useCallback((message: unknown) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      socketRef.current.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }, []);

  const attachSocket = useCallback(
    (socket: WebSocket) => {
      socketRef.current = socket;

      socket.onmessage = (event) => {
        const message = parseOnlineServerMessage(String(event.data));

        if (!message) {
          return;
        }

        if (message.type === 'room-created') {
          rememberSession(message);
          rememberPendingAction(null);
          reconcileSnapshot(message.snapshot, 'room-created');
          setError(null);
          setLastRejection(null);
          setStatus('waiting');
          return;
        }

        if (message.type === 'room-joined') {
          rememberSession(message);
          rememberPendingAction(null);
          reconcileSnapshot(message.snapshot, 'room-joined');
          setError(null);
          setLastRejection(null);
          setStatus('connected');
          return;
        }

        if (message.type === 'room-rejoined') {
          rememberSession(message);
          rememberPendingAction(null);
          reconcileSnapshot(message.snapshot, 'room-rejoined');
          setError(null);
          setLastRejection(null);
          setStatus(message.peerConnected ? 'connected' : 'peer-waiting');
          return;
        }

        if (message.type === 'peer-joined') {
          if (message.settings) {
            setSettings(message.settings);
            handlersRef.current.onRoomSettings(message.settings);
          }

          reconcileSnapshot(message.snapshot, 'peer-joined');
          setError(null);
          setLastRejection(null);
          setStatus('connected');
          return;
        }

        if (message.type === 'peer-left') {
          if (
            message.snapshot &&
            message.snapshot.sequence !== snapshotRef.current?.sequence
          ) {
            reconcileSnapshot(message.snapshot, 'resync');
          } else if (message.snapshot) {
            storeSnapshot(message.snapshot);
          }

          rememberPendingAction(null);

          // This socket is still healthy; only the peer left. Keep the room
          // open and wait for its reserved session to rejoin.
          setStatus('peer-waiting');
          return;
        }

        if (message.type === 'action-rejected') {
          if (
            !pendingActionRef.current ||
            message.actionId === null ||
            pendingActionRef.current.actionId === message.actionId
          ) {
            rememberPendingAction(null);
          }

          setLastRejection({
            actionId: message.actionId,
            code: message.code,
            message: message.message,
          });
          setError(message.message);
          reconcileSnapshot(message.snapshot, 'rejected');

          if (message.code === 'peer-unavailable') {
            setStatus('disconnected');
          }

          return;
        }

        if (message.type === 'action-ack') {
          const previous = snapshotRef.current;
          const pending = pendingActionRef.current;

          if (!pending || pending.actionId !== message.actionId) {
            if (!previous || message.sequence > previous.sequence) {
              reconcileSnapshot(message.snapshot, 'resync');
            }

            return;
          }

          rememberPendingAction(null);
          setError(null);
          setLastRejection(null);

          if (
            message.action !== pending.type ||
            !previous ||
            message.sequence !== previous.sequence + 1
          ) {
            reconcileSnapshot(message.snapshot, 'resync');
            return;
          }

          storeSnapshot(message.snapshot);

          if (
            message.action === 'move' &&
            pending.index !== undefined &&
            pending.player
          ) {
            handlersRef.current.onLocalMoveAcknowledged?.(
              pending.index,
              pending.player,
              message.snapshot,
            );
          } else if (message.action === 'reset-round') {
            handlersRef.current.onLocalRoundResetAcknowledged?.(
              message.snapshot,
            );
          } else if (message.action === 'reset-match') {
            handlersRef.current.onLocalMatchResetAcknowledged?.(
              message.snapshot,
            );
          }

          return;
        }

        if (message.type === 'error') {
          setError(message.message);
          setStatus('error');
          return;
        }

        const previous = snapshotRef.current;

        if (!previous || message.sequence !== previous.sequence + 1) {
          if (!previous || message.sequence > previous.sequence) {
            reconcileSnapshot(message.snapshot, 'resync');
          }

          return;
        }

        storeSnapshot(message.snapshot);
        setError(null);
        setLastRejection(null);

        if (message.type === 'move') {
          handlersRef.current.onRemoteMove(
            message.index,
            message.player,
            message.snapshot,
          );
        }

        if (message.type === 'reset-round') {
          handlersRef.current.onRemoteRoundReset(message.snapshot);
        }

        if (message.type === 'reset-match') {
          handlersRef.current.onRemoteMatchReset(message.snapshot);
        }
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }

        setStatus((current) => (current === 'idle' ? current : 'disconnected'));
      };

      socket.onerror = () => {
        setError(`Connection lost: ${serverUrl}`);
        setStatus('error');
      };
    },
    [
      reconcileSnapshot,
      rememberPendingAction,
      rememberSession,
      serverUrl,
      storeSnapshot,
    ],
  );

  const openSocket = useCallback(
    () =>
      new Promise<WebSocket>((resolve, reject) => {
        if (!serverConfig.isConfigured) {
          reject(new Error(serverConfig.error));
          return;
        }

        const socket = new WebSocket(serverUrl);
        const timeout = window.setTimeout(() => {
          socket.close();
          reject(new Error(`Cannot reach ${serverUrl}`));
        }, 4500);

        socket.onopen = () => {
          window.clearTimeout(timeout);
          attachSocket(socket);
          resolve(socket);
        };

        socket.onerror = () => {
          window.clearTimeout(timeout);
          reject(new Error(`Cannot reach ${serverUrl}`));
        };
      }),
    [attachSocket, serverConfig, serverUrl],
  );

  const startHost = useCallback(
    async (roomSettings: OnlineRoomSettings) => {
      close();

      if (!serverConfig.isConfigured) {
        setError(serverConfig.error);
        setStatus('error');
        return;
      }

      setStatus('connecting');
      setRole('host');
      setSettings(roomSettings);

      try {
        const socket = await openSocket();
        socket.send(
          JSON.stringify({ settings: roomSettings, type: 'create-room' }),
        );
      } catch (caught) {
        clearSession();
        setError(caught instanceof Error ? caught.message : 'Could not host');
        setStatus('error');
      }
    },
    [clearSession, close, openSocket, serverConfig],
  );

  const joinOffer = useCallback(
    async (roomCode: string) => {
      close();

      if (!serverConfig.isConfigured) {
        setError(serverConfig.error);
        setStatus('error');
        return;
      }

      setStatus('connecting');
      setRole('guest');

      try {
        const socket = await openSocket();
        socket.send(
          JSON.stringify({
            roomId: roomCode.trim().toUpperCase(),
            type: 'join-room',
          }),
        );
      } catch (caught) {
        clearSession();
        setError(caught instanceof Error ? caught.message : 'Could not join');
        setStatus('error');
      }
    },
    [clearSession, close, openSocket, serverConfig],
  );

  const reconnect = useCallback(async () => {
    if (!serverConfig.isConfigured) {
      setError(serverConfig.error);
      setStatus('error');
      return false;
    }

    if (!role || !roomId || !sessionId) {
      setError('No room session to reconnect');
      setStatus('error');
      return false;
    }

    disconnectCurrentSocket();
    setError(null);
    setLastRejection(null);
    setStatus('reconnecting');

    try {
      const socket = await openSocket();

      socket.send(
        JSON.stringify({
          player: playerForRole(role),
          roomId,
          sessionId,
          type: 'rejoin-room',
        }),
      );

      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reconnect');
      setStatus('disconnected');
      return false;
    }
  }, [
    disconnectCurrentSocket,
    openSocket,
    role,
    roomId,
    serverConfig,
    sessionId,
  ]);

  const createActionId = useCallback(() => {
    actionCounterRef.current += 1;
    const randomPart = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

    return `${randomPart}-${actionCounterRef.current.toString(36)}`.slice(0, 80);
  }, []);

  const sendAction = useCallback(
    (action: Omit<PendingOnlineAction, 'actionId'>) => {
      if (pendingActionRef.current) {
        setError('Waiting for the server to confirm the previous action.');
        return false;
      }

      const snapshot = snapshotRef.current;

      if (!snapshot) {
        setError('Room state is not ready. Reconnect before playing.');
        return false;
      }

      const nextPending: PendingOnlineAction = {
        ...action,
        actionId: createActionId(),
      };
      const delivered = sendRaw({
        ...nextPending,
        expectedSequence: snapshot.sequence,
      });

      if (!delivered && status !== 'idle') {
        setError('Connection is offline. Reconnect the room to keep playing.');
        setStatus('disconnected');
      }

      if (!delivered) {
        return false;
      }

      rememberPendingAction(nextPending);
      setError(null);
      setLastRejection(null);
      return true;
    },
    [createActionId, rememberPendingAction, sendRaw, status],
  );

  const localPlayer: Player | null =
    role === 'host' ? 'X' : role === 'guest' ? 'O' : null;
  const remotePlayer: Player | null =
    role === 'host' ? 'O' : role === 'guest' ? 'X' : null;

  return {
    authoritativeSnapshot,
    canReconnect: Boolean(role && roomId && sessionId),
    close,
    configurationError: serverConfig.error,
    error,
    isConnected: status === 'connected',
    isConfigured: serverConfig.isConfigured,
    lastRejection,
    joinOffer,
    localPlayer,
    localSignal: roomId,
    pendingAction,
    reconnect,
    remotePlayer,
    role,
    sendMatchReset: () => sendAction({ type: 'reset-match' }),
    sendMove: (index: number, player: Player) =>
      sendAction({ index, player, type: 'move' }),
    sendRoundReset: () => sendAction({ type: 'reset-round' }),
    serverUrl,
    serverUrlSource: serverConfig.source,
    startHost,
    status,
    settings,
  };
}
