import {
  Board,
  Difficulty,
  GameRuleset,
  Player,
  WINNING_LINES,
  evaluateClassicBoard,
  evaluateLinesBoard,
  getAvailableMoves,
  getLineScores,
  getLineThreats,
  getNewCompletedLines,
  getOtherPlayer,
  getThreatCells,
} from './rules';

const LINE_WEIGHTS = [0, 4, 34, 420];
const CENTER_INDEX = 13;
const CORNERS = new Set([0, 2, 6, 8, 18, 20, 24, 26]);
const MIDDLE_FACE_CENTERS = new Set([1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25]);
const EDGE_CENTERS = new Set([4, 10, 12, 14, 16, 22]);

const takeRandom = (moves: number[]) =>
  moves[Math.floor(Math.random() * moves.length)] ?? null;

const findWinningMove = (board: Board, player: Player) =>
  getAvailableMoves(board).find((move) => {
    const next = [...board];
    next[move] = player;
    return evaluateClassicBoard(next).winner === player;
  }) ?? null;

const lineScore = (ownCount: number, rivalCount: number) => {
  if (ownCount && rivalCount) {
    return 0;
  }

  if (ownCount) {
    return LINE_WEIGHTS[ownCount];
  }

  if (rivalCount) {
    return -LINE_WEIGHTS[rivalCount] * 1.15;
  }

  return 1;
};

const scorePosition = (board: Board, player: Player) => {
  const rival = getOtherPlayer(player);
  const terminal = evaluateClassicBoard(board);

  if (terminal.winner === player) {
    return 10000;
  }

  if (terminal.winner === rival) {
    return -10000;
  }

  let score = 0;

  for (const line of WINNING_LINES) {
    const values = line.map((index) => board[index]);
    const ownCount = values.filter((cell) => cell === player).length;
    const rivalCount = values.filter((cell) => cell === rival).length;
    score += lineScore(ownCount, rivalCount);
  }

  if (board[CENTER_INDEX] === player) {
    score += 20;
  } else if (board[CENTER_INDEX] === rival) {
    score -= 20;
  }

  for (const corner of CORNERS) {
    if (board[corner] === player) {
      score += 4;
    } else if (board[corner] === rival) {
      score -= 4;
    }
  }

  return score;
};

const getCandidateMoves = (board: Board) => {
  const moves = getAvailableMoves(board);

  return [...moves].sort((a, b) => {
    const aPriority = a === CENTER_INDEX ? 3 : CORNERS.has(a) ? 2 : 1;
    const bPriority = b === CENTER_INDEX ? 3 : CORNERS.has(b) ? 2 : 1;
    return bPriority - aPriority;
  });
};

const forkScore = (board: Board, player: Player) =>
  getAvailableMoves(board).reduce((score, move) => {
    const next = [...board];
    next[move] = player;
    const threats = getLineThreats(next, player).length;
    return score + Math.max(0, threats - 1) * 18;
  }, 0);

const positionalBonus = (move: number) => {
  if (move === CENTER_INDEX) {
    return 16;
  }

  if (CORNERS.has(move)) {
    return 7;
  }

  if (MIDDLE_FACE_CENTERS.has(move)) {
    return 4;
  }

  return 0;
};

const scoreTerminal = (
  board: Board,
  aiPlayer: Player,
  depthRemaining: number,
) => {
  const result = evaluateClassicBoard(board);

  if (result.winner === aiPlayer) {
    return 100000 + depthRemaining * 120;
  }

  if (result.winner === getOtherPlayer(aiPlayer)) {
    return -100000 - depthRemaining * 120;
  }

  if (result.isDraw) {
    return 0;
  }

  return null;
};

const minimax = (
  board: Board,
  aiPlayer: Player,
  turn: Player,
  depth: number,
  candidateLimit: number,
  alpha: number,
  beta: number,
): number => {
  const terminalScore = scoreTerminal(board, aiPlayer, depth);

  if (terminalScore !== null) {
    return terminalScore;
  }

  if (depth <= 0) {
    const rival = getOtherPlayer(aiPlayer);
    return (
      scorePosition(board, aiPlayer) +
      forkScore(board, aiPlayer) -
      forkScore(board, rival) * 1.18
    );
  }

  const moves = getCandidateMoves(board)
    .map((move) => {
      const next = [...board];
      next[move] = turn;
      return {
        move,
        score:
          scorePosition(next, aiPlayer) +
          positionalBonus(move) +
          forkScore(next, turn) * (turn === aiPlayer ? 1 : -1.08),
      };
    })
    .sort((a, b) =>
      turn === aiPlayer ? b.score - a.score : a.score - b.score,
    )
    .slice(0, candidateLimit);

  if (turn === aiPlayer) {
    let best = Number.NEGATIVE_INFINITY;

    for (const { move } of moves) {
      const next = [...board];
      next[move] = turn;
      best = Math.max(
        best,
        minimax(
          next,
          aiPlayer,
          getOtherPlayer(turn),
          depth - 1,
          candidateLimit,
          alpha,
          beta,
        ),
      );
      alpha = Math.max(alpha, best);

      if (beta <= alpha) {
        break;
      }
    }

    return best;
  }

  let best = Number.POSITIVE_INFINITY;

  for (const { move } of moves) {
    const next = [...board];
    next[move] = turn;
    best = Math.min(
      best,
      minimax(
        next,
        aiPlayer,
        getOtherPlayer(turn),
        depth - 1,
        candidateLimit,
        alpha,
        beta,
      ),
    );
    beta = Math.min(beta, best);

    if (beta <= alpha) {
      break;
    }
  }

  return best;
};

const scoreMove = (
  board: Board,
  move: number,
  player: Player,
  depth: number,
  candidateLimit: number,
) => {
  const next = [...board];
  next[move] = player;

  return (
    minimax(
      next,
      player,
      getOtherPlayer(player),
      depth,
      candidateLimit,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    ) + positionalBonus(move)
  );
};

const lineParticipation = (move: number) =>
  WINNING_LINES.filter((line) => line.includes(move)).length;

const linesPositionalBonus = (move: number) => {
  if (move === CENTER_INDEX) {
    return 28;
  }

  if (CORNERS.has(move)) {
    return 18;
  }

  if (EDGE_CENTERS.has(move)) {
    return 15;
  }

  if (MIDDLE_FACE_CENTERS.has(move)) {
    return 11;
  }

  return 4;
};

const countOpenLinesThroughMove = (
  board: Board,
  move: number,
  player: Player,
) => {
  const rival = getOtherPlayer(player);

  return WINNING_LINES.filter(
    (line) =>
      line.includes(move) &&
      line.every((index) => index === move || board[index] !== rival),
  ).length;
};

const scoreLinesBoard = (board: Board, player: Player) => {
  const rival = getOtherPlayer(player);
  const result = evaluateLinesBoard(board);
  let score =
    (result.lineScores[player] - result.lineScores[rival]) *
    (result.isComplete ? 900 : 155);

  if (result.isComplete) {
    if (result.winner === player) {
      return 120000 + score;
    }

    if (result.winner === rival) {
      return -120000 + score;
    }

    return score;
  }

  for (const line of WINNING_LINES) {
    const values = line.map((index) => board[index]);
    const ownCount = values.filter((cell) => cell === player).length;
    const rivalCount = values.filter((cell) => cell === rival).length;

    if (ownCount > 0 && rivalCount > 0) {
      continue;
    }

    if (ownCount > 0) {
      score += [0, 9, 54, 170][ownCount];
    } else if (rivalCount > 0) {
      score -= [0, 8, 58, 185][rivalCount] * 1.08;
    } else {
      score += 2;
    }
  }

  score += getThreatCells(board, player).length * 34;
  score -= getThreatCells(board, rival).length * 42;

  return score;
};

const scoreLinesCandidateShallow = (
  board: Board,
  move: number,
  player: Player,
) => {
  const rival = getOtherPlayer(player);
  const next = [...board];
  const beforeScores = getLineScores(board);
  next[move] = player;
  const afterScores = getLineScores(next);
  const immediateGain = afterScores[player] - beforeScores[player];
  const newCompletedCount = getNewCompletedLines(board, next, player).length;
  const blocksThreat = getThreatCells(board, rival).includes(move) ? 1 : 0;
  const createsThreats =
    getThreatCells(next, player).length - getThreatCells(board, player).length;
  const remainingAfter = getAvailableMoves(next).length;
  const endgameMultiplier = remainingAfter < 6 ? 1.35 : 1;

  return (
    scoreLinesBoard(next, player) +
    immediateGain * 230 * endgameMultiplier +
    newCompletedCount * 120 +
    blocksThreat * 118 * endgameMultiplier +
    Math.max(0, createsThreats) * 28 +
    countOpenLinesThroughMove(board, move, player) * 9 +
    countOpenLinesThroughMove(board, move, rival) * 7 +
    lineParticipation(move) * 4 +
    linesPositionalBonus(move)
  );
};

const getLinesCandidateMoves = (board: Board, player: Player) =>
  getAvailableMoves(board)
    .map((move) => ({
      move,
      score: scoreLinesCandidateShallow(board, move, player),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ move }) => move);

const scoreLinesMove = (
  board: Board,
  move: number,
  player: Player,
  depth: number,
  candidateLimit: number,
): number => {
  const next = [...board];
  next[move] = player;
  const ownScore = scoreLinesCandidateShallow(board, move, player);

  if (depth <= 0 || getAvailableMoves(next).length === 0) {
    return ownScore;
  }

  const rival = getOtherPlayer(player);
  const rivalCandidates = getLinesCandidateMoves(next, rival).slice(
    0,
    candidateLimit,
  );
  const rivalBest = rivalCandidates.reduce((best, rivalMove) => {
    return Math.max(
      best,
      scoreLinesMove(next, rivalMove, rival, depth - 1, candidateLimit),
    );
  }, Number.NEGATIVE_INFINITY);

  return ownScore - (Number.isFinite(rivalBest) ? rivalBest * 0.55 : 0);
};

const chooseLinesMove = (
  board: Board,
  player: Player,
  difficulty: Difficulty,
) => {
  const moves = getAvailableMoves(board);

  if (moves.length === 0) {
    return null;
  }

  if (difficulty === 'easy' && Math.random() < 0.34) {
    return takeRandom(moves);
  }

  const depthByDifficulty: Record<Difficulty, number> = {
    easy: 0,
    balanced: 0,
    hard: 1,
    master: 2,
  };
  const candidateLimitByDifficulty: Record<Difficulty, number> = {
    easy: 7,
    balanced: 8,
    hard: 8,
    master: 10,
  };
  const depth = depthByDifficulty[difficulty];
  const candidateLimit = candidateLimitByDifficulty[difficulty];
  const ranked = moves
    .map((move) => ({
      move,
      score: scoreLinesMove(board, move, player, depth, candidateLimit),
    }))
    .sort((a, b) => b.score - a.score);

  if (difficulty === 'balanced' && ranked[1] && Math.random() < 0.16) {
    return ranked[1].move;
  }

  if (difficulty === 'easy' && ranked[2] && Math.random() < 0.28) {
    return ranked[2].move;
  }

  return ranked[0]?.move ?? takeRandom(moves);
};

const chooseClassicMove = (
  board: Board,
  player: Player,
  difficulty: Difficulty,
) => {
  const moves = getAvailableMoves(board);

  if (moves.length === 0) {
    return null;
  }

  const rival = getOtherPlayer(player);
  const winningMove = findWinningMove(board, player);

  if (winningMove !== null) {
    return winningMove;
  }

  const blockingMove = findWinningMove(board, rival);

  if (blockingMove !== null && difficulty !== 'easy') {
    return blockingMove;
  }

  if (difficulty === 'easy' && Math.random() < 0.42) {
    return takeRandom(moves);
  }

  const threatBonus = new Map<number, number>();

  for (const threat of getLineThreats(board, player)) {
    const move = threat.find((index) => board[index] === null);

    if (move !== undefined) {
      threatBonus.set(move, (threatBonus.get(move) ?? 0) + 36);
    }
  }

  for (const threat of getLineThreats(board, rival)) {
    const move = threat.find((index) => board[index] === null);

    if (move !== undefined) {
      threatBonus.set(move, (threatBonus.get(move) ?? 0) + 32);
    }
  }

  const depthByDifficulty: Record<Difficulty, number> = {
    easy: 0,
    balanced: 1,
    hard: 2,
    master: 3,
  };
  const candidateLimitByDifficulty: Record<Difficulty, number> = {
    easy: 7,
    balanced: 8,
    hard: 10,
    master: 12,
  };
  const depth = depthByDifficulty[difficulty];
  const candidateLimit = candidateLimitByDifficulty[difficulty];
  const ranked = getCandidateMoves(board)
    .map((move) => ({
      move,
      score:
        scoreMove(board, move, player, depth, candidateLimit) +
        (threatBonus.get(move) ?? 0),
    }))
    .sort((a, b) => b.score - a.score);

  if (difficulty === 'balanced' && ranked[1] && Math.random() < 0.18) {
    return ranked[1].move;
  }

  if (difficulty === 'easy' && ranked[2] && Math.random() < 0.35) {
    return ranked[2].move;
  }

  return ranked[0]?.move ?? takeRandom(moves);
};

export const shouldSwapClassicPie = (
  board: Board,
  difficulty: Difficulty,
) => {
  const movesPlayed = board.filter(Boolean).length;

  if (movesPlayed !== 1) {
    return false;
  }

  const firstMove = board.findIndex(Boolean);
  const value =
    positionalBonus(firstMove) * 3 +
    lineParticipation(firstMove) * 8 +
    (firstMove === CENTER_INDEX ? 34 : 0);

  const threshold: Record<Difficulty, number> = {
    easy: 92,
    balanced: 78,
    hard: 66,
    master: 56,
  };

  return value >= threshold[difficulty];
};

export const chooseAiMove = (
  board: Board,
  player: Player,
  difficulty: Difficulty,
  ruleset: GameRuleset = 'classic',
) =>
  ruleset === 'lines'
    ? chooseLinesMove(board, player, difficulty)
    : chooseClassicMove(board, player, difficulty);
