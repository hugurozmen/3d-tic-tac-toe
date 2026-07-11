import { Menu } from 'lucide-react';
import type { BoardLayout } from '../game/boardView';
import { useI18n } from '../i18n';
import { ViewSelector } from './ViewSelector';

type GameScreenChromeProps = {
  layout: BoardLayout;
  onLayoutChange: (layout: BoardLayout) => void;
  onOpenMenu: () => void;
};

export function GameScreenChrome({
  layout,
  onLayoutChange,
  onOpenMenu,
}: GameScreenChromeProps) {
  const { t } = useI18n();

  return (
    <div className="game-screen-chrome">
      <button
        aria-label={t('menu.open')}
        className="stage-menu-button"
        title={t('menu.open')}
        type="button"
        onClick={onOpenMenu}
      >
        <Menu aria-hidden="true" size={20} />
      </button>
      <ViewSelector
        className="stage-view-selector"
        layout={layout}
        onChange={onLayoutChange}
      />
    </div>
  );
}
