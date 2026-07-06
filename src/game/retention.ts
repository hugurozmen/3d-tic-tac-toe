import type { Difficulty } from './rules';

export type SoloOutcome = 'win' | 'loss' | 'draw';
export type DifficultyStreaks = Record<Difficulty, number>;

const STREAK_KEY = '3dxox-difficulty-streaks';
const UNLOCK_KEY = '3dxox-theme-unlocks';

export const createDifficultyStreaks = (): DifficultyStreaks => ({
  easy: 0,
  balanced: 0,
  hard: 0,
  master: 0,
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

export const updateDifficultyStreak = (
  streaks: DifficultyStreaks,
  difficulty: Difficulty,
  outcome: SoloOutcome,
) => ({
  ...streaks,
  [difficulty]: outcome === 'win' ? streaks[difficulty] + 1 : 0,
});

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

export const saveThemeUnlockHooks = (unlocks: string[]) => {
  try {
    const previous = new Set(
      JSON.parse(window.localStorage.getItem(UNLOCK_KEY) ?? '[]') as string[],
    );

    for (const unlock of unlocks) {
      previous.add(unlock);
    }

    window.localStorage.setItem(UNLOCK_KEY, JSON.stringify(Array.from(previous)));
  } catch {
    // best-effort persistence only
  }
};
