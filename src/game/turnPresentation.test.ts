import { describe, expect, it } from 'vitest';
import { getOnlineTurnPresentation } from './turnPresentation';

const readyRoom = {
  isConnected: true,
  isTerminal: false,
  pendingAction: false,
} as const;

describe('online turn presentation', () => {
  it('selects the player-relative label for the local turn', () => {
    expect(
      getOnlineTurnPresentation({
        ...readyRoom,
        currentPlayer: 'X',
        localPlayer: 'X',
      }),
    ).toEqual({
      labelKey: 'hud.yourTurn',
      owner: 'local',
      turnMark: 'X',
    });
  });

  it("selects the opponent label and opponent's active mark while waiting", () => {
    expect(
      getOnlineTurnPresentation({
        ...readyRoom,
        currentPlayer: 'X',
        localPlayer: 'O',
      }),
    ).toEqual({
      labelKey: 'hud.opponentTurn',
      owner: 'opponent',
      turnMark: 'X',
    });
  });

  it.each([
    { isConnected: false, isTerminal: false, pendingAction: false },
    { isConnected: true, isTerminal: true, pendingAction: false },
    { isConnected: true, isTerminal: false, pendingAction: true },
  ])('falls back to room or result status when play is unavailable', (state) => {
    expect(
      getOnlineTurnPresentation({
        ...state,
        currentPlayer: 'O',
        localPlayer: 'O',
      }),
    ).toBeNull();
  });
});
