import { KeyboardEvent, useRef } from 'react';
import { Board, Player } from '../game/rules';
import type { CoachHint, CoachHintKind } from '../game/coach';
import { SceneTheme, ThemeStyle } from '../theme';

type ScannerBoardProps = {
  board: Board;
  coachBlockCells: number[];
  coachHints: CoachHint[];
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
  coachHints,
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
  const gridRef = useRef<HTMLDivElement | null>(null);
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
  const hintsByCell = new Map(coachHints.map((hint) => [hint.cell, hint]));
  const winningFloors = new Set(Array.from(highlightedCells).map(floorOf));
  const style: ThemeStyle = { '--scan-win': theme.win };

  const mergeHintKind = (
    current: CoachHintKind | null,
    next: CoachHintKind,
  ): CoachHintKind => {
    if (!current || current === next) {
      return next;
    }

    return 'both';
  };

  const hintKindForFloor = (layer: number) =>
    coachHints.reduce<CoachHintKind | null>((kind, hint) => {
      if (floorOf(hint.cell) !== layer) {
        return kind;
      }

      return mergeHintKind(kind, hint.kind);
    }, null);

  const hintClassForFloor = (layer: number) => {
    const kind = hintKindForFloor(layer);

    return kind ? `hint-${kind}` : '';
  };

  const hintLabelForFloor = (layer: number) => {
    const kind = hintKindForFloor(layer);

    if (!kind) {
      return '';
    }

    if (kind === 'both') {
      return ', score and block hints';
    }

    if (kind === 'score') {
      return ', score hint';
    }

    return ', block hint';
  };

  const connectorKindForCell = (index: number) =>
    coachHints.reduce<CoachHintKind | null>((kind, hint) => {
      if (!hint.isCrossFloor || floorOf(hint.cell) === floor) {
        return kind;
      }

      const relatedLines = [...hint.scoreLines, ...hint.blockLines];
      const lineTouchesCell = relatedLines.some((line) => line.includes(index));

      if (!lineTouchesCell) {
        return kind;
      }

      return mergeHintKind(kind, hint.kind);
    }, null);

  const firstVisibleHint =
    coachHints.find((hint) => floorOf(hint.cell) === floor) ??
    coachHints.find((hint) =>
      [...hint.scoreLines, ...hint.blockLines].some((line) =>
        line.some((index) => floorOf(index) === floor),
      ),
    ) ??
    null;

  const hintClassForDot = (index: number) => {
    const hint = hintsByCell.get(index);

    if (hint) {
      return `dot-hint-${hint.kind}`;
    }

    const connectorKind = connectorKindForCell(index);

    return connectorKind ? `dot-connector-${connectorKind}` : '';
  };

  const focusCell = (index: number) => {
    window.requestAnimationFrame(() => {
      const cell = gridRef.current?.querySelector<HTMLButtonElement>(
        `[data-cell-index="${index}"]`,
      );

      cell?.focus();
    });
  };

  const moveFocusOnFloor = (index: number, targetCell: number) => {
    const targetIndex = floor * 9 + targetCell;

    if (targetIndex !== index) {
      focusCell(targetIndex);
    }
  };

  const handleCellKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const localCell = index % 9;
    const row = Math.floor(localCell / 3);
    const column = localCell % 3;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveFocusOnFloor(index, row * 3 + Math.min(2, column + 1));
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveFocusOnFloor(index, row * 3 + Math.max(0, column - 1));
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocusOnFloor(index, Math.min(2, row + 1) * 3 + column);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocusOnFloor(index, Math.max(0, row - 1) * 3 + column);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusCell(floor * 9);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusCell(floor * 9 + 8);
      return;
    }

    if (event.key === 'PageUp' && floor < 2) {
      event.preventDefault();
      onFloorChange(floor + 1);
      focusCell(index + 9);
      return;
    }

    if (event.key === 'PageDown' && floor > 0) {
      event.preventDefault();
      onFloorChange(floor - 1);
      focusCell(index - 9);
    }
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
                const index = layer * 9 + cell;
                const value = board[index];

                return (
                  <span
                    key={cell}
                    className={`scanner-dot ${
                      value === 'X' ? 'dot-x' : value === 'O' ? 'dot-o' : ''
                    } ${hintClassForDot(index)}`}
                  />
                );
              })}
            </button>
          ))}
        </div>
      </div>

      <div className="scanner-center">
        <div
          ref={gridRef}
          aria-label={`Floor ${floor + 1} board. Use arrow keys to move, Page Up and Page Down to change floors.`}
          className="scanner-grid"
          role="group"
        >
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
              const coachHint = hintsByCell.get(index);
              const connectorKind = connectorKindForCell(index);
              const hintGlyph = isCoachBoth
                ? 'S+B'
                : isCoachScore
                  ? 'S'
                  : isCoachBlock
                    ? 'B'
                    : connectorKind
                      ? connectorKind === 'both'
                        ? 'S+B'
                        : connectorKind === 'score'
                          ? 'S'
                          : 'B'
                      : null;
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
                connectorKind ? `coach-connector-${connectorKind}` : '',
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
                ? `, ${coachHint?.accessibleLabel ?? 'completes and blocks lines'}`
                : isCoachScore
                  ? `, ${coachHint?.accessibleLabel ?? 'completes a line'}`
                  : isCoachBlock
                    ? `, ${coachHint?.accessibleLabel ?? 'blocks a line'}`
                    : '';
              const connectorLabel =
                !coachLabel && connectorKind
                  ? `, part of a cross-floor ${connectorKind === 'both' ? 'score and block' : connectorKind} hint`
                  : '';
              const cellLabel = value
                ? `Cell ${index + 1}, ${value}${lineLabel}, floor ${floor + 1}`
                : isPlayable
                  ? `Place ${currentPlayer} at cell ${index + 1}, floor ${
                      floor + 1
                    }${coachLabel}${connectorLabel}`
                  : `Cell ${index + 1}, empty, floor ${
                      floor + 1
                    }${lineLabel}${coachLabel}${connectorLabel}`;

              return (
                <button
                  key={index}
                  aria-label={cellLabel}
                  className={cellClass}
                  data-cell-index={index}
                  disabled={!isPlayable}
                  title={coachHint?.explanation}
                  type="button"
                  onKeyDown={(event) => handleCellKeyDown(event, index)}
                  onClick={() => onSelect(index)}
                >
                  {value ?? ''}
                  {hintGlyph ? (
                    <span
                      aria-hidden="true"
                      className={`scanner-hint-glyph hint-glyph-${connectorKind ?? coachHint?.kind ?? 'score'}`}
                    >
                      {hintGlyph}
                    </span>
                  ) : null}
                  {connectorKind ? (
                    <span
                      aria-hidden="true"
                      className={`scanner-connector connector-${connectorKind}`}
                    />
                  ) : null}
                  <span aria-hidden="true" className="scanner-cell-num">
                    {index + 1}
                  </span>
                </button>
              );
            },
          )}
        </div>
        <p className="scanner-caption">Floor {floor + 1} of 3</p>
        {firstVisibleHint ? (
          <p className={`scanner-coach-note note-${firstVisibleHint.kind}`}>
            {firstVisibleHint.explanation}
          </p>
        ) : null}
      </div>

      <div className="scanner-rail" aria-label="Floor selector">
        {RAIL_LAYERS.map((layer) => (
          <button
            key={layer}
            aria-current={layer === floor}
            aria-label={`Floor ${layer + 1}${hintLabelForFloor(layer)}`}
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
