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
  LinesBonusScores,
  LinesEndgameMode,
  WildcardId,
  WildcardState,
  activateWildcard as activateWildcardState,
  consumeActiveWildcard,
  createWildcardDraft,
  createWildcardState,
  pickWildcard as pickWildcardState,
} from './wildcards';

export type MoveImpact = {
  bonusPoints: number;
  blockedLines: number[][];
  id: number;
  linesCompleted: number[][];
  player: Player;
  wildcard: WildcardId | null;
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
  if (result.ruleset !== 'lines' || endgameMode !== 'wildcards') {
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
  const [wildcards, setWildcards] = useState<WildcardState>(() =>
    createWildcardState(),
  );
  const boardRef = useRef(board);
  const currentPlayerRef = useRef(currentPlayer);
  const matchRef = useRef(match);
  const rulesetRef = useRef(ruleset);
  const linesEndgameModeRef = useRef(linesEndgameMode);
  const wildcardsRef = useRef(wildcards);
  const recentLinesTimeoutRef = useRef<number | null>(null);
  const moveImpactIdRef = useRef(0);
  const baseResult = useMemo(() => evaluateBoard(board, ruleset), [board, ruleset]);
  const result = useMemo(
    () =>
      applyLinesBonusToResult(
        baseResult,
        wildcards.bonusScores,
        linesEndgameMode,
      ),
    [baseResult, linesEndgameMode, wildcards.bonusScores],
  );
  const baseLineScores = baseResult.lineScores;
  const linesBonusScores = wildcards.bonusScores;
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
    wildcardsRef.current = wildcards;
  }, [wildcards]);

  useEffect(() => {
    if (ruleset === 'lines' && linesEndgameMode === 'wildcards') {
      return;
    }

    const nextWildcards = createWildcardState();

    wildcardsRef.current = nextWildcards;
    setWildcards(nextWildcards);
  }, [linesEndgameMode, ruleset]);

  useEffect(() => {
    if (
      ruleset !== 'lines' ||
      linesEndgameMode !== 'wildcards' ||
      baseResult.isComplete ||
      baseResult.remainingCells !== 6 ||
      wildcards.phase !== 'inactive'
    ) {
      return;
    }

    const nextWildcards = createWildcardDraft({
      currentPlayer,
      lineScores: baseResult.lineScores,
      roundNumber: match.roundNumber,
    });

    wildcardsRef.current = nextWildcards;
    setWildcards(nextWildcards);
  }, [
    baseResult.isComplete,
    baseResult.lineScores,
    baseResult.remainingCells,
    currentPlayer,
    linesEndgameMode,
    match.roundNumber,
    ruleset,
    wildcards.phase,
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
    const nextWildcards = createWildcardState();

    matchRef.current = nextMatch;
    boardRef.current = nextBoard;
    currentPlayerRef.current = nextStarter;
    wildcardsRef.current = nextWildcards;
    setMatch(nextMatch);
    setBoard(nextBoard);
    setCurrentPlayer(nextStarter);
    setWildcards(nextWildcards);
    setLastMove(null);
    setScoredRound(null);
    setRecentImpact(null);
    clearRecentLines();
  }, [clearRecentLines]);

  const resetMatch = useCallback(() => {
    const nextMatch = createMatchState('X');
    const nextBoard = createBoard();
    const nextWildcards = createWildcardState();

    matchRef.current = nextMatch;
    boardRef.current = nextBoard;
    currentPlayerRef.current = nextMatch.opener;
    wildcardsRef.current = nextWildcards;
    setMatch(nextMatch);
    setBoard(nextBoard);
    setCurrentPlayer(nextMatch.opener);
    setWildcards(nextWildcards);
    setLastMove(null);
    setScoredRound(null);
    setRecentImpact(null);
    clearRecentLines();
  }, [clearRecentLines]);

  const applyMove = useCallback((index: number, player?: Player) => {
    const activeBoard = boardRef.current;
    const activeRuleset = rulesetRef.current;
    const activeEndgameMode = linesEndgameModeRef.current;
    const activeWildcards = wildcardsRef.current;
    const activeResult = applyLinesBonusToResult(
      evaluateBoard(activeBoard, activeRuleset),
      activeWildcards.bonusScores,
      activeEndgameMode,
    );
    const movePlayer = player ?? currentPlayerRef.current;

    if (
      activeBoard[index] ||
      activeResult.winner ||
      activeResult.isDraw ||
      (activeRuleset === 'lines' &&
        activeEndgameMode === 'wildcards' &&
        activeWildcards.phase === 'drafting')
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
    const wildcardImpact =
      activeRuleset === 'lines' && activeEndgameMode === 'wildcards'
        ? consumeActiveWildcard(activeWildcards, movePlayer, index, activeBoard)
        : {
            bonus: {
              blockLines: 0,
              bonus: 0,
              lineCount: 0,
            },
            nextState: activeWildcards,
            wildcard: null,
          };
    const bonusPoints = wildcardImpact.bonus.bonus;
    const hasNotableImpact =
      newCompletedLines.length > 0 || blockedLines.length > 0 || bonusPoints > 0;

    boardRef.current = next;
    currentPlayerRef.current = nextPlayer;
    wildcardsRef.current = wildcardImpact.nextState;
    setBoard(next);
    setCurrentPlayer(nextPlayer);
    setWildcards(wildcardImpact.nextState);
    setLastMove(index);

    if (hasNotableImpact && newCompletedLines.length > 0) {
      setRecentLines(newCompletedLines);
      setRecentImpact({
        bonusPoints,
        blockedLines,
        id: moveImpactIdRef.current + 1,
        linesCompleted: newCompletedLines,
        player: movePlayer,
        wildcard: wildcardImpact.wildcard,
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
        wildcard: wildcardImpact.wildcard,
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
      wildcard: wildcardImpact.wildcard,
    };
  }, []);

  const pickWildcard = useCallback((player: Player, wildcard: WildcardId) => {
    const nextWildcards = pickWildcardState(
      wildcardsRef.current,
      player,
      wildcard,
    );

    if (nextWildcards === wildcardsRef.current) {
      return false;
    }

    wildcardsRef.current = nextWildcards;
    setWildcards(nextWildcards);
    return true;
  }, []);

  const activateWildcard = useCallback((player: Player) => {
    const activeResult = applyLinesBonusToResult(
      evaluateBoard(boardRef.current, rulesetRef.current),
      wildcardsRef.current.bonusScores,
      linesEndgameModeRef.current,
    );

    if (activeResult.winner || activeResult.isDraw) {
      return false;
    }

    const nextWildcards = activateWildcardState(wildcardsRef.current, player);

    if (nextWildcards === wildcardsRef.current) {
      return false;
    }

    wildcardsRef.current = nextWildcards;
    setWildcards(nextWildcards);
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
    activateWildcard,
    baseLineScores,
    board,
    currentPlayer,
    currentPlayerRef,
    lastMove,
    lifetimeScore,
    linesBonusScores,
    match,
    oMoves,
    pickWildcard,
    resetMatch,
    resetRound,
    result,
    wildcards,
    xMoves,
    opener,
    recentLines,
    recentImpact,
  };
}
