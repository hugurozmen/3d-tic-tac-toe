import { describe, expect, it } from 'vitest';
import type { Board } from './rules';
import {
  CELL_COUNT,
  createBoard,
  evaluateClassicBoard,
  evaluateLinesBoard,
  getAllLines,
  getBlockingCells,
  getCompletedLines,
  getLineScores,
  getNewCompletedLines,
  getThreatCells,
} from './rules';

const lineKey = (line: number[]) => [...line].sort((a, b) => a - b).join('-');

const boardFromString = (cells: string): Board =>
  cells.split('').map((cell) => {
    if (cell === 'X' || cell === 'O') {
      return cell;
    }

    return null;
  });

describe('TicTacube rules engine', () => {
  it('defines exactly 49 unique lines from the canonical model', () => {
    const lines = getAllLines();
    const keys = new Set(lines.map(lineKey));

    expect(lines).toHaveLength(49);
    expect(keys.size).toBe(49);
    expect(keys.has('0-1-2')).toBe(true);
    expect(keys.has('0-9-18')).toBe(true);
    expect(keys.has('0-13-26')).toBe(true);
  });

  it('keeps every line to three valid unique cells', () => {
    const lines = getAllLines();

    for (const line of lines) {
      expect(line).toHaveLength(3);
      expect(new Set(line).size).toBe(3);
      expect(line.every((index) => index >= 0 && index < CELL_COUNT)).toBe(true);
    }
  });

  it('has no duplicate line keys', () => {
    const lines = getAllLines();
    const keys = lines.map(lineKey);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('matches center, corner, edge, and face-center line participation counts', () => {
    const participation = Array(CELL_COUNT).fill(0);

    for (const line of getAllLines()) {
      for (const index of line) {
        participation[index] += 1;
      }
    }

    const corners = [0, 2, 6, 8, 18, 20, 24, 26];
    const edgeCenters = [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25];
    const faceCenters = [4, 10, 12, 14, 16, 22];

    expect(participation[13]).toBe(13);
    expect(corners.map((index) => participation[index])).toEqual(Array(8).fill(7));
    expect(edgeCenters.map((index) => participation[index])).toEqual(
      Array(12).fill(4),
    );
    expect(faceCenters.map((index) => participation[index])).toEqual(
      Array(6).fill(5),
    );
    expect(
      participation.reduce<Record<number, number>>((distribution, count) => {
        distribution[count] = (distribution[count] ?? 0) + 1;
        return distribution;
      }, {}),
    ).toEqual({ 4: 12, 5: 6, 7: 8, 13: 1 });
  });

  it('keeps Classic as sudden death before the board is full', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    board[2] = 'X';

    const result = evaluateClassicBoard(board);

    expect(result.winner).toBe('X');
    expect(result.winningLine).toEqual([0, 1, 2]);
    expect(result.isDraw).toBe(false);
    expect(result.isComplete).toBe(true);
    expect(result.remainingCells).toBe(24);
  });

  it('scores a completed line in Lines without ending the round', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    board[2] = 'X';

    const result = evaluateLinesBoard(board);

    expect(result.winner).toBeNull();
    expect(result.isComplete).toBe(false);
    expect(result.remainingCells).toBe(24);
    expect(result.lineScores).toEqual({ X: 1, O: 0 });
  });

  it('ignores mixed lines when scoring Lines boards', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    board[2] = 'O';
    board[3] = 'O';
    board[4] = 'O';
    board[5] = 'O';

    expect(getLineScores(board)).toEqual({ X: 0, O: 1 });
    expect(getCompletedLines(board, 'X')).toHaveLength(0);
    expect(evaluateLinesBoard(board).lineScores).toEqual({ X: 0, O: 1 });
  });

  it('finishes Lines on a full board and uses line score for the winner', () => {
    const board = createBoard();
    board.fill('X');
    const result = evaluateLinesBoard(board);

    expect(result.isComplete).toBe(true);
    expect(result.isDraw).toBe(false);
    expect(result.winner).toBe('X');
    expect(result.winningLines).toHaveLength(49);
    expect(getLineScores(board)).toEqual({ X: 49, O: 0 });
  });

  it('returns a Lines draw when a full board has equal line scores', () => {
    const board = boardFromString('OXXXXOOOXOOOXOXOOXOXXXXOOXX');
    const result = evaluateLinesBoard(board);

    expect(result.isComplete).toBe(true);
    expect(result.isDraw).toBe(true);
    expect(result.winner).toBeNull();
    expect(result.remainingCells).toBe(0);
    expect(result.lineScores).toEqual({ X: 5, O: 5 });
  });

  it('detects one move completing multiple lines', () => {
    const previous = createBoard();

    for (const index of [0, 2, 6, 8, 18, 20, 24, 26]) {
      previous[index] = 'X';
    }

    const next = [...previous];
    next[13] = 'X';
    const newLines = getNewCompletedLines(previous, next, 'X');

    expect(getCompletedLines(previous, 'X')).toHaveLength(0);
    expect(new Set(newLines.map(lineKey))).toEqual(
      new Set(['0-13-26', '2-13-24', '6-13-20', '8-13-18']),
    );
    expect(evaluateLinesBoard(next).lineScores.X).toBe(4);
  });

  it('counts completed lines only once', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    board[2] = 'X';

    expect(getCompletedLines(board, 'X').map(lineKey)).toEqual(['0-1-2']);
    expect(evaluateLinesBoard(board).lineScores.X).toBe(1);
  });

  it('returns only newly completed lines from previous board to next board', () => {
    const previous = createBoard();

    for (const index of [0, 1, 2, 3, 4]) {
      previous[index] = 'X';
    }

    const next = [...previous];
    next[5] = 'X';
    const newLines = getNewCompletedLines(previous, next, 'X');

    expect(getCompletedLines(previous, 'X').map(lineKey)).toEqual(['0-1-2']);
    expect(newLines.map(lineKey)).toEqual(['3-4-5']);
    expect(getNewCompletedLines(next, next, 'X')).toHaveLength(0);
  });

  it('returns threat cells for immediate scoring lines', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    board[9] = 'X';

    expect(getThreatCells(board, 'X').sort((a, b) => a - b)).toEqual([2, 18]);
  });

  it('returns blocking cells against the opponent threats', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    board[9] = 'X';

    expect(getBlockingCells(board, 'O').sort((a, b) => a - b)).toEqual([2, 18]);
    expect(getBlockingCells(board, 'X')).toEqual([]);
  });
});
