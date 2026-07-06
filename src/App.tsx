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
import { chooseAiMove, shouldSwapClassicPie } from './game/ai';
import { setFeedbackMuted } from './game/feedback';
import {
  DIFFICULTY_OPTIONS,
  LAYOUT_OPTIONS,
  MODE_DESCRIPTION,
  RULESET_DESCRIPTION,
  RULESET_OPTIONS,
} from './game/options';
import {
  Difficulty,
  GameMode,
  GameRuleset,
  PLAYERS,
  Player,
  getBlockingCells,
  getOtherPlayer,
  getThreatCells,
} from './game/rules';
import {
  getThemeUnlockHooks,
  loadDifficultyStreaks,
  saveDifficultyStreaks,
  saveThemeUnlockHooks,
  updateDifficultyStreak,
} from './game/retention';
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

const COACH_OPTIONS = ['auto', 'on', 'off'] as const;
type CoachSetting = (typeof COACH_OPTIONS)[number];

const aiThinkingDelay: Record<Difficulty, number> = {
  easy: 650,
  balanced: 1050,
  hard: 1250,
  master: 1400,
};

export function App() {
  const [ruleset, setRuleset] = useLocalStorageState<GameRuleset>(
    '3dxox-ruleset',
    'lines',
    RULESET_OPTIONS,
  );
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
    opener,
    recentLines,
  } = useMatchState(ruleset);
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
  const [coachSetting, setCoachSetting] = useLocalStorageState<CoachSetting>(
    '3dxox-coach',
    'auto',
    COACH_OPTIONS,
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
  const streakRoundRef = useRef<string | null>(null);
  const [scannerFloor, setScannerFloor] = useState(1);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null,
  );
  const [stageNotice, setStageNotice] = useState<string | null>(null);
  const [piePromptOpen, setPiePromptOpen] = useState(false);
  const [pieDecisionDone, setPieDecisionDone] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [difficultyStreaks, setDifficultyStreaks] = useState(
    loadDifficultyStreaks,
  );
  const theme = THEMES[themeId];
  const themeStyle = useMemo(() => themeToCssVariables(theme), [theme]);
  const aiPlayer = getOtherPlayer(humanSide);
  const moveCount = xMoves + oMoves;
  const pieRuleEnabled = ruleset === 'classic' && mode !== 'online';
  const pieDecisionPending =
    pieRuleEnabled &&
    !pieDecisionDone &&
    moveCount === 1 &&
    currentPlayer === 'O' &&
    !result.winner &&
    !result.isDraw;
  const isAiTurn =
    mode === 'solo' &&
    currentPlayer === aiPlayer &&
    !result.winner &&
    !result.isDraw &&
    !pieDecisionPending;
  const coachEnabled =
    coachSetting === 'on' || (coachSetting === 'auto' && difficulty === 'easy');
  const coachScoreCells = useMemo(
    () =>
      coachEnabled && !result.winner && !result.isDraw
        ? getThreatCells(board, currentPlayer)
        : [],
    [board, coachEnabled, currentPlayer, result.isDraw, result.winner],
  );
  const coachBlockCells = useMemo(
    () =>
      coachEnabled && !result.winner && !result.isDraw
        ? getBlockingCells(board, currentPlayer)
        : [],
    [board, coachEnabled, currentPlayer, result.isDraw, result.winner],
  );
  const highlightLines =
    ruleset === 'lines'
      ? recentLines
      : result.winningLine.length === 3
        ? [result.winningLine]
        : [];

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

  useEffect(() => {
    if (moveCount === 0) {
      setPieDecisionDone(false);
      setPiePromptOpen(false);
    }
  }, [moveCount]);

  useEffect(() => {
    if (ruleset !== 'lines' || recentLines.length === 0 || lastMove === null) {
      return;
    }

    const scoringPlayer = board[lastMove];

    if (!scoringPlayer) {
      return;
    }

    const lineText = recentLines.length === 1 ? 'line' : 'lines';
    flashNotice(
      `${scoringPlayer} +${recentLines.length} ${lineText} (${result.lineScores.X}-${result.lineScores.O})`,
    );
  }, [
    board,
    flashNotice,
    lastMove,
    recentLines.length,
    result.lineScores.O,
    result.lineScores.X,
    ruleset,
  ]);

  useEffect(() => {
    if (!pieDecisionPending) {
      return;
    }

    if (mode === 'solo' && currentPlayer === aiPlayer) {
      const shouldSwap = shouldSwapClassicPie(board, difficulty);

      setPieDecisionDone(true);

      if (shouldSwap) {
        setHumanSide(getOtherPlayer(humanSide));
        flashNotice('AI swapped sides');
      } else {
        flashNotice('AI kept sides');
      }

      return;
    }

    setPiePromptOpen(true);
  }, [
    aiPlayer,
    board,
    currentPlayer,
    difficulty,
    flashNotice,
    humanSide,
    mode,
    pieDecisionPending,
    setHumanSide,
  ]);

  useEffect(() => {
    if (!result.winner && !result.isDraw) {
      streakRoundRef.current = null;
      return;
    }

    if (mode !== 'solo') {
      return;
    }

    const roundSignature = `${ruleset}:${board
      .map((cell) => cell ?? '-')
      .join('')}`;

    if (streakRoundRef.current === roundSignature) {
      return;
    }

    const outcome = result.isDraw
      ? 'draw'
      : result.winner === humanSide
        ? 'win'
        : 'loss';
    const nextStreaks = updateDifficultyStreak(
      difficultyStreaks,
      difficulty,
      outcome,
    );
    const unlocks = getThemeUnlockHooks(nextStreaks);

    streakRoundRef.current = roundSignature;
    setDifficultyStreaks(nextStreaks);
    saveDifficultyStreaks(nextStreaks);
    saveThemeUnlockHooks(unlocks);
  }, [
    board,
    difficulty,
    difficultyStreaks,
    humanSide,
    mode,
    result.isDraw,
    result.winner,
    ruleset,
  ]);

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
    pieDecisionPending ||
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
      setIsAiThinking(false);
      return;
    }

    const id = aiRequestIdRef.current + 1;

    aiRequestIdRef.current = id;
    setIsAiThinking(true);

    const startedAt = performance.now();
    let pendingTimeout: number | null = null;

    const applyAiMove = (move: number | null) => {
      if (aiRequestIdRef.current !== id || move === null) {
        setIsAiThinking(false);
        return;
      }

      // keep a short "thinking" pause even when the move comes back instantly
      const remaining = Math.max(
        0,
        aiThinkingDelay[difficulty] - (performance.now() - startedAt),
      );

      pendingTimeout = window.setTimeout(() => {
        if (aiRequestIdRef.current === id) {
          setIsAiThinking(false);
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
        () => applyAiMove(chooseAiMove(board, aiPlayer, difficulty, ruleset)),
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
        applyAiMove(chooseAiMove(board, aiPlayer, difficulty, ruleset));
      };
      worker.postMessage({ board, difficulty, id, player: aiPlayer, ruleset });
    }

    return () => {
      aiRequestIdRef.current += 1;
      setIsAiThinking(false);

      if (pendingTimeout !== null) {
        window.clearTimeout(pendingTimeout);
      }
    };
  }, [aiPlayer, applyMove, board, difficulty, isAiTurn, ruleset]);

  const status = useMemo(() => {
    if (result.winner) {
      if (ruleset === 'lines') {
        return `${result.winner} wins ${result.lineScores.X}-${result.lineScores.O}`;
      }

      return `${result.winner} wins`;
    }

    if (result.isDraw) {
      if (ruleset === 'lines') {
        return `Draw ${result.lineScores.X}-${result.lineScores.O}`;
      }

      return 'Draw';
    }

    if (pieDecisionPending) {
      return 'Swap choice';
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
    result.lineScores.O,
    result.lineScores.X,
    result.winner,
    ruleset,
    pieDecisionPending,
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

  const handleRulesetChange = (nextRuleset: GameRuleset) => {
    if (nextRuleset === ruleset) {
      return;
    }

    requestRoundReset(
      `Switching to ${RULESET_DESCRIPTION[nextRuleset]} resets the active best of 5.`,
      () => {
        setRuleset(nextRuleset);
        resetMatch();
        setPieDecisionDone(false);
        setPiePromptOpen(false);
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

  const resolvePieDecision = (swap: boolean) => {
    if (swap && mode === 'solo') {
      setHumanSide(getOtherPlayer(humanSide));
    }

    setPieDecisionDone(true);
    setPiePromptOpen(false);
    flashNotice(swap ? 'Sides swapped' : 'Sides kept');
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

  const openerText = useMemo(() => {
    if (mode === 'solo') {
      return opener === humanSide ? 'You open' : 'AI opens';
    }

    return `${opener} opens`;
  }, [humanSide, mode, opener]);

  const openedText = useMemo(() => {
    if (mode === 'solo') {
      return opener === humanSide ? 'You opened' : 'AI opened';
    }

    return `${opener} opened`;
  }, [humanSide, mode, opener]);

  const resultLabel = useMemo(() => {
    if (!result.winner && !result.isDraw) {
      return null;
    }

    if (ruleset === 'lines') {
      const scoreText = `${result.lineScores.X}-${result.lineScores.O}`;

      if (result.isDraw) {
        return `Draw, ${scoreText}`;
      }

      if (mode === 'solo') {
        return result.winner === humanSide
          ? `You win by lines, ${scoreText}`
          : `AI wins by lines, ${scoreText}`;
      }

      return `${result.winner} wins by lines, ${scoreText}`;
    }

    if (result.isDraw) {
      return 'Round drawn';
    }

    if (mode === 'solo') {
      return result.winner === humanSide
        ? 'You win the round'
        : 'AI wins the round';
    }

    return `${result.winner} wins the round`;
  }, [
    humanSide,
    mode,
    result.isDraw,
    result.lineScores.O,
    result.lineScores.X,
    result.winner,
    ruleset,
  ]);

  return (
    <main className="app-shell" data-theme={themeId} style={themeStyle}>
      <GameStage
        ref={stageRef}
        board={board}
        coachBlockCells={coachBlockCells}
        coachScoreCells={coachScoreCells}
        currentPlayer={currentPlayer}
        disabled={isBoardDisabled}
        highlightLines={highlightLines}
        lastMove={lastMove}
        layout={layout}
        openedText={openedText}
        result={result}
        resultLabel={resultLabel}
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
        coachEnabled={coachEnabled}
        coachSetting={coachSetting}
        copiedSignal={copiedSignal}
        currentPlayer={currentPlayer}
        difficulty={difficulty}
        humanSide={humanSide}
        isAiThinking={isAiThinking}
        lastMove={lastMove}
        layout={layout}
        lineScores={result.lineScores}
        mode={mode}
        oMoves={oMoves}
        online={online}
        openerText={openerText}
        remoteSignal={remoteSignal}
        remainingCells={result.remainingCells}
        result={result}
        roundsPlayed={roundsPlayed}
        ruleset={ruleset}
        score={score}
        soundSetting={soundSetting}
        status={status}
        themeId={themeId}
        xMoves={xMoves}
        onCoachSettingChange={setCoachSetting}
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
        onRulesetChange={handleRulesetChange}
        onSideChange={handleSideChange}
        onThemeChange={setThemeId}
        onToggleSound={() =>
          setSoundSetting(soundSetting === 'on' ? 'off' : 'on')
        }
      />

      <GameDialogs
        guideOpen={guideOpen}
        pendingConfirm={pendingConfirm}
        piePromptOpen={piePromptOpen}
        onCancelConfirm={() => setPendingConfirm(null)}
        onCloseGuide={closeGuide}
        onConfirmPending={confirmPending}
        onKeepPie={() => resolvePieDecision(false)}
        onSwapPie={() => resolvePieDecision(true)}
      />
    </main>
  );
}
