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
import { useI18n } from '../i18n';

type GamePanelProps = {
  actions: PanelActionsProps;
  dailyProgress: PanelDailyProgressProps;
  matchPanel: PanelMatchProps;
  options: PanelOptionsProps;
  scoreboard: PanelScoreboardProps;
  setup: PanelSetupProps;
};

export function GamePanel({
  actions,
  dailyProgress,
  matchPanel,
  options,
  scoreboard,
  setup,
}: GamePanelProps) {
  const { t } = useI18n();

  return (
    <aside className="game-panel" aria-label={t('aria.gameControls')}>
      <PanelScoreboard {...scoreboard} />
      <div className="panel-scroll">
        <PanelMatch {...matchPanel} />
        <PanelSetup {...setup} />
        <PanelOptions {...options} />
        <PanelDailyProgress {...dailyProgress} />
      </div>
      <PanelActions {...actions} />
    </aside>
  );
}
