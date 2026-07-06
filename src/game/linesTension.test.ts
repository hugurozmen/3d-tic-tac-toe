import { describe, expect, it } from 'vitest';
import { getLinesEndgameAnalysis } from './linesTension';
import { createBoard } from './rules';

describe('Lines endgame tension analysis', () => {
  it('returns null outside the final six cells', () => {
    const board = createBoard();

    expect(getLinesEndgameAnalysis(board, 'X')).toBeNull();
  });

  it('identifies final-six scoring and blocking cells', () => {
    const board = createBoard();

    for (let index = 0; index < 21; index += 1) {
      board[index] = index % 2 === 0 ? 'X' : 'O';
    }

    board[21] = 'X';
    board[22] = 'X';
    board[24] = 'O';
    board[25] = 'O';

    const analysis = getLinesEndgameAnalysis(board, 'X');

    expect(analysis?.remainingCells).toBe(2);
    expect(analysis?.scoringCells).toContain(23);
    expect(analysis?.blockingCells).toContain(26);
    expect(analysis?.text).toContain('Final 2');
  });
});
