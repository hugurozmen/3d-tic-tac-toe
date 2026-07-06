export type PendingConfirm = {
  message: string;
  run: () => void;
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

      {piePromptOpen ? (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Pie Rule decision"
        >
          <div className="confirm-card">
            <strong>Pie Rule</strong>
            <p>The second player may swap sides after the first move.</p>
            <div className="confirm-actions">
              <button
                className="secondary-action"
                type="button"
                onClick={onKeepPie}
              >
                Keep sides?
              </button>
              <button
                className="primary-action"
                type="button"
                onClick={onSwapPie}
              >
                Swap sides?
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
              <g className="guide-cell-labels">
                <text x="66" y="30">1</text>
                <text x="86" y="62">14</text>
                <text x="106" y="94">27</text>
              </g>
            </svg>
            <ul className="guide-list">
              <li>
                <strong>Lines is the main game.</strong> Keep playing until all
                27 cells fill; every 3-cell row scores, and the higher total wins.
              </li>
              <li>
                <strong>Classic is a variant.</strong> It ends immediately on the
                first 3-in-a-row.
              </li>
              <li>
                <strong>3D lines cross floors.</strong> Cells 1, 14, and 27 form
                one diagonal through the cube.
              </li>
              <li>
                <strong>Coach hints teach threats.</strong> Green scores, red
                blocks, and gold does both.
              </li>
              <li>
                <strong>Pick the view for the job.</strong> Scanner is fastest
                to play, Cube shows the shape, and Floors compares layers.
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
