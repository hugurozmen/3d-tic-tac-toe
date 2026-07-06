import type { GameMode } from './rules';
import type { CoachHint } from './coach';

export type CoachSetting = 'auto' | 'on' | 'off';
export type CoachHintVisibility = 'full' | 'soft';

export type CoachDisplayHint = CoachHint & {
  visibility: CoachHintVisibility;
};

export const AUTO_COACH_FULL_LOCAL_ROUNDS = 3;

export type CoachLadderInput = {
  completedLocalRounds: number;
  hints: CoachHint[];
  mode: GameMode;
  setting: CoachSetting;
};

export type CoachLadderResult = {
  enabled: boolean;
  fullHints: CoachDisplayHint[];
  hints: CoachDisplayHint[];
  phase: 'off' | 'full' | 'ladder';
  softScoreCells: number[];
};

export const getCoachLadder = ({
  completedLocalRounds,
  hints,
  mode,
  setting,
}: CoachLadderInput): CoachLadderResult => {
  if (setting === 'off') {
    return {
      enabled: false,
      fullHints: [],
      hints: [],
      phase: 'off',
      softScoreCells: [],
    };
  }

  const shouldShowFullHints =
    setting === 'on' ||
    (setting === 'auto' &&
      mode !== 'online' &&
      completedLocalRounds < AUTO_COACH_FULL_LOCAL_ROUNDS);
  const displayHints = hints.map<CoachDisplayHint>((hint) => ({
    ...hint,
    visibility:
      shouldShowFullHints || hint.kind !== 'score' ? 'full' : 'soft',
  }));

  return {
    enabled: true,
    fullHints: displayHints.filter((hint) => hint.visibility === 'full'),
    hints: displayHints,
    phase: shouldShowFullHints ? 'full' : 'ladder',
    softScoreCells: displayHints
      .filter((hint) => hint.visibility === 'soft')
      .map((hint) => hint.cell),
  };
};
