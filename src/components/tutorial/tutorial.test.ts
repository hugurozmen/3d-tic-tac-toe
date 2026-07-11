import { describe, expect, it } from 'vitest';
import {
  clampTutorialStep,
  getNextTutorialStep,
  getPreviousTutorialStep,
  TUTORIAL_STEP_COUNT,
  TUTORIAL_STEPS,
} from './tutorial';

describe('tutorial steps', () => {
  it('keeps the five lessons in the intended learning order', () => {
    expect(TUTORIAL_STEP_COUNT).toBe(5);
    expect(TUTORIAL_STEPS.map(({ id }) => id)).toEqual([
      'board',
      'lines',
      'cross-floor',
      'touch',
      'views',
    ]);
    expect(new Set(TUTORIAL_STEPS.map(({ id }) => id)).size).toBe(5);
  });

  it('clamps next and previous navigation at the tutorial bounds', () => {
    expect(getPreviousTutorialStep(0)).toBe(0);
    expect(getNextTutorialStep(0)).toBe(1);
    expect(getNextTutorialStep(TUTORIAL_STEP_COUNT - 1)).toBe(
      TUTORIAL_STEP_COUNT - 1,
    );
    expect(clampTutorialStep(99)).toBe(TUTORIAL_STEP_COUNT - 1);
    expect(clampTutorialStep(-4)).toBe(0);
  });
});
