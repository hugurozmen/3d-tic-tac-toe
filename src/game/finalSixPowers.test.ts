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

  it('scores Power Cell when the chosen cell blocks a threat', () => {
    const board = createBoard();
    board[0] = 'O';
    board[1] = 'O';

    let state = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 2, X: 0 },
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

    expect(applied.impact.bonusPoints).toBe(2);
    expect(applied.impact.powerMessage).toBe('Power Cell +2');
    expect(applied.nextState.bonusScores.X).toBe(2);
  });

  it('scores Surge Line when the powered line is completed', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';

    let state = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 0, X: 0 },
    });
    state = pickFinalSixPower(state, board, 'X', {
      id: 'surge-line',
      line: [0, 1, 2],
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

    expect(applied.impact.bonusPoints).toBe(2);
    expect(applied.impact.powerMessage).toBe('Surge Line +2');
    expect(applied.nextState.bonusScores.X).toBe(2);
  });

  it('lets Shield Line deny an opponent power bonus', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';

    let state = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 0, X: 0 },
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
    expect(applied.nextState.players.X.choice?.triggered).toBe(true);
    expect(applied.nextState.players.O.choice?.triggered).toBe(true);
  });

  it('chooses and uses legal AI power targets heuristically', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';

    const choice = chooseFinalSixPower(board, 'X');

    expect(choice).toEqual({ id: 'power-cell', targetCell: 2 });

    let state = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 0, X: 0 },
    });
    state = pickFinalSixPower(state, board, 'X', choice!);
    state = pickFinalSixPower(state, board, 'O', {
      id: 'power-cell',
      targetCell: 3,
    });

    expect(chooseFinalSixPowerMove(board, 'X', state)).toBe(2);
  });

  it('exposes Surge and Shield preview line paths during board selection', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    board[9] = 'O';
    board[10] = 'O';
    const draft = createFinalSixPowerDraft({
      currentPlayer: 'X',
      lineScores: { O: 1, X: 1 },
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
