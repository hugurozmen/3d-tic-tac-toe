import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameDialogs, PendingConfirm } from './components/GameDialogs';
import { GamePanel } from './components/GamePanel';
import { GameStage, preloadBoardScene } from './components/GameStage';
import { ViewSelector } from './components/ViewSelector';
import type {
  BoardLayout,
  BoardViewAction,
  BoardViewCommand,
} from './game/boardView';
import { chooseAiMove } from './game/ai';
import { setFeedbackMuted } from './game/feedback';
import {
  DIFFICULTY_OPTIONS,
  LAYOUT_OPTIONS,
  MODE_DESCRIPTION,
} from './game/options';
import {
  Difficulty,
  GameMode,
  PLAYERS,
  Player,
  getOtherPlayer,
} from './game/rules';
import { useMatchState } from './game/useMatchState';
import { useOnlineGame } from './game/useOnlineGame';
import { THEME_ORDER, THEMES, ThemeId, themeToCssVariables } from './theme';
import { useLocalStorageState } from './useLocalStorageState';

const getInitialLayout = (): BoardLayout => {
  if (window.matchMedia('(max-width: 900px)').matches) {
    return 'scanner';
  }

  return 'cube';
};

export function App() {
  const {
    applyMove,
    board,
    currentPlayer,
    currentPlayerRef,
    lastMove,
    oMoves,
    resetMatch,
    resetRound,
    result,
    roundsPlayed,
    score,
    xMoves,
  } = useMatchState();
  const [mode, setMode] = useState<GameMode>('solo');
  const [difficulty, setDifficulty] = useLocalStorageState<Difficulty>(
    '3dxox-difficulty',
    'balanced',
    DIFFICULTY_OPTIONS,
  );
  const [themeId, setThemeId] = useLocalStorageState<ThemeId>(
    '3dxox-theme',
    'glass',
    THEME_ORDER,
  );
  const [layout, setLayout] = useLocalStorageState<BoardLayout>(
    '3dxox-layout',
    getInitialLayout(),
    LAYOUT_OPTIONS,
  );
  const [humanSide, setHumanSide] = useLocalStorageState<Player>(
    '3dxox-side',
    'X',
    PLAYERS,
  );
  const [soundSetting, setSoundSetting] = useLocalStorageState(
    '3dxox-sound',
    'on',
    ['on', 'off'] as const,
  );
  const [onboarded, setOnboarded] = useLocalStorageState(
    '3dxox-guide',
    'pending',
    ['pending', 'done'] as const,
  );
  const [guideOpen, setGuideOpen] = useState(onboarded === 'pending');
  const [viewCommand, setViewCommand] = useState<BoardViewCommand | null>(null);
  const [remoteSignal, setRemoteSignal] = useState('');
  const [copiedSignal, setCopiedSignal] = useState(false);
  const stageRef = useRef<HTMLElement | null>(null);
  const remotePlayerRef = useRef<Player | null>(null);
  const aiWorkerRef = useRef<Worker | null>(null);
  const aiRequestIdRef = useRef(0);
  const noticeTimeoutRef = useRef<number | null>(null);
  const [scannerFloor, setScannerFloor] = useState(1);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null,
  );
  const [stageNotice, setStageNotice] = useState<string | null>(null);
  const theme = THEMES[themeId];
  const themeStyle = useMemo(() => themeToCssVariables(theme), [theme]);
  const aiPlayer = getOtherPlayer(humanSide);
  const isAiTurn =
    mode === 'solo' &&
    currentPlayer === aiPlayer &&
    !result.winner &&
    !result.isDraw;

  useEffect(() => {
    setFeedbackMuted(soundSetting === 'off');
  }, [soundSetting]);

  useEffect(() => {
    if (layout !== 'scanner') {
      preloadBoardScene();
      return;
    }

    if (window.matchMedia('(max-width: 900px)').matches) {
      return;
    }

    const preloadTimer = window.setTimeout(preloadBoardScene, 900);

    return () => window.clearTimeout(preloadTimer);
  }, [layout]);

  const flashNotice = useCallback((text: string) => {
    setStageNotice(text);

    if (noticeTimeoutRef.current !== null) {
      window.clearTimeout(noticeTimeoutRef.current);
    }

    noticeTimeoutRef.current = window.setTimeout(
      () => setStageNotice(null),
      2600,
    );
  }, []);

  useEffect(
    () => () => {
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
    },
    [],
  );

  const onlineHandlers = useMemo(
    () => ({
      onRemoteMatchReset: () => {
        resetMatch();
        flashNotice('Opponent reset the match');
      },
      onRemoteMove: (index: number, player: Player) => {
        // only accept moves the remote side is actually allowed to make
        if (
          player !== remotePlayerRef.current ||
          player !== currentPlayerRef.current
        ) {
          return;
        }

        applyMove(index, player);
      },
      onRemoteRoundReset: () => {
        resetRound();
        flashNotice('Opponent started a new round');
      },
    }),
    [applyMove, flashNotice, resetMatch, resetRound],
  );
  const online = useOnlineGame(onlineHandlers);

  useEffect(() => {
    remotePlayerRef.current = online.remotePlayer;
  }, [online.remotePlayer]);

  const isOnlineTurn =
    mode === 'online' &&
    online.isConnected &&
    online.localPlayer === currentPlayer;
  const isBoardDisabled =
    isAiTurn ||
    Boolean(result.winner) ||
    result.isDraw ||
    (mode === 'online' && !isOnlineTurn);

  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme.ui.background);
    document.documentElement.style.colorScheme = theme.ui.scheme;
  }, [theme]);

  useEffect(() => {
    if (mode !== 'online') {
      online.close();
      setRemoteSignal('');
    }
  }, [mode, online.close]);

  useEffect(() => () => aiWorkerRef.current?.terminate(), []);

  useEffect(() => {
    if (!isAiTurn) {
      return;
    }

    const id = aiRequestIdRef.current + 1;

    aiRequestIdRef.current = id;

    const startedAt = performance.now();
    let pendingTimeout: number | null = null;

    const applyAiMove = (move: number | null) => {
      if (aiRequestIdRef.current !== id || move === null) {
        return;
      }

      // keep a short "thinking" pause even when the move comes back instantly
      const remaining = Math.max(0, 520 - (performance.now() - startedAt));

      pendingTimeout = window.setTimeout(() => {
        if (aiRequestIdRef.current === id) {
          applyMove(move, aiPlayer);
        }
      }, remaining);
    };

    if (!aiWorkerRef.current) {
      try {
        aiWorkerRef.current = new Worker(
          new URL('./game/aiWorker.ts', import.meta.url),
          { type: 'module' },
        );
      } catch {
        aiWorkerRef.current = null;
      }
    }

    const worker = aiWorkerRef.current;

    if (!worker) {
      pendingTimeout = window.setTimeout(
        () => applyAiMove(chooseAiMove(board, aiPlayer, difficulty)),
        40,
      );
    } else {
      worker.onmessage = (
        event: MessageEvent<{ id: number; move: number | null }>,
      ) => {
        if (event.data.id === id) {
          applyAiMove(event.data.move);
        }
      };
      worker.onerror = () => {
        worker.terminate();
        aiWorkerRef.current = null;
        applyAiMove(chooseAiMove(board, aiPlayer, difficulty));
      };
      worker.postMessage({ board, difficulty, id, player: aiPlayer });
    }

    return () => {
      aiRequestIdRef.current += 1;

      if (pendingTimeout !== null) {
        window.clearTimeout(pendingTimeout);
      }
    };
  }, [aiPlayer, applyMove, board, difficulty, isAiTurn]);

  const status = useMemo(() => {
    if (result.winner) {
      return `${result.winner} wins`;
    }

    if (result.isDraw) {
      return 'Draw';
    }

    if (isAiTurn) {
      return `${aiPlayer} thinking`;
    }

    if (mode === 'online') {
      if (!online.localPlayer) {
        return 'Pair online';
      }

      if (!online.isConnected) {
        return online.status === 'waiting' ? 'Room ready' : 'Online setup';
      }

      if (online.localPlayer !== currentPlayer) {
        return `${currentPlayer} remote`;
      }
    }

    return `${currentPlayer} turn`;
  }, [
    aiPlayer,
    currentPlayer,
    isAiTurn,
    mode,
    online.isConnected,
    online.localPlayer,
    online.status,
    result.isDraw,
    result.winner,
  ]);

  const handleSelect = useCallback(
    (index: number) => {
      if (isAiTurn) {
        return;
      }

      if (mode === 'online') {
        if (!online.isConnected || !online.localPlayer) {
          return;
        }

        if (
          board[index] ||
          result.winner ||
          result.isDraw ||
          online.localPlayer !== currentPlayer
        ) {
          return;
        }

        if (!online.sendMove(index, online.localPlayer)) {
          flashNotice('Reconnect the room before moving');
          return;
        }

        applyMove(index, online.localPlayer);
        return;
      }

      applyMove(index);
    },
    [
      applyMove,
      board,
      currentPlayer,
      flashNotice,
      isAiTurn,
      mode,
      online,
      result.isDraw,
      result.winner,
    ],
  );

  const roundInProgress =
    !result.winner && !result.isDraw && board.some(Boolean);

  const requestRoundReset = (message: string, run: () => void) => {
    if (roundInProgress) {
      setPendingConfirm({ message, run });
      return;
    }

    run();
  };

  const handleModeChange = (nextMode: GameMode) => {
    if (nextMode === mode) {
      return;
    }

    requestRoundReset(
      `Switching to ${MODE_DESCRIPTION[nextMode]} ends the current round without scoring it.`,
      () => {
        setMode(nextMode);
        resetRound();
      },
    );
  };

  const handleSideChange = (side: Player) => {
    if (side === humanSide) {
      return;
    }

    requestRoundReset(
      'Switching sides ends the current round without scoring it.',
      () => {
        setHumanSide(side);
        resetRound();
      },
    );
  };

  const confirmPending = () => {
    pendingConfirm?.run();
    setPendingConfirm(null);
  };

  useEffect(() => {
    if (!pendingConfirm) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPendingConfirm(null);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingConfirm]);

  const closeGuide = () => {
    setGuideOpen(false);
    setOnboarded('done');
  };

  const handleDifficultyChange = (nextDifficulty: Difficulty) => {
    // applies immediately — the AI simply thinks at the new level from now on
    setDifficulty(nextDifficulty);
  };

  const restoreStageForMobile = useCallback(() => {
    if (!window.matchMedia('(max-width: 900px)').matches) {
      return;
    }

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    window.requestAnimationFrame(() => {
      stageRef.current?.scrollIntoView({
        block: 'start',
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    });
  }, []);

  const handleLayoutChange = useCallback(
    (nextLayout: BoardLayout) => {
      setLayout(nextLayout);
      restoreStageForMobile();
    },
    [restoreStageForMobile, setLayout],
  );

  const sendViewCommand = useCallback((action: BoardViewAction) => {
    setViewCommand((previous) => ({
      action,
      id: (previous?.id ?? 0) + 1,
    }));
  }, []);

  const handleOnlineSignal = () => {
    const roomCode = remoteSignal.trim();

    if (!roomCode) {
      return;
    }

    resetMatch();
    void online.joinOffer(roomCode);
  };

  const handleHostOnline = () => {
    resetMatch();
    setRemoteSignal('');
    void online.startHost();
  };

  const handleResetRound = () => {
    if (mode === 'online' && !online.sendRoundReset()) {
      flashNotice('Reconnect the room before resetting');
      return;
    }

    resetRound();
  };

  const handleResetMatch = () => {
    if (mode === 'online' && !online.sendMatchReset()) {
      flashNotice('Reconnect the room before resetting');
      return;
    }

    resetMatch();
  };

  const handleCopySignal = async () => {
    if (!online.localSignal) {
      return;
    }

    try {
      await navigator.clipboard.writeText(online.localSignal);
      setCopiedSignal(true);
      window.setTimeout(() => setCopiedSignal(false), 1400);
    } catch {
      setCopiedSignal(false);
    }
  };

  return (
    <main className="app-shell" data-theme={themeId} style={themeStyle}>
      <GameStage
        ref={stageRef}
        board={board}
        currentPlayer={currentPlayer}
        disabled={isBoardDisabled}
        lastMove={lastMove}
        layout={layout}
        result={result}
        scannerFloor={scannerFloor}
        stageNotice={stageNotice}
        theme={theme.scene}
        viewCommand={viewCommand}
        onFloorChange={setScannerFloor}
        onResetRound={handleResetRound}
        onSelect={handleSelect}
        onViewCommand={sendViewCommand}
      />

      <ViewSelector
        className="mobile-view-selector"
        layout={layout}
        onChange={handleLayoutChange}
      />

      <GamePanel
        copiedSignal={copiedSignal}
        currentPlayer={currentPlayer}
        difficulty={difficulty}
        humanSide={humanSide}
        lastMove={lastMove}
        layout={layout}
        mode={mode}
        oMoves={oMoves}
        online={online}
        remoteSignal={remoteSignal}
        result={result}
        roundsPlayed={roundsPlayed}
        score={score}
        soundSetting={soundSetting}
        status={status}
        themeId={themeId}
        xMoves={xMoves}
        onCopySignal={handleCopySignal}
        onDifficultyChange={handleDifficultyChange}
        onHostOnline={handleHostOnline}
        onLayoutChange={handleLayoutChange}
        onModeChange={handleModeChange}
        onOnlineSignal={handleOnlineSignal}
        onOpenGuide={() => setGuideOpen(true)}
        onRemoteSignalChange={setRemoteSignal}
        onResetMatch={handleResetMatch}
        onResetRound={handleResetRound}
        onSideChange={handleSideChange}
        onThemeChange={setThemeId}
        onToggleSound={() =>
          setSoundSetting(soundSetting === 'on' ? 'off' : 'on')
        }
      />

      <GameDialogs
        guideOpen={guideOpen}
        pendingConfirm={pendingConfirm}
        onCancelConfirm={() => setPendingConfirm(null)}
        onCloseGuide={closeGuide}
        onConfirmPending={confirmPending}
      />
    </main>
  );
}
