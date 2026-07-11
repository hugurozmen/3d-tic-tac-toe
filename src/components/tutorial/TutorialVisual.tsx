import { useI18n } from '../../i18n';
import type { TutorialStepId } from './tutorial';

type TutorialVisualProps = {
  step: TutorialStepId;
};

function PlaneGrid({ className, y }: { className: string; y: number }) {
  return (
    <g className={className}>
      <g transform={`translate(100 ${y}) skewX(-18)`}>
        <rect className="tutorial-plane-fill" width="120" height="42" rx="5" />
        <path d="M40 0V42M80 0V42M0 14H120M0 28H120" />
      </g>
    </g>
  );
}

function BoardVisual() {
  return (
    <svg viewBox="0 0 320 170">
      <PlaneGrid className="tutorial-floor tutorial-floor-1" y={10} />
      <PlaneGrid className="tutorial-floor tutorial-floor-2" y={64} />
      <PlaneGrid className="tutorial-floor tutorial-floor-3" y={118} />
      <g className="tutorial-floor-labels">
        <text x="85" y="31">1</text>
        <text x="85" y="85">2</text>
        <text x="85" y="139">3</text>
      </g>
    </svg>
  );
}

function LinesVisual() {
  const { t } = useI18n();

  return (
    <svg viewBox="0 0 320 170">
      <g className="tutorial-lines-grid">
        <rect x="66" y="20" width="150" height="126" rx="12" />
        <path d="M116 20V146M166 20V146M66 62H216M66 104H216" />
      </g>
      <g className="tutorial-lines-marks">
        <path d="M80 34l22 16m0-16L80 50M130 76l22 16m0-16l-22 16" />
        <path className="tutorial-third-mark" d="M180 118l22 16m0-16l-22 16" />
        <path className="tutorial-score-line" d="M91 42L141 84l50 42" />
      </g>
      <g className="tutorial-score-chip">
        <rect x="232" y="55" width="70" height="60" rx="17" />
        <text className="tutorial-score-before" x="267" y="91">0</text>
        <text className="tutorial-score-after" x="267" y="91">1</text>
      </g>
      <text className="tutorial-score-callout" x="267" y="132">
        {t('tutorial.scoreBadge')}
      </text>
    </svg>
  );
}

function CrossFloorVisual() {
  return (
    <svg viewBox="0 0 320 170">
      <g className="tutorial-cross-planes">
        <g transform="translate(92 11) skewX(-18)">
          <rect width="132" height="34" rx="5" />
        </g>
        <g transform="translate(92 68) skewX(-18)">
          <rect width="132" height="34" rx="5" />
        </g>
        <g transform="translate(92 125) skewX(-18)">
          <rect width="132" height="34" rx="5" />
        </g>
      </g>
      <path className="tutorial-cross-line" d="M114 27L158 85l44 57" />
      <g className="tutorial-cross-dots">
        <circle cx="114" cy="27" r="7" />
        <circle cx="158" cy="85" r="7" />
        <circle cx="202" cy="142" r="7" />
      </g>
      <g className="tutorial-cross-labels">
        <text x="114" y="15">1</text>
        <text x="158" y="73">14</text>
        <text x="202" y="130">27</text>
      </g>
    </svg>
  );
}

function TouchVisual() {
  const { t } = useI18n();

  return (
    <div className="tutorial-touch-scene">
      <svg viewBox="0 0 320 170">
        <g className="tutorial-touch-cell">
          <rect x="100" y="22" width="120" height="120" rx="24" />
          <circle className="tutorial-arm-ring" cx="160" cy="82" r="48" />
          <path className="tutorial-touch-mark" d="M130 52l60 60m0-60l-60 60" />
        </g>
        <g className="tutorial-touch-pointer">
          <circle cx="225" cy="127" r="16" />
          <path d="M225 142v-25m0 0l-8 9m8-9l8 9" />
        </g>
      </svg>
      <span className="tutorial-tap-badge">{t('tutorial.tapAgain')}</span>
    </div>
  );
}

function ViewsVisual() {
  const { t } = useI18n();

  return (
    <svg viewBox="0 0 320 170">
      <g className="tutorial-view-card tutorial-view-cube">
        <rect x="8" y="18" width="92" height="132" rx="13" />
        <g transform="translate(30 42) skewX(-18)">
          <rect width="48" height="25" rx="3" />
          <rect y="15" width="48" height="25" rx="3" />
          <rect y="30" width="48" height="25" rx="3" />
        </g>
        <text x="54" y="137">{t('layout.cube')}</text>
      </g>
      <g className="tutorial-view-card tutorial-view-floors">
        <rect x="114" y="18" width="92" height="132" rx="13" />
        <g transform="translate(136 40) skewX(-18)">
          <rect width="48" height="18" rx="3" />
          <rect y="27" width="48" height="18" rx="3" />
          <rect y="54" width="48" height="18" rx="3" />
        </g>
        <text x="160" y="137">{t('layout.floors')}</text>
      </g>
      <g className="tutorial-view-card tutorial-view-scanner">
        <rect x="220" y="18" width="92" height="132" rx="13" />
        <g className="tutorial-mini-scanner">
          <rect x="237" y="40" width="58" height="58" rx="6" />
          <path d="M256.3 40V98M275.7 40V98M237 59.3H295M237 78.7H295" />
          <circle className="tutorial-coach-score" cx="247" cy="50" r="5" />
          <circle className="tutorial-coach-block" cx="285" cy="88" r="5" />
        </g>
        <text x="266" y="137">{t('layout.scanner')}</text>
      </g>
      <g className="tutorial-coach-key">
        <circle className="tutorial-coach-score" cx="112" cy="162" r="4" />
        <text x="120" y="165">{t('coach.score')}</text>
        <circle className="tutorial-coach-block" cx="201" cy="162" r="4" />
        <text x="209" y="165">{t('coach.block')}</text>
      </g>
    </svg>
  );
}

export function TutorialVisual({ step }: TutorialVisualProps) {
  return (
    <div className={`tutorial-visual tutorial-visual-${step}`} aria-hidden="true">
      {step === 'board' ? <BoardVisual /> : null}
      {step === 'lines' ? <LinesVisual /> : null}
      {step === 'cross-floor' ? <CrossFloorVisual /> : null}
      {step === 'touch' ? <TouchVisual /> : null}
      {step === 'views' ? <ViewsVisual /> : null}
    </div>
  );
}
