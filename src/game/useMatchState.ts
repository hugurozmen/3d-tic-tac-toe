import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { feedback } from './feedback';
import {
  Board,
  GameRuleset,
  Player,
  countMarks,
  createBoard,
  evaluateBoard,
  getLineThreats,
  getOtherPlayer,
  getNewCompletedLines,
} from './rules';

export type Score = Record<Player | 'draws', number>;

export type MoveImpact = {
  blockedLines: number[][];
  id: number;
  linesCompleted: number[][];
  player: Player;
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

const createScore = (): Score => ({
  X: 0,
  O: 0,
  draws: 0,
});

export function useMatchState(ruleset: GameRuleset) {
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X');
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [score, setScore] = useState<Score>(loadScore);
  const [scoredRound, setScoredRound] = useState<string | null>(null);
  const [recentLines, setRecentLines] = useState<number[][]>([]);
  const [recentImpact, setRecentImpact] = useState<MoveImpact | null>(null);
  const boardRef = useRef(board);
  const currentPlayerRef = useRef(currentPlayer);
  const rulesetRef = useRef(ruleset);
  const startingPlayerRef = useRef<Player>('X');
  const recentLinesTimeoutRef = useRef<number | null>(null);
  const moveImpactIdRef = useRef(0);
  const result = useMemo(() => evaluateBoard(board, ruleset), [board, ruleset]);
  const boardSignature = useMemo(
    () => board.map((cell) => cell ?? '-').join(''),
    [board],
  );
  const roundsPlayed = score.X + score.O + score.draws;
  const xMoves = countMarks(board, 'X');
  const oMoves = countMarks(board, 'O');
  const opener = startingPlayerRef.current;

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
      window.localStorage.setItem('3dxox-score', JSON.stringify(score));
    } catch {
      // best-effort persistence only
    }
  }, [score]);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  useEffect(() => {
    rulesetRef.current = ruleset;
  }, [ruleset]);

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
    const nextStarter =
      starter ??
      (roundFinished
        ? getOtherPlayer(startingPlayerRef.current)
        : startingPlayerRef.current);
    const nextBoard = createBoard();

    startingPlayerRef.current = nextStarter;
    boardRef.current = nextBoard;
    currentPlayerRef.current = nextStarter;
    setBoard(nextBoard);
    setCurrentPlayer(nextStarter);
    setLastMove(null);
    setScoredRound(null);
    setRecentImpact(null);
    clearRecentLines();
  }, [clearRecentLines]);

  const resetMatch = useCallback(() => {
    resetRound('X');
    setScore(createScore());
  }, [resetRound]);

  const applyMove = useCallback((index: number, player?: Player) => {
    const activeBoard = boardRef.current;
    const activeRuleset = rulesetRef.current;
    const activeResult = evaluateBoard(activeBoard, activeRuleset);
    const movePlayer = player ?? currentPlayerRef.current;

    if (activeBoard[index] || activeResult.winner || activeResult.isDraw) {
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

    boardRef.current = next;
    currentPlayerRef.current = nextPlayer;
    setBoard(next);
    setCurrentPlayer(nextPlayer);
    setLastMove(index);

    if (newCompletedLines.length > 0) {
      setRecentLines(newCompletedLines);
      setRecentImpact({
        blockedLines,
        id: moveImpactIdRef.current + 1,
        linesCompleted: newCompletedLines,
        player: movePlayer,
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
    } else if (blockedLines.length > 0) {
      setRecentLines([]);
      setRecentImpact({
        blockedLines,
        id: moveImpactIdRef.current + 1,
        linesCompleted: [],
        player: movePlayer,
      });
      moveImpactIdRef.current += 1;
      feedback.block();

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
      moved: true,
      player: movePlayer,
    };
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

    setScore((previous) => {
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
    setScoredRound(boardSignature);
  }, [boardSignature, result.isDraw, result.winner, scoredRound]);

  return {
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
    recentImpact,
  };
}
