import { Board, Player } from '../game/rules';
import { SceneTheme, ThemeStyle } from '../theme';

type ScannerBoardProps = {
  board: Board;
  coachBlockCells: number[];
  coachScoreCells: number[];
  currentPlayer: Player;
  disabled: boolean;
  finalLines: number[][];
  floor: number;
  lastMove: number | null;
  scoredLines: number[][];
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
  coachBlockCells,
  coachScoreCells,
  currentPlayer,
  disabled,
  finalLines,
  floor,
  lastMove,
  scoredLines,
  theme,
  winningLine,
  onFloorChange,
  onSelect,
}: ScannerBoardProps) {
  const lastMoveFloor = lastMove === null ? null : floorOf(lastMove);
  const classicWinningCells = new Set(winningLine);
  const scoredCells = new Set(scoredLines.flatMap((line) => line));
  const finalCells = new Set(finalLines.flatMap((line) => line));
  const highlightedCells = new Set([
    ...classicWinningCells,
    ...scoredCells,
    ...finalCells,
  ]);
  const scoreCells = new Set(coachScoreCells);
  const blockCells = new Set(coachBlockCells);
  const winningFloors = new Set(Array.from(highlightedCells).map(floorOf));
  const style: ThemeStyle = { '--scan-win': theme.win };

  const hintClassForFloor = (layer: number) => {
    const hasScore = coachScoreCells.some((index) => floorOf(index) === layer);
    const hasBlock = coachBlockCells.some((index) => floorOf(index) === layer);

    if (hasScore && hasBlock) {
      return 'hint-both';
    }

    if (hasScore) {
      return 'hint-score';
    }

    if (hasBlock) {
      return 'hint-block';
    }

    return '';
  };

  const stopClass = (layer: number) =>
    [
      'scanner-stop',
      layer === floor ? 'active' : '',
      hintClassForFloor(layer),
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
              const isClassicWinning = classicWinningCells.has(index);
              const isScoredLine = scoredCells.has(index);
              const isFinalLine = finalCells.has(index);
              const isWinning = highlightedCells.has(index);
              const isCoachScore = !value && scoreCells.has(index);
              const isCoachBlock = !value && blockCells.has(index);
              const isCoachBoth = isCoachScore && isCoachBlock;
              const isPlayable = !value && !disabled;
              const cellClass = [
                'scanner-cell',
                value === 'X' ? 'mark-x' : value === 'O' ? 'mark-o' : '',
                isWinning ? 'win' : '',
                isScoredLine ? 'scored-line' : '',
                isFinalLine || isClassicWinning ? 'final-line' : '',
                isCoachScore ? 'coach-score' : '',
                isCoachBlock ? 'coach-block' : '',
                isCoachBoth ? 'coach-both' : '',
                lastMove === index ? 'last' : '',
                isPlayable ? `preview-${currentPlayer.toLowerCase()}` : '',
              ]
                .filter(Boolean)
                .join(' ');

              const lineLabel = isClassicWinning
                ? ', winning line'
                : isFinalLine
                  ? ', final winning line'
                  : isScoredLine
                    ? ', scored line'
                    : '';
              const coachLabel = isCoachBoth
                ? ', completes and blocks lines'
                : isCoachScore
                  ? ', completes a line'
                  : isCoachBlock
                    ? ', blocks a line'
                    : '';
              const cellLabel = value
                ? `Cell ${index + 1}, ${value}${lineLabel}`
                : isPlayable
                  ? `Place ${currentPlayer} at cell ${index + 1}, floor ${
                      floor + 1
                    }${coachLabel}`
                  : `Cell ${index + 1}, empty${lineLabel}${coachLabel}`;

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
