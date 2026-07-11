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

export type AiMoveOptions = {
  random?: () => number;
};

type RankedMove = {
  move: number;
  score: number;
};

type RankedLinesMove = RankedMove & {
  analysis: LinesMoveAnalysis;
  replyRisk: number;
};

type LinesMoveAnalysis = {
  blockedThreats: number;
  createsThreats: number;
  deniedRivalLines: number;
  futureScoringPaths: number;
  immediateLines: number;
  multiLineBonus: number;
  rivalPathsDenied: number;
};

const LINE_WEIGHTS = [0, 4, 34, 420];
export const AI_CENTER_INDEX = 13;
const CORNERS = new Set([0, 2, 6, 8, 18, 20, 24, 26]);
const MIDDLE_FACE_CENTERS = new Set([1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25]);
const EDGE_CENTERS = new Set([4, 10, 12, 14, 16, 22]);

const getRandom = (options?: AiMoveOptions) => options?.random ?? Math.random;

const takeRandom = (moves: number[], random = Math.random) =>
  moves[Math.floor(random() * moves.length)] ?? null;

const chooseWeighted = (
  ranked: RankedMove[],
  random: () => number,
  maxChoices: number,
  temperature: number,
) => {
  const choices = ranked.slice(0, maxChoices);

  if (choices.length === 0) {
    return null;
  }

  const bestScore = choices[0].score;
  const weights = choices.map(({ score }, index) => {
    const rankPenalty = 1 / (index + 1);
    return Math.max(0.015, Math.exp((score - bestScore) / temperature)) * rankPenalty;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = random() * total;

  for (let index = 0; index < choices.length; index += 1) {
    cursor -= weights[index];

    if (cursor <= 0) {
      return choices[index].move;
    }
  }

  return choices[0].move;
};

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

  if (board[AI_CENTER_INDEX] === player) {
    score += 20;
  } else if (board[AI_CENTER_INDEX] === rival) {
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
    const aPriority = a === AI_CENTER_INDEX ? 3 : CORNERS.has(a) ? 2 : 1;
    const bPriority = b === AI_CENTER_INDEX ? 3 : CORNERS.has(b) ? 2 : 1;
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
  if (move === AI_CENTER_INDEX) {
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
  if (move === AI_CENTER_INDEX) {
    return 30;
  }

  if (CORNERS.has(move)) {
    return 18;
  }

  if (EDGE_CENTERS.has(move)) {
    return 16;
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

const analyzeLinesMove = (
  board: Board,
  move: number,
  player: Player,
): LinesMoveAnalysis => {
  const rival = getOtherPlayer(player);
  const next = [...board];
  next[move] = player;
  const ownThreatsBefore = getThreatCells(board, player).length;
  const ownThreatsAfter = getThreatCells(next, player).length;
  const immediateLines = getNewCompletedLines(board, next, player).length;
  const blockedThreats = getLineThreats(board, rival).filter(
    (line) =>
      line.includes(move) &&
      line.find((index) => board[index] === null) === move,
  ).length;

  let deniedRivalLines = 0;
  let futureScoringPaths = 0;
  let rivalPathsDenied = 0;

  for (const line of WINNING_LINES) {
    if (!line.includes(move)) {
      continue;
    }

    const values = line.map((index) => board[index]);
    const ownCount = values.filter((cell) => cell === player).length;
    const rivalCount = values.filter((cell) => cell === rival).length;

    if (rivalCount > 0 && ownCount === 0) {
      deniedRivalLines += rivalCount === 2 ? 0 : rivalCount;
      rivalPathsDenied += 1;
    }

    if (ownCount > 0 && rivalCount === 0) {
      futureScoringPaths += ownCount + 1;
    } else if (ownCount === 0 && rivalCount === 0) {
      futureScoringPaths += 1;
    }
  }

  return {
    blockedThreats,
    createsThreats: Math.max(0, ownThreatsAfter - ownThreatsBefore),
    deniedRivalLines,
    futureScoringPaths,
    immediateLines,
    multiLineBonus: Math.max(0, immediateLines - 1),
    rivalPathsDenied,
  };
};

const getBestImmediateLineGain = (board: Board, player: Player) =>
  getAvailableMoves(board).reduce((best, move) => {
    const next = [...board];
    next[move] = player;
    return Math.max(best, getNewCompletedLines(board, next, player).length);
  }, 0);

const scoreLinesBoard = (board: Board, player: Player) => {
  const rival = getOtherPlayer(player);
  const result = evaluateLinesBoard(board);
  const remaining = result.remainingCells;
  const lineDiff = result.lineScores[player] - result.lineScores[rival];
  const diffWeight = result.isComplete
    ? 1100
    : remaining < 6
      ? 285
      : remaining < 12
        ? 225
        : 165;
  let score = lineDiff * diffWeight;

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
      score += [0, 14, 82, 190][ownCount];
    } else if (rivalCount > 0) {
      score -= [0, 16, 94, 210][rivalCount] * 1.08;
    } else {
      score += 2;
    }
  }

  score += getThreatCells(board, player).length * (remaining < 8 ? 54 : 42);
  score -= getThreatCells(board, rival).length * (remaining < 8 ? 72 : 58);

  if (board[AI_CENTER_INDEX] === player) {
    score += 26;
  } else if (board[AI_CENTER_INDEX] === rival) {
    score -= 24;
  }

  return score;
};

const scoreLinesCandidateShallow = (
  board: Board,
  move: number,
  player: Player,
  includeReplyRisk = true,
) => {
  const rival = getOtherPlayer(player);
  const next = [...board];
  const beforeScores = getLineScores(board);
  next[move] = player;
  const afterScores = getLineScores(next);
  const immediateGain = afterScores[player] - beforeScores[player];
  const analysis = analyzeLinesMove(board, move, player);
  const remainingAfter = getAvailableMoves(next).length;
  const endgameMultiplier = remainingAfter < 6 ? 1.45 : remainingAfter < 10 ? 1.22 : 1;
  const replyRisk = includeReplyRisk ? getBestImmediateLineGain(next, rival) : 0;

  return (
    scoreLinesBoard(next, player) +
    immediateGain * 270 * endgameMultiplier +
    analysis.immediateLines * 170 +
    analysis.multiLineBonus * 260 +
    analysis.blockedThreats * 185 * endgameMultiplier +
    Math.max(0, analysis.blockedThreats - 1) * 95 +
    analysis.deniedRivalLines * 34 +
    analysis.createsThreats * 46 +
    analysis.futureScoringPaths * 12 +
    analysis.rivalPathsDenied * 8 +
    countOpenLinesThroughMove(board, move, player) * 11 +
    countOpenLinesThroughMove(board, move, rival) * 8 +
    lineParticipation(move) * 5 +
    linesPositionalBonus(move) -
    replyRisk * (remainingAfter < 8 ? 150 : 105)
  );
};

const scoreLinesCandidateOrder = (
  board: Board,
  move: number,
  player: Player,
  rivalThreatCells: Set<number>,
) => {
  const next = [...board];
  next[move] = player;

  return (
    getNewCompletedLines(board, next, player).length * 520 +
    (rivalThreatCells.has(move) ? 210 : 0) +
    countOpenLinesThroughMove(board, move, player) * 14 +
    lineParticipation(move) * 6 +
    linesPositionalBonus(move)
  );
};

const getLinesCandidateMoves = (board: Board, player: Player) =>
  {
    const rivalThreatCells = new Set(getThreatCells(board, getOtherPlayer(player)));

    return getAvailableMoves(board)
    .map((move) => ({
      move,
      score: scoreLinesCandidateOrder(board, move, player, rivalThreatCells),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ move }) => move);
  };

const searchLinesBoard = (
  board: Board,
  aiPlayer: Player,
  turn: Player,
  depth: number,
  candidateLimit: number,
  alpha: number,
  beta: number,
): number => {
  const result = evaluateLinesBoard(board);

  if (result.isComplete || depth <= 0) {
    return scoreLinesBoard(board, aiPlayer);
  }

  const moves = getLinesCandidateMoves(board, turn).slice(0, candidateLimit);

  if (turn === aiPlayer) {
    let best = Number.NEGATIVE_INFINITY;

    for (const move of moves) {
      const next = [...board];
      next[move] = turn;
      best = Math.max(
        best,
        searchLinesBoard(
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

  for (const move of moves) {
    const next = [...board];
    next[move] = turn;
    best = Math.min(
      best,
      searchLinesBoard(
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

const scoreLinesMove = (
  board: Board,
  move: number,
  player: Player,
  depth: number,
  candidateLimit: number,
): number => {
  const next = [...board];
  next[move] = player;
  const shallowScore = scoreLinesCandidateShallow(board, move, player);

  if (depth <= 0 || getAvailableMoves(next).length === 0) {
    return shallowScore;
  }

  return (
    searchLinesBoard(
      next,
      player,
      getOtherPlayer(player),
      depth,
      candidateLimit,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    ) +
    shallowScore * 0.35
  );
};

const isTacticallyAcceptableLinesMove = (
  board: Board,
  player: Player,
  candidate: RankedLinesMove,
  best: RankedLinesMove,
) => {
  if (candidate.analysis.immediateLines < best.analysis.immediateLines) {
    return false;
  }

  if (
    best.analysis.immediateLines === 0 &&
    candidate.analysis.blockedThreats < best.analysis.blockedThreats
  ) {
    return false;
  }

  const rival = getOtherPlayer(player);
  const next = [...board];
  next[candidate.move] = player;
  const candidateReplyRisk = getBestImmediateLineGain(next, rival);

  return candidateReplyRisk <= best.replyRisk;
};

const getForcedLinesMove = (
  board: Board,
  player: Player,
  difficulty: Difficulty,
  ranked: RankedLinesMove[],
) => {
  const best = ranked[0];

  if (!best || difficulty === 'easy') {
    return null;
  }

  const bestScoringMove = [...ranked].sort(
    (a, b) =>
      b.analysis.immediateLines - a.analysis.immediateLines ||
      b.analysis.multiLineBonus - a.analysis.multiLineBonus ||
      b.score - a.score,
  )[0];

  if (
    bestScoringMove &&
    bestScoringMove.analysis.immediateLines > 0 &&
    best.analysis.immediateLines === 0 &&
    bestScoringMove.score >= best.score - 220 &&
    isTacticallyAcceptableLinesMove(board, player, bestScoringMove, best)
  ) {
    return bestScoringMove.move;
  }

  const bestBlockingMove = [...ranked].sort(
    (a, b) =>
      b.analysis.blockedThreats - a.analysis.blockedThreats ||
      b.analysis.immediateLines - a.analysis.immediateLines ||
      b.score - a.score,
  )[0];

  if (
    bestBlockingMove &&
    best.analysis.immediateLines === 0 &&
    bestBlockingMove.analysis.blockedThreats > best.analysis.blockedThreats
  ) {
    return bestBlockingMove.move;
  }

  if (difficulty !== 'master' || best.replyRisk === 0) {
    return null;
  }

  const saferMove = ranked.find(
    (candidate) =>
      candidate.replyRisk < best.replyRisk &&
      candidate.analysis.immediateLines >= best.analysis.immediateLines &&
      candidate.score >= best.score - 220,
  );

  return saferMove?.move ?? null;
};

const chooseLinesMove = (
  board: Board,
  player: Player,
  difficulty: Difficulty,
  options?: AiMoveOptions,
) => {
  const moves = getAvailableMoves(board);

  if (moves.length === 0) {
    return null;
  }

  const random = getRandom(options);
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
    master: 9,
  };
  const depth = depthByDifficulty[difficulty];
  const candidateLimit = candidateLimitByDifficulty[difficulty];
  const ranked = moves
    .map((move) => {
      const next = [...board];
      next[move] = player;
      return {
        analysis: analyzeLinesMove(board, move, player),
        move,
        replyRisk: getBestImmediateLineGain(next, getOtherPlayer(player)),
        score: scoreLinesMove(board, move, player, depth, candidateLimit),
      };
    })
    .sort((a, b) => b.score - a.score);
  const forcedMove = getForcedLinesMove(board, player, difficulty, ranked);

  if (forcedMove !== null) {
    return forcedMove;
  }

  if (difficulty === 'master' || difficulty === 'hard') {
    return ranked[0]?.move ?? takeRandom(moves, random);
  }

  if (difficulty === 'balanced') {
    const best = ranked[0];
    const softerMove = ranked
      .slice(1, 3)
      .find((candidate) =>
        best ? isTacticallyAcceptableLinesMove(board, player, candidate, best) : true,
      );

    if (softerMove && random() < 0.12) {
      return softerMove.move;
    }

    return best?.move ?? takeRandom(moves, random);
  }

  if (random() < 0.1) {
    return takeRandom(moves, random);
  }

  return (
    chooseWeighted(ranked, random, Math.min(7, ranked.length), 680) ??
    takeRandom(moves, random)
  );
};

const chooseClassicMove = (
  board: Board,
  player: Player,
  difficulty: Difficulty,
  options?: AiMoveOptions,
) => {
  const moves = getAvailableMoves(board);

  if (moves.length === 0) {
    return null;
  }

  const random = getRandom(options);
  const rival = getOtherPlayer(player);
  const winningMove = findWinningMove(board, player);

  if (winningMove !== null && (difficulty !== 'easy' || random() < 0.78)) {
    return winningMove;
  }

  const blockingMove = findWinningMove(board, rival);

  if (
    blockingMove !== null &&
    (difficulty === 'master' ||
      difficulty === 'hard' ||
      difficulty === 'balanced' ||
      random() < 0.45)
  ) {
    return blockingMove;
  }

  if (difficulty === 'easy' && random() < 0.12) {
    return takeRandom(moves, random);
  }

  const movesPlayed = board.filter(Boolean).length;

  if (difficulty !== 'easy' && movesPlayed <= 1) {
    const openingMove = [
      AI_CENTER_INDEX,
      0,
      2,
      6,
      8,
      18,
      20,
      24,
      26,
    ].find((move) => board[move] === null);

    if (openingMove !== undefined) {
      return openingMove;
    }
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
  const depth =
    difficulty === 'master' && moves.length > 18
      ? 2
      : depthByDifficulty[difficulty];
  const candidateLimit =
    difficulty === 'master' && moves.length > 18
      ? 9
      : candidateLimitByDifficulty[difficulty];
  const ranked = getCandidateMoves(board)
    .map((move) => ({
      move,
      score:
        scoreMove(board, move, player, depth, candidateLimit) +
        (threatBonus.get(move) ?? 0),
    }))
    .sort((a, b) => b.score - a.score);

  if (difficulty === 'master' || difficulty === 'hard') {
    return ranked[0]?.move ?? takeRandom(moves, random);
  }

  if (difficulty === 'balanced' && ranked[1] && random() < 0.14) {
    return ranked[1].move;
  }

  if (difficulty === 'easy') {
    return (
      chooseWeighted(ranked, random, Math.min(7, ranked.length), 520) ??
      takeRandom(moves, random)
    );
  }

  return ranked[0]?.move ?? takeRandom(moves, random);
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
    (firstMove === AI_CENTER_INDEX ? 34 : 0);

  const threshold: Record<Difficulty, number> = {
    easy: 104,
    balanced: 78,
    hard: 66,
    master: 54,
  };

  return value >= threshold[difficulty];
};

export const chooseAiMove = (
  board: Board,
  player: Player,
  difficulty: Difficulty,
  ruleset: GameRuleset = 'classic',
  options?: AiMoveOptions,
) =>
  ruleset === 'lines'
    ? chooseLinesMove(board, player, difficulty, options)
    : chooseClassicMove(board, player, difficulty, options);
