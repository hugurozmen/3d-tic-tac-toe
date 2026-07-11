import { KeyboardEvent, useEffect, useRef } from 'react';
import { useI18n } from '../i18n';

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

    window.requestAnimationFrame(() => {
      const firstButton = dialogRef.current?.querySelector<HTMLButtonElement>(
        'button:not(:disabled)',
      );

      firstButton?.focus();
    });

    return () => {
      previousFocusRef.current?.focus?.();
      previousFocusRef.current = null;
    };
  }, [activeDialog]);

  const getFocusableElements = () =>
    Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (pendingConfirm) {
        event.preventDefault();
        onCancelConfirm();
        return;
      }

      if (guideOpen) {
        event.preventDefault();
        onCloseGuide();
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

  return (
    <>
      {pendingConfirm ? (
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
      ) : null}

      {piePromptOpen ? (
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
      ) : null}

      {guideOpen ? (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('aria.howToPlay')}
          onKeyDown={handleDialogKeyDown}
          onClick={onCloseGuide}
        >
          <div
            ref={dialogRef}
            className="confirm-card guide-card"
            onClick={(event) => event.stopPropagation()}
          >
            <strong>{t('dialog.howToPlay')}</strong>
            <svg
              aria-hidden="true"
              className="guide-diagram"
              viewBox="0 0 200 96"
            >
              <g fill="none" stroke="currentColor" opacity="0.4">
                <g transform="translate(46 4) skewX(-24)">
                  <rect width="116" height="24" rx="5" />
                </g>
                <g transform="translate(36 36) skewX(-24)">
                  <rect width="116" height="24" rx="5" />
                </g>
                <g transform="translate(26 68) skewX(-24)">
                  <rect width="116" height="24" rx="5" />
                </g>
              </g>
              <path
                d="M66 16 L86 48 L106 80"
                fill="none"
                stroke="var(--mark-x)"
                strokeDasharray="3 6"
                strokeLinecap="round"
                strokeWidth="2.5"
              />
              <circle cx="66" cy="16" r="5.5" fill="var(--mark-x)" />
              <circle cx="86" cy="48" r="5.5" fill="var(--mark-x)" />
              <circle cx="106" cy="80" r="5.5" fill="var(--mark-x)" />
              <g className="guide-cell-labels">
                <text x="66" y="30">1</text>
                <text x="86" y="62">14</text>
                <text x="106" y="94">27</text>
              </g>
            </svg>
            <ul className="guide-list">
              <li>
                <strong>{t('dialog.guideLine1Title')}</strong>{' '}
                {t('dialog.guideLine1Body')}
              </li>
              <li>
                <strong>{t('dialog.guideLine2Title')}</strong>{' '}
                {t('dialog.guideLine2Body')}
              </li>
            </ul>
            <button className="primary-action" type="button" onClick={onCloseGuide}>
              {t('action.gotIt')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
