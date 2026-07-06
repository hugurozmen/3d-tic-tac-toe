import {
  Brain,
  Circle,
  Clipboard,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Link2,
  RefreshCw,
  Sparkles,
  Swords,
  Trophy,
  Unplug,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from 'lucide-react';
import type { BoardLayout } from '../game/boardView';
import {
  DIFFICULTY_LABEL,
  DIFFICULTY_OPTIONS,
  RULESET_LABEL,
  RULESET_OPTIONS,
} from '../game/options';
import type {
  Difficulty,
  GameMode,
  GameResult,
  GameRuleset,
  LineScores,
  Player,
} from '../game/rules';
import type { OnlineStatus } from '../game/useOnlineGame';
import { THEME_ORDER, THEMES, ThemeId } from '../theme';
import { ViewSelector } from './ViewSelector';

type Score = Record<Player | 'draws', number>;
type SoundSetting = 'on' | 'off';
type CoachSetting = 'auto' | 'on' | 'off';

type OnlinePanelState = {
  canReconnect: boolean;
  close: () => void;
  error: string | null;
  localPlayer: Player | null;
  localSignal: string;
  reconnect: () => Promise<boolean>;
  status: OnlineStatus;
};

type GamePanelProps = {
  coachEnabled: boolean;
  coachSetting: CoachSetting;
  copiedSignal: boolean;
  currentPlayer: Player;
  difficulty: Difficulty;
  humanSide: Player;
  isAiThinking: boolean;
  lastMove: number | null;
  layout: BoardLayout;
  lineScores: LineScores;
  mode: GameMode;
  oMoves: number;
  online: OnlinePanelState;
  openerText: string;
  remoteSignal: string;
  recentBlockCount: number;
  recentLineCount: number;
  recentLinePlayer: Player | null;
  remainingCells: number;
  result: GameResult;
  roundsPlayed: number;
  ruleset: GameRuleset;
  score: Score;
  soundSetting: SoundSetting;
  status: string;
  themeId: ThemeId;
  xMoves: number;
  onCoachSettingChange: (setting: CoachSetting) => void;
  onCopySignal: () => void;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onHostOnline: () => void;
  onLayoutChange: (layout: BoardLayout) => void;
  onModeChange: (mode: GameMode) => void;
  onOnlineSignal: () => void;
  onOpenGuide: () => void;
  onRemoteSignalChange: (signal: string) => void;
  onResetMatch: () => void;
  onResetRound: () => void;
  onRulesetChange: (ruleset: GameRuleset) => void;
  onSideChange: (side: Player) => void;
  onThemeChange: (themeId: ThemeId) => void;
  onToggleSound: () => void;
};

function markIcon(player: Player) {
  return player === 'X' ? <X size={18} /> : <Circle size={18} />;
}

export function GamePanel({
  coachEnabled,
  coachSetting,
  copiedSignal,
  currentPlayer,
  difficulty,
  humanSide,
  isAiThinking,
  lastMove,
  layout,
  lineScores,
  mode,
  oMoves,
  online,
  openerText,
  remoteSignal,
  recentBlockCount,
  recentLineCount,
  recentLinePlayer,
  remainingCells,
  result,
  roundsPlayed,
  ruleset,
  score,
  soundSetting,
  status,
  themeId,
  xMoves,
  onCoachSettingChange,
  onCopySignal,
  onDifficultyChange,
  onHostOnline,
  onLayoutChange,
  onModeChange,
  onOnlineSignal,
  onOpenGuide,
  onRemoteSignalChange,
  onResetMatch,
  onResetRound,
  onRulesetChange,
  onSideChange,
  onThemeChange,
  onToggleSound,
}: GamePanelProps) {
  const lineScoreEventClass = [
    recentLineCount > 0 ? 'score-bump' : '',
    recentLineCount > 1 ? 'multi-line' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const emptyCellsTense =
    ruleset === 'lines' &&
    remainingCells > 0 &&
    remainingCells < 6 &&
    !result.isComplete;

  return (
    <aside className="game-panel" aria-label="Game controls">
      <header className="panel-header">
        <div>
          <p className="eyebrow">3x3x3</p>
          <h1>3D XOX</h1>
        </div>
        <div className="header-side">
          <div
            className={`turn-badge ${
              result.winner
                ? 'turn-win'
                : currentPlayer === 'X'
                  ? 'turn-x'
                  : 'turn-o'
            } ${isAiThinking ? 'thinking' : ''}`}
            aria-label={status}
          >
            {isAiThinking ? (
              <span className="thinking-spinner" aria-hidden="true" />
            ) : result.winner ? (
              <Trophy size={20} />
            ) : (
              markIcon(currentPlayer)
            )}
            <span>{status}</span>
          </div>
          <div className="icon-row">
            <button
              aria-label={soundSetting === 'on' ? 'Mute sounds' : 'Unmute sounds'}
              className="icon-button"
              type="button"
              onClick={onToggleSound}
            >
              {soundSetting === 'on' ? (
                <Volume2 size={15} />
              ) : (
                <VolumeX size={15} />
              )}
            </button>
            <button
              aria-label="How to play"
              className="icon-button"
              type="button"
              onClick={onOpenGuide}
            >
              <HelpCircle size={15} />
            </button>
          </div>
        </div>
      </header>

      <div className="score-row" aria-label="Score">
        <div
          className={`score-tile score-x ${
            !result.winner && currentPlayer === 'X' ? 'live' : ''
          }`}
        >
          <span>X</span>
          <strong>{score.X}</strong>
        </div>
        <div className="score-tile score-draw">
          <span>Draw</span>
          <strong>{score.draws}</strong>
        </div>
        <div
          className={`score-tile score-o ${
            !result.winner && currentPlayer === 'O' ? 'live' : ''
          }`}
        >
          <span>O</span>
          <strong>{score.O}</strong>
        </div>
      </div>

      {ruleset === 'lines' ? (
        <div
          className={`line-score-card ${
            recentBlockCount > 0 ? 'block-event' : ''
          }`}
          aria-label="Lines score"
          aria-live="polite"
        >
          <div
            className={`line-score-tile line-score-x ${
              recentLinePlayer === 'X' ? lineScoreEventClass : ''
            }`}
          >
            <span>X lines</span>
            <strong>{lineScores.X}</strong>
          </div>
          <div
            className={`line-score-tile line-score-round ${
              recentLineCount > 0 ? lineScoreEventClass : ''
            }`}
          >
            <span>Round</span>
            <strong>
              {lineScores.X}-{lineScores.O}
            </strong>
          </div>
          <div
            className={`line-score-tile line-score-o ${
              recentLinePlayer === 'O' ? lineScoreEventClass : ''
            }`}
          >
            <span>O lines</span>
            <strong>{lineScores.O}</strong>
          </div>
          <div
            className={`line-score-tile line-score-empty ${
              emptyCellsTense ? 'tension' : ''
            }`}
          >
            <span>{emptyCellsTense ? 'Final cells' : 'Empty'}</span>
            <strong>{remainingCells}</strong>
          </div>
        </div>
      ) : null}

      <div className="control-group">
        <span className="control-label">Rules</span>
        <div className="segmented-control ruleset-control">
          {RULESET_OPTIONS.map((option) => (
            <button
              key={option}
              className={ruleset === option ? 'active' : ''}
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

      <ViewSelector
        className="panel-view-selector"
        layout={layout}
        onChange={onLayoutChange}
      />

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

      <div className="control-group">
        <span className="control-label">Style</span>
        <div className="theme-grid">
          {THEME_ORDER.map((id) => {
            const option = THEMES[id];

            return (
              <button
                key={id}
                className={`theme-option ${themeId === id ? 'active' : ''}`}
                type="button"
                onClick={() => onThemeChange(id)}
              >
                <span
                  className="theme-swatch"
                  aria-hidden="true"
                  style={{ background: option.scene.background }}
                >
                  <span style={{ background: option.scene.x }} />
                  <span style={{ background: option.scene.o }} />
                  <span style={{ background: option.scene.edge }} />
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

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

      <div className="control-group">
        <span className="control-label">Coach</span>
        <div className="segmented-control coach-control">
          {(['auto', 'on', 'off'] as const).map((setting) => (
            <button
              key={setting}
              className={coachSetting === setting ? 'active' : ''}
              type="button"
              onClick={() => onCoachSettingChange(setting)}
            >
              <Lightbulb size={16} />
              <span>
                {setting === 'auto'
                  ? coachEnabled
                    ? 'Auto on'
                    : 'Auto'
                  : setting === 'on'
                    ? 'On'
                    : 'Off'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="match-card">
        <div>
          <span>Best 5</span>
          <strong>{Math.min(roundsPlayed + 1, 5)}</strong>
        </div>
        <div>
          <span>Opener</span>
          <strong>{openerText}</strong>
        </div>
        <div>
          <span>X moves</span>
          <strong>{xMoves}</strong>
        </div>
        <div>
          <span>O moves</span>
          <strong>{oMoves}</strong>
        </div>
        <div>
          <span>Last</span>
          <strong>{lastMove === null ? '-' : lastMove + 1}</strong>
        </div>
      </div>

      <div className="action-row">
        <button className="primary-action" type="button" onClick={onResetRound}>
          <RefreshCw size={18} />
          <span>New round</span>
        </button>
        <button className="secondary-action" type="button" onClick={onResetMatch}>
          Reset
        </button>
      </div>
    </aside>
  );
}
