import { Board, Player } from '../game/rules';
import { SceneTheme, ThemeStyle } from '../theme';

type ScannerBoardProps = {
  board: Board;
  currentPlayer: Player;
  disabled: boolean;
  floor: number;
  lastMove: number | null;
  theme: SceneTheme;
  winningLine: number[];
  onFloorChange: (floor: number) => void;
  onSelect: (index: number) => void;
};

const FLOOR_LAYERS = [0, 1, 2];
const RAIL_LAYERS = [2, 1, 0];

const floorOf = (index: number) => Math.floor(index / 9);

export function ScannerBoard({
  board,
  currentPlayer,
  disabled,
  floor,
  lastMove,
  theme,
  winningLine,
  onFloorChange,
  onSelect,
}: ScannerBoardProps) {
  const lastMoveFloor = lastMove === null ? null : floorOf(lastMove);
  const winningFloors = new Set(winningLine.map(floorOf));
  const style: ThemeStyle = { '--scan-win': theme.win };

  const stopClass = (layer: number) =>
    [
      'scanner-stop',
      layer === floor ? 'active' : '',
      winningFloors.has(layer)
        ? 'win'
        : layer !== floor && lastMoveFloor === layer
          ? 'hinted'
          : '',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <div className="scanner-board" style={style}>
      <div className="scanner-ghost">
        <div className="scanner-ghost-inner">
          {FLOOR_LAYERS.map((layer) => (
            <button
              key={layer}
              aria-label={`Show floor ${layer + 1}`}
              className={`scanner-ghost-layer ${layer === floor ? 'active' : ''}`}
              style={{ transform: `translateZ(${(layer - 1) * 44}px)` }}
              type="button"
              onClick={() => onFloorChange(layer)}
            >
              {Array.from({ length: 9 }, (_, cell) => {
                const value = board[layer * 9 + cell];

                return (
                  <span
                    key={cell}
                    className={`scanner-dot ${
                      value === 'X' ? 'dot-x' : value === 'O' ? 'dot-o' : ''
                    }`}
                  />
                );
              })}
            </button>
          ))}
        </div>
      </div>

      <div className="scanner-center">
        <div className="scanner-grid">
          {Array.from({ length: 9 }, (_, cell) => floor * 9 + cell).map(
            (index) => {
              const value = board[index];
              const isWinning = winningLine.includes(index);
              const isPlayable = !value && !disabled;
              const cellClass = [
                'scanner-cell',
                value === 'X' ? 'mark-x' : value === 'O' ? 'mark-o' : '',
                isWinning ? 'win' : '',
                lastMove === index ? 'last' : '',
                isPlayable ? `preview-${currentPlayer.toLowerCase()}` : '',
              ]
                .filter(Boolean)
                .join(' ');

              const cellLabel = value
                ? `Cell ${index + 1}, ${value}${isWinning ? ', winning line' : ''}`
                : isPlayable
                  ? `Place ${currentPlayer} at cell ${index + 1}, floor ${floor + 1}`
                  : `Cell ${index + 1}, empty`;

              return (
                <button
                  key={index}
                  aria-label={cellLabel}
                  className={cellClass}
                  disabled={!isPlayable}
                  type="button"
                  onClick={() => onSelect(index)}
                >
                  {value ?? ''}
                  <span aria-hidden="true" className="scanner-cell-num">
                    {index + 1}
                  </span>
                </button>
              );
            },
          )}
        </div>
        <p className="scanner-caption">Floor {floor + 1} of 3</p>
      </div>

      <div className="scanner-rail" aria-label="Floor selector">
        {RAIL_LAYERS.map((layer) => (
          <button
            key={layer}
            aria-current={layer === floor}
            aria-label={`Floor ${layer + 1}`}
            className={stopClass(layer)}
            type="button"
            onClick={() => onFloorChange(layer)}
          >
            {layer + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
