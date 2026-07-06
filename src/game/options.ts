import type { BoardLayout } from './boardView';
import type { Difficulty, GameMode, GameRuleset } from './rules';

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Casual',
  balanced: 'Smart',
  hard: 'Hard',
  master: 'Master',
};

export const DIFFICULTY_OPTIONS: Difficulty[] = [
  'easy',
  'balanced',
  'hard',
  'master',
];

export const LAYOUT_OPTIONS: BoardLayout[] = ['cube', 'floors', 'scanner'];

export const MODE_DESCRIPTION: Record<GameMode, string> = {
  solo: 'AI mode',
  duo: '2-player mode',
  online: 'online mode',
};

export const RULESET_LABEL: Record<GameRuleset, string> = {
  lines: 'Lines',
  classic: 'Classic',
};

export const RULESET_DESCRIPTION: Record<GameRuleset, string> = {
  lines: 'line scoring',
  classic: 'sudden death',
};

export const RULESET_OPTIONS: GameRuleset[] = ['lines', 'classic'];
