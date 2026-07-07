import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  id: number;
  linesCompleted: number[][];
  player: Player;
  power: FinalSixPowerId | null;
  powerMessage: string | null;
  shieldDenied: boolean;
};

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
  if (result.ruleset !== 'lines' || endgameMode !== 'powers-v2') {
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
    createFinalSixPowerState(),
  );
  const boardRef = useRef(board);
  const currentPlayerRef = useRef(currentPlayer);
  const matchRef = useRef(match);
  const rulesetRef = useRef(ruleset);
  const linesEndgameModeRef = useRef(linesEndgameMode);
  const finalSixPowersRef = useRef(finalSixPowers);
  const recentLinesTimeoutRef = useRef<number | null>(null);
  const moveImpactIdRef = useRef(0);
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
    if (ruleset === 'lines' && linesEndgameMode === 'powers-v2') {
      return;
    }

    const nextFinalSixPowers = createFinalSixPowerState();

    finalSixPowersRef.current = nextFinalSixPowers;
    setFinalSixPowers(nextFinalSixPowers);
  }, [linesEndgameMode, ruleset]);

  useEffect(() => {
    if (
      ruleset !== 'lines' ||
      linesEndgameMode !== 'powers-v2' ||
      baseResult.isComplete ||
      baseResult.remainingCells !== 6 ||
      finalSixPowers.phase !== 'inactive'
    ) {
      return;
    }

    const nextFinalSixPowers = createFinalSixPowerDraft({
      currentPlayer,
      lineScores: baseResult.lineScores,
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
    const nextFinalSixPowers = createFinalSixPowerState();

    matchRef.current = nextMatch;
    boardRef.current = nextBoard;
    currentPlayerRef.current = nextStarter;
    finalSixPowersRef.current = nextFinalSixPowers;
    setMatch(nextMatch);
    setBoard(nextBoard);
    setCurrentPlayer(nextStarter);
    setFinalSixPowers(nextFinalSixPowers);
    setLastMove(null);
    setScoredRound(null);
    setRecentImpact(null);
    clearRecentLines();
  }, [clearRecentLines]);

  const resetMatch = useCallback(() => {
    const nextMatch = createMatchState('X');
    const nextBoard = createBoard();
    const nextFinalSixPowers = createFinalSixPowerState();

    matchRef.current = nextMatch;
    boardRef.current = nextBoard;
    currentPlayerRef.current = nextMatch.opener;
    finalSixPowersRef.current = nextFinalSixPowers;
    setMatch(nextMatch);
    setBoard(nextBoard);
    setCurrentPlayer(nextMatch.opener);
    setFinalSixPowers(nextFinalSixPowers);
    setLastMove(null);
    setScoredRound(null);
    setRecentImpact(null);
    clearRecentLines();
  }, [clearRecentLines]);

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
        activeEndgameMode === 'powers-v2' &&
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
      activeRuleset === 'lines' && activeEndgameMode === 'powers-v2'
        ? applyFinalSixPowerMove({
            blockedLines,
            completedLines: newCompletedLines,
            move: index,
            player: movePlayer,
            state: activeFinalSixPowers,
          })
        : {
            impact: {
              bonusPoints: 0,
              power: null,
              powerMessage: null,
              shieldDenied: false,
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

    if (hasNotableImpact && newCompletedLines.length > 0) {
      setRecentLines(newCompletedLines);
      setRecentImpact({
        bonusPoints,
        blockedLines,
        id: moveImpactIdRef.current + 1,
        linesCompleted: newCompletedLines,
        player: movePlayer,
        power: powerImpact.impact.power,
        powerMessage: powerImpact.impact.powerMessage,
        shieldDenied: powerImpact.impact.shieldDenied,
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
        power: powerImpact.impact.power,
        powerMessage: powerImpact.impact.powerMessage,
        shieldDenied: powerImpact.impact.shieldDenied,
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
      moved: true,
      player: movePlayer,
      power: powerImpact.impact.power,
      powerMessage: powerImpact.impact.powerMessage,
      shieldDenied: powerImpact.impact.shieldDenied,
    };
  }, []);

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
    return true;
  }, []);

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

      matchRef.current = next;
      return next;
    });
    setScoredRound(boardSignature);
  }, [boardSignature, result.isDraw, result.winner, scoredRound]);

  return {
    applyMove,
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
