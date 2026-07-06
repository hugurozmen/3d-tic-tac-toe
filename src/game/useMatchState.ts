import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { feedback } from './feedback';
import {
  Board,
  Player,
  countMarks,
  createBoard,
  evaluateBoard,
  getOtherPlayer,
} from './rules';

export type Score = Record<Player | 'draws', number>;

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

export function useMatchState() {
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X');
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [score, setScore] = useState<Score>(loadScore);
  const [scoredRound, setScoredRound] = useState<string | null>(null);
  const boardRef = useRef(board);
  const currentPlayerRef = useRef(currentPlayer);
  const startingPlayerRef = useRef<Player>('X');
  const result = useMemo(() => evaluateBoard(board), [board]);
  const boardSignature = useMemo(
    () => board.map((cell) => cell ?? '-').join(''),
    [board],
  );
  const roundsPlayed = score.X + score.O + score.draws;
  const xMoves = countMarks(board, 'X');
  const oMoves = countMarks(board, 'O');

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

  const resetRound = useCallback((starter?: Player) => {
    const previousResult = evaluateBoard(boardRef.current);
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
  }, []);

  const resetMatch = useCallback(() => {
    resetRound('X');
    setScore(createScore());
  }, [resetRound]);

  const applyMove = useCallback((index: number, player?: Player) => {
    const activeBoard = boardRef.current;
    const activeResult = evaluateBoard(activeBoard);
    const movePlayer = player ?? currentPlayerRef.current;

    if (activeBoard[index] || activeResult.winner || activeResult.isDraw) {
      return false;
    }

    const next = [...activeBoard];
    const nextPlayer = getOtherPlayer(movePlayer);

    next[index] = movePlayer;
    boardRef.current = next;
    currentPlayerRef.current = nextPlayer;
    setBoard(next);
    setCurrentPlayer(nextPlayer);
    setLastMove(index);
    feedback.place(movePlayer);
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
  };
}
