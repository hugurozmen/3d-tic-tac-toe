import type { Difficulty, GameResult, Player } from './rules';
import { getOtherPlayer } from './rules';

export type SoloOutcome = 'win' | 'loss' | 'draw';
export type DifficultyStreaks = Record<Difficulty, number>;
export type RetentionStats = {
  bestLinesWinMargin: number;
  masterWins: number;
  totalLinesScored: number;
};
export type RetentionRoundSummary = {
  difficulty: Difficulty;
  humanSide: Player;
  outcome: SoloOutcome;
  result: GameResult;
};
export type ThemeUnlockProgress = {
  detail: string;
  id: string;
  label: string;
  progress: number;
  unlocked: boolean;
  valueText: string;
};

const STREAK_KEY = '3dxox-difficulty-streaks';
const STATS_KEY = '3dxox-retention-stats';
const UNLOCK_KEY = '3dxox-theme-unlocks';

export const createDifficultyStreaks = (): DifficultyStreaks => ({
  easy: 0,
  balanced: 0,
  hard: 0,
  master: 0,
});

export const createRetentionStats = (): RetentionStats => ({
  bestLinesWinMargin: 0,
  masterWins: 0,
  totalLinesScored: 0,
});

export const loadDifficultyStreaks = (): DifficultyStreaks => {
  try {
    const raw = window.localStorage.getItem(STREAK_KEY);

    if (raw) {
      const parsed = JSON.parse(raw);

      if (
        parsed &&
        ['easy', 'balanced', 'hard', 'master'].every(
          (key) => Number.isInteger(parsed[key]) && parsed[key] >= 0,
        )
      ) {
        return {
          easy: parsed.easy,
          balanced: parsed.balanced,
          hard: parsed.hard,
          master: parsed.master,
        };
      }
    }
  } catch {
    // best-effort persistence only
  }

  return createDifficultyStreaks();
};

export const saveDifficultyStreaks = (streaks: DifficultyStreaks) => {
  try {
    window.localStorage.setItem(STREAK_KEY, JSON.stringify(streaks));
  } catch {
    // best-effort persistence only
  }
};

export const loadRetentionStats = (): RetentionStats => {
  try {
    const raw = window.localStorage.getItem(STATS_KEY);

    if (raw) {
      const parsed = JSON.parse(raw);

      if (
        parsed &&
        Number.isInteger(parsed.bestLinesWinMargin) &&
        parsed.bestLinesWinMargin >= 0 &&
        Number.isInteger(parsed.masterWins) &&
        parsed.masterWins >= 0 &&
        Number.isInteger(parsed.totalLinesScored) &&
        parsed.totalLinesScored >= 0
      ) {
        return {
          bestLinesWinMargin: parsed.bestLinesWinMargin,
          masterWins: parsed.masterWins,
          totalLinesScored: parsed.totalLinesScored,
        };
      }
    }
  } catch {
    // best-effort persistence only
  }

  return createRetentionStats();
};

export const saveRetentionStats = (stats: RetentionStats) => {
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // best-effort persistence only
  }
};

export const loadThemeUnlockHooks = () => {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(UNLOCK_KEY) ?? '[]',
    ) as unknown;

    if (Array.isArray(parsed)) {
      return parsed.filter(
        (unlock): unlock is string => typeof unlock === 'string',
      );
    }
  } catch {
    // best-effort persistence only
  }

  return [];
};

export const updateDifficultyStreak = (
  streaks: DifficultyStreaks,
  difficulty: Difficulty,
  outcome: SoloOutcome,
) => ({
  ...streaks,
  [difficulty]: outcome === 'win' ? streaks[difficulty] + 1 : 0,
});

export const updateRetentionStats = (
  stats: RetentionStats,
  summary: RetentionRoundSummary,
): RetentionStats => {
  const next = { ...stats };

  if (summary.result.ruleset === 'lines' && summary.result.isComplete) {
    const playerLines = summary.result.lineScores[summary.humanSide];
    next.totalLinesScored += playerLines;

    if (summary.outcome === 'win') {
      const rival = getOtherPlayer(summary.humanSide);
      const margin = playerLines - summary.result.lineScores[rival];
      next.bestLinesWinMargin = Math.max(next.bestLinesWinMargin, margin);
    }
  }

  if (summary.difficulty === 'master' && summary.outcome === 'win') {
    next.masterWins += 1;
  }

  return next;
};

export const getThemeUnlockHooks = (streaks: DifficultyStreaks) => {
  const unlocks: string[] = [];

  if (streaks.balanced >= 3 || streaks.hard >= 2 || streaks.master >= 1) {
    unlocks.push('ranked-focus');
  }

  if (streaks.hard >= 3 || streaks.master >= 2) {
    unlocks.push('hard-streak');
  }

  if (streaks.master >= 3) {
    unlocks.push('master-lineage');
  }

  return unlocks;
};

const clampProgress = (value: number) => Math.min(1, Math.max(0, value));
const formatBestProgressPath = (
  paths: Array<{ current: number; label: string; target: number }>,
) => {
  const best = [...paths].sort(
    (a, b) => b.current / b.target - a.current / a.target,
  )[0];

  return `${Math.min(best.current, best.target)}/${best.target} ${best.label}`;
};

export const getThemeUnlockProgress = (
  streaks: DifficultyStreaks,
  unlockedHooks: string[] = [],
): ThemeUnlockProgress[] => {
  const persistedUnlocks = new Set(unlockedHooks);
  const rankedFocusProgress = Math.max(
    clampProgress(streaks.balanced / 3),
    clampProgress(streaks.hard / 2),
    clampProgress(streaks.master),
  );
  const hardStreakProgress = Math.max(
    clampProgress(streaks.hard / 3),
    clampProgress(streaks.master / 2),
  );
  const masterLineageProgress = clampProgress(streaks.master / 3);
  const rankedFocusUnlocked =
    rankedFocusProgress >= 1 || persistedUnlocks.has('ranked-focus');
  const hardStreakUnlocked =
    hardStreakProgress >= 1 || persistedUnlocks.has('hard-streak');
  const masterLineageUnlocked =
    masterLineageProgress >= 1 || persistedUnlocks.has('master-lineage');

  return [
    {
      detail: 'Smart x3, Hard x2, or one Master win',
      id: 'ranked-focus',
      label: 'Ranked focus',
      progress: rankedFocusUnlocked ? 1 : rankedFocusProgress,
      unlocked: rankedFocusUnlocked,
      valueText:
        rankedFocusUnlocked
          ? 'Accent ready'
          : formatBestProgressPath([
              { current: streaks.balanced, label: 'Smart', target: 3 },
              { current: streaks.hard, label: 'Hard', target: 2 },
              { current: streaks.master, label: 'Master', target: 1 },
            ]),
    },
    {
      detail: 'Hard x3 or Master x2',
      id: 'hard-streak',
      label: 'Hard streak',
      progress: hardStreakUnlocked ? 1 : hardStreakProgress,
      unlocked: hardStreakUnlocked,
      valueText:
        hardStreakUnlocked
          ? 'Accent ready'
          : formatBestProgressPath([
              { current: streaks.hard, label: 'Hard', target: 3 },
              { current: streaks.master, label: 'Master', target: 2 },
            ]),
    },
    {
      detail: 'Master x3',
      id: 'master-lineage',
      label: 'Master lineage',
      progress: masterLineageUnlocked ? 1 : masterLineageProgress,
      unlocked: masterLineageUnlocked,
      valueText:
        masterLineageUnlocked ? 'Accent ready' : `${streaks.master}/3 Master`,
    },
  ];
};

export const saveThemeUnlockHooks = (unlocks: string[]) => {
  try {
    const previous = new Set(
      JSON.parse(window.localStorage.getItem(UNLOCK_KEY) ?? '[]') as string[],
    );

    for (const unlock of unlocks) {
      previous.add(unlock);
    }

    window.localStorage.setItem(
      UNLOCK_KEY,
      JSON.stringify(Array.from(previous)),
    );
  } catch {
    // best-effort persistence only
  }
};
