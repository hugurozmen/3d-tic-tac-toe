import {
  Board,
  LineScores,
  Player,
  WINNING_LINES,
  getAvailableMoves,
  getLineThreats,
  getNewCompletedLines,
  getOtherPlayer,
} from './rules';

export type LinesEndgameMode = 'standard' | 'powers-v2';
export type LinesBonusScores = Record<Player, number>;
export type FinalSixPowerId = 'power-cell' | 'surge-line' | 'shield-line';

export type FinalSixPowerChoice = {
  cell: number | null;
  id: FinalSixPowerId;
  line: number[] | null;
  player: Player;
  triggered: boolean;
};

export type FinalSixPowerEvent = {
  bonus: number;
  cell: number | null;
  line: number[] | null;
  player: Player;
  power: FinalSixPowerId;
  shieldDenied: boolean;
  text: string;
};

export type FinalSixPowerState = {
  bonusScores: LinesBonusScores;
  lastEvent: FinalSixPowerEvent | null;
  phase: 'inactive' | 'choosing' | 'active';
  pickIndex: number;
  pickOrder: Player[];
  players: Record<Player, { choice: FinalSixPowerChoice | null }>;
};

export type FinalSixPowerPickRequest = {
  id: FinalSixPowerId;
  line?: number[];
  targetCell?: number;
};

export type FinalSixPowerMoveImpact = {
  bonusPoints: number;
  power: FinalSixPowerId | null;
  powerMessage: string | null;
  shieldDenied: boolean;
};

export type FinalSixPowerPreviewCell = {
  cell: number;
  kind: FinalSixPowerId;
  label: '+2' | 'SH';
  player: Player;
};

export type FinalSixPowerPreviewLine = {
  kind: 'surge-line' | 'shield-line';
  line: number[];
  player: Player;
};

export type FinalSixPowerBoardEffects = {
  powerCells: FinalSixPowerChoice[];
  previewCells: FinalSixPowerPreviewCell[];
  previewLines: FinalSixPowerPreviewLine[];
  shieldLines: FinalSixPowerChoice[];
  surgeLines: FinalSixPowerChoice[];
  trigger: FinalSixPowerEvent | null;
};

export const FINAL_SIX_POWER_LABEL: Record<FinalSixPowerId, string> = {
  'power-cell': 'Power Cell',
  'shield-line': 'Shield Line',
  'surge-line': 'Surge Line',
};

export const FINAL_SIX_POWER_SHORT_LABEL: Record<FinalSixPowerId, string> = {
  'power-cell': 'Cell',
  'shield-line': 'Shield',
  'surge-line': 'Surge',
};

export const FINAL_SIX_POWER_DESCRIPTION: Record<FinalSixPowerId, string> = {
  'power-cell': 'Choose an empty cell. If it scores or blocks later, +2.',
  'shield-line': 'Choose an opponent threat line. Its power bonus is denied.',
  'surge-line': 'Choose your open line. Completing it later gives +2.',
};

const POWER_ORDER: FinalSixPowerId[] = [
  'power-cell',
  'surge-line',
  'shield-line',
];

const createBonusScores = (): LinesBonusScores => ({ O: 0, X: 0 });

const lineKey = (line: number[]) => [...line].sort((a, b) => a - b).join('-');

export const isSameLine = (left: number[] | null, right: number[] | null) =>
  Boolean(left && right && lineKey(left) === lineKey(right));

const countPlayerMarks = (board: Board, line: number[], player: Player) =>
  line.filter((cell) => board[cell] === player).length;

const countEmpty = (board: Board, line: number[]) =>
  line.filter((cell) => board[cell] === null).length;

const firstEmptyCell = (board: Board, line: number[]) =>
  line.find((cell) => board[cell] === null) ?? null;

const lineHasOpponent = (board: Board, line: number[], player: Player) =>
  line.some((cell) => board[cell] === getOtherPlayer(player));

const sortLines = (board: Board, player: Player, lines: number[][]) =>
  [...lines].sort((left, right) => {
    const leftMarks = countPlayerMarks(board, left, player);
    const rightMarks = countPlayerMarks(board, right, player);
    const leftEmpty = countEmpty(board, left);
    const rightEmpty = countEmpty(board, right);

    return (
      rightMarks - leftMarks ||
      leftEmpty - rightEmpty ||
      lineKey(left).localeCompare(lineKey(right))
    );
  });

export const createFinalSixPowerState = (): FinalSixPowerState => ({
  bonusScores: createBonusScores(),
  lastEvent: null,
  phase: 'inactive',
  pickIndex: 0,
  pickOrder: [],
  players: {
    O: { choice: null },
    X: { choice: null },
  },
});

export const getFinalSixPowerPickOrder = (
  lineScores: LineScores,
  currentPlayer: Player,
): Player[] => {
  if (lineScores.X === lineScores.O) {
    return [currentPlayer, getOtherPlayer(currentPlayer)];
  }

  const trailing = lineScores.X < lineScores.O ? 'X' : 'O';

  return [trailing, getOtherPlayer(trailing)];
};

export const createFinalSixPowerDraft = ({
  currentPlayer,
  lineScores,
}: {
  currentPlayer: Player;
  lineScores: LineScores;
}): FinalSixPowerState => ({
  ...createFinalSixPowerState(),
  phase: 'choosing',
  pickOrder: getFinalSixPowerPickOrder(lineScores, currentPlayer),
});

export const getCurrentFinalSixPowerPicker = (state: FinalSixPowerState) =>
  state.phase === 'choosing' ? state.pickOrder[state.pickIndex] ?? null : null;

export const getBlockingLines = (
  board: Board,
  move: number,
  player: Player,
) =>
  getLineThreats(board, getOtherPlayer(player)).filter(
    (line) =>
      line.includes(move) &&
      line.find((cellIndex) => board[cellIndex] === null) === move,
  );

export const getPowerCellPayoff = (
  board: Board,
  move: number,
  player: Player,
) => {
  if (board[move] !== null) {
    return { blockLines: [], bonus: 0, scoreLines: [] };
  }

  const next = [...board];
  next[move] = player;
  const scoreLines = getNewCompletedLines(board, next, player);
  const blockLines = getBlockingLines(board, move, player);

  return {
    blockLines,
    bonus: scoreLines.length > 0 || blockLines.length > 0 ? 2 : 0,
    scoreLines,
  };
};

export const getPowerCellPreviewCells = (board: Board, player: Player) =>
  getAvailableMoves(board).filter(
    (move) => getPowerCellPayoff(board, move, player).bonus > 0,
  );

export const getSurgeLineCandidates = (board: Board, player: Player) =>
  sortLines(
    board,
    player,
    WINNING_LINES.filter(
      (line) =>
        !lineHasOpponent(board, line, player) &&
        countPlayerMarks(board, line, player) > 0 &&
        countEmpty(board, line) > 0,
    ),
  );

export const getSurgeLineForCell = (
  board: Board,
  player: Player,
  cell: number,
) =>
  getSurgeLineCandidates(board, player).find(
    (line) => line.includes(cell) && board[cell] === null,
  ) ?? null;

export const getShieldLineCandidates = (board: Board, player: Player) =>
  sortLines(board, getOtherPlayer(player), getLineThreats(board, getOtherPlayer(player)));

export const getShieldLineForCell = (
  board: Board,
  player: Player,
  cell: number,
) =>
  getShieldLineCandidates(board, player).find(
    (line) => line.find((index) => board[index] === null) === cell,
  ) ?? null;

const normalizeLineTarget = (
  board: Board,
  player: Player,
  request: FinalSixPowerPickRequest,
) => {
  if (request.id === 'power-cell') {
    return {
      cell:
        request.targetCell !== undefined && board[request.targetCell] === null
          ? request.targetCell
          : null,
      line: null,
    };
  }

  if (request.id === 'surge-line') {
    const requestLine = request.line
      ? getSurgeLineCandidates(board, player).find((line) =>
          isSameLine(line, request.line ?? null),
        ) ?? null
      : null;
    const line =
      requestLine ??
      (request.targetCell !== undefined
        ? getSurgeLineForCell(board, player, request.targetCell)
        : getSurgeLineCandidates(board, player)[0] ?? null);

    return {
      cell: line ? firstEmptyCell(board, line) : null,
      line,
    };
  }

  const requestLine = request.line
    ? getShieldLineCandidates(board, player).find((line) =>
        isSameLine(line, request.line ?? null),
      ) ?? null
    : null;
  const line =
    requestLine ??
    (request.targetCell !== undefined
      ? getShieldLineForCell(board, player, request.targetCell)
      : getShieldLineCandidates(board, player)[0] ?? null);

  return {
    cell: line ? firstEmptyCell(board, line) : null,
    line,
  };
};

export const pickFinalSixPower = (
  state: FinalSixPowerState,
  board: Board,
  player: Player,
  request: FinalSixPowerPickRequest,
): FinalSixPowerState => {
  const picker = getCurrentFinalSixPowerPicker(state);

  if (
    state.phase !== 'choosing' ||
    picker !== player ||
    state.players[player].choice !== null ||
    !POWER_ORDER.includes(request.id)
  ) {
    return state;
  }

  const target = normalizeLineTarget(board, player, request);

  if (
    target.cell === null ||
    (request.id !== 'power-cell' && target.line === null)
  ) {
    return state;
  }

  const nextPickIndex = state.pickIndex + 1;
  const choice: FinalSixPowerChoice = {
    cell: target.cell,
    id: request.id,
    line: target.line,
    player,
    triggered: false,
  };

  return {
    ...state,
    phase: nextPickIndex >= state.pickOrder.length ? 'active' : 'choosing',
    pickIndex: nextPickIndex,
    players: {
      ...state.players,
      [player]: { choice },
    },
  };
};

const scorePowerCellTarget = (board: Board, player: Player, move: number) => {
  const payoff = getPowerCellPayoff(board, move, player);

  return (
    payoff.scoreLines.length * 120 +
    payoff.blockLines.length * 100 +
    WINNING_LINES.filter((line) => line.includes(move)).length
  );
};

export const chooseFinalSixPower = (
  board: Board,
  player: Player,
): FinalSixPowerPickRequest | null => {
  const scoringPowerCells = getPowerCellPreviewCells(board, player).sort(
    (left, right) =>
      scorePowerCellTarget(board, player, right) -
        scorePowerCellTarget(board, player, left) || left - right,
  );

  if (scoringPowerCells.length > 0) {
    return { id: 'power-cell', targetCell: scoringPowerCells[0] };
  }

  const surgeLine = getSurgeLineCandidates(board, player)[0] ?? null;

  if (surgeLine) {
    return {
      id: 'surge-line',
      line: surgeLine,
      targetCell: firstEmptyCell(board, surgeLine) ?? undefined,
    };
  }

  const shieldLine = getShieldLineCandidates(board, player)[0] ?? null;

  if (shieldLine) {
    return {
      id: 'shield-line',
      line: shieldLine,
      targetCell: firstEmptyCell(board, shieldLine) ?? undefined,
    };
  }

  const fallback = getAvailableMoves(board)[0] ?? null;

  return fallback === null ? null : { id: 'power-cell', targetCell: fallback };
};

export const chooseFinalSixPowerMove = (
  board: Board,
  player: Player,
  state: FinalSixPowerState,
) => {
  const choice = state.players[player].choice;

  if (state.phase !== 'active' || !choice || choice.triggered) {
    return null;
  }

  if (choice.id === 'power-cell' && choice.cell !== null) {
    const payoff = getPowerCellPayoff(board, choice.cell, player);

    return payoff.bonus > 0 ? choice.cell : null;
  }

  if (choice.id === 'surge-line' && choice.line) {
    const empty = firstEmptyCell(board, choice.line);

    return empty !== null && countPlayerMarks(board, choice.line, player) === 2
      ? empty
      : null;
  }

  return null;
};

export const applyFinalSixPowerMove = ({
  blockedLines,
  completedLines,
  move,
  player,
  state,
}: {
  blockedLines: number[][];
  completedLines: number[][];
  move: number;
  player: Player;
  state: FinalSixPowerState;
}): { impact: FinalSixPowerMoveImpact; nextState: FinalSixPowerState } => {
  if (state.phase !== 'active') {
    return {
      impact: {
        bonusPoints: 0,
        power: null,
        powerMessage: null,
        shieldDenied: false,
      },
      nextState: state,
    };
  }

  const opponent = getOtherPlayer(player);
  const playerChoice = state.players[player].choice;
  const opponentChoice = state.players[opponent].choice;
  const surgeTriggered =
    playerChoice?.id === 'surge-line' &&
    !playerChoice.triggered &&
    completedLines.some((line) => isSameLine(line, playerChoice.line));
  const powerCellTriggered =
    playerChoice?.id === 'power-cell' &&
    !playerChoice.triggered &&
    playerChoice.cell === move &&
    (completedLines.length > 0 || blockedLines.length > 0);
  const shieldTriggered =
    opponentChoice?.id === 'shield-line' &&
    !opponentChoice.triggered &&
    completedLines.some((line) => isSameLine(line, opponentChoice.line));
  const bonusPower =
    powerCellTriggered || surgeTriggered ? playerChoice?.id ?? null : null;
  const denied = Boolean(shieldTriggered && bonusPower);
  const bonusPoints = bonusPower && !denied ? 2 : 0;
  const powerMessage = denied
    ? 'Shield denied bonus'
    : bonusPower
      ? `${FINAL_SIX_POWER_LABEL[bonusPower]} +2`
      : null;
  const nextPlayers = {
    ...state.players,
    [player]: {
      choice:
        playerChoice && bonusPower
          ? { ...playerChoice, triggered: true }
          : playerChoice,
    },
    [opponent]: {
      choice:
        opponentChoice && shieldTriggered
          ? { ...opponentChoice, triggered: true }
          : opponentChoice,
    },
  };
  const eventPower = denied ? 'shield-line' : bonusPower;
  const event =
    eventPower && powerMessage
      ? {
          bonus: bonusPoints,
          cell:
            eventPower === 'shield-line'
              ? opponentChoice?.cell ?? null
              : playerChoice?.cell ?? null,
          line:
            eventPower === 'shield-line'
              ? opponentChoice?.line ?? null
              : playerChoice?.line ?? null,
          player: denied ? opponent : player,
          power: eventPower,
          shieldDenied: denied,
          text: powerMessage,
        }
      : null;

  return {
    impact: {
      bonusPoints,
      power: bonusPower,
      powerMessage,
      shieldDenied: denied,
    },
    nextState: {
      ...state,
      bonusScores: {
        ...state.bonusScores,
        [player]: state.bonusScores[player] + bonusPoints,
      },
      lastEvent: event,
      players: nextPlayers,
    },
  };
};

export const getFinalSixPowerBoardEffects = ({
  board,
  picker,
  selection,
  state,
}: {
  board: Board;
  picker: Player | null;
  selection: FinalSixPowerId;
  state: FinalSixPowerState;
}): FinalSixPowerBoardEffects => {
  const choices = [state.players.X.choice, state.players.O.choice].filter(
    (choice): choice is FinalSixPowerChoice => choice !== null,
  );
  const previewCells: FinalSixPowerPreviewCell[] = [];
  const previewLines: FinalSixPowerPreviewLine[] = [];

  if (state.phase === 'choosing' && picker) {
    if (selection === 'power-cell') {
      for (const cell of getPowerCellPreviewCells(board, picker)) {
        previewCells.push({ cell, kind: selection, label: '+2', player: picker });
      }
    } else if (selection === 'surge-line') {
      const seen = new Set<number>();

      for (const line of getSurgeLineCandidates(board, picker)) {
        const cell = firstEmptyCell(board, line);

        if (cell !== null && !seen.has(cell)) {
          seen.add(cell);
          previewCells.push({ cell, kind: selection, label: '+2', player: picker });
          previewLines.push({ kind: selection, line, player: picker });
        }
      }
    } else {
      for (const line of getShieldLineCandidates(board, picker)) {
        const cell = firstEmptyCell(board, line);

        if (cell !== null) {
          previewCells.push({ cell, kind: selection, label: 'SH', player: picker });
          previewLines.push({ kind: selection, line, player: picker });
        }
      }
    }
  }

  if (state.phase === 'active') {
    for (const choice of choices) {
      if (choice.triggered) {
        continue;
      }

      if (choice.id === 'power-cell' && choice.cell !== null) {
        const payoff = getPowerCellPayoff(board, choice.cell, choice.player);

        if (payoff.bonus > 0) {
          previewCells.push({
            cell: choice.cell,
            kind: choice.id,
            label: '+2',
            player: choice.player,
          });
        }
      }

      if (choice.id === 'surge-line' && choice.line) {
        const cell = firstEmptyCell(board, choice.line);

        if (
          cell !== null &&
          countPlayerMarks(board, choice.line, choice.player) === 2
        ) {
          previewCells.push({
            cell,
            kind: choice.id,
            label: '+2',
            player: choice.player,
          });
        }
      }
    }
  }

  return {
    powerCells: choices.filter((choice) => choice.id === 'power-cell'),
    previewCells,
    previewLines,
    shieldLines: choices.filter((choice) => choice.id === 'shield-line'),
    surgeLines: choices.filter((choice) => choice.id === 'surge-line'),
    trigger: state.lastEvent,
  };
};
