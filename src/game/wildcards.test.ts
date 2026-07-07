import { describe, expect, it } from 'vitest';
import { createBoard } from './rules';
import {
  activateWildcard,
  chooseWildcardDraft,
  chooseWildcardMove,
  consumeActiveWildcard,
  createWildcardDraft,
  getCurrentWildcardPicker,
  getRemainingDraftOptions,
  getWildcardDraftOptions,
  getWildcardPickOrder,
  pickWildcard,
  scoreWildcardBonus,
} from './wildcards';

describe('Final Six Wildcards prototype', () => {
  it('uses deterministic draft options and gives the trailing player first pick', () => {
    expect(getWildcardDraftOptions(1)).toEqual([
      'double-line',
      'block-bonus',
      'corner-spark',
    ]);
    expect(getWildcardDraftOptions(2)).toEqual([
      'block-bonus',
      'corner-spark',
      'last-word',
    ]);
    expect(getWildcardPickOrder({ O: 4, X: 2 }, 'O')).toEqual(['X', 'O']);
    expect(getWildcardPickOrder({ O: 3, X: 3 }, 'O')).toEqual(['O', 'X']);
  });

  it('drafts one wildcard per player and discards the unused option', () => {
    const draft = createWildcardDraft({
      currentPlayer: 'X',
      lineScores: { O: 5, X: 3 },
      roundNumber: 1,
    });

    expect(getCurrentWildcardPicker(draft)).toBe('X');

    const afterFirstPick = pickWildcard(draft, 'X', 'double-line');

    expect(afterFirstPick.players.X.picked).toBe('double-line');
    expect(getCurrentWildcardPicker(afterFirstPick)).toBe('O');
    expect(getRemainingDraftOptions(afterFirstPick)).toEqual([
      'block-bonus',
      'corner-spark',
    ]);

    const afterSecondPick = pickWildcard(afterFirstPick, 'O', 'block-bonus');

    expect(afterSecondPick.phase).toBe('active');
    expect(afterSecondPick.players.O.picked).toBe('block-bonus');
    expect(getRemainingDraftOptions(afterSecondPick)).toEqual(['corner-spark']);
  });

  it('scores each initial wildcard with separate bonus points', () => {
    const scoringBoard = createBoard();
    scoringBoard[0] = 'X';
    scoringBoard[1] = 'X';

    expect(
      scoreWildcardBonus({
        board: scoringBoard,
        move: 2,
        player: 'X',
        wildcard: 'double-line',
      }).bonus,
    ).toBe(1);
    expect(
      scoreWildcardBonus({
        board: scoringBoard,
        move: 2,
        player: 'X',
        wildcard: 'corner-spark',
      }).bonus,
    ).toBe(1);

    const blockingBoard = createBoard();
    blockingBoard[0] = 'O';
    blockingBoard[1] = 'O';

    expect(
      scoreWildcardBonus({
        board: blockingBoard,
        move: 2,
        player: 'X',
        wildcard: 'block-bonus',
      }).bonus,
    ).toBe(1);

    const finalCellBoard = createBoard();
    finalCellBoard.fill('O');
    finalCellBoard[0] = 'X';
    finalCellBoard[1] = 'X';
    finalCellBoard[2] = null;

    expect(
      scoreWildcardBonus({
        board: finalCellBoard,
        move: 2,
        player: 'X',
        wildcard: 'last-word',
      }).bonus,
    ).toBe(1);
  });

  it('arms and consumes a wildcard once for the next move', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';
    const draft = createWildcardDraft({
      currentPlayer: 'X',
      lineScores: { O: 0, X: 0 },
      roundNumber: 1,
    });
    const withPicks = pickWildcard(
      pickWildcard(draft, 'X', 'double-line'),
      'O',
      'block-bonus',
    );
    const armed = activateWildcard(withPicks, 'X');

    expect(armed.players.X.active).toBe('double-line');

    const consumed = consumeActiveWildcard(armed, 'X', 2, board);

    expect(consumed.wildcard).toBe('double-line');
    expect(consumed.bonus.bonus).toBe(1);
    expect(consumed.nextState.bonusScores.X).toBe(1);
    expect(consumed.nextState.players.X.active).toBeNull();
    expect(consumed.nextState.players.X.used).toBe(true);

    const secondTry = activateWildcard(consumed.nextState, 'X');

    expect(secondTry).toBe(consumed.nextState);
  });

  it('gives Solo AI deterministic draft and bonus move helpers', () => {
    const board = createBoard();
    board[0] = 'X';
    board[1] = 'X';

    expect(
      chooseWildcardDraft(board, 'X', ['block-bonus', 'double-line']),
    ).toBe('double-line');
    expect(chooseWildcardMove(board, 'X', 'double-line')).toBe(2);
  });
});
