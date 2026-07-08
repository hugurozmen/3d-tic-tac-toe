import { Box, Layers, ScanLine } from 'lucide-react';
import type { BoardLayout } from '../game/boardView';

type ViewSelectorProps = {
  className?: string;
  layout: BoardLayout;
  onChange: (layout: BoardLayout) => void;
};

const viewOptions = [
  { Icon: Box, id: 'cube', label: 'Cube' },
  { Icon: Layers, id: 'floors', label: 'Floors' },
  { Icon: ScanLine, id: 'scanner', label: 'Scanner' },
] satisfies Array<{
  Icon: typeof Box;
  id: BoardLayout;
  label: string;
}>;

export function ViewSelector({
  className = '',
  layout,
  onChange,
}: ViewSelectorProps) {
  return (
    <div className={`control-group view-selector ${className}`.trim()}>
      <span className="control-label">View</span>
      <div className="segmented-control mode-control">
        {viewOptions.map(({ Icon, id, label }) => (
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
        ))}
      </div>
    </div>
  );
}
