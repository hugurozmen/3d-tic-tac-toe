import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
} from 'react';

type PanelModalProps = {
  ariaLabel: string;
  children: ReactNode;
  title: string;
  onClose: () => void;
};

export function PanelModal({
  ariaLabel,
  children,
  title,
  onClose,
}: PanelModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
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
  }, []);

  const getFocusableElements = () =>
    Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
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
    <div
      className="confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="confirm-card panel-modal-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-modal-heading">
          <strong>{title}</strong>
          <button className="secondary-action" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
