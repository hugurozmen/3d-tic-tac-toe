import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { GameDialogs, PendingConfirm } from './components/GameDialogs';
import { GamePanel } from './components/GamePanel';
import { GameStage, preloadBoardScene } from './components/GameStage';
import { ViewSelector } from './components/ViewSelector';
import type {
  BoardLayout,
  BoardViewAction,
  BoardViewCommand,
} from './game/boardView';
import { getAnimationTone } from './game/animationEvents';
import { chooseAiMove, shouldSwapClassicPie } from './game/ai';
import { getCoachLadder } from './game/coachLadder';
import { getCoachHints } from './game/coach';
import { setFeedbackMuted } from './game/feedback';
import { getLinesEndgameAnalysis } from './game/linesTension';
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
  getOtherPlayer,
} from './game/rules';
import {
  evaluateDailyPuzzleMove,
  getDailyPuzzle,
  loadDailyPuzzleResult,
  saveDailyPuzzleResult,
} from './game/puzzles';
import {
  getThemeUnlockHooks,
  getThemeUnlockProgress,
  loadDifficultyStreaks,
  loadRetentionStats,
  loadThemeUnlockHooks,
  saveDifficultyStreaks,
  saveRetentionStats,
  saveThemeUnlockHooks,
  updateDifficultyStreak,
  updateRetentionStats,
} from './game/retention';
import { useMatchState } from './game/useMatchState';
import { type OnlineRoomSettings, useOnlineGame } from './game/useOnlineGame';
import {
  FINAL_SIX_POWER_LABEL,
  type FinalSixPowerId,
  type LinesEndgameMode,
  chooseFinalSixPower,
  chooseFinalSixPowerMove,
  getCurrentFinalSixPowerPicker,
  getFinalSixPowerBoardEffects,
} from './game/finalSixPowers';
import { THEME_ORDER, THEMES, ThemeId, themeToCssVariables } from './theme';
import { useLocalStorageState } from './useLocalStorageState';

const getInitialLayout = (): BoardLayout => {
  if (window.matchMedia('(max-width: 900px)').matches) {
    return 'scanner';
  }

  return 'cube';
};

const COACH_OPTIONS = ['auto', 'on', 'off'] as const;
const ENDGAME_OPTIONS = ['standard', 'powers-v3'] as const;
const POWER_SELECTION_BY_ENDGAME: Record<
  Exclude<LinesEndgameMode, 'standard'>,
  FinalSixPowerId
> = {
  'powers-v2': 'power-cell',
  'powers-v3': 'charged-cell',
};
type CoachSetting = (typeof COACH_OPTIONS)[number];
const ONLINE_CLASSIC_PIE_RULE = false;
const NARROW_3D_RETRY_DELAY_MS = 140;
const NARROW_3D_SETTLE_DELAY_MS = 420;

const aiThinkingDelay: Record<Difficulty, number> = {
  easy: 520,
  balanced: 840,
  hard: 1020,
  master: 1180,
};

type StageNotice = {
  count?: number;
  id: number;
  text: string;
  tone: 'block' | 'score' | 'system';
};

export function App() {
  const [ruleset, setRuleset] = useLocalStorageState<GameRuleset>(
    '3dxox-ruleset',
    'lines',
    RULESET_OPTIONS,
  );
  const [mode, setMode] = useState<GameMode>('solo');
  const [linesEndgameMode, setLinesEndgameMode] =
    useLocalStorageState<LinesEndgameMode>(
      '3dxox-lines-endgame',
      'standard',
      ENDGAME_OPTIONS,
    );
  const effectiveLinesEndgameMode =
    ruleset === 'lines' && mode !== 'online' ? linesEndgameMode : 'standard';
  const {
    applyMove,
    animationEvents,
    baseLineScores,
    board,
    currentPlayer,
    currentPlayerRef,
    finalSixPowers,
    lastMove,
    lifetimeScore,
    linesBonusScores,
    match,
    oMoves,
    pickFinalSixPower,
    resetMatch,
    resetRound,
    result,
    xMoves,
    opener,
    recentLines,
    recentImpact,
  } = useMatchState(ruleset, effectiveLinesEndgameMode);
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
  const didNormalizeNarrow3dBoot = useRef(false);
  const needsNarrow3dWarmup = useRef(
    window.matchMedia('(max-width: 900px)').matches,
  );
  const narrow3dWarmupTimers = useRef<number[]>([]);
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
  const dailyShareTimeoutRef = useRef<number | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);
  const streakRoundRef = useRef<string | null>(null);
  const [scannerFloor, setScannerFloor] = useState(1);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null,
  );
  const [stageNotice, setStageNotice] = useState<StageNotice | null>(null);
  const [piePromptOpen, setPiePromptOpen] = useState(false);
  const [pieDecisionDone, setPieDecisionDone] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [powerSelection, setPowerSelection] =
    useState<FinalSixPowerId>('charged-cell');
  const [difficultyStreaks, setDifficultyStreaks] = useState(
    loadDifficultyStreaks,
  );
  const [retentionStats, setRetentionStats] = useState(loadRetentionStats);
  const [themeUnlockHooks, setThemeUnlockHooks] = useState(
    loadThemeUnlockHooks,
  );
  const dailyPuzzle = useMemo(() => getDailyPuzzle(), []);
  const [dailyPuzzleResult, setDailyPuzzleResult] = useState(() =>
    loadDailyPuzzleResult(dailyPuzzle.dateKey),
  );
  const [dailyPuzzleShareCopied, setDailyPuzzleShareCopied] = useState(false);
  const theme = THEMES[themeId];
  const themeStyle = useMemo(() => themeToCssVariables(theme), [theme]);
  const themeUnlockProgress = useMemo(
    () => getThemeUnlockProgress(difficultyStreaks, themeUnlockHooks),
    [difficultyStreaks, themeUnlockHooks],
  );
  const aiPlayer = getOtherPlayer(humanSide);
  const powerPicker = getCurrentFinalSixPowerPicker(finalSixPowers);
  const isPowerChoosing = finalSixPowers.phase === 'choosing';
  const canHumanChoosePower =
    Boolean(powerPicker) && (mode !== 'solo' || powerPicker === humanSide);
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
    !isPowerChoosing &&
    !pieDecisionPending;
  const completedLocalRounds =
    lifetimeScore.X + lifetimeScore.O + lifetimeScore.draws;
  const rawCoachHints = useMemo(
    () =>
      mode !== 'online' &&
      coachSetting !== 'off' &&
      !result.winner &&
      !result.isDraw
        ? getCoachHints(board, currentPlayer)
        : [],
    [board, coachSetting, currentPlayer, mode, result.isDraw, result.winner],
  );
  const coachLadder = useMemo(
    () =>
      getCoachLadder({
        completedLocalRounds,
        hints: rawCoachHints,
        mode,
        setting: coachSetting,
      }),
    [coachSetting, completedLocalRounds, mode, rawCoachHints],
  );
  const coachEnabled = mode !== 'online' && coachLadder.enabled;
  const hostOnlineSettings = useMemo<OnlineRoomSettings>(
    () => ({
      classicPieRule: ONLINE_CLASSIC_PIE_RULE,
      ruleset,
    }),
    [ruleset],
  );
  const coachHints = coachLadder.hints;
  const coachScoreCells = useMemo(
    () =>
      coachLadder.fullHints
        .filter((hint) => hint.kind === 'score' || hint.kind === 'both')
        .map((hint) => hint.cell),
    [coachLadder.fullHints],
  );
  const coachBlockCells = useMemo(
    () =>
      coachLadder.fullHints
        .filter((hint) => hint.kind === 'block' || hint.kind === 'both')
        .map((hint) => hint.cell),
    [coachLadder.fullHints],
  );
  const coachSoftScoreCells = coachLadder.softScoreCells;
  const linesEndgame = useMemo(
    () =>
      ruleset === 'lines' && !result.isComplete
        ? getLinesEndgameAnalysis(board, currentPlayer)
        : null,
    [board, currentPlayer, result.isComplete, ruleset],
  );
  const powerEffects = useMemo(
    () =>
      getFinalSixPowerBoardEffects({
        board,
        picker: powerPicker,
        selection: powerSelection,
        state: finalSixPowers,
      }),
    [board, finalSixPowers, powerPicker, powerSelection],
  );
  const scoredLines = ruleset === 'lines' ? recentLines : [];
  const finalLines: number[][] =
    ruleset === 'lines' && result.winner && 'winningLines' in result
      ? (result.winningLines as number[][])
      : [];
  const recentLineCount = recentImpact?.linesCompleted.length ?? 0;
  const recentBlockCount = recentImpact?.blockedLines.length ?? 0;
  const showCoachPrompt =
    mode !== 'online' && coachSetting === 'off' && completedLocalRounds < 3;

  useEffect(() => {
    if (
      effectiveLinesEndgameMode === 'powers-v3' &&
      !['charged-cell', 'shield-cell'].includes(powerSelection)
    ) {
      setPowerSelection('charged-cell');
    }
  }, [effectiveLinesEndgameMode, powerSelection]);

  // Narrow embedded browsers can cold-paint WebGL blank when restored into 3D.
  useLayoutEffect(() => {
    if (
      didNormalizeNarrow3dBoot.current ||
      layout === 'scanner' ||
      !window.matchMedia('(max-width: 900px)').matches
    ) {
      return;
    }

    didNormalizeNarrow3dBoot.current = true;
    needsNarrow3dWarmup.current = true;
    setLayout('scanner');
  }, [layout, setLayout]);

  useEffect(() => {
    return () => {
      narrow3dWarmupTimers.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

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

  const flashNotice = useCallback(
    (text: string, tone: StageNotice['tone'] = 'system', count?: number) => {
      setStageNotice({
        count,
        id: Date.now(),
        text,
        tone,
      });

      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current);
      }

      noticeTimeoutRef.current = window.setTimeout(
        () => setStageNotice(null),
        tone === 'score' ? 2800 : 2200,
      );
    },
    [],
  );

  useEffect(
    () => () => {
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current);
      }

      if (dailyShareTimeoutRef.current !== null) {
        window.clearTimeout(dailyShareTimeoutRef.current);
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
    if (ruleset !== 'lines' || !recentImpact) {
      return;
    }

    const lineCount = recentImpact.linesCompleted.length;
    const blockCount = recentImpact.blockedLines.length;
    const bonusPoints = recentImpact.bonusPoints;
    const parts: string[] = [];

    if (lineCount > 0) {
      const lineText = lineCount === 1 ? 'line' : 'lines';
      parts.push(`${recentImpact.player} +${lineCount} ${lineText}`);
    }

    if (blockCount > 0) {
      const blockText = blockCount === 1 ? 'block' : 'blocks';
      parts.push(`${blockCount} ${blockText}`);
    }

    if (recentImpact.powerMessages.length > 0) {
      parts.push(...recentImpact.powerMessages);
    } else if (recentImpact.powerMessage) {
      parts.push(recentImpact.powerMessage);
    } else if (bonusPoints > 0) {
      parts.push(`+${bonusPoints} bonus`);
    }

    flashNotice(
      `${parts.join(' + ')} (${result.lineScores.X}-${result.lineScores.O})`,
      lineCount > 0 || bonusPoints > 0 ? 'score' : 'block',
      lineCount || blockCount,
    );
  }, [
    flashNotice,
    recentImpact,
    result.lineScores.O,
    result.lineScores.X,
    ruleset,
  ]);

  useEffect(() => {
    const latest = animationEvents[animationEvents.length - 1];

    if (!latest) {
      return;
    }

    if (latest.type === 'final-six-start') {
      flashNotice('Final Six: cube charged', 'system');
      return;
    }

    if (latest.type === 'power-selected') {
      flashNotice(
        `${latest.player} chose ${FINAL_SIX_POWER_LABEL[latest.power as FinalSixPowerId] ?? latest.power}`,
        getAnimationTone(latest) === 'block' ? 'block' : 'system',
      );
    }
  }, [animationEvents, flashNotice]);

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
    const nextStats = updateRetentionStats(retentionStats, {
      difficulty,
      humanSide,
      outcome,
      result,
    });
    const unlocks = getThemeUnlockHooks(nextStreaks);
    const mergedUnlocks = Array.from(new Set([...themeUnlockHooks, ...unlocks]));

    streakRoundRef.current = roundSignature;
    setDifficultyStreaks(nextStreaks);
    setRetentionStats(nextStats);
    setThemeUnlockHooks(mergedUnlocks);
    saveDifficultyStreaks(nextStreaks);
    saveRetentionStats(nextStats);
    saveThemeUnlockHooks(unlocks);
  }, [
    board,
    difficulty,
    difficultyStreaks,
    humanSide,
    mode,
    retentionStats,
    result.isDraw,
    result.winner,
    result,
    ruleset,
    themeUnlockHooks,
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
      onRoomSettings: (settings: OnlineRoomSettings) => {
        if (settings.ruleset !== ruleset) {
          setRuleset(settings.ruleset);
          resetMatch();
          setPieDecisionDone(false);
          setPiePromptOpen(false);
        }
      },
    }),
    [applyMove, flashNotice, resetMatch, resetRound, ruleset, setRuleset],
  );
  const online = useOnlineGame(onlineHandlers);
  const onlineRoomActive = mode === 'online' && Boolean(online.localSignal);

  useEffect(() => {
    remotePlayerRef.current = online.remotePlayer;
  }, [online.remotePlayer]);

  const isOnlineTurn =
    mode === 'online' &&
    online.isConnected &&
    online.localPlayer === currentPlayer;
  const isBoardDisabled =
    isAiTurn ||
    (isPowerChoosing && !canHumanChoosePower) ||
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
    if (
      mode !== 'solo' ||
      powerPicker !== aiPlayer ||
      result.winner ||
      result.isDraw
    ) {
      return;
    }

    const choice = chooseFinalSixPower(
      board,
      aiPlayer,
      effectiveLinesEndgameMode === 'powers-v2' ? 'powers-v2' : 'powers-v3',
    );

    if (!choice) {
      return;
    }

    const timer = window.setTimeout(() => {
      pickFinalSixPower(aiPlayer, choice);
    }, 520);

    return () => window.clearTimeout(timer);
  }, [
    aiPlayer,
    board,
    mode,
    pickFinalSixPower,
    powerPicker,
    effectiveLinesEndgameMode,
    result.isDraw,
    result.winner,
  ]);

  const chooseAiPowerMove = useCallback(
    (suggestedMove: number | null) => {
      if (
        suggestedMove === null ||
        !['powers-v2', 'powers-v3'].includes(effectiveLinesEndgameMode) ||
        finalSixPowers.phase !== 'active'
      ) {
        return suggestedMove;
      }

      const powerMove = chooseFinalSixPowerMove(board, aiPlayer, finalSixPowers);

      if (powerMove !== null) {
        return powerMove;
      }

      return suggestedMove;
    },
    [aiPlayer, board, effectiveLinesEndgameMode, finalSixPowers],
  );

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
          const finalMove = chooseAiPowerMove(move);

          if (finalMove === null) {
            setIsAiThinking(false);
            return;
          }

          setIsAiThinking(false);
          applyMove(finalMove, aiPlayer);
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
  }, [
    aiPlayer,
    applyMove,
    board,
    chooseAiPowerMove,
    difficulty,
    isAiTurn,
    ruleset,
  ]);

  const status = useMemo(() => {
    if (match.winner) {
      if (mode === 'solo') {
        return match.winner === humanSide ? 'You win match' : 'AI wins match';
      }

      return `${match.winner} wins match`;
    }

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

    if (powerPicker) {
      if (mode === 'solo') {
        return powerPicker === aiPlayer ? 'AI choosing' : 'Choose Power';
      }

      return `${powerPicker} power`;
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
    humanSide,
    isAiTurn,
    match.winner,
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
    powerPicker,
  ]);

  const handleSelect = useCallback(
    (index: number) => {
      if (isAiTurn) {
        return;
      }

      if (isPowerChoosing) {
        if (!powerPicker || !canHumanChoosePower) {
          return;
        }

        if (
          !pickFinalSixPower(powerPicker, {
            id: powerSelection,
            targetCell: index,
          })
        ) {
          flashNotice('Choose a glowing power target');
        }

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
      isPowerChoosing,
      mode,
      online,
      pickFinalSixPower,
      powerPicker,
      powerSelection,
      result.isDraw,
      result.winner,
      canHumanChoosePower,
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

    if (onlineRoomActive) {
      flashNotice('Online room settings are locked');
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

  const handleEndgameModeChange = (nextEndgameMode: LinesEndgameMode) => {
    if (nextEndgameMode === linesEndgameMode) {
      return;
    }

    if (ruleset !== 'lines' || mode === 'online') {
      flashNotice('Final Six Powers are local prototype only');
      return;
    }

    requestRoundReset(
      'Switching the Lines endgame resets the active best of 5.',
      () => {
        setLinesEndgameMode(nextEndgameMode);
        if (nextEndgameMode !== 'standard') {
          setPowerSelection(POWER_SELECTION_BY_ENDGAME[nextEndgameMode]);
        }
        resetMatch();
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

  const closeGuide = () => {
    setGuideOpen(false);
    setOnboarded('done');
  };

  const handleDifficultyChange = (nextDifficulty: Difficulty) => {
    // applies immediately — the AI simply thinks at the new level from now on
    setDifficulty(nextDifficulty);
  };

  const handleTryCoach = () => {
    if (mode === 'online') {
      flashNotice('Coach disabled online');
      return;
    }

    setCoachSetting('on');
    flashNotice('Coach on: green scores, red blocks');
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
      if (
        nextLayout !== 'scanner' &&
        layout === 'scanner' &&
        needsNarrow3dWarmup.current &&
        window.matchMedia('(max-width: 900px)').matches
      ) {
        const warmupLayout = nextLayout === 'cube' ? 'floors' : 'cube';

        // The first 3D canvas may be blank; one 3D layout retry wakes it.
        didNormalizeNarrow3dBoot.current = true;
        needsNarrow3dWarmup.current = false;
        setLayout(nextLayout);
        restoreStageForMobile();

        narrow3dWarmupTimers.current.forEach((timer) => {
          window.clearTimeout(timer);
        });
        narrow3dWarmupTimers.current = [
          window.setTimeout(
            () => setLayout(warmupLayout),
            NARROW_3D_RETRY_DELAY_MS,
          ),
          window.setTimeout(() => {
            setLayout(nextLayout);
            restoreStageForMobile();
            narrow3dWarmupTimers.current = [];
          }, NARROW_3D_SETTLE_DELAY_MS),
        ];
        return;
      }

      if (nextLayout !== 'scanner') {
        didNormalizeNarrow3dBoot.current = true;
      }

      setLayout(nextLayout);
      restoreStageForMobile();
    },
    [layout, restoreStageForMobile, setLayout],
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
    void online.startHost(hostOnlineSettings);
  };

  const handleResetRound = () => {
    if (match.isComplete) {
      handleResetMatch();
      return;
    }

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

  const handleDailyPuzzleMove = useCallback(
    (move: number) => {
      if (dailyPuzzleResult || dailyPuzzle.board[move]) {
        return;
      }

      const nextResult = evaluateDailyPuzzleMove(dailyPuzzle, move);

      setDailyPuzzleResult(nextResult);
      saveDailyPuzzleResult(nextResult);
    },
    [dailyPuzzle, dailyPuzzleResult],
  );

  const handleShareDailyPuzzle = useCallback(async () => {
    if (!dailyPuzzleResult?.solved) {
      return;
    }

    try {
      await navigator.clipboard.writeText(dailyPuzzleResult.shareText);
      setDailyPuzzleShareCopied(true);

      if (dailyShareTimeoutRef.current !== null) {
        window.clearTimeout(dailyShareTimeoutRef.current);
      }

      dailyShareTimeoutRef.current = window.setTimeout(
        () => setDailyPuzzleShareCopied(false),
        1400,
      );
    } catch {
      setDailyPuzzleShareCopied(false);
    }
  }, [dailyPuzzleResult]);

  const openerText = useMemo(() => {
    if (mode === 'solo') {
      return opener === humanSide ? 'You open' : 'AI opens';
    }

    return `${opener} opens`;
  }, [humanSide, mode, opener]);

  const nextOpenerText = useMemo(() => {
    if (mode === 'solo') {
      return match.nextOpener === humanSide ? 'You open' : 'AI opens';
    }

    return `${match.nextOpener} opens`;
  }, [humanSide, match.nextOpener, mode]);

  const openedByText = useMemo(() => {
    if (mode === 'solo') {
      return opener === humanSide ? 'You opened' : 'AI opened';
    }

    return `${opener} opened`;
  }, [humanSide, mode, opener]);

  const openedText = useMemo(() => {
    const context =
      ruleset === 'lines' && (result.winner || result.isDraw)
        ? 'Final board filled - '
        : '';
    const nextContext = match.isComplete
      ? 'Match complete'
      : `${nextOpenerText} next`;

    return `${context}${openedByText} - ${nextContext}`;
  }, [
    match.isComplete,
    nextOpenerText,
    openedByText,
    result.isDraw,
    result.winner,
    ruleset,
  ]);

  const resultLabel = useMemo(() => {
    if (!result.winner && !result.isDraw) {
      return null;
    }

    const roundPrefix = `Round ${match.roundNumber}: `;

    if (ruleset === 'lines') {
      const scoreText = `${result.lineScores.X}\u2013${result.lineScores.O}`;

      if (result.isDraw) {
        return `${roundPrefix}Draw by lines, ${scoreText}`;
      }

      if (mode === 'solo') {
        return result.winner === humanSide
          ? `${roundPrefix}You win by lines, ${scoreText}`
          : `${roundPrefix}AI wins by lines, ${scoreText}`;
      }

      return `${roundPrefix}${result.winner} wins by lines, ${scoreText}`;
    }

    if (result.isDraw) {
      return `${roundPrefix}Round drawn`;
    }

    if (mode === 'solo') {
      return result.winner === humanSide
        ? `${roundPrefix}You win the round`
        : `${roundPrefix}AI wins the round`;
    }

    return `${roundPrefix}${result.winner} wins the round`;
  }, [
    humanSide,
    match.roundNumber,
    mode,
    result.isDraw,
    result.lineScores.O,
    result.lineScores.X,
    result.winner,
    ruleset,
  ]);

  const matchWinnerText = useMemo(() => {
    if (!match.winner) {
      return null;
    }

    if (mode === 'solo') {
      return match.winner === humanSide ? 'You' : 'AI';
    }

    return match.winner;
  }, [humanSide, match.winner, mode]);

  const matchResultLabel = useMemo(() => {
    if (!match.winner || !matchWinnerText) {
      return null;
    }

    if (mode === 'solo') {
      const humanWins = match.score[humanSide];
      const aiWins = match.score[getOtherPlayer(humanSide)];
      return match.winner === humanSide
        ? `You win the match, ${humanWins}\u2013${aiWins}`
        : `AI wins the match, ${aiWins}\u2013${humanWins}`;
    }

    return `${match.winner} wins the match, ${match.score.X}\u2013${match.score.O}`;
  }, [humanSide, match.score, match.winner, matchWinnerText, mode]);

  return (
    <main
      className="app-shell"
      data-layout={layout}
      data-theme={themeId}
      style={themeStyle}
    >
      <GameStage
        ref={stageRef}
        board={board}
        animationEvents={animationEvents}
        coachBlockCells={coachBlockCells}
        coachHints={coachHints}
        coachScoreCells={coachScoreCells}
        coachSoftScoreCells={coachSoftScoreCells}
        currentPlayer={powerPicker ?? currentPlayer}
        disabled={isBoardDisabled}
        finalPhase={linesEndgame}
        finalLines={finalLines}
        lastMove={lastMove}
        layout={layout}
        matchResultLabel={matchResultLabel}
        openedText={openedText}
        powerEffects={powerEffects}
        result={result}
        resultLabel={resultLabel}
        scannerFloor={scannerFloor}
        scoredLines={scoredLines}
        stageNotice={stageNotice}
        theme={theme.scene}
        viewCommand={viewCommand}
        onFloorChange={setScannerFloor}
        onResetMatch={handleResetMatch}
        onResetRound={handleResetRound}
        onSelect={handleSelect}
        onUseScanner={() => handleLayoutChange('scanner')}
        onViewCommand={sendViewCommand}
      />

      <ViewSelector
        className="mobile-view-selector"
        layout={layout}
        onChange={handleLayoutChange}
      />

      <GamePanel
        baseLineScores={baseLineScores}
        animationEvents={animationEvents}
        coachEnabled={coachEnabled}
        coachDisabledOnline={mode === 'online'}
        coachSetting={coachSetting}
        copiedSignal={copiedSignal}
        currentPlayer={currentPlayer}
        dailyPuzzle={dailyPuzzle}
        dailyPuzzleResult={dailyPuzzleResult}
        dailyPuzzleShareCopied={dailyPuzzleShareCopied}
        difficulty={difficulty}
        difficultyStreaks={difficultyStreaks}
        humanSide={humanSide}
        isAiThinking={isAiThinking}
        lastMove={lastMove}
        layout={layout}
        lineScores={result.lineScores}
        linesBonusScores={linesBonusScores}
        linesEndgameMode={linesEndgameMode}
        linesEndgameText={linesEndgame?.text ?? null}
        lifetimeScore={lifetimeScore}
        match={match}
        matchWinnerText={matchWinnerText}
        mode={mode}
        nextOpenerText={nextOpenerText}
        online={online}
        onlineRulesLocked={onlineRoomActive}
        openerText={openerText}
        remoteSignal={remoteSignal}
        recentBlockCount={recentBlockCount}
        recentLineCount={recentLineCount}
        recentLinePlayer={recentImpact?.player ?? null}
        remainingCells={result.remainingCells}
        result={result}
        retentionStats={retentionStats}
        ruleset={ruleset}
        showCoachPrompt={showCoachPrompt}
        soundSetting={soundSetting}
        status={status}
        themeId={themeId}
        themeUnlockProgress={themeUnlockProgress}
        canHumanChoosePower={canHumanChoosePower}
        effectiveLinesEndgameMode={effectiveLinesEndgameMode}
        onCoachSettingChange={setCoachSetting}
        onCopySignal={handleCopySignal}
        onDailyPuzzleMove={handleDailyPuzzleMove}
        onDifficultyChange={handleDifficultyChange}
        onEndgameModeChange={handleEndgameModeChange}
        onHostOnline={handleHostOnline}
        onLayoutChange={handleLayoutChange}
        onModeChange={handleModeChange}
        onOnlineSignal={handleOnlineSignal}
        onOpenGuide={() => setGuideOpen(true)}
        onPowerSelectionChange={setPowerSelection}
        onRemoteSignalChange={setRemoteSignal}
        onResetMatch={handleResetMatch}
        onResetRound={handleResetRound}
        onRulesetChange={handleRulesetChange}
        onSideChange={handleSideChange}
        onThemeChange={setThemeId}
        onTryCoach={handleTryCoach}
        onShareDailyPuzzle={handleShareDailyPuzzle}
        onToggleSound={() =>
          setSoundSetting(soundSetting === 'on' ? 'off' : 'on')
        }
        powerPicker={powerPicker}
        powerSelection={powerSelection}
        finalSixPowers={finalSixPowers}
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
