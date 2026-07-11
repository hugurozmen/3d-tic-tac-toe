import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { TutorialVisual } from './tutorial/TutorialVisual';
import {
  getNextTutorialStep,
  getPreviousTutorialStep,
  TUTORIAL_STEP_COUNT,
  TUTORIAL_STEPS,
} from './tutorial/tutorial';

export type PendingConfirm = {
  message: string;
  run: () => void;
  title: string;
};

type GameDialogsProps = {
  guideOpen: boolean;
  pendingConfirm: PendingConfirm | null;
  piePromptOpen: boolean;
  onCancelConfirm: () => void;
  onCloseGuide: () => void;
  onConfirmPending: () => void;
  onKeepPie: () => void;
  onSwapPie: () => void;
};

export function GameDialogs({
  guideOpen,
  pendingConfirm,
  piePromptOpen,
  onCancelConfirm,
  onCloseGuide,
  onConfirmPending,
  onKeepPie,
  onSwapPie,
}: GameDialogsProps) {
  const { t } = useI18n();
  const [tutorialStep, setTutorialStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const activeDialog = pendingConfirm
    ? 'confirm'
    : piePromptOpen
      ? 'pie'
      : guideOpen
        ? 'guide'
        : null;

  useEffect(() => {
    if (!activeDialog) {
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const focusFrame = window.requestAnimationFrame(() => {
      const firstButton =
        dialogRef.current?.querySelector<HTMLButtonElement>(
          '[data-dialog-autofocus]:not(:disabled)',
        ) ??
        dialogRef.current?.querySelector<HTMLButtonElement>(
          'button:not(:disabled)',
        );

      firstButton?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      previousFocusRef.current?.focus?.();
      previousFocusRef.current = null;
    };
  }, [activeDialog]);

  useEffect(() => {
    if (!guideOpen) {
      setTutorialStep(0);
    }
  }, [guideOpen]);

  const closeTutorial = () => {
    setTutorialStep(0);
    onCloseGuide();
  };

  const getFocusableElements = () =>
    Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (activeDialog === 'confirm') {
        event.preventDefault();
        onCancelConfirm();
      } else if (activeDialog === 'guide') {
        event.preventDefault();
        closeTutorial();
      }

      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = getFocusableElements();

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (activeDialog === 'confirm' && pendingConfirm) {
    return (
      <div
        className="confirm-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={pendingConfirm.title}
        onKeyDown={handleDialogKeyDown}
        onClick={onCancelConfirm}
      >
        <div
          ref={dialogRef}
          className="confirm-card"
          onClick={(event) => event.stopPropagation()}
        >
          <strong>{pendingConfirm.title}</strong>
          <p>{pendingConfirm.message}</p>
          <div className="confirm-actions">
            <button
              className="secondary-action"
              type="button"
              onClick={onCancelConfirm}
            >
              {t('action.keepPlaying')}
            </button>
            <button
              className="primary-action"
              type="button"
              onClick={onConfirmPending}
            >
              {t('action.switch')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeDialog === 'pie') {
    return (
      <div
        className="confirm-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={t('aria.pieDecision')}
        onKeyDown={handleDialogKeyDown}
      >
        <div ref={dialogRef} className="confirm-card">
          <strong>{t('dialog.pieRule')}</strong>
          <p>{t('dialog.pieBody')}</p>
          <div className="confirm-actions">
            <button
              className="secondary-action"
              type="button"
              onClick={onKeepPie}
            >
              {t('dialog.keepSides')}
            </button>
            <button
              className="primary-action"
              type="button"
              onClick={onSwapPie}
            >
              {t('dialog.swapSides')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeDialog === 'guide') {
    const step = TUTORIAL_STEPS[tutorialStep];
    const isLastStep = tutorialStep === TUTORIAL_STEP_COUNT - 1;
    const progressText = t('tutorial.progress', {
      current: tutorialStep + 1,
      total: TUTORIAL_STEP_COUNT,
    });

    return (
      <div
        className="confirm-overlay tutorial-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        aria-describedby="tutorial-copy"
        onKeyDown={handleDialogKeyDown}
        onClick={closeTutorial}
      >
        <div
          ref={dialogRef}
          className="confirm-card guide-card tutorial-card"
          data-step={tutorialStep + 1}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="tutorial-header">
            <span>{progressText}</span>
            <button
              className="tutorial-skip"
              type="button"
              onClick={closeTutorial}
            >
              {t('action.skip')}
            </button>
          </div>

          <div className="tutorial-copy tutorial-step" aria-live="polite">
            <h2 id="tutorial-title">{t(step.titleKey)}</h2>
            <p id="tutorial-copy">{t(step.bodyKey)}</p>
          </div>

          <TutorialVisual step={step.id} />

          <ol className="tutorial-progress" aria-label={progressText}>
            {TUTORIAL_STEPS.map(({ id }, index) => (
              <li
                key={id}
                className={`tutorial-progress-dot${index === tutorialStep ? ' active' : ''}`}
                aria-current={index === tutorialStep ? 'step' : undefined}
              >
                <span className="sr-only">
                  {t('tutorial.progress', {
                    current: index + 1,
                    total: TUTORIAL_STEP_COUNT,
                  })}
                </span>
              </li>
            ))}
          </ol>

          <div className="tutorial-actions">
            <button
              className="secondary-action"
              type="button"
              disabled={tutorialStep === 0}
              onClick={() =>
                setTutorialStep((current) => getPreviousTutorialStep(current))
              }
            >
              {t('action.back')}
            </button>
            <button
              className="primary-action"
              data-dialog-autofocus
              type="button"
              onClick={() => {
                if (isLastStep) {
                  closeTutorial();
                  return;
                }

                setTutorialStep((current) => getNextTutorialStep(current));
              }}
            >
              {t(isLastStep ? 'action.done' : 'action.next')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
