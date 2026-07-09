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
  DIFFICULTY_LABEL,
  DIFFICULTY_OPTIONS,
  RULESET_LABEL,
  RULESET_OPTIONS,
  } from '../../game/options';
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
  const onlineSettingsText = online.settings
    ? online.settings.ruleset === 'classic'
      ? `${RULESET_LABEL[online.settings.ruleset]} room - Pie ${
          online.settings.classicPieRule ? 'on' : 'off'
        }`
      : `${RULESET_LABEL[online.settings.ruleset]} room`
    : `${RULESET_LABEL[ruleset]} room`;
  const onlineStatusText = online.isConfigured
    ? online.status
    : 'not configured';
  const onlineServerText = online.isConfigured
    ? online.serverUrlSource === 'local'
      ? 'Local server'
      : 'Production server'
    : 'Missing server';

  return (
    <details
      className="panel-section panel-section-setup"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>Setup</span>
        <small>Changing these starts a new round</small>
      </summary>

      <div className="panel-section-body">
        <div className="control-group">
          <span className="control-label">Mode</span>
          <div className="segmented-control mode-control">
            <button
              aria-label="AI"
              className={mode === 'solo' ? 'active' : ''}
              title="AI"
              type="button"
              onClick={() => onModeChange('solo')}
            >
              <Brain size={17} />
              <span>AI</span>
            </button>
            <button
              aria-label="2P"
              className={mode === 'duo' ? 'active' : ''}
              title="2P"
              type="button"
              onClick={() => onModeChange('duo')}
            >
              <Swords size={17} />
              <span>2P</span>
            </button>
            <button
              aria-label="Online"
              className={mode === 'online' ? 'active' : ''}
              title="Online"
              type="button"
              onClick={() => onModeChange('online')}
            >
              <Wifi size={17} />
              <span>Online</span>
            </button>
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">Rules</span>
          <div className="segmented-control ruleset-control">
            {RULESET_OPTIONS.map((option) => (
              <button
                key={option}
                aria-label={RULESET_LABEL[option]}
                className={ruleset === option ? 'active' : ''}
                disabled={onlineRulesLocked}
                title={RULESET_LABEL[option]}
                type="button"
                onClick={() => onRulesetChange(option)}
              >
                {option === 'lines' ? (
                  <ListChecks size={16} />
                ) : (
                  <Trophy size={16} />
                )}
                <span>{RULESET_LABEL[option]}</span>
              </button>
            ))}
          </div>
        </div>

        {ruleset === 'lines' ? (
          <div className="control-group">
            <span className="control-label">Endgame</span>
            <div className="segmented-control endgame-control">
              <button
                aria-label="Standard"
                className={linesEndgameMode === 'standard' ? 'active' : ''}
                disabled={mode === 'online'}
                title="Standard"
                type="button"
                onClick={() => onEndgameModeChange('standard')}
              >
                <ListChecks size={16} />
                <span>Standard</span>
              </button>
              <button
                aria-label="Final Six Powers (beta)"
                className={linesEndgameMode === 'powers-v3' ? 'active' : ''}
                disabled={mode === 'online'}
                title="Final Six Powers (beta)"
                type="button"
                onClick={() => onEndgameModeChange('powers-v3')}
              >
                <Sparkles size={16} />
                <span>Final Six Powers (beta)</span>
              </button>
            </div>
            {mode === 'online' ? (
              <p className="control-note">
                Final Six Powers are local prototype only
              </p>
            ) : linesEndgameMode === 'powers-v3' ? (
              <p className="control-note">Final Six charges the cube</p>
            ) : null}
          </div>
        ) : null}

        {mode === 'solo' ? (
          <div className="control-group">
            <span className="control-label">You play</span>
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
            <span className="control-label">AI</span>
            <div className="segmented-control difficulty-control">
              {DIFFICULTY_OPTIONS.map((level) => (
                <button
                  key={level}
                  aria-label={DIFFICULTY_LABEL[level]}
                  className={difficulty === level ? 'active' : ''}
                  title={DIFFICULTY_LABEL[level]}
                  type="button"
                  onClick={() => onDifficultyChange(level)}
                >
                  <Sparkles size={16} />
                  <span>{DIFFICULTY_LABEL[level]}</span>
                </button>
              ))}
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
                {online.localPlayer ? `${online.localPlayer} local` : 'No side'}
              </strong>
            </div>
            <div className="online-settings">
              <span>{onlineSettingsText}</span>
              <strong>{onlineRulesLocked ? 'Locked' : 'Host decides'}</strong>
            </div>
            <div className="online-settings">
              <span>Server</span>
              <strong>{onlineServerText}</strong>
            </div>
            <p className="online-hint">
              Coach disabled online. Final Six Powers are local prototype only.
            </p>
            {!online.isConfigured ? (
              <div className="online-banner online-banner-warning">
                <Unplug size={15} />
                <span>{online.configurationError}</span>
              </div>
            ) : null}
            {online.status === 'disconnected' ? (
              <div className="online-banner">
                <Unplug size={15} />
                <span>Room paused — reconnect or wait for the opponent.</span>
                {online.canReconnect ? (
                  <button type="button" onClick={() => void online.reconnect()}>
                    Reconnect
                  </button>
                ) : null}
              </div>
            ) : null}
            {online.status === 'waiting' ? (
              <p className="online-hint">
                Waiting for an opponent — share the room code.
              </p>
            ) : null}
            <div className="online-actions">
              <button
                disabled={!online.isConfigured || online.status === 'connecting'}
                type="button"
                onClick={onHostOnline}
              >
                <Link2 size={16} />
                <span>Host</span>
              </button>
              <button type="button" onClick={online.close}>
                <Unplug size={16} />
                <span>Clear</span>
              </button>
            </div>
            <label className="signal-field">
              <span>Room</span>
              <input
                className="room-code-field"
                readOnly
                value={online.localSignal}
                placeholder="Room code"
              />
            </label>
            <div className="online-actions">
              <button
                disabled={!online.localSignal}
                type="button"
                onClick={onCopySignal}
              >
                <Clipboard size={16} />
                <span>{copiedSignal ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <label className="signal-field">
              <span>Join</span>
              <input
                className="room-code-field"
                value={remoteSignal}
                placeholder="Room code"
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
              Join
            </button>
            {online.error ? <p className="online-error">{online.error}</p> : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}
