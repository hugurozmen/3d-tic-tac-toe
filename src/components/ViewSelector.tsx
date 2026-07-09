import { Box, Layers, ScanLine } from 'lucide-react';
import type { BoardLayout } from '../game/boardView';
import { labelLayout, useI18n } from '../i18n';

type ViewSelectorProps = {
  className?: string;
  layout: BoardLayout;
  onChange: (layout: BoardLayout) => void;
};

const viewOptions = [
  { Icon: Box, id: 'cube' },
  { Icon: Layers, id: 'floors' },
  { Icon: ScanLine, id: 'scanner' },
] satisfies Array<{
  Icon: typeof Box;
  id: BoardLayout;
}>;

export function ViewSelector({
  className = '',
  layout,
  onChange,
}: ViewSelectorProps) {
  const i18n = useI18n();
  const { t } = i18n;

  return (
    <div className={`control-group view-selector ${className}`.trim()}>
      <span className="control-label">{t('options.view')}</span>
      <div className="segmented-control mode-control">
        {viewOptions.map(({ Icon, id }) => {
          const label = labelLayout(i18n, id);

          return (
            <button
              key={id}
              aria-label={label}
              className={layout === id ? 'active' : ''}
              title={label}
              type="button"
              onClick={() => onChange(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
