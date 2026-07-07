import { describe, expect, it } from 'vitest';
import { createBoard, getNewCompletedLines } from './rules';
import {
  applyFinalSixPowerMove,
  chooseFinalSixPower,
  chooseFinalSixPowerMove,
  createFinalSixPowerDraft,
  getBlockingLines,
  getCurrentFinalSixPowerPicker,
  getFinalSixPowerBoardEffects,
  getFinalSixPowerPickOrder,
  getPowerCellPayoff,
  pickFinalSixPower,
} from './finalSixPowers';

describe('Final Six Powers v2', () => {
  it('gives the trailing player first power choice and allows one power per player', () => {
    expect(getFinalSixPowerPickOrder({ O: 4, X: 2 }, 'O')).toEqual(['X', 'O']);
    expect(getFinalSixPowerPickOrder({ O: 3, X: 3 }, 'O')).toEqual(['O', 'X']);

    const board = createBoard();
    const draft = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 1, X: 1 },
      mode: 'powers-v2',
    });

    expect(getCurrentFinalSixPowerPicker(draft)).toBe('X');

    const afterX = pickFinalSixPower(draft, board, 'X', {
      id: 'power-cell',
      targetCell: 2,
    });
    const xCannotPickAgain = pickFinalSixPower(afterX, board, 'X', {
      id: 'surge-line',
      targetCell: 3,
    });

    expect(xCannotPickAgain).toBe(afterX);
    expect(getCurrentFinalSixPowerPicker(afterX)).toBe('O');

    const active = pickFinalSixPower(afterX, board, 'O', {
      id: 'power-cell',
      targetCell: 3,
    });

    expect(active.phase).toBe('active');
    expect(active.players.X.choice?.id).toBe('power-cell');
    expect(active.players.O.choice?.id).toBe('power-cell');
  });

  it('scores Power Cell when the chosen cell completes a line', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';

    let state = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 0, X: 0 },
      mode: 'powers-v2',
    });
    state = pickFinalSixPower(state, board, 'X', {
      id: 'power-cell',
      targetCell: 2,
    });
    state = pickFinalSixPower(state, board, 'O', {
      id: 'power-cell',
      targetCell: 3,
    });

    const next = [...board];
    next[2] = 'X';
    const applied = applyFinalSixPowerMove({
      blockedLines: getBlockingLines(board, 2, 'X'),
      completedLines: getNewCompletedLines(board, next, 'X'),
      move: 2,
      player: 'X',
      state,
    });

    expect(getPowerCellPayoff(board, 2, 'X').bonus).toBe(2);
    expect(applied.impact.bonusPoints).toBe(2);
    expect(applied.impact.powerMessage).toBe('Power Cell +2');
    expect(applied.nextState.bonusScores.X).toBe(2);
  });

  it('scores Surge Line and lets Shield Line deny a v2 power bonus', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';

    let state = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 0, X: 0 },
      mode: 'powers-v2',
    });
    state = pickFinalSixPower(state, board, 'X', {
      id: 'surge-line',
      line: [0, 1, 2],
    });
    state = pickFinalSixPower(state, board, 'O', {
      id: 'shield-line',
      line: [0, 1, 2],
    });

    const next = [...board];
    next[2] = 'X';
    const applied = applyFinalSixPowerMove({
      blockedLines: getBlockingLines(board, 2, 'X'),
      completedLines: getNewCompletedLines(board, next, 'X'),
      move: 2,
      player: 'X',
      state,
    });

    expect(applied.impact.bonusPoints).toBe(0);
    expect(applied.impact.shieldDenied).toBe(true);
    expect(applied.impact.powerMessage).toBe('Shield denied bonus');
    expect(applied.nextState.bonusScores.X).toBe(0);
  });

  it('chooses and uses legal v2 AI power targets heuristically', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';

    const choice = chooseFinalSixPower(board, 'X', 'powers-v2');

    expect(choice).toEqual({ id: 'power-cell', targetCell: 2 });

    let state = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 0, X: 0 },
      mode: 'powers-v2',
    });
    state = pickFinalSixPower(state, board, 'X', choice!);
    state = pickFinalSixPower(state, board, 'O', {
      id: 'power-cell',
      targetCell: 3,
    });

    expect(chooseFinalSixPowerMove(board, 'X', state)).toBe(2);
  });

  it('exposes Surge and Shield preview line paths during v2 board selection', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    board[9] = 'O';
    board[10] = 'O';
    const draft = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 1, X: 1 },
      mode: 'powers-v2',
    });

    const surgeEffects = getFinalSixPowerBoardEffects({
      board,
      picker: 'X',
      selection: 'surge-line',
      state: draft,
    });
    const shieldEffects = getFinalSixPowerBoardEffects({
      board,
      picker: 'X',
      selection: 'shield-line',
      state: draft,
    });

    expect(surgeEffects.previewLines.some((preview) => preview.line.length === 3))
      .toBe(true);
    expect(surgeEffects.previewCells.some((preview) => preview.label === '+2'))
      .toBe(true);
    expect(shieldEffects.previewLines.some((preview) => preview.line.length === 3))
      .toBe(true);
    expect(shieldEffects.previewCells.some((preview) => preview.label === 'SH'))
      .toBe(true);
  });
});

describe('Final Six Powers v3', () => {
  it('starts charged at six cells and gives the trailing player first choice', () => {
    const draft = createFinalSixPowerDraft({
      currentPlayer: 'O',
      lineScores: { O: 4, X: 2 },
      mode: 'powers-v3',
    });

    expect(draft.mode).toBe('powers-v3');
    expect(draft.phase).toBe('choosing');
    expect(getCurrentFinalSixPowerPicker(draft)).toBe('X');
  });

  it('allows one charged or shield cell per player', () => {
    const board = createBoard();
    board[0] = 'O';
    board[1] = 'O';
    const draft = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 1, X: 1 },
      mode: 'powers-v3',
    });
    const afterX = pickFinalSixPower(draft, board, 'X', {
      id: 'shield-cell',
      targetCell: 2,
    });
    const xCannotPickAgain = pickFinalSixPower(afterX, board, 'X', {
      id: 'charged-cell',
      targetCell: 3,
    });
    const active = pickFinalSixPower(afterX, board, 'O', {
      id: 'charged-cell',
      targetCell: 3,
    });

    expect(xCannotPickAgain).toBe(afterX);
    expect(active.phase).toBe('active');
    expect(active.players.X.choice?.id).toBe('shield-cell');
    expect(active.players.O.choice?.id).toBe('charged-cell');
  });

  it('grants Charged Cell +2 only when the chosen cell scores or blocks', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';

    let state = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 0, X: 0 },
      mode: 'powers-v3',
    });
    state = pickFinalSixPower(state, board, 'X', {
      id: 'charged-cell',
      targetCell: 2,
    });
    state = pickFinalSixPower(state, board, 'O', {
      id: 'charged-cell',
      targetCell: 3,
    });

    const next = [...board];
    next[2] = 'X';
    const applied = applyFinalSixPowerMove({
      blockedLines: getBlockingLines(board, 2, 'X'),
      completedLines: getNewCompletedLines(board, next, 'X'),
      move: 2,
      player: 'X',
      state,
    });

    expect(applied.impact.bonusPoints).toBe(2);
    expect(applied.impact.powerMessages).toEqual(['Charged Cell +2']);
    expect(applied.nextState.bonusScores.X).toBe(2);

    let dryState = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 0, X: 0 },
      mode: 'powers-v3',
    });
    const dryBoard = createBoard();
    dryState = pickFinalSixPower(dryState, dryBoard, 'X', {
      id: 'charged-cell',
      targetCell: 4,
    });
    dryState = pickFinalSixPower(dryState, dryBoard, 'O', {
      id: 'charged-cell',
      targetCell: 5,
    });
    const dryApplied = applyFinalSixPowerMove({
      blockedLines: [],
      completedLines: [],
      move: 4,
      player: 'X',
      state: dryState,
    });

    expect(dryApplied.impact.bonusPoints).toBe(0);
    expect(dryApplied.impact.powerMessages).toEqual([]);
  });

  it('keeps charged cells visible until played', () => {
    const board = createBoard();
    let state = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 0, X: 0 },
      mode: 'powers-v3',
    });

    state = pickFinalSixPower(state, board, 'X', {
      id: 'charged-cell',
      targetCell: 2,
    });
    state = pickFinalSixPower(state, board, 'O', {
      id: 'charged-cell',
      targetCell: 3,
    });

    const effects = getFinalSixPowerBoardEffects({
      board,
      picker: null,
      selection: 'charged-cell',
      state,
    });

    expect(effects.chargedState).toBe(true);
    expect(effects.chargedEmptyCells.length).toBe(27);
    expect(new Set(effects.powerCells.map((choice) => choice.cell))).toEqual(
      new Set([2, 3]),
    );
  });

  it('lets Shield Cell deny a charged bonus and score +1 for the shielder', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';

    let state = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 0, X: 0 },
      mode: 'powers-v3',
    });
    state = pickFinalSixPower(state, board, 'X', {
      id: 'charged-cell',
      targetCell: 2,
    });
    state = pickFinalSixPower(state, board, 'O', {
      id: 'shield-cell',
      targetCell: 2,
    });

    const next = [...board];
    next[2] = 'X';
    const applied = applyFinalSixPowerMove({
      blockedLines: getBlockingLines(board, 2, 'X'),
      completedLines: getNewCompletedLines(board, next, 'X'),
      move: 2,
      player: 'X',
      state,
    });

    expect(applied.impact.bonusPoints).toBe(1);
    expect(applied.impact.shieldDenied).toBe(true);
    expect(applied.impact.shieldValue).toBe(true);
    expect(applied.impact.powerMessages).toEqual(['Bonus denied', 'Shield +1']);
    expect(applied.nextState.bonusScores.X).toBe(0);
    expect(applied.nextState.bonusScores.O).toBe(1);
  });

  it('chooses legal v3 power targets heuristically', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';

    expect(chooseFinalSixPower(board, 'X', 'powers-v3')).toEqual({
      id: 'charged-cell',
      targetCell: 2,
    });

    const shieldBoard = createBoard();
    shieldBoard[0] = 'O';
    shieldBoard[1] = 'O';

    expect(chooseFinalSixPower(shieldBoard, 'X', 'powers-v3')).toEqual({
      id: 'shield-cell',
      line: [0, 1, 2],
      targetCell: 2,
    });
  });

  it('exposes charged cell and shield previews during board selection', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    board[9] = 'O';
    board[10] = 'O';
    const draft = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 1, X: 1 },
      mode: 'powers-v3',
    });

    const chargedEffects = getFinalSixPowerBoardEffects({
      board,
      picker: 'X',
      selection: 'charged-cell',
      state: draft,
    });
    const shieldEffects = getFinalSixPowerBoardEffects({
      board,
      picker: 'X',
      selection: 'shield-cell',
      state: draft,
    });

    expect(chargedEffects.chargedState).toBe(true);
    expect(chargedEffects.chargedEmptyCells.length).toBe(23);
    expect(
      chargedEffects.previewCells.some((preview) => preview.label === '+2'),
    ).toBe(true);
    expect(
      shieldEffects.previewLines.some((preview) => preview.kind === 'shield-cell'),
    ).toBe(true);
    expect(
      shieldEffects.previewCells.some((preview) => preview.label === '+1'),
    ).toBe(true);
  });
});
