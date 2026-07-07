import {
  Board,
  LineScores,
  Player,
  getAvailableMoves,
  getLineThreats,
  getNewCompletedLines,
  getOtherPlayer,
} from './rules';

export type LinesEndgameMode = 'standard' | 'wildcards';
export type WildcardId =
  | 'double-line'
  | 'block-bonus'
  | 'corner-spark'
  | 'last-word';

export type LinesBonusScores = Record<Player, number>;

export type WildcardDefinition = {
  description: string;
  id: WildcardId;
  name: string;
};

export type WildcardPickState = {
  active: WildcardId | null;
  picked: WildcardId | null;
  used: boolean;
};

export type WildcardState = {
  bonusScores: LinesBonusScores;
  options: WildcardId[];
  phase: 'inactive' | 'drafting' | 'active';
  pickIndex: number;
  pickOrder: Player[];
  players: Record<Player, WildcardPickState>;
};

export type WildcardBonusResult = {
  blockLines: number;
  bonus: number;
  lineCount: number;
};

const CORNERS = new Set([0, 2, 6, 8, 18, 20, 24, 26]);

export const WILDCARDS: Record<WildcardId, WildcardDefinition> = {
  'block-bonus': {
    description: 'Your next move gains +1 if it blocks an immediate threat.',
    id: 'block-bonus',
    name: 'Block Bonus',
  },
  'corner-spark': {
    description:
      'Your next corner move gains +1 if it scores or blocks a threat.',
    id: 'corner-spark',
    name: 'Corner Spark',
  },
  'double-line': {
    description: 'Your next scoring move gains +1 bonus point.',
    id: 'double-line',
    name: 'Double Line',
  },
  'last-word': {
    description: 'On the final cell, each new line gains +1 bonus point.',
    id: 'last-word',
    name: 'Last Word',
  },
};

const WILDCARD_ORDER: WildcardId[] = [
  'double-line',
  'block-bonus',
  'corner-spark',
  'last-word',
];

export const createBonusScores = (): LinesBonusScores => ({ O: 0, X: 0 });

export const createWildcardState = (): WildcardState => ({
  bonusScores: createBonusScores(),
  options: [],
  phase: 'inactive',
  pickIndex: 0,
  pickOrder: [],
  players: {
    O: {
      active: null,
      picked: null,
      used: false,
    },
    X: {
      active: null,
      picked: null,
      used: false,
    },
  },
});

export const getWildcardDraftOptions = (roundNumber: number): WildcardId[] => {
  const start = Math.max(0, roundNumber - 1) % WILDCARD_ORDER.length;

  return Array.from(
    { length: 3 },
    (_, index) => WILDCARD_ORDER[(start + index) % WILDCARD_ORDER.length],
  );
};

export const getWildcardPickOrder = (
  lineScores: LineScores,
  currentPlayer: Player,
): Player[] => {
  if (lineScores.X === lineScores.O) {
    return [currentPlayer, getOtherPlayer(currentPlayer)];
  }

  const trailing = lineScores.X < lineScores.O ? 'X' : 'O';

  return [trailing, getOtherPlayer(trailing)];
};

export const createWildcardDraft = ({
  currentPlayer,
  lineScores,
  roundNumber,
}: {
  currentPlayer: Player;
  lineScores: LineScores;
  roundNumber: number;
}): WildcardState => ({
  ...createWildcardState(),
  options: getWildcardDraftOptions(roundNumber),
  phase: 'drafting',
  pickOrder: getWildcardPickOrder(lineScores, currentPlayer),
});

export const getCurrentWildcardPicker = (state: WildcardState) =>
  state.phase === 'drafting' ? state.pickOrder[state.pickIndex] ?? null : null;

export const getRemainingDraftOptions = (state: WildcardState) =>
  state.options.filter(
    (option) =>
      state.players.X.picked !== option && state.players.O.picked !== option,
  );

export const pickWildcard = (
  state: WildcardState,
  player: Player,
  wildcard: WildcardId,
): WildcardState => {
  const picker = getCurrentWildcardPicker(state);

  if (
    state.phase !== 'drafting' ||
    picker !== player ||
    !getRemainingDraftOptions(state).includes(wildcard)
  ) {
    return state;
  }

  const nextPickIndex = state.pickIndex + 1;
  const nextPlayers = {
    ...state.players,
    [player]: {
      ...state.players[player],
      picked: wildcard,
    },
  };

  return {
    ...state,
    phase: nextPickIndex >= state.pickOrder.length ? 'active' : 'drafting',
    pickIndex: nextPickIndex,
    players: nextPlayers,
  };
};

export const canActivateWildcard = (state: WildcardState, player: Player) =>
  state.phase === 'active' &&
  state.players[player].picked !== null &&
  !state.players[player].used &&
  state.players[player].active === null;

export const activateWildcard = (
  state: WildcardState,
  player: Player,
): WildcardState => {
  if (!canActivateWildcard(state, player)) {
    return state;
  }

  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        active: state.players[player].picked,
      },
    },
  };
};

export const countBlockedLines = (
  board: Board,
  move: number,
  player: Player,
) =>
  getLineThreats(board, getOtherPlayer(player)).filter(
    (line) =>
      line.includes(move) &&
      line.find((cellIndex) => board[cellIndex] === null) === move,
  ).length;

export const scoreWildcardBonus = ({
  board,
  move,
  player,
  wildcard,
}: {
  board: Board;
  move: number;
  player: Player;
  wildcard: WildcardId;
}): WildcardBonusResult => {
  const next = [...board];
  next[move] = player;

  const lineCount = getNewCompletedLines(board, next, player).length;
  const blockLines = countBlockedLines(board, move, player);
  const remainingCells = getAvailableMoves(board).length;
  const bonus =
    wildcard === 'double-line'
      ? lineCount > 0
        ? 1
        : 0
      : wildcard === 'block-bonus'
        ? blockLines > 0
          ? 1
          : 0
        : wildcard === 'corner-spark'
          ? CORNERS.has(move) && (lineCount > 0 || blockLines > 0)
            ? 1
            : 0
          : remainingCells === 1 && lineCount > 0
            ? lineCount
            : 0;

  return {
    blockLines,
    bonus,
    lineCount,
  };
};

export const consumeActiveWildcard = (
  state: WildcardState,
  player: Player,
  move: number,
  board: Board,
): { bonus: WildcardBonusResult; nextState: WildcardState; wildcard: WildcardId | null } => {
  const wildcard = state.players[player].active;
  const emptyBonus = {
    blockLines: 0,
    bonus: 0,
    lineCount: 0,
  };

  if (!wildcard) {
    return {
      bonus: emptyBonus,
      nextState: state,
      wildcard: null,
    };
  }

  const bonus = scoreWildcardBonus({ board, move, player, wildcard });

  return {
    bonus,
    nextState: {
      ...state,
      bonusScores: {
        ...state.bonusScores,
        [player]: state.bonusScores[player] + bonus.bonus,
      },
      players: {
        ...state.players,
        [player]: {
          ...state.players[player],
          active: null,
          used: true,
        },
      },
    },
    wildcard,
  };
};

export const chooseWildcardDraft = (
  board: Board,
  player: Player,
  options: WildcardId[],
) =>
  [...options].sort((left, right) => {
    const leftScore = evaluateWildcardPotential(board, player, left);
    const rightScore = evaluateWildcardPotential(board, player, right);

    return (
      rightScore - leftScore ||
      WILDCARD_ORDER.indexOf(left) - WILDCARD_ORDER.indexOf(right)
    );
  })[0] ?? null;

export const chooseWildcardMove = (
  board: Board,
  player: Player,
  wildcard: WildcardId,
) => {
  const moves = getAvailableMoves(board)
    .map((move) => ({
      move,
      result: scoreWildcardBonus({ board, move, player, wildcard }),
    }))
    .filter(({ result }) => result.bonus > 0)
    .sort(
      (left, right) =>
        right.result.bonus - left.result.bonus ||
        right.result.lineCount - left.result.lineCount ||
        right.result.blockLines - left.result.blockLines ||
        left.move - right.move,
    );

  return moves[0]?.move ?? null;
};

const evaluateWildcardPotential = (
  board: Board,
  player: Player,
  wildcard: WildcardId,
) => {
  const moves = getAvailableMoves(board);

  if (moves.length === 0) {
    return 0;
  }

  return Math.max(
    0,
    ...moves.map((move) => {
      const result = scoreWildcardBonus({ board, move, player, wildcard });

      return result.bonus * 100 + result.lineCount * 16 + result.blockLines * 14;
    }),
  );
};
