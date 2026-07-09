import {
  Brain,
  Circle,
  Clipboard,
  Link2,
  ListChecks,
  Sparkles,
  Swords,
  Trophy,
  Unplug,
  Wifi,
  X,
} from 'lucide-react';
import {
  DIFFICULTY_OPTIONS,
  RULESET_OPTIONS,
} from '../../game/options';
import {
  labelDifficulty,
  labelRuleset,
  translateOnlineMessage,
  useI18n,
} from '../../i18n';
import type { PanelSetupProps } from './types';
import { usePanelDisclosure } from './usePanelDisclosure';

export function PanelSetup({
  copiedSignal,
  difficulty,
  humanSide,
  linesEndgameMode,
  mode,
  online,
  onlineRulesLocked,
  remoteSignal,
  ruleset,
  onCopySignal,
  onDifficultyChange,
  onEndgameModeChange,
  onHostOnline,
  onModeChange,
  onOnlineSignal,
  onRemoteSignalChange,
  onRulesetChange,
  onSideChange,
}: PanelSetupProps) {
  const [open, setOpen] = usePanelDisclosure('3dxox-panel-setup-open', true);
  const i18n = useI18n();
  const { t } = i18n;
  const onlineSettingsText = online.settings
    ? online.settings.ruleset === 'classic'
      ? t('online.roomRulesClassic', {
          pie: online.settings.classicPieRule ? t('game.pieOn') : t('game.pieOff'),
          ruleset: labelRuleset(i18n, online.settings.ruleset),
        })
      : t('online.roomRulesLines', {
          ruleset: labelRuleset(i18n, online.settings.ruleset),
        })
    : t('online.roomRulesLines', { ruleset: labelRuleset(i18n, ruleset) });
  const onlineStatusText = online.isConfigured
    ? t(`online.status.${online.status}`)
    : t('online.notConfigured');
  const onlineServerText = online.isConfigured
    ? online.serverUrlSource === 'local'
      ? t('online.localServer')
      : t('online.productionServer')
    : t('online.missingServer');
  const onlineError = translateOnlineMessage(i18n, online.error);
  const configurationError = translateOnlineMessage(
    i18n,
    online.configurationError,
  );

  return (
    <details
      className="panel-section panel-section-setup"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>{t('setup.title')}</span>
        <small>{t('setup.changingStarts')}</small>
      </summary>

      <div className="panel-section-body">
        <div className="control-group">
          <span className="control-label">{t('setup.mode')}</span>
          <div className="segmented-control mode-control">
            <button
              aria-label={t('game.ai')}
              className={mode === 'solo' ? 'active' : ''}
              title={t('game.ai')}
              type="button"
              onClick={() => onModeChange('solo')}
            >
              <Brain size={17} />
              <span>{t('game.ai')}</span>
            </button>
            <button
              aria-label={t('game.twoPlayer')}
              className={mode === 'duo' ? 'active' : ''}
              title={t('game.twoPlayer')}
              type="button"
              onClick={() => onModeChange('duo')}
            >
              <Swords size={17} />
              <span>{t('game.twoPlayer')}</span>
            </button>
            <button
              aria-label={t('game.online')}
              className={mode === 'online' ? 'active' : ''}
              title={t('game.online')}
              type="button"
              onClick={() => onModeChange('online')}
            >
              <Wifi size={17} />
              <span>{t('game.online')}</span>
            </button>
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">{t('setup.rules')}</span>
          <div className="segmented-control ruleset-control">
            {RULESET_OPTIONS.map((option) => {
              const label = labelRuleset(i18n, option);

              return (
                <button
                  key={option}
                  aria-label={label}
                  className={ruleset === option ? 'active' : ''}
                  disabled={onlineRulesLocked}
                  title={label}
                  type="button"
                  onClick={() => onRulesetChange(option)}
                >
                  {option === 'lines' ? (
                    <ListChecks size={16} />
                  ) : (
                    <Trophy size={16} />
                  )}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {ruleset === 'lines' ? (
          <div className="control-group">
            <span className="control-label">{t('setup.endgame')}</span>
            <div className="segmented-control endgame-control">
              <button
                aria-label={t('endgame.standard')}
                className={linesEndgameMode === 'standard' ? 'active' : ''}
                disabled={mode === 'online'}
                title={t('endgame.standard')}
                type="button"
                onClick={() => onEndgameModeChange('standard')}
              >
                <ListChecks size={16} />
                <span>{t('endgame.standard')}</span>
              </button>
              <button
                aria-label={t('endgame.finalSixPowers')}
                className={linesEndgameMode === 'powers-v3' ? 'active' : ''}
                disabled={mode === 'online'}
                title={t('endgame.finalSixPowers')}
                type="button"
                onClick={() => onEndgameModeChange('powers-v3')}
              >
                <Sparkles size={16} />
                <span>{t('endgame.finalSixPowers')}</span>
              </button>
            </div>
            {mode === 'online' ? (
              <p className="control-note">
                {t('finalSix.localOnly')}
              </p>
            ) : linesEndgameMode === 'powers-v3' ? (
              <p className="control-note">{t('finalSix.chargesCube')}</p>
            ) : null}
          </div>
        ) : null}

        {mode === 'solo' ? (
          <div className="control-group">
            <span className="control-label">{t('setup.youPlay')}</span>
            <div className="segmented-control">
              <button
                aria-label="X"
                className={humanSide === 'X' ? 'active' : ''}
                title="X"
                type="button"
                onClick={() => onSideChange('X')}
              >
                <X size={16} />
                <span>X</span>
              </button>
              <button
                aria-label="O"
                className={humanSide === 'O' ? 'active' : ''}
                title="O"
                type="button"
                onClick={() => onSideChange('O')}
              >
                <Circle size={16} />
                <span>O</span>
              </button>
            </div>
          </div>
        ) : null}

        {mode === 'solo' ? (
          <div className="control-group">
            <span className="control-label">{t('setup.difficulty')}</span>
            <div className="segmented-control difficulty-control">
              {DIFFICULTY_OPTIONS.map((level) => {
                const label = labelDifficulty(i18n, level);

                return (
                  <button
                    key={level}
                    aria-label={label}
                    className={difficulty === level ? 'active' : ''}
                    title={label}
                    type="button"
                    onClick={() => onDifficultyChange(level)}
                  >
                    <Sparkles size={16} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {mode === 'online' ? (
          <div className="online-card">
            <div className="online-status">
              <span>
                {online.status === 'connecting' ||
                online.status === 'reconnecting' ? (
                  <span className="online-spinner" aria-hidden="true" />
                ) : null}
                {onlineStatusText}
              </span>
              <strong>
                {online.localPlayer
                  ? t('game.playerLocal', { player: online.localPlayer })
                  : t('game.noSide')}
              </strong>
            </div>
            <div className="online-settings">
              <span>{onlineSettingsText}</span>
              <strong>
                {onlineRulesLocked ? t('online.locked') : t('online.hostDecides')}
              </strong>
            </div>
            <div className="online-settings">
              <span>{t('online.server')}</span>
              <strong>{onlineServerText}</strong>
            </div>
            <p className="online-hint">
              {t('online.hint')}
            </p>
            {!online.isConfigured ? (
              <div className="online-banner online-banner-warning">
                <Unplug size={15} />
                <span>{configurationError}</span>
              </div>
            ) : null}
            {online.status === 'disconnected' ? (
              <div className="online-banner">
                <Unplug size={15} />
                <span>{t('online.reconnectWait')}</span>
                {online.canReconnect ? (
                  <button type="button" onClick={() => void online.reconnect()}>
                    {t('action.reconnect')}
                  </button>
                ) : null}
              </div>
            ) : null}
            {online.status === 'waiting' ? (
              <p className="online-hint">
                {t('online.waiting')}
              </p>
            ) : null}
            <div className="online-actions">
              <button
                disabled={!online.isConfigured || online.status === 'connecting'}
                type="button"
                onClick={onHostOnline}
              >
                <Link2 size={16} />
                <span>{t('action.host')}</span>
              </button>
              <button type="button" onClick={online.close}>
                <Unplug size={16} />
                <span>{t('action.clear')}</span>
              </button>
            </div>
            <label className="signal-field">
              <span>{t('online.room')}</span>
              <input
                className="room-code-field"
                readOnly
                value={online.localSignal}
                placeholder={t('online.roomCode')}
              />
            </label>
            <div className="online-actions">
              <button
                disabled={!online.localSignal}
                type="button"
                onClick={onCopySignal}
              >
                <Clipboard size={16} />
                <span>{copiedSignal ? t('action.copied') : t('action.copy')}</span>
              </button>
            </div>
            <label className="signal-field">
              <span>{t('action.join')}</span>
              <input
                className="room-code-field"
                value={remoteSignal}
                placeholder={t('online.roomCode')}
                onChange={(event) => onRemoteSignalChange(event.target.value)}
              />
            </label>
            <button
              className="online-connect"
              disabled={
                !online.isConfigured ||
                !remoteSignal.trim() ||
                online.status === 'connecting'
              }
              type="button"
              onClick={onOnlineSignal}
            >
              {t('action.join')}
            </button>
            {onlineError ? <p className="online-error">{onlineError}</p> : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}
