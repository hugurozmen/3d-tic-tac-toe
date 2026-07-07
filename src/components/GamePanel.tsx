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
import type { MatchState, Score } from '../game/match';
import type { DailyPuzzle, DailyPuzzleResult } from '../game/puzzles';
import type {
  DifficultyStreaks,
  RetentionStats,
  ThemeUnlockProgress,
} from '../game/retention';
import type {
  Difficulty,
  GameMode,
  GameResult,
  GameRuleset,
  LineScores,
  Player,
} from '../game/rules';
import type { OnlineRoomSettings, OnlineStatus } from '../game/useOnlineGame';
import {
  WILDCARDS,
  type LinesBonusScores,
  type LinesEndgameMode,
  type WildcardId,
  type WildcardState,
  canActivateWildcard,
  getRemainingDraftOptions,
} from '../game/wildcards';
import { THEME_ORDER, THEMES, ThemeId } from '../theme';
import { ViewSelector } from './ViewSelector';

type SoundSetting = 'on' | 'off';
type CoachSetting = 'auto' | 'on' | 'off';

type OnlinePanelState = {
  canReconnect: boolean;
  close: () => void;
  error: string | null;
  localPlayer: Player | null;
  localSignal: string;
  reconnect: () => Promise<boolean>;
  settings: OnlineRoomSettings | null;
  status: OnlineStatus;
};

type GamePanelProps = {
  baseLineScores: LineScores;
  coachEnabled: boolean;
  coachDisabledOnline: boolean;
  coachSetting: CoachSetting;
  copiedSignal: boolean;
  currentPlayer: Player;
  dailyPuzzle: DailyPuzzle;
  dailyPuzzleResult: DailyPuzzleResult | null;
  dailyPuzzleShareCopied: boolean;
  difficulty: Difficulty;
  difficultyStreaks: DifficultyStreaks;
  humanSide: Player;
  isAiThinking: boolean;
  lastMove: number | null;
  layout: BoardLayout;
  lineScores: LineScores;
  linesBonusScores: LinesBonusScores;
  linesEndgameMode: LinesEndgameMode;
  linesEndgameText: string | null;
  lifetimeScore: Score;
  match: MatchState;
  matchWinnerText: string | null;
  mode: GameMode;
  nextOpenerText: string;
  online: OnlinePanelState;
  onlineRulesLocked: boolean;
  openerText: string;
  remoteSignal: string;
  recentBlockCount: number;
  recentLineCount: number;
  recentLinePlayer: Player | null;
  remainingCells: number;
  result: GameResult;
  retentionStats: RetentionStats;
  ruleset: GameRuleset;
  showCoachPrompt: boolean;
  soundSetting: SoundSetting;
  status: string;
  themeId: ThemeId;
  themeUnlockProgress: ThemeUnlockProgress[];
  wildcardPicker: Player | null;
  wildcards: WildcardState;
  effectiveLinesEndgameMode: LinesEndgameMode;
  onActivateWildcard: (player: Player) => void;
  onCoachSettingChange: (setting: CoachSetting) => void;
  onCopySignal: () => void;
  onDailyPuzzleMove: (move: number) => void;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onEndgameModeChange: (mode: LinesEndgameMode) => void;
  onHostOnline: () => void;
  onLayoutChange: (layout: BoardLayout) => void;
  onModeChange: (mode: GameMode) => void;
  onOnlineSignal: () => void;
  onOpenGuide: () => void;
  onPickWildcard: (player: Player, wildcard: WildcardId) => void;
  onRemoteSignalChange: (signal: string) => void;
  onResetMatch: () => void;
  onResetRound: () => void;
  onRulesetChange: (ruleset: GameRuleset) => void;
  onSideChange: (side: Player) => void;
  onShareDailyPuzzle: () => void;
  onThemeChange: (themeId: ThemeId) => void;
  onTryCoach: () => void;
  onToggleSound: () => void;
};

function markIcon(player: Player) {
  return player === 'X' ? <X size={18} /> : <Circle size={18} />;
}

const DAILY_FLOORS = [0, 1, 2] as const;
const WILDCARD_PLAYERS = ['X', 'O'] as const;

const formatCell = (move: number | null) => (move === null ? '-' : move + 1);

export function GamePanel({
  baseLineScores,
  coachEnabled,
  coachDisabledOnline,
  coachSetting,
  copiedSignal,
  currentPlayer,
  dailyPuzzle,
  dailyPuzzleResult,
  dailyPuzzleShareCopied,
  difficulty,
  difficultyStreaks,
  humanSide,
  isAiThinking,
  lastMove,
  layout,
  lineScores,
  linesBonusScores,
  linesEndgameMode,
  linesEndgameText,
  lifetimeScore,
  match,
  matchWinnerText,
  mode,
  nextOpenerText,
  online,
  onlineRulesLocked,
  openerText,
  remoteSignal,
  recentBlockCount,
  recentLineCount,
  recentLinePlayer,
  remainingCells,
  result,
  retentionStats,
  ruleset,
  showCoachPrompt,
  soundSetting,
  status,
  themeId,
  themeUnlockProgress,
  wildcardPicker,
  wildcards,
  effectiveLinesEndgameMode,
  onActivateWildcard,
  onCoachSettingChange,
  onCopySignal,
  onDailyPuzzleMove,
  onDifficultyChange,
  onEndgameModeChange,
  onHostOnline,
  onLayoutChange,
  onModeChange,
  onOnlineSignal,
  onOpenGuide,
  onPickWildcard,
  onRemoteSignalChange,
  onResetMatch,
  onResetRound,
  onRulesetChange,
  onSideChange,
  onShareDailyPuzzle,
  onThemeChange,
  onTryCoach,
  onToggleSound,
}: GamePanelProps) {
  const lineScoreEventClass = [
    recentLineCount > 0 ? 'score-bump' : '',
    recentLineCount > 1 ? 'multi-line' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const isWildcardScoreMode =
    ruleset === 'lines' && effectiveLinesEndgameMode === 'wildcards';
  const emptyCellsTense =
    ruleset === 'lines' &&
    !isWildcardScoreMode &&
    remainingCells > 0 &&
    remainingCells <= 6 &&
    !result.isComplete;
  const onlineSettingsText = online.settings
    ? online.settings.ruleset === 'classic'
      ? `${RULESET_LABEL[online.settings.ruleset]} room - Pie ${
          online.settings.classicPieRule ? 'on' : 'off'
        }`
      : `${RULESET_LABEL[online.settings.ruleset]} room`
    : `${RULESET_LABEL[ruleset]} room`;
  const hasLineBonus = linesBonusScores.X > 0 || linesBonusScores.O > 0;
  const wildcardOptions = getRemainingDraftOptions(wildcards);
  const canHumanDraftWildcard =
    Boolean(wildcardPicker) &&
    (mode !== 'solo' || wildcardPicker === humanSide);
  const canShowWildcardPanel =
    ruleset === 'lines' &&
    effectiveLinesEndgameMode === 'wildcards' &&
    mode !== 'online';

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

      <div className="score-row" aria-label="Best-of-5 match score">
        <div
          className={`score-tile score-x ${
            !result.winner && !match.isComplete && currentPlayer === 'X'
              ? 'live'
              : ''
          }`}
        >
          <span>X wins</span>
          <strong>{match.score.X}</strong>
        </div>
        <div className="score-tile score-draw">
          <span>Draws</span>
          <strong>{match.score.draws}</strong>
        </div>
        <div
          className={`score-tile score-o ${
            !result.winner && !match.isComplete && currentPlayer === 'O'
              ? 'live'
              : ''
          }`}
        >
          <span>O wins</span>
          <strong>{match.score.O}</strong>
        </div>
      </div>

      {ruleset === 'lines' ? (
        <>
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
              <span>{isWildcardScoreMode ? 'X total' : 'X lines'}</span>
              <strong>{lineScores.X}</strong>
            </div>
            <div
              className={`line-score-tile line-score-round ${
                recentLineCount > 0 ? lineScoreEventClass : ''
            }`}
            >
              <span>{isWildcardScoreMode ? 'Lines' : 'Round'}</span>
              <strong>
                {isWildcardScoreMode
                  ? `${baseLineScores.X}-${baseLineScores.O}`
                  : `${lineScores.X}-${lineScores.O}`}
              </strong>
            </div>
            <div
              className={`line-score-tile line-score-o ${
                recentLinePlayer === 'O' ? lineScoreEventClass : ''
            }`}
            >
              <span>{isWildcardScoreMode ? 'O total' : 'O lines'}</span>
              <strong>{lineScores.O}</strong>
            </div>
            <div
              className={`line-score-tile ${
                isWildcardScoreMode ? 'line-score-bonus' : 'line-score-empty'
              } ${emptyCellsTense ? 'tension' : ''}`}
            >
              <span>
                {isWildcardScoreMode
                  ? 'Bonus'
                  : emptyCellsTense
                    ? 'Final cells'
                    : 'Empty'}
              </span>
              <strong>
                {isWildcardScoreMode
                  ? `${linesBonusScores.X}-${linesBonusScores.O}`
                  : remainingCells}
              </strong>
            </div>
          </div>
          {linesEndgameText ? (
            <p className="line-tension-note" aria-live="polite">
              {linesEndgameText}
            </p>
          ) : null}
          {hasLineBonus ? (
            <p className="line-bonus-note" aria-live="polite">
              Lines {baseLineScores.X}-{baseLineScores.O} + Bonus{' '}
              {linesBonusScores.X}-{linesBonusScores.O} = Total {lineScores.X}-
              {lineScores.O}
            </p>
          ) : null}
        </>
      ) : null}

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
              className={linesEndgameMode === 'wildcards' ? 'active' : ''}
              disabled={mode === 'online'}
              type="button"
              onClick={() => onEndgameModeChange('wildcards')}
            >
              <Sparkles size={16} />
              <span>Wildcards Experimental</span>
            </button>
          </div>
          {mode === 'online' ? (
            <p className="control-note">Wildcards are local prototype only</p>
          ) : linesEndgameMode === 'wildcards' ? (
            <p className="control-note">Final Six: draft one Wildcard</p>
          ) : null}
        </div>
      ) : null}

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
          <div className="online-settings">
            <span>{onlineSettingsText}</span>
            <strong>{onlineRulesLocked ? 'Locked' : 'Host decides'}</strong>
          </div>
          <p className="online-hint">
            Coach disabled online. Wildcards are local prototype only.
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
              disabled={coachDisabledOnline}
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
        {coachDisabledOnline ? (
          <p className="control-note">Coach disabled online</p>
        ) : null}
        {coachEnabled ? (
          <div className="coach-legend" aria-label="Coach legend">
            <span>
              <i className="legend-dot legend-score" aria-hidden="true" />
              Score
            </span>
            <span>
              <i className="legend-dot legend-block" aria-hidden="true" />
              Block
            </span>
            <span>
              <i className="legend-dot legend-both" aria-hidden="true" />
              Score + block
            </span>
          </div>
        ) : null}
        {showCoachPrompt ? (
          <div className="coach-prompt" aria-label="Try Coach prompt">
            <div>
              <strong>Try Coach</strong>
              <span>See scoring moves, blocks, and cross-floor threats.</span>
            </div>
            <button type="button" onClick={onTryCoach}>
              <Lightbulb size={15} />
              <span>Try Coach</span>
            </button>
          </div>
        ) : null}
      </div>

      {canShowWildcardPanel ? (
        <div className="wildcard-card" aria-label="Final Six Wildcards">
          <div className="wildcard-header">
            <div>
              <span>Final Six</span>
              <strong>Wildcards</strong>
            </div>
            <span className="wildcard-score">
              Bonus {linesBonusScores.X}-{linesBonusScores.O}
            </span>
          </div>

          {wildcards.phase === 'inactive' ? (
            <p className="wildcard-copy">
              Final Six: draft one Wildcard when six cells remain.
            </p>
          ) : null}

          {wildcards.phase === 'drafting' ? (
            <>
              <div className="wildcard-draft-status" aria-live="polite">
                <strong>Final Six: draft one Wildcard</strong>
                <span>
                  {mode === 'solo' && wildcardPicker !== humanSide
                    ? 'AI picks'
                    : `${wildcardPicker ?? '-'} picks`}
                </span>
              </div>
              <div className="wildcard-options">
                {wildcardOptions.map((wildcard) => (
                  <button
                    key={wildcard}
                    className="wildcard-option"
                    disabled={!wildcardPicker || !canHumanDraftWildcard}
                    type="button"
                    onClick={() => onPickWildcard(wildcardPicker!, wildcard)}
                  >
                    <strong>{WILDCARDS[wildcard].name}</strong>
                    <span>{WILDCARDS[wildcard].description}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {wildcards.phase === 'active' ? (
            <div className="wildcard-player-list">
              {WILDCARD_PLAYERS.map((player) => {
                const picked = wildcards.players[player].picked;
                const active = wildcards.players[player].active;
                const used = wildcards.players[player].used;
                const canUse =
                  canActivateWildcard(wildcards, player) &&
                  currentPlayer === player &&
                  !result.isComplete &&
                  !result.winner &&
                  !result.isDraw &&
                  (mode !== 'solo' || player === humanSide);

                return (
                  <div key={player} className="wildcard-player-row">
                    <div>
                      <span>{player} Wildcard</span>
                      <strong>{picked ? WILDCARDS[picked].name : '-'}</strong>
                      <small>
                        {used
                          ? 'Used'
                          : active
                            ? 'Armed for next move'
                            : 'Ready'}
                      </small>
                    </div>
                    {picked && !used ? (
                      <button
                        disabled={!canUse}
                        type="button"
                        onClick={() => onActivateWildcard(player)}
                      >
                        Use {WILDCARDS[picked].name}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="progress-card" aria-label="Local progress">
        <div className="progress-card-header">
          <span>Progress</span>
          <strong>Local only</strong>
        </div>
        <div className="streak-grid" aria-label="Win streak by difficulty">
          {DIFFICULTY_OPTIONS.map((level) => (
            <div key={level} className="streak-tile">
              <span>{DIFFICULTY_LABEL[level]}</span>
              <strong>{difficultyStreaks[level]}</strong>
            </div>
          ))}
        </div>
        <div className="retention-stat-grid">
          <div>
            <span>Best margin</span>
            <strong>+{retentionStats.bestLinesWinMargin}</strong>
          </div>
          <div>
            <span>Total lines</span>
            <strong>{retentionStats.totalLinesScored}</strong>
          </div>
          <div
            className={`master-badge ${
              retentionStats.masterWins > 0 ? 'earned' : ''
            }`}
          >
            <span>Master wins</span>
            <strong>{retentionStats.masterWins}</strong>
          </div>
        </div>
        <div className="theme-progress-list" aria-label="Theme accent progress">
          <div className="theme-progress-heading">
            <span>Theme accents</span>
            <strong>{themeUnlockProgress.filter((item) => item.unlocked).length}/3</strong>
          </div>
          {themeUnlockProgress.map((item) => (
            <div key={item.id} className="theme-progress-row">
              <div>
                <span>{item.label}</span>
                <small>{item.detail}</small>
              </div>
              <strong>{item.valueText}</strong>
              <i aria-hidden="true">
                <span style={{ width: `${Math.round(item.progress * 100)}%` }} />
              </i>
            </div>
          ))}
        </div>
      </div>

      <div className="daily-puzzle-card" aria-label="Daily puzzle">
        <div className="daily-puzzle-header">
          <div>
            <span>Daily #{dailyPuzzle.id}</span>
            <strong>{dailyPuzzle.title}</strong>
          </div>
          <span>{RULESET_LABEL[dailyPuzzle.ruleset]}</span>
        </div>
        <p>{dailyPuzzle.prompt}</p>
        <div className="daily-puzzle-board">
          {DAILY_FLOORS.map((floor) => (
            <div key={floor} className="daily-puzzle-floor">
              <span>Floor {floor + 1}</span>
              <div className="daily-puzzle-grid">
                {Array.from({ length: 9 }, (_, cell) => {
                  const index = floor * 9 + cell;
                  const value = dailyPuzzle.board[index];
                  const isPicked = dailyPuzzleResult?.move === index;
                  const isBest = dailyPuzzleResult?.bestMove === index;

                  return (
                    <button
                      key={index}
                      aria-label={`Daily puzzle cell ${index + 1}, ${
                        value ?? 'empty'
                      }`}
                      className={[
                        'daily-cell',
                        value ? `occupied mark-${value.toLowerCase()}` : '',
                        isPicked ? 'picked' : '',
                        isBest ? 'best' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      disabled={Boolean(value) || Boolean(dailyPuzzleResult)}
                      type="button"
                      onClick={() => onDailyPuzzleMove(index)}
                    >
                      {value ?? index + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {dailyPuzzleResult ? (
          <div
            className={`daily-puzzle-result ${
              dailyPuzzleResult.solved ? 'solved' : 'missed'
            }`}
          >
            <div className="daily-result-moves">
              <span>Best move {formatCell(dailyPuzzleResult.bestMove)}</span>
              <span>Your move {formatCell(dailyPuzzleResult.move)}</span>
            </div>
            <p>{dailyPuzzleResult.explanation}</p>
            {dailyPuzzleResult.solved ? (
              <button
                className="daily-share"
                type="button"
                onClick={onShareDailyPuzzle}
              >
                <Clipboard size={15} />
                <span>{dailyPuzzleShareCopied ? 'Copied' : 'Share'}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="match-card">
        <div>
          <span>Round</span>
          <strong>{match.roundNumber}</strong>
        </div>
        <div>
          <span>{match.winner ? 'Winner' : 'Target'}</span>
          <strong>{matchWinnerText ?? `Race to ${match.targetWins}`}</strong>
        </div>
        <div>
          <span>Match</span>
          <strong>
            {match.score.X}-{match.score.O}
          </strong>
        </div>
        <div>
          <span>Opener</span>
          <strong>{openerText}</strong>
        </div>
        <div>
          <span>Next</span>
          <strong>{match.isComplete ? 'Done' : nextOpenerText}</strong>
        </div>
        <div>
          <span>Lifetime</span>
          <strong>
            {lifetimeScore.X}-{lifetimeScore.O}
          </strong>
        </div>
        <div>
          <span>Life draws</span>
          <strong>{lifetimeScore.draws}</strong>
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
          Reset match
        </button>
      </div>
    </aside>
  );
}
