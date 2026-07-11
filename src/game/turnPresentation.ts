import type { Player } from './rules';

export type OnlineTurnPresentation = {
  labelKey: 'hud.opponentTurn' | 'hud.yourTurn';
  owner: 'local' | 'opponent';
  turnMark: Player;
};

type OnlineTurnPresentationInput = {
  currentPlayer: Player;
  isConnected: boolean;
  isTerminal: boolean;
  localPlayer: Player | null;
  pendingAction: boolean;
};

/**
 * Selects the player-relative online turn language without coupling game state
 * to a particular locale. Non-playable room states deliberately fall back to
 * the existing connection/result status copy.
 */
export const getOnlineTurnPresentation = ({
  currentPlayer,
  isConnected,
  isTerminal,
  localPlayer,
  pendingAction,
}: OnlineTurnPresentationInput): OnlineTurnPresentation | null => {
  if (!isConnected || !localPlayer || pendingAction || isTerminal) {
    return null;
  }

  const owner = localPlayer === currentPlayer ? 'local' : 'opponent';

  return {
    labelKey: owner === 'local' ? 'hud.yourTurn' : 'hud.opponentTurn',
    owner,
    turnMark: currentPlayer,
  };
};
