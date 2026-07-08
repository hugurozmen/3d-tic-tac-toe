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
              className={mode === 'solo' ? 'active' : ''}
              type="button"
              onClick={() => onModeChange('solo')}
            >
              <Brain size={17} />
              <span>AI</span>
            </button>
            <button
              className={mode === 'duo' ? 'active' : ''}
              type="button"
              onClick={() => onModeChange('duo')}
            >
              <Swords size={17} />
              <span>2P</span>
            </button>
            <button
              className={mode === 'online' ? 'active' : ''}
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
                className={ruleset === option ? 'active' : ''}
                disabled={onlineRulesLocked}
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
                className={linesEndgameMode === 'standard' ? 'active' : ''}
                disabled={mode === 'online'}
                type="button"
                onClick={() => onEndgameModeChange('standard')}
              >
                <ListChecks size={16} />
                <span>Standard</span>
              </button>
              <button
                className={linesEndgameMode === 'powers-v3' ? 'active' : ''}
                disabled={mode === 'online'}
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
                className={humanSide === 'X' ? 'active' : ''}
                type="button"
                onClick={() => onSideChange('X')}
              >
                <X size={16} />
                <span>X</span>
              </button>
              <button
                className={humanSide === 'O' ? 'active' : ''}
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
                  className={difficulty === level ? 'active' : ''}
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
                {online.status}
              </span>
              <strong>
                {online.localPlayer ? `${online.localPlayer} local` : 'No side'}
              </strong>
            </div>
            <div className="online-settings">
              <span>{onlineSettingsText}</span>
              <strong>{onlineRulesLocked ? 'Locked' : 'Host decides'}</strong>
            </div>
            <p className="online-hint">
              Coach disabled online. Final Six Powers are local prototype only.
            </p>
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
                disabled={online.status === 'connecting'}
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
              disabled={!remoteSignal.trim() || online.status === 'connecting'}
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
