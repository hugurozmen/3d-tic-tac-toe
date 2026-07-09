import { RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { PanelActionsProps } from './types';

export function PanelActions({
  onResetMatch,
  onResetRound,
}: PanelActionsProps) {
  const { t } = useI18n();

  return (
    <div className="panel-sticky-actions">
      <div className="action-row">
        <button className="primary-action" type="button" onClick={onResetRound}>
          <RefreshCw size={18} />
          <span>{t('action.newRound')}</span>
        </button>
        <button
          className="secondary-action"
          type="button"
          onClick={onResetMatch}
        >
          {t('action.resetMatch')}
        </button>
      </div>
    </div>
  );
}
