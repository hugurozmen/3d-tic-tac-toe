import { RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { PanelActionsProps } from './types';

export function PanelActions({
  resetMatchDisabled,
  resetRoundDisabled,
  onResetMatch,
  onResetRound,
}: PanelActionsProps) {
  const { t } = useI18n();

  return (
    <div className="panel-sticky-actions">
      <div className="action-row">
        <button
          className="primary-action"
          disabled={resetRoundDisabled}
          type="button"
          onClick={onResetRound}
        >
          <RefreshCw size={18} />
          <span>{t('action.newRound')}</span>
        </button>
        <button
          className="secondary-action"
          disabled={resetMatchDisabled}
          type="button"
          onClick={onResetMatch}
        >
          {t('action.resetMatch')}
        </button>
      </div>
    </div>
  );
}
