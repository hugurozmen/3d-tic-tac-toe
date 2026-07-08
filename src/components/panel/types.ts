import type { GameAnimationEvent } from '../../game/animationEvents';
import type { BoardLayout } from '../../game/boardView';
import type { MatchState, Score } from '../../game/match';
import type { DailyPuzzle, DailyPuzzleResult } from '../../game/puzzles';
import type {
  DifficultyStreaks,
  RetentionStats,
  ThemeUnlockProgress,
} from '../../game/retention';
import type {
  Difficulty,
  GameMode,
  GameResult,
  GameRuleset,
  LineScores,
  Player,
} from '../../game/rules';
import type { OnlineRoomSettings, OnlineStatus } from '../../game/useOnlineGame';
import type {
  FinalSixPowerId,
  FinalSixPowerState,
  LinesBonusScores,
  LinesEndgameMode,
} from '../../game/finalSixPowers';
import type { ThemeId } from '../../theme';

export type SoundSetting = 'on' | 'off';
export type CoachSetting = 'auto' | 'on' | 'off';

export type OnlinePanelState = {
  canReconnect: boolean;
  close: () => void;
  error: string | null;
  localPlayer: Player | null;
  localSignal: string;
  reconnect: () => Promise<boolean>;
  settings: OnlineRoomSettings | null;
  status: OnlineStatus;
};

export type PanelScoreboardProps = {
  animationEvents: GameAnimationEvent[];
  baseLineScores: LineScores;
  currentPlayer: Player;
  isAiThinking: boolean;
  lastMove: number | null;
  lineScores: LineScores;
  linesBonusScores: LinesBonusScores;
  linesEndgameText: string | null;
  lifetimeScore: Score;
  match: MatchState;
  matchWinnerText: string | null;
  mode: GameMode;
  nextOpenerText: string;
  openerText: string;
  recentBlockCount: number;
  recentLineCount: number;
  recentLinePlayer: Player | null;
  remainingCells: number;
  result: GameResult;
  ruleset: GameRuleset;
  status: string;
  isPowerScoreMode: boolean;
  onOpenGuide: () => void;
};

export type PanelSetupProps = {
  copiedSignal: boolean;
  difficulty: Difficulty;
  humanSide: Player;
  linesEndgameMode: LinesEndgameMode;
  mode: GameMode;
  online: OnlinePanelState;
  onlineRulesLocked: boolean;
  remoteSignal: string;
  ruleset: GameRuleset;
  onCopySignal: () => void;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onEndgameModeChange: (mode: LinesEndgameMode) => void;
  onHostOnline: () => void;
  onModeChange: (mode: GameMode) => void;
  onOnlineSignal: () => void;
  onRemoteSignalChange: (signal: string) => void;
  onRulesetChange: (ruleset: GameRuleset) => void;
  onSideChange: (side: Player) => void;
};

export type PanelOptionsProps = {
  coachDisabledOnline: boolean;
  coachEnabled: boolean;
  coachSetting: CoachSetting;
  layout: BoardLayout;
  soundSetting: SoundSetting;
  themeId: ThemeId;
  onCoachSettingChange: (setting: CoachSetting) => void;
  onLayoutChange: (layout: BoardLayout) => void;
  onThemeChange: (themeId: ThemeId) => void;
  onToggleSound: () => void;
};

export type PanelMatchProps = {
  canHumanChoosePower: boolean;
  canShowPowerPanel: boolean;
  coachEnabled: boolean;
  coachDisabledOnline: boolean;
  finalSixPowers: FinalSixPowerState;
  linesBonusScores: LinesBonusScores;
  mode: GameMode;
  powerPicker: Player | null;
  powerSelection: FinalSixPowerId;
  showCoachPrompt: boolean;
  showFinalSixNudge: boolean;
  onCoachSettingChange: (setting: CoachSetting) => void;
  onDismissFinalSixNudge: () => void;
  onPowerSelectionChange: (power: FinalSixPowerId) => void;
  onTryCoach: () => void;
};

export type PanelDailyProgressProps = {
  dailyPuzzle: DailyPuzzle;
  dailyPuzzleResult: DailyPuzzleResult | null;
  dailyPuzzleShareCopied: boolean;
  difficultyStreaks: DifficultyStreaks;
  lastMove: number | null;
  lifetimeScore: Score;
  retentionStats: RetentionStats;
  showDailyNudge: boolean;
  themeUnlockProgress: ThemeUnlockProgress[];
  onDailyPuzzleMove: (move: number) => void;
  onDismissDailyNudge: () => void;
  onShareDailyPuzzle: () => void;
};

export type PanelActionsProps = {
  onResetMatch: () => void;
  onResetRound: () => void;
};
