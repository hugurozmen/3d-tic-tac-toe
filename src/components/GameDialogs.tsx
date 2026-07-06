export type PendingConfirm = {
  message: string;
  run: () => void;
};

type GameDialogsProps = {
  guideOpen: boolean;
  pendingConfirm: PendingConfirm | null;
  onCancelConfirm: () => void;
  onCloseGuide: () => void;
  onConfirmPending: () => void;
};

export function GameDialogs({
  guideOpen,
  pendingConfirm,
  onCancelConfirm,
  onCloseGuide,
  onConfirmPending,
}: GameDialogsProps) {
  return (
    <>
      {pendingConfirm ? (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Abandon this round?"
          onClick={onCancelConfirm}
        >
          <div className="confirm-card" onClick={(event) => event.stopPropagation()}>
            <strong>Abandon this round?</strong>
            <p>{pendingConfirm.message}</p>
            <div className="confirm-actions">
              <button
                className="secondary-action"
                type="button"
                onClick={onCancelConfirm}
              >
                Keep playing
              </button>
              <button
                className="primary-action"
                type="button"
                onClick={onConfirmPending}
              >
                Switch
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
          aria-label="How to play"
          onClick={onCloseGuide}
        >
          <div
            className="confirm-card guide-card"
            onClick={(event) => event.stopPropagation()}
          >
            <strong>How to play</strong>
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
            </svg>
            <ul className="guide-list">
              <li>
                <strong>27 cells, 3 floors.</strong> The board is a 3×3×3 cube.
              </li>
              <li>
                <strong>Three in a row wins</strong> — along a floor, straight
                down through floors, or on any diagonal, even corner to corner
                across the whole cube.
              </li>
              <li>
                <strong>Three views.</strong> Cube shows everything, Floors
                separates the layers, Scanner plays one floor at a time.
              </li>
              <li>
                <strong>On touch:</strong> tap a cell to preview, tap again to
                place your mark.
              </li>
            </ul>
            <button className="primary-action" type="button" onClick={onCloseGuide}>
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
