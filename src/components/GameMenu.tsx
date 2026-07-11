import { HelpCircle, Play } from 'lucide-react';
import { useI18n } from '../i18n';
import { PanelActions } from './panel/PanelActions';
import { PanelDailyProgress } from './panel/PanelDailyProgress';
import { PanelMatch } from './panel/PanelMatch';
import { PanelOptions } from './panel/PanelOptions';
import { PanelScoreboard } from './panel/PanelScoreboard';
import { PanelSetup } from './panel/PanelSetup';
import type {
  PanelActionsProps,
  PanelDailyProgressProps,
  PanelMatchProps,
  PanelOptionsProps,
  PanelScoreboardProps,
  PanelSetupProps,
} from './panel/types';

export type GameMenuProps = {
  actions: PanelActionsProps;
  canResume: boolean;
  dailyProgress: PanelDailyProgressProps;
  matchPanel: PanelMatchProps;
  options: PanelOptionsProps;
  scoreboard: PanelScoreboardProps;
  setup: PanelSetupProps;
  onOpenGuide: () => void;
  onPlay: () => void;
};

export function GameMenu({
  actions,
  canResume,
  dailyProgress,
  matchPanel,
  options,
  scoreboard,
  setup,
  onOpenGuide,
  onPlay,
}: GameMenuProps) {
  const { t } = useI18n();

  return (
    <section className="menu-screen" aria-label={t('menu.label')}>
      <div className="menu-content">
        <div className="menu-hero">
          <PanelScoreboard {...scoreboard} />
          <div className="menu-intro">
            <p>{t('menu.tagline')}</p>
            <div className="menu-launch-actions">
              <button
                className="menu-play-action"
                type="button"
                onClick={onPlay}
              >
                <Play aria-hidden="true" fill="currentColor" size={22} />
                <span>{t(canResume ? 'menu.resume' : 'menu.play')}</span>
              </button>
              <button
                className="menu-guide-action"
                type="button"
                onClick={onOpenGuide}
              >
                <HelpCircle aria-hidden="true" size={19} />
                <span>{t('menu.howToPlay')}</span>
              </button>
            </div>
            <small>{t('menu.configure')}</small>
          </div>
        </div>

        <div className="menu-sections">
          <div className="menu-section-column menu-section-primary">
            <PanelSetup {...setup} />
            <PanelMatch {...matchPanel} />
          </div>
          <div className="menu-section-column menu-section-secondary">
            <PanelOptions {...options} />
            <PanelDailyProgress {...dailyProgress} />
          </div>
        </div>

        {canResume ? (
          <div className="menu-round-actions">
            <PanelActions {...actions} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
