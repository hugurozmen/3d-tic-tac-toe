import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameRuleset, Player } from './rules';

type OnlineRole = 'guest' | 'host';
export type OnlineStatus =
  | 'idle'
  | 'connecting'
  | 'waiting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

type PeerMessage =
  | {
      index: number;
      player: Player;
      type: 'move';
    }
  | {
      type: 'reset-round';
    }
  | {
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
  type: 'room-created' | 'room-joined';
};

type RejoinedMessage = {
  peerConnected: boolean;
  player: Player;
  roomId: string;
  sessionId: string;
  settings: OnlineRoomSettings;
  type: 'room-rejoined';
};

type ServerMessage =
  | RoomMessage
  | RejoinedMessage
  | {
      settings?: OnlineRoomSettings;
      type: 'peer-joined';
    }
  | {
      type: 'peer-left';
    }
  | {
      message: string;
      type: 'error';
    }
  | PeerMessage;

type OnlineHandlers = {
  onRemoteMatchReset: () => void;
  onRemoteMove: (index: number, player: Player) => void;
  onRemoteRoundReset: () => void;
  onRoomSettings: (settings: OnlineRoomSettings) => void;
};

const DEFAULT_SERVER_PORT = '8787';
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

const isRoomSettings = (value: unknown): value is OnlineRoomSettings => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const settings = value as Partial<OnlineRoomSettings>;

  return (
    isRuleset(settings.ruleset) &&
    typeof settings.classicPieRule === 'boolean'
  );
};

const roleForPlayer = (player: Player): OnlineRole =>
  player === 'X' ? 'host' : 'guest';

const playerForRole = (role: OnlineRole): Player =>
  role === 'host' ? 'X' : 'O';

const isPeerMessage = (value: unknown): value is PeerMessage => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as PeerMessage;

  if (message.type === 'reset-round' || message.type === 'reset-match') {
    return true;
  }

  return (
    message.type === 'move' &&
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
  isPlayer(message.player);

const parseServerMessage = (data: string): ServerMessage | null => {
  try {
    const message = JSON.parse(data);

    if (!message || typeof message !== 'object') {
      return null;
    }

    if (isPeerMessage(message)) {
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
      isPlayer(message.player)
    ) {
      return message;
    }

    if (
      message.type === 'peer-joined' &&
      (message.settings === undefined || isRoomSettings(message.settings))
    ) {
      return message;
    }

    if (message.type === 'peer-left') {
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
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<OnlineRole | null>(null);
  const [roomId, setRoomId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [settings, setSettings] = useState<OnlineRoomSettings | null>(null);
  const [status, setStatus] = useState<OnlineStatus>('idle');

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

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

    socketRef.current.send(JSON.stringify(message));
    return true;
  }, []);

  const attachSocket = useCallback(
    (socket: WebSocket) => {
      socketRef.current = socket;

      socket.onmessage = (event) => {
        const message = parseServerMessage(String(event.data));

        if (!message) {
          return;
        }

        if (message.type === 'room-created') {
          rememberSession(message);
          setError(null);
          setStatus('waiting');
          return;
        }

        if (message.type === 'room-joined') {
          rememberSession(message);
          setError(null);
          setStatus('connected');
          return;
        }

        if (message.type === 'room-rejoined') {
          rememberSession(message);
          setError(null);
          setStatus(message.peerConnected ? 'connected' : 'waiting');
          return;
        }

        if (message.type === 'peer-joined') {
          if (message.settings) {
            setSettings(message.settings);
            handlersRef.current.onRoomSettings(message.settings);
          }

          setError(null);
          setStatus('connected');
          return;
        }

        if (message.type === 'peer-left') {
          setStatus('disconnected');
          return;
        }

        if (message.type === 'error') {
          setError(message.message);
          setStatus('error');
          return;
        }

        if (message.type === 'move') {
          handlersRef.current.onRemoteMove(message.index, message.player);
        }

        if (message.type === 'reset-round') {
          handlersRef.current.onRemoteRoundReset();
        }

        if (message.type === 'reset-match') {
          handlersRef.current.onRemoteMatchReset();
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
    [rememberSession, serverUrl],
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

  const send = useCallback(
    (message: PeerMessage) => {
      const delivered = sendRaw(message);

      if (!delivered && status !== 'idle') {
        setError('Connection is offline. Reconnect the room to keep playing.');
        setStatus('disconnected');
      }

      return delivered;
    },
    [sendRaw, status],
  );

  const localPlayer: Player | null =
    role === 'host' ? 'X' : role === 'guest' ? 'O' : null;
  const remotePlayer: Player | null =
    role === 'host' ? 'O' : role === 'guest' ? 'X' : null;

  return {
    canReconnect: Boolean(role && roomId && sessionId),
    close,
    configurationError: serverConfig.error,
    error,
    isConnected: status === 'connected',
    isConfigured: serverConfig.isConfigured,
    joinOffer,
    localPlayer,
    localSignal: roomId,
    reconnect,
    remotePlayer,
    role,
    sendMatchReset: () => send({ type: 'reset-match' }),
    sendMove: (index: number, player: Player) =>
      send({ index, player, type: 'move' }),
    sendRoundReset: () => send({ type: 'reset-round' }),
    serverUrl,
    serverUrlSource: serverConfig.source,
    startHost,
    status,
    settings,
  };
}
