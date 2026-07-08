import { RefreshCw } from 'lucide-react';
import type { PanelActionsProps } from './types';

export function PanelActions({
  onResetMatch,
  onResetRound,
}: PanelActionsProps) {
  return (
    <div className="panel-sticky-actions">
      <div className="action-row">
        <button className="primary-action" type="button" onClick={onResetRound}>
          <RefreshCw size={18} />
          <span>New round</span>
        </button>
        <button
          className="secondary-action"
          type="button"
          onClick={onResetMatch}
        >
          Reset match
        </button>
      </div>
    </div>
  );
}
