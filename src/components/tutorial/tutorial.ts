import type { I18nKey } from '../../i18n';

export const TUTORIAL_STEPS = [
  {
    bodyKey: 'tutorial.board.body',
    id: 'board',
    titleKey: 'tutorial.board.title',
  },
  {
    bodyKey: 'tutorial.lines.body',
    id: 'lines',
    titleKey: 'tutorial.lines.title',
  },
  {
    bodyKey: 'tutorial.crossFloor.body',
    id: 'cross-floor',
    titleKey: 'tutorial.crossFloor.title',
  },
  {
    bodyKey: 'tutorial.touch.body',
    id: 'touch',
    titleKey: 'tutorial.touch.title',
  },
  {
    bodyKey: 'tutorial.views.body',
    id: 'views',
    titleKey: 'tutorial.views.title',
  },
] as const satisfies readonly {
  bodyKey: I18nKey;
  id: string;
  titleKey: I18nKey;
}[];

export type TutorialStepId = (typeof TUTORIAL_STEPS)[number]['id'];

export const TUTORIAL_STEP_COUNT = TUTORIAL_STEPS.length;

export const clampTutorialStep = (step: number) =>
  Math.max(0, Math.min(TUTORIAL_STEP_COUNT - 1, Math.trunc(step)));

export const getNextTutorialStep = (step: number) =>
  clampTutorialStep(step + 1);

export const getPreviousTutorialStep = (step: number) =>
  clampTutorialStep(step - 1);
