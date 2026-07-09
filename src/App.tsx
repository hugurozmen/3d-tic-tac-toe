import {
  useCallback,
  useEffect,
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
import {
  formatLinesEndgameText,
  getDailyPuzzleShareText,
  getInitialLocale,
  I18nProvider,
  labelMode,
  labelPower,
  labelRulesetDescription,
  LOCALE_OPTIONS,
  translatePowerMessage,
  type Locale,
  useI18nValue,
} from './i18n';
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
  const [language, setLanguage] = useLocalStorageState<Locale>(
    '3dxox-language',
    getInitialLocale(),
    LOCALE_OPTIONS,
  );
  const i18n = useI18nValue(language);
  const { t } = i18n;
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
  const [finalSixNudgeState, setFinalSixNudgeState] = useLocalStorageState(
    '3dxox-final-six-nudge',
    'pending',
    ['pending', 'done'] as const,
  );
  const [dailyNudgeState, setDailyNudgeState] = useLocalStorageState(
    '3dxox-daily-nudge',
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
  const isPowerScoreMode =
    ruleset === 'lines' &&
    (effectiveLinesEndgameMode === 'powers-v2' ||
      effectiveLinesEndgameMode === 'powers-v3');
  const canShowPowerPanel =
    ruleset === 'lines' && isPowerScoreMode && mode !== 'online';
  const showFinalSixNudge =
    finalSixNudgeState === 'pending' &&
    canShowPowerPanel &&
    finalSixPowers.phase !== 'inactive';
  const showDailyNudge =
    dailyNudgeState === 'pending' && match.isComplete;

  useEffect(() => {
    if (
      effectiveLinesEndgameMode === 'powers-v3' &&
      !['charged-cell', 'shield-cell'].includes(powerSelection)
    ) {
      setPowerSelection('charged-cell');
    }
  }, [effectiveLinesEndgameMode, powerSelection]);

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
      const lineText = t(lineCount === 1 ? 'lines.line' : 'lines.lines');
      parts.push(`${recentImpact.player} +${lineCount} ${lineText}`);
    }

    if (blockCount > 0) {
      const blockText = t(blockCount === 1 ? 'lines.block' : 'lines.blocks');
      parts.push(`${blockCount} ${blockText}`);
    }

    if (recentImpact.powerMessages.length > 0) {
      parts.push(
        ...recentImpact.powerMessages.map((message) =>
          translatePowerMessage(i18n, message),
        ),
      );
    } else if (recentImpact.powerMessage) {
      parts.push(translatePowerMessage(i18n, recentImpact.powerMessage));
    } else if (bonusPoints > 0) {
      parts.push(t('notice.bonus', { count: bonusPoints }));
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
    i18n,
    t,
  ]);

  useEffect(() => {
    const latest = animationEvents[animationEvents.length - 1];

    if (!latest) {
      return;
    }

    if (latest.type === 'final-six-start') {
      flashNotice(t('finalSix.chargedNotice'), 'system');
      return;
    }

    if (latest.type === 'power-selected') {
      flashNotice(
        t('finalSix.powerChosen', {
          player: latest.player,
          power:
            latest.power in FINAL_SIX_POWER_LABEL
              ? labelPower(i18n, latest.power as FinalSixPowerId)
              : latest.power,
        }),
        getAnimationTone(latest) === 'block' ? 'block' : 'system',
      );
    }
  }, [animationEvents, flashNotice, i18n, t]);

  useEffect(() => {
    if (!pieDecisionPending) {
      return;
    }

    if (mode === 'solo' && currentPlayer === aiPlayer) {
      const shouldSwap = shouldSwapClassicPie(board, difficulty);

      setPieDecisionDone(true);

      if (shouldSwap) {
        setHumanSide(getOtherPlayer(humanSide));
        flashNotice(t('notice.aiSwappedSides'));
      } else {
        flashNotice(t('notice.aiKeptSides'));
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
    t,
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
        flashNotice(t('notice.opponentResetMatch'));
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
        flashNotice(t('notice.opponentNewRound'));
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
    [applyMove, flashNotice, resetMatch, resetRound, ruleset, setRuleset, t],
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
    document.documentElement.lang = language;
  }, [language]);

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
        return match.winner === humanSide
          ? t('status.youWinMatch')
          : t('status.aiWinsMatch');
      }

      return t('status.playerWinsMatch', { player: match.winner });
    }

    if (result.winner) {
      if (ruleset === 'lines') {
        return t('status.playerWinsScore', {
          player: result.winner,
          score: `${result.lineScores.X}-${result.lineScores.O}`,
        });
      }

      return t('status.playerWins', { player: result.winner });
    }

    if (result.isDraw) {
      if (ruleset === 'lines') {
        return t('status.drawScore', {
          score: `${result.lineScores.X}-${result.lineScores.O}`,
        });
      }

      return t('status.draw');
    }

    if (pieDecisionPending) {
      return t('status.swapChoice');
    }

    if (powerPicker) {
      if (mode === 'solo') {
        return powerPicker === aiPlayer
          ? t('status.aiChoosing')
          : t('status.choosePower');
      }

      return t('status.playerPower', { player: powerPicker });
    }

    if (isAiTurn) {
      return t('status.aiThinking', { player: aiPlayer });
    }

    if (mode === 'online') {
      if (!online.localPlayer) {
        return t('status.pairOnline');
      }

      if (!online.isConnected) {
        return online.status === 'waiting'
          ? t('status.roomReady')
          : t('status.onlineSetup');
      }

      if (online.localPlayer !== currentPlayer) {
        return t('status.playerRemote', { player: currentPlayer });
      }
    }

    return t('status.playerTurn', { player: currentPlayer });
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
    t,
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
          flashNotice(t('finalSix.chooseTargetNotice'));
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
          flashNotice(t('notice.reconnectMove'));
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
      t,
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
      t('setup.switchModeConfirm', { mode: labelMode(i18n, nextMode) }),
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
      flashNotice(t('notice.onlineLocked'));
      return;
    }

    requestRoundReset(
      t('setup.switchRulesConfirm', {
        ruleset: labelRulesetDescription(i18n, nextRuleset),
      }),
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
      flashNotice(t('finalSix.localOnly'));
      return;
    }

    requestRoundReset(
      t('setup.switchEndgameConfirm'),
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
      t('setup.switchSideConfirm'),
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
    flashNotice(swap ? t('notice.sidesSwapped') : t('notice.sidesKept'));
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
      flashNotice(t('coach.disabledOnline'));
      return;
    }

    setCoachSetting('on');
    flashNotice(t('coach.onNotice'));
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
    void online.startHost(hostOnlineSettings);
  };

  const handleResetRound = () => {
    if (match.isComplete) {
      handleResetMatch();
      return;
    }

    if (mode === 'online' && !online.sendRoundReset()) {
      flashNotice(t('notice.reconnectReset'));
      return;
    }

    resetRound();
  };

  const handleResetMatch = () => {
    if (mode === 'online' && !online.sendMatchReset()) {
      flashNotice(t('notice.reconnectReset'));
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
      await navigator.clipboard.writeText(getDailyPuzzleShareText(i18n, dailyPuzzle));
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
  }, [dailyPuzzle, dailyPuzzleResult, i18n]);

  const openerText = useMemo(() => {
    if (mode === 'solo') {
      return opener === humanSide ? t('result.opensYou') : t('result.opensAi');
    }

    return t('result.opensPlayer', { player: opener });
  }, [humanSide, mode, opener, t]);

  const nextOpenerText = useMemo(() => {
    if (mode === 'solo') {
      return match.nextOpener === humanSide
        ? t('result.opensYou')
        : t('result.opensAi');
    }

    return t('result.opensPlayer', { player: match.nextOpener });
  }, [humanSide, match.nextOpener, mode, t]);

  const openedByText = useMemo(() => {
    if (mode === 'solo') {
      return opener === humanSide
        ? t('result.openedYou')
        : t('result.openedAi');
    }

    return t('result.openedPlayer', { player: opener });
  }, [humanSide, mode, opener, t]);

  const openedText = useMemo(() => {
    const context =
      ruleset === 'lines' && (result.winner || result.isDraw)
        ? `${t('lines.finalBoardFilled')} - `
        : '';
    const nextContext = match.isComplete
      ? t('match.complete')
      : t('match.nextContext', { opener: nextOpenerText });

    return `${context}${openedByText} - ${nextContext}`;
  }, [
    match.isComplete,
    nextOpenerText,
    openedByText,
    result.isDraw,
    result.winner,
    ruleset,
    t,
  ]);

  const resultLabel = useMemo(() => {
    if (!result.winner && !result.isDraw) {
      return null;
    }

    const withRound = (text: string) =>
      t('result.roundPrefix', { round: match.roundNumber, text });

    if (ruleset === 'lines') {
      const scoreText = `${result.lineScores.X}\u2013${result.lineScores.O}`;

      if (result.isDraw) {
        return withRound(t('result.drawByLines', { score: scoreText }));
      }

      if (mode === 'solo') {
        return result.winner === humanSide
          ? withRound(t('result.youWinByLines', { score: scoreText }))
          : withRound(t('result.aiWinsByLines', { score: scoreText }));
      }

      return withRound(
        t('result.playerWinsByLines', {
          player: result.winner ?? '',
          score: scoreText,
        }),
      );
    }

    if (result.isDraw) {
      return withRound(t('result.roundDrawn'));
    }

    if (mode === 'solo') {
      return result.winner === humanSide
        ? withRound(t('result.youWinRound'))
        : withRound(t('result.aiWinsRound'));
    }

    return withRound(
      t('result.playerWinsRound', { player: result.winner ?? '' }),
    );
  }, [
    humanSide,
    match.roundNumber,
    mode,
    result.isDraw,
    result.lineScores.O,
    result.lineScores.X,
    result.winner,
    ruleset,
    t,
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
        ? t('result.youWinMatch', { score: `${humanWins}\u2013${aiWins}` })
        : t('result.aiWinsMatch', { score: `${aiWins}\u2013${humanWins}` });
    }

    return t('result.playerWinsMatch', {
      player: match.winner,
      score: `${match.score.X}\u2013${match.score.O}`,
    });
  }, [humanSide, match.score, match.winner, matchWinnerText, mode, t]);

  return (
    <I18nProvider value={i18n}>
      <main
        className="app-shell"
        data-layout={layout}
        data-theme={themeId}
        lang={language}
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
        actions={{
          onResetMatch: handleResetMatch,
          onResetRound: handleResetRound,
        }}
        dailyProgress={{
          dailyPuzzle,
          dailyPuzzleResult,
          dailyPuzzleShareCopied,
          difficultyStreaks,
          lastMove,
          lifetimeScore,
          retentionStats,
          showDailyNudge,
          themeUnlockProgress,
          onDailyPuzzleMove: handleDailyPuzzleMove,
          onDismissDailyNudge: () => setDailyNudgeState('done'),
          onShareDailyPuzzle: handleShareDailyPuzzle,
        }}
        matchPanel={{
          canHumanChoosePower,
          canShowPowerPanel,
          coachDisabledOnline: mode === 'online',
          coachEnabled,
          finalSixPowers,
          linesBonusScores,
          mode,
          powerPicker,
          powerSelection,
          showCoachPrompt,
          showFinalSixNudge,
          onCoachSettingChange: setCoachSetting,
          onDismissFinalSixNudge: () => setFinalSixNudgeState('done'),
          onPowerSelectionChange: setPowerSelection,
          onTryCoach: handleTryCoach,
        }}
        options={{
          coachDisabledOnline: mode === 'online',
          coachEnabled,
          coachSetting,
          language,
          layout,
          soundSetting,
          themeId,
          onCoachSettingChange: setCoachSetting,
          onLanguageChange: setLanguage,
          onLayoutChange: handleLayoutChange,
          onThemeChange: setThemeId,
          onToggleSound: () =>
            setSoundSetting(soundSetting === 'on' ? 'off' : 'on'),
        }}
        scoreboard={{
          animationEvents,
          baseLineScores,
          currentPlayer,
          isAiThinking,
          isPowerScoreMode,
          lastMove,
          lineScores: result.lineScores,
          linesBonusScores,
          linesEndgameText: formatLinesEndgameText(i18n, linesEndgame),
          lifetimeScore,
          match,
          matchWinnerText,
          mode,
          nextOpenerText,
          openerText,
          recentBlockCount,
          recentLineCount,
          recentLinePlayer: recentImpact?.player ?? null,
          remainingCells: result.remainingCells,
          result,
          ruleset,
          status,
          onOpenGuide: () => setGuideOpen(true),
        }}
        setup={{
          copiedSignal,
          difficulty,
          humanSide,
          linesEndgameMode,
          mode,
          online,
          onlineRulesLocked: onlineRoomActive,
          remoteSignal,
          ruleset,
          onCopySignal: handleCopySignal,
          onDifficultyChange: handleDifficultyChange,
          onEndgameModeChange: handleEndgameModeChange,
          onHostOnline: handleHostOnline,
          onModeChange: handleModeChange,
          onOnlineSignal: handleOnlineSignal,
          onRemoteSignalChange: setRemoteSignal,
          onRulesetChange: handleRulesetChange,
          onSideChange: handleSideChange,
        }}
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
    </I18nProvider>
  );
}
