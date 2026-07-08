import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameAnimationEvents } from './animationEvents';
import { feedback } from './feedback';
import {
  MatchState,
  Score,
  advanceMatchRound,
  createMatchState,
  recordMatchRound,
} from './match';
import {
  Board,
  GameResult,
  GameRuleset,
  LineScores,
  Player,
  countMarks,
  createBoard,
  evaluateBoard,
  getLineThreats,
  getOtherPlayer,
  getNewCompletedLines,
} from './rules';
import {
  LinesEndgameMode,
  LinesBonusScores,
  FinalSixPowerId,
  FinalSixPowerMode,
  FinalSixPowerPickRequest,
  FinalSixPowerState,
  applyFinalSixPowerMove,
  createFinalSixPowerDraft,
  createFinalSixPowerState,
  pickFinalSixPower as pickFinalSixPowerState,
} from './finalSixPowers';

export type MoveImpact = {
  bonusPoints: number;
  blockedLines: number[][];
  chargedCellUsed: boolean;
  id: number;
  linesCompleted: number[][];
  player: Player;
  power: FinalSixPowerId | null;
  powerMessage: string | null;
  powerMessages: string[];
  shieldValue: boolean;
  shieldDenied: boolean;
};

const isFinalSixPowerMode = (
  mode: LinesEndgameMode,
): mode is FinalSixPowerMode => mode === 'powers-v2' || mode === 'powers-v3';

const addBonusScores = (
  lineScores: LineScores,
  bonusScores: LinesBonusScores,
): LineScores => ({
  O: lineScores.O + bonusScores.O,
  X: lineScores.X + bonusScores.X,
});

const applyLinesBonusToResult = (
  result: GameResult,
  bonusScores: LinesBonusScores,
  endgameMode: LinesEndgameMode,
): GameResult => {
  if (result.ruleset !== 'lines' || !isFinalSixPowerMode(endgameMode)) {
    return result;
  }

  const lineScores = addBonusScores(result.lineScores, bonusScores);
  const winner =
    result.isComplete && lineScores.X !== lineScores.O
      ? lineScores.X > lineScores.O
        ? 'X'
        : 'O'
      : null;

  return {
    ...result,
    winner,
    winningLines: winner ? result.completedLines[winner] : [],
    isDraw: result.isComplete && lineScores.X === lineScores.O,
    lineScores,
  } as GameResult;
};

const loadScore = (): Score => {
  try {
    const raw = window.localStorage.getItem('3dxox-score');

    if (raw) {
      const parsed = JSON.parse(raw);

      if (
        parsed &&
        [parsed.X, parsed.O, parsed.draws].every(
          (value) => Number.isInteger(value) && value >= 0,
        )
      ) {
        return { X: parsed.X, O: parsed.O, draws: parsed.draws };
      }
    }
  } catch {
    // fall through to a fresh score
  }

  return { X: 0, O: 0, draws: 0 };
};

export function useMatchState(
  ruleset: GameRuleset,
  linesEndgameMode: LinesEndgameMode = 'standard',
) {
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X');
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [lifetimeScore, setLifetimeScore] = useState<Score>(loadScore);
  const [match, setMatch] = useState<MatchState>(() => createMatchState());
  const [scoredRound, setScoredRound] = useState<string | null>(null);
  const [recentLines, setRecentLines] = useState<number[][]>([]);
  const [recentImpact, setRecentImpact] = useState<MoveImpact | null>(null);
  const [finalSixPowers, setFinalSixPowers] = useState<FinalSixPowerState>(() =>
    createFinalSixPowerState(
      isFinalSixPowerMode(linesEndgameMode) ? linesEndgameMode : 'powers-v3',
    ),
  );
  const boardRef = useRef(board);
  const currentPlayerRef = useRef(currentPlayer);
  const matchRef = useRef(match);
  const rulesetRef = useRef(ruleset);
  const linesEndgameModeRef = useRef(linesEndgameMode);
  const finalSixPowersRef = useRef(finalSixPowers);
  const finalSixAnnouncedRef = useRef(false);
  const recentLinesTimeoutRef = useRef<number | null>(null);
  const moveImpactIdRef = useRef(0);
  const {
    animationEvents,
    clearAnimationEvents,
    pushAnimationEvent,
  } = useGameAnimationEvents();
  const baseResult = useMemo(() => evaluateBoard(board, ruleset), [board, ruleset]);
  const result = useMemo(
    () =>
      applyLinesBonusToResult(
        baseResult,
        finalSixPowers.bonusScores,
        linesEndgameMode,
      ),
    [baseResult, finalSixPowers.bonusScores, linesEndgameMode],
  );
  const baseLineScores = baseResult.lineScores;
  const linesBonusScores = finalSixPowers.bonusScores;
  const boardSignature = useMemo(
    () => board.map((cell) => cell ?? '-').join(''),
    [board],
  );
  const xMoves = countMarks(board, 'X');
  const oMoves = countMarks(board, 'O');
  const opener = match.opener;

  const clearRecentLines = useCallback(() => {
    if (recentLinesTimeoutRef.current !== null) {
      window.clearTimeout(recentLinesTimeoutRef.current);
      recentLinesTimeoutRef.current = null;
    }

    setRecentLines([]);
    setRecentImpact(null);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('3dxox-score', JSON.stringify(lifetimeScore));
    } catch {
      // best-effort persistence only
    }
  }, [lifetimeScore]);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  useEffect(() => {
    rulesetRef.current = ruleset;
  }, [ruleset]);

  useEffect(() => {
    linesEndgameModeRef.current = linesEndgameMode;
  }, [linesEndgameMode]);

  useEffect(() => {
    finalSixPowersRef.current = finalSixPowers;
  }, [finalSixPowers]);

  useEffect(() => {
    if (ruleset === 'lines' && isFinalSixPowerMode(linesEndgameMode)) {
      return;
    }

    const nextFinalSixPowers = createFinalSixPowerState('powers-v3');

    finalSixPowersRef.current = nextFinalSixPowers;
    setFinalSixPowers(nextFinalSixPowers);
    finalSixAnnouncedRef.current = false;
  }, [linesEndgameMode, ruleset]);

  useEffect(() => {
    if (
      ruleset !== 'lines' ||
      baseResult.isComplete ||
      baseResult.remainingCells !== 6 ||
      finalSixAnnouncedRef.current
    ) {
      return;
    }

    finalSixAnnouncedRef.current = true;
    pushAnimationEvent({ type: 'final-six-start' });
  }, [
    baseResult.isComplete,
    baseResult.remainingCells,
    pushAnimationEvent,
    ruleset,
  ]);

  useEffect(() => {
    if (
      ruleset !== 'lines' ||
      !isFinalSixPowerMode(linesEndgameMode) ||
      baseResult.isComplete ||
      baseResult.remainingCells !== 6 ||
      finalSixPowers.phase !== 'inactive'
    ) {
      return;
    }

    const nextFinalSixPowers = createFinalSixPowerDraft({
      currentPlayer,
      lineScores: baseResult.lineScores,
      mode: linesEndgameMode,
    });

    finalSixPowersRef.current = nextFinalSixPowers;
    setFinalSixPowers(nextFinalSixPowers);
  }, [
    baseResult.isComplete,
    baseResult.lineScores,
    baseResult.remainingCells,
    currentPlayer,
    finalSixPowers.phase,
    linesEndgameMode,
    ruleset,
  ]);

  useEffect(
    () => () => {
      if (recentLinesTimeoutRef.current !== null) {
        window.clearTimeout(recentLinesTimeoutRef.current);
      }
    },
    [],
  );

  const resetRound = useCallback((starter?: Player) => {
    const previousResult = evaluateBoard(boardRef.current, rulesetRef.current);
    const roundFinished = Boolean(previousResult.winner) || previousResult.isDraw;
    const activeMatch = matchRef.current;
    const nextStarter = starter ?? (roundFinished ? activeMatch.nextOpener : activeMatch.opener);
    const nextMatch = roundFinished
      ? advanceMatchRound(activeMatch, nextStarter)
      : {
          ...activeMatch,
          nextOpener: getOtherPlayer(nextStarter),
          opener: nextStarter,
        };
    const nextBoard = createBoard();
    const nextFinalSixPowers = createFinalSixPowerState(
      isFinalSixPowerMode(linesEndgameModeRef.current)
        ? linesEndgameModeRef.current
        : 'powers-v3',
    );

    matchRef.current = nextMatch;
    boardRef.current = nextBoard;
    currentPlayerRef.current = nextStarter;
    finalSixPowersRef.current = nextFinalSixPowers;
    finalSixAnnouncedRef.current = false;
    setMatch(nextMatch);
    setBoard(nextBoard);
    setCurrentPlayer(nextStarter);
    setFinalSixPowers(nextFinalSixPowers);
    setLastMove(null);
    setScoredRound(null);
    setRecentImpact(null);
    clearAnimationEvents();
    clearRecentLines();
  }, [clearAnimationEvents, clearRecentLines]);

  const resetMatch = useCallback(() => {
    const nextMatch = createMatchState('X');
    const nextBoard = createBoard();
    const nextFinalSixPowers = createFinalSixPowerState(
      isFinalSixPowerMode(linesEndgameModeRef.current)
        ? linesEndgameModeRef.current
        : 'powers-v3',
    );

    matchRef.current = nextMatch;
    boardRef.current = nextBoard;
    currentPlayerRef.current = nextMatch.opener;
    finalSixPowersRef.current = nextFinalSixPowers;
    finalSixAnnouncedRef.current = false;
    setMatch(nextMatch);
    setBoard(nextBoard);
    setCurrentPlayer(nextMatch.opener);
    setFinalSixPowers(nextFinalSixPowers);
    setLastMove(null);
    setScoredRound(null);
    setRecentImpact(null);
    clearAnimationEvents();
    clearRecentLines();
  }, [clearAnimationEvents, clearRecentLines]);

  const applyMove = useCallback((index: number, player?: Player) => {
    const activeBoard = boardRef.current;
    const activeRuleset = rulesetRef.current;
    const activeEndgameMode = linesEndgameModeRef.current;
    const activeFinalSixPowers = finalSixPowersRef.current;
    const activeResult = applyLinesBonusToResult(
      evaluateBoard(activeBoard, activeRuleset),
      activeFinalSixPowers.bonusScores,
      activeEndgameMode,
    );
    const movePlayer = player ?? currentPlayerRef.current;

    if (
      activeBoard[index] ||
      activeResult.winner ||
      activeResult.isDraw ||
      (activeRuleset === 'lines' &&
        isFinalSixPowerMode(activeEndgameMode) &&
        activeFinalSixPowers.phase === 'choosing')
    ) {
      return false;
    }

    const next = [...activeBoard];
    const nextPlayer = getOtherPlayer(movePlayer);

    next[index] = movePlayer;
    const newCompletedLines =
      activeRuleset === 'lines'
        ? getNewCompletedLines(activeBoard, next, movePlayer)
        : [];
    const blockedLines =
      activeRuleset === 'lines'
        ? getLineThreats(activeBoard, getOtherPlayer(movePlayer)).filter(
            (line) =>
              line.includes(index) &&
              line.find((cellIndex) => activeBoard[cellIndex] === null) ===
                index,
          )
        : [];
    const powerImpact =
      activeRuleset === 'lines' && isFinalSixPowerMode(activeEndgameMode)
        ? applyFinalSixPowerMove({
            blockedLines,
            completedLines: newCompletedLines,
            move: index,
            player: movePlayer,
            state: activeFinalSixPowers,
          })
        : {
            impact: {
              bonusByType: {},
              bonusPoints: 0,
              chargedCellUsed: false,
              power: null,
              powerMessage: null,
              powerMessages: [],
              shieldDenied: false,
              shieldValue: false,
            },
            nextState: activeFinalSixPowers,
          };
    const bonusPoints = powerImpact.impact.bonusPoints;
    const hasNotableImpact =
      newCompletedLines.length > 0 ||
      blockedLines.length > 0 ||
      bonusPoints > 0 ||
      powerImpact.impact.shieldDenied;

    boardRef.current = next;
    currentPlayerRef.current = nextPlayer;
    finalSixPowersRef.current = powerImpact.nextState;
    setBoard(next);
    setCurrentPlayer(nextPlayer);
    setFinalSixPowers(powerImpact.nextState);
    setLastMove(index);
    pushAnimationEvent({
      cell: index,
      player: movePlayer,
      type: 'place',
    });

    if (newCompletedLines.length > 1) {
      pushAnimationEvent({
        lines: newCompletedLines,
        player: movePlayer,
        type: 'multi-line',
      });
    } else if (newCompletedLines.length === 1) {
      pushAnimationEvent({
        lines: newCompletedLines,
        player: movePlayer,
        type: 'score-line',
      });
    }

    if (blockedLines.length > 0) {
      pushAnimationEvent({
        lines: blockedLines,
        player: movePlayer,
        type: 'block',
      });
    }

    if (powerImpact.impact.powerMessages.length > 0) {
      const lastEvent = powerImpact.nextState.lastEvent;

      pushAnimationEvent({
        bonus: powerImpact.impact.bonusPoints,
        cell: lastEvent?.cell ?? index,
        line: lastEvent?.line ?? newCompletedLines[0] ?? blockedLines[0],
        player: lastEvent?.player ?? movePlayer,
        power: powerImpact.impact.power ?? 'power',
        shieldDenied: powerImpact.impact.shieldDenied,
        type: 'power-triggered',
      });
    }

    if (hasNotableImpact && newCompletedLines.length > 0) {
      setRecentLines(newCompletedLines);
      setRecentImpact({
        bonusPoints,
        blockedLines,
        id: moveImpactIdRef.current + 1,
        linesCompleted: newCompletedLines,
        player: movePlayer,
        chargedCellUsed: powerImpact.impact.chargedCellUsed,
        power: powerImpact.impact.power,
        powerMessage: powerImpact.impact.powerMessage,
        powerMessages: powerImpact.impact.powerMessages,
        shieldDenied: powerImpact.impact.shieldDenied,
        shieldValue: powerImpact.impact.shieldValue,
      });
      moveImpactIdRef.current += 1;
      feedback.scoreLine(newCompletedLines.length);

      if (recentLinesTimeoutRef.current !== null) {
        window.clearTimeout(recentLinesTimeoutRef.current);
      }

      recentLinesTimeoutRef.current = window.setTimeout(() => {
        setRecentLines([]);
        setRecentImpact(null);
        recentLinesTimeoutRef.current = null;
      }, 2600);
    } else if (hasNotableImpact) {
      setRecentLines([]);
      setRecentImpact({
        bonusPoints,
        blockedLines,
        id: moveImpactIdRef.current + 1,
        linesCompleted: [],
        player: movePlayer,
        chargedCellUsed: powerImpact.impact.chargedCellUsed,
        power: powerImpact.impact.power,
        powerMessage: powerImpact.impact.powerMessage,
        powerMessages: powerImpact.impact.powerMessages,
        shieldDenied: powerImpact.impact.shieldDenied,
        shieldValue: powerImpact.impact.shieldValue,
      });
      moveImpactIdRef.current += 1;
      if (bonusPoints > 0) {
        feedback.scoreLine(1);
      } else {
        feedback.block();
      }

      if (recentLinesTimeoutRef.current !== null) {
        window.clearTimeout(recentLinesTimeoutRef.current);
      }

      recentLinesTimeoutRef.current = window.setTimeout(() => {
        setRecentImpact(null);
        recentLinesTimeoutRef.current = null;
      }, 1800);
    } else {
      setRecentLines([]);
      setRecentImpact(null);
      feedback.place(movePlayer);
    }

    return {
      linesCompleted: newCompletedLines,
      blockedLines,
      bonusPoints,
      chargedCellUsed: powerImpact.impact.chargedCellUsed,
      moved: true,
      player: movePlayer,
      power: powerImpact.impact.power,
      powerMessage: powerImpact.impact.powerMessage,
      powerMessages: powerImpact.impact.powerMessages,
      shieldDenied: powerImpact.impact.shieldDenied,
      shieldValue: powerImpact.impact.shieldValue,
    };
  }, [pushAnimationEvent]);

  const pickFinalSixPower = useCallback((player: Player, request: FinalSixPowerPickRequest) => {
    const nextFinalSixPowers = pickFinalSixPowerState(
      finalSixPowersRef.current,
      boardRef.current,
      player,
      request,
    );

    if (nextFinalSixPowers === finalSixPowersRef.current) {
      return false;
    }

    finalSixPowersRef.current = nextFinalSixPowers;
    setFinalSixPowers(nextFinalSixPowers);
    const choice = nextFinalSixPowers.players[player].choice;

    pushAnimationEvent({
      cell: choice?.cell ?? undefined,
      line: choice?.line ?? undefined,
      player,
      power: request.id,
      type: 'power-selected',
    });
    return true;
  }, [pushAnimationEvent]);

  useEffect(() => {
    if (!result.winner && !result.isDraw) {
      if (scoredRound !== null) {
        setScoredRound(null);
      }

      return;
    }

    if (scoredRound === boardSignature) {
      return;
    }

    if (result.winner) {
      feedback.win();
    } else {
      feedback.draw();
    }

    pushAnimationEvent({
      isDraw: result.isDraw,
      type: 'round-end',
      winner: result.winner,
    });

    setLifetimeScore((previous) => {
      if (result.winner) {
        return {
          ...previous,
          [result.winner]: previous[result.winner] + 1,
        };
      }

      return {
        ...previous,
        draws: previous.draws + 1,
      };
    });
    setMatch((previous) => {
      const next = recordMatchRound(previous, result.winner, result.isDraw);

      if (next.winner) {
        pushAnimationEvent({
          type: 'match-end',
          winner: next.winner,
        });
      }

      matchRef.current = next;
      return next;
    });
    setScoredRound(boardSignature);
  }, [
    boardSignature,
    pushAnimationEvent,
    result.isDraw,
    result.winner,
    scoredRound,
  ]);

  return {
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
  };
}
