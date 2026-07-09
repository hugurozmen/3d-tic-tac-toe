import { type CSSProperties, KeyboardEvent, useRef } from 'react';
import { Board, Player, getOtherPlayer } from '../game/rules';
import type { CoachHint, CoachHintKind } from '../game/coach';
import {
  type AnimationCellMoment,
  getAnimationCells,
  getAnimationCellMoments,
  getAnimationLines,
  type GameAnimationEvent,
} from '../game/animationEvents';
import type { FinalSixPowerBoardEffects } from '../game/finalSixPowers';
import {
  labelPower,
  translateCoachHint,
  useI18n,
} from '../i18n';
import type { LinesEndgameAnalysis } from '../game/linesTension';
import { SceneTheme, ThemeStyle } from '../theme';

type ScannerBoardProps = {
  animationEvents: GameAnimationEvent[];
  board: Board;
  coachBlockCells: number[];
  coachHints: CoachHint[];
  coachScoreCells: number[];
  coachSoftScoreCells: number[];
  currentPlayer: Player;
  disabled: boolean;
  finalPhase: LinesEndgameAnalysis | null;
  finalLines: number[][];
  floor: number;
  lastMove: number | null;
  powerEffects: FinalSixPowerBoardEffects;
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
  animationEvents,
  coachBlockCells,
  coachHints,
  coachScoreCells,
  coachSoftScoreCells,
  currentPlayer,
  disabled,
  finalPhase,
  finalLines,
  floor,
  lastMove,
  powerEffects,
  scoredLines,
  theme,
  winningLine,
  onFloorChange,
  onSelect,
}: ScannerBoardProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const gridRef = useRef<HTMLDivElement | null>(null);
  const rival = getOtherPlayer(currentPlayer);
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
  const softScoreCells = new Set(coachSoftScoreCells);
  const finalPhaseScoreCells = new Set(finalPhase?.scoringCells ?? []);
  const finalPhaseBlockCells = new Set(finalPhase?.blockingCells ?? []);
  const finalPhaseCells = new Map(
    finalPhase?.cells.map((cell) => [cell.cell, cell]) ?? [],
  );
  const powerCellByCell = new Map(
    powerEffects.powerCells
      .filter((choice) => choice.cell !== null)
      .map((choice) => [choice.cell!, choice]),
  );
  const previewByCell = new Map(
    powerEffects.previewCells.map((preview) => [preview.cell, preview]),
  );
  const previewSurgeLineCells = new Set(
    powerEffects.previewLines
      .filter((preview) => preview.kind === 'surge-line')
      .flatMap((preview) => preview.line),
  );
  const previewShieldLineCells = new Set(
    powerEffects.previewLines
      .filter(
        (preview) =>
          preview.kind === 'shield-line' || preview.kind === 'shield-cell',
      )
      .flatMap((preview) => preview.line),
  );
  const shieldChoiceByCell = new Map(
    powerEffects.shieldLines
      .filter((choice) => choice.cell !== null)
      .map((choice) => [choice.cell!, choice]),
  );
  const surgeCells = new Set(
    powerEffects.surgeLines.flatMap((choice) => choice.line ?? []),
  );
  const shieldCells = new Set(
    powerEffects.shieldLines.flatMap((choice) => choice.line ?? []),
  );
  const chargedEmptyCells = new Set(powerEffects.chargedEmptyCells);
  const triggerCells = new Set(
    powerEffects.trigger
      ? powerEffects.trigger.line ?? [powerEffects.trigger.cell].filter(
          (cell): cell is number => cell !== null,
        )
      : [],
  );
  const scoreEventLines = animationEvents
    .filter(
      (event) => event.type === 'score-line' || event.type === 'multi-line',
    )
    .flatMap(getAnimationLines);
  const blockEventLines = animationEvents
    .filter((event) => event.type === 'block')
    .flatMap(getAnimationLines);
  const powerEventLines = animationEvents
    .filter(
      (event) =>
        event.type === 'power-selected' || event.type === 'power-triggered',
    )
    .flatMap(getAnimationLines);
  const scoreEventCells = new Set(scoreEventLines.flatMap((line) => line));
  const blockEventCells = new Set(blockEventLines.flatMap((line) => line));
  const powerEventCells = new Set(
    animationEvents
      .filter(
        (event) =>
          event.type === 'power-selected' || event.type === 'power-triggered',
      )
      .flatMap(getAnimationCells),
  );
  const placeEventCells = new Set(
    animationEvents
      .filter((event) => event.type === 'place')
      .flatMap(getAnimationCells),
  );
  const animationCellMoments = getAnimationCellMoments(animationEvents);
  const lineMomentByCell = animationCellMoments.reduce<
    Map<number, AnimationCellMoment>
  >((moments, moment) => {
    const current = moments.get(moment.cell);

    if (
      !current ||
      (moment.isCombo && current.isCombo && moment.sequence > current.sequence) ||
      moment.delayMs < current.delayMs ||
      (moment.tone === 'power' && current.tone !== 'power')
    ) {
      moments.set(moment.cell, moment);
    }

    return moments;
  }, new Map());
  const powerTriggerByCell = new Map(
    animationEvents.flatMap((event) =>
      event.type === 'power-triggered' && event.cell !== undefined
        ? [[event.cell, event] as const]
        : [],
    ),
  );
  const hasFinalSixStartEvent = animationEvents.some(
    (event) => event.type === 'final-six-start',
  );
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
      if (softScoreCells.has(hint.cell) && hint.kind === 'score') {
        return kind;
      }

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
      return `, ${t('cell.scoreAndBlockHint')}`;
    }

    if (kind === 'score') {
      return `, ${t('cell.scoreHint')}`;
    }

    return `, ${t('cell.blockHint')}`;
  };

  const connectorKindForCell = (index: number) =>
    coachHints.reduce<CoachHintKind | null>((kind, hint) => {
      if (softScoreCells.has(hint.cell) && hint.kind === 'score') {
        return kind;
      }

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
    coachHints.find(
      (hint) =>
        floorOf(hint.cell) === floor &&
        !(softScoreCells.has(hint.cell) && hint.kind === 'score'),
    ) ??
    coachHints.find((hint) =>
      !(softScoreCells.has(hint.cell) && hint.kind === 'score') &&
      [...hint.scoreLines, ...hint.blockLines].some((line) =>
        line.some((index) => floorOf(index) === floor),
      ),
    ) ??
    null;

  const hintClassForDot = (index: number) => {
    if (triggerCells.has(index)) {
      return 'dot-power-trigger';
    }

    if (powerEventCells.has(index)) {
      return 'dot-power-trigger';
    }

    if (powerCellByCell.has(index)) {
      return 'dot-power-cell';
    }

    if (surgeCells.has(index) || previewSurgeLineCells.has(index)) {
      return 'dot-power-surge';
    }

    if (shieldCells.has(index) || previewShieldLineCells.has(index)) {
      return 'dot-power-shield';
    }

    if (scoreEventCells.has(index)) {
      return 'dot-hint-score';
    }

    if (blockEventCells.has(index)) {
      return 'dot-hint-block';
    }

    if (previewByCell.has(index)) {
      return 'dot-power-preview';
    }

    if (!board[index] && chargedEmptyCells.has(index)) {
      return 'dot-power-charged';
    }

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
    <div
      className={[
        'scanner-board',
        powerEffects.chargedState ? 'power-charged' : '',
        hasFinalSixStartEvent ? 'final-six-animating' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      <div className="scanner-ghost">
        <div className="scanner-ghost-inner">
          {FLOOR_LAYERS.map((layer) => (
            <button
              key={layer}
              aria-label={t('cell.showFloor', { floor: layer + 1 })}
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
          aria-label={
            i18n.locale === 'tr'
              ? `Kat ${floor + 1} tahtası. Hareket etmek için ok tuşlarını, kat değiştirmek için Page Up ve Page Down tuşlarını kullan.`
              : `Floor ${floor + 1} board. Use arrow keys to move, Page Up and Page Down to change floors.`
          }
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
              const isCoachSoftScore = !value && softScoreCells.has(index);
              const isCoachBoth = isCoachScore && isCoachBlock;
              const coachHint = hintsByCell.get(index);
              const localizedCoachHint = coachHint
                ? translateCoachHint(i18n, coachHint, rival)
                : null;
              const connectorKind = connectorKindForCell(index);
              const finalPhaseCell = finalPhaseCells.get(index);
              const powerCell = powerCellByCell.get(index);
              const shieldChoice = shieldChoiceByCell.get(index);
              const powerPreview = previewByCell.get(index);
              const isPowerCell = Boolean(powerCell);
              const isPowerSurge = surgeCells.has(index);
              const isPowerShield = shieldCells.has(index);
              const isPowerShieldCell = Boolean(shieldChoice);
              const isPowerPreviewSurge = previewSurgeLineCells.has(index);
              const isPowerPreviewShield = previewShieldLineCells.has(index);
              const isPowerTrigger = triggerCells.has(index);
              const lineMoment = lineMomentByCell.get(index);
              const powerTrigger = powerTriggerByCell.get(index);
              const isScoreEvent = scoreEventCells.has(index);
              const isBlockEvent = blockEventCells.has(index);
              const isPowerEvent = powerEventCells.has(index);
              const isPlaceEvent = placeEventCells.has(index);
              const isPowerChargedEmpty =
                !value &&
                chargedEmptyCells.has(index) &&
                !isPowerCell &&
                !powerPreview &&
                !isPowerShieldCell;
              const isFinalPhaseScore =
                !value && finalPhaseScoreCells.has(index);
              const isFinalPhaseBlock =
                !value && finalPhaseBlockCells.has(index);
              const isFinalPhaseBoth = isFinalPhaseScore && isFinalPhaseBlock;
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
              const finalGlyph = isFinalPhaseBoth
                ? '+!'
                : isFinalPhaseScore
                  ? `+${finalPhaseCell?.scoreLines ?? 1}`
                  : isFinalPhaseBlock
                    ? '!'
                    : null;
              const powerGlyph =
                powerPreview?.label ??
                (isPowerCell
                  ? '+2'
                  : isPowerShieldCell
                    ? shieldChoice?.id === 'shield-cell'
                      ? '+1'
                      : 'SH'
                    : isPowerSurge
                      ? '+2'
                      : null);
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
                isCoachSoftScore ? 'coach-soft-score' : '',
                connectorKind ? `coach-connector-${connectorKind}` : '',
                isFinalPhaseScore ? 'final-six-score' : '',
                isFinalPhaseBlock ? 'final-six-block' : '',
                isFinalPhaseBoth ? 'final-six-both' : '',
                isPowerCell ? 'power-cell' : '',
                isPowerSurge ? 'power-surge' : '',
                isPowerShield ? 'power-shield' : '',
                isPowerChargedEmpty ? 'power-charged-empty' : '',
                isPowerPreviewSurge ? 'power-preview-line power-preview-line-surge-line' : '',
                isPowerPreviewShield ? 'power-preview-line power-preview-line-shield-line' : '',
                powerPreview ? `power-preview power-preview-${powerPreview.kind}` : '',
                isPowerTrigger ? 'power-trigger' : '',
                isScoreEvent ? 'score-event' : '',
                isBlockEvent ? 'block-event' : '',
                isPowerEvent ? 'power-event' : '',
                lineMoment ? 'line-event-active' : '',
                lineMoment ? `${lineMoment.tone}-line-step` : '',
                lineMoment?.isCombo ? 'combo-line-step' : '',
                isPlaceEvent ? 'place-event' : '',
                lastMove === index ? 'last' : '',
                isPlayable ? `preview-${currentPlayer.toLowerCase()}` : '',
              ]
                .filter(Boolean)
                .join(' ');
              const cellStyle = lineMoment
                ? ({
                    '--line-step-delay': `${lineMoment.delayMs}ms`,
                    '--line-step-index': lineMoment.step,
                    '--line-sequence-index': lineMoment.sequence,
                  } as CSSProperties)
                : undefined;

              const lineLabel = isClassicWinning
                ? `, ${t('cell.winningLine')}`
                : isFinalLine
                  ? `, ${t('cell.finalLine')}`
                  : isScoredLine
                    ? `, ${t('cell.lineScored')}`
                    : '';
              const coachLabel = isCoachBoth
                ? `, ${
                    localizedCoachHint?.accessibleLabel ??
                    t('cell.scoresAndBlocks')
                  }`
                : isCoachScore
                  ? `, ${
                      localizedCoachHint?.accessibleLabel ?? t('cell.scoresLine')
                    }`
                  : isCoachBlock
                    ? `, ${
                        localizedCoachHint?.accessibleLabel ?? t('cell.blocksLine')
                      }`
                    : isCoachSoftScore
                      ? `, ${t('cell.scoreHintFocus', {
                          label:
                            localizedCoachHint?.accessibleLabel ??
                            t('cell.scoresLine'),
                        })}`
                    : '';
              const connectorLabel =
                !coachLabel && connectorKind
                  ? `, ${t('cell.coachConnector', {
                      kind:
                        connectorKind === 'both'
                          ? t('cell.scoreAndBlock')
                          : connectorKind === 'score'
                            ? t('coach.score').toLowerCase()
                            : t('coach.block').toLowerCase(),
                    })}`
                  : '';
              const finalPhaseLabel = isFinalPhaseBoth
                ? `, ${t('cell.finalScoreBlock', {
                    block: finalPhaseCell?.blockLines ?? 1,
                    score: finalPhaseCell?.scoreLines ?? 1,
                  })}`
                : isFinalPhaseScore
                  ? `, ${t('cell.finalScore', {
                      count: finalPhaseCell?.scoreLines ?? 1,
                    })}`
                  : isFinalPhaseBlock
                    ? `, ${t('cell.finalBlock', {
                        count: finalPhaseCell?.blockLines ?? 1,
                      })}`
                    : '';
              const powerLabel = powerPreview
                  ? `, ${t('cell.powerPreview', {
                    label: powerPreview.label,
                    power: labelPower(i18n, powerPreview.kind),
                  })}`
                : isPowerCell && powerCell
                  ? `, ${powerCell.player} ${labelPower(i18n, powerCell.id)}`
                  : isPowerShieldCell && shieldChoice
                    ? `, ${shieldChoice.player} ${labelPower(i18n, shieldChoice.id)}`
                  : isPowerSurge || isPowerPreviewSurge
                    ? `, ${t('cell.powerPathSurge')}`
                  : isPowerShield || isPowerPreviewShield
                      ? `, ${t('cell.powerPathShield')}`
                    : isPowerChargedEmpty
                      ? `, ${t('cell.chargedFinalSix')}`
                      : '';
              const animationLabel = isPowerEvent
                ? `, ${t('cell.animation.power')}`
                : isScoreEvent
                  ? `, ${t('cell.animation.score')}`
                  : isBlockEvent
                    ? `, ${t('cell.animation.block')}`
                    : isPlaceEvent
                      ? `, ${t('cell.animation.place')}`
                      : '';
              const cellLabel = value
                ? `${t('cell.read', {
                    cell: index + 1,
                    mark: value,
                  })}${lineLabel}${powerLabel}${animationLabel}, ${t('cell.floor', {
                    floor: floor + 1,
                  })}`
                : isPlayable
                  ? `${t('cell.place', {
                      cell: index + 1,
                      floor: floor + 1,
                      player: currentPlayer,
                    })}${coachLabel}${connectorLabel}${finalPhaseLabel}${powerLabel}${animationLabel}`
                  : `${t('cell.read', {
                      cell: index + 1,
                      mark: t('cell.empty'),
                    })}, ${t('cell.floor', {
                      floor: floor + 1,
                    })}${lineLabel}${coachLabel}${connectorLabel}${finalPhaseLabel}${powerLabel}${animationLabel}`;

              return (
                <button
                  key={index}
                  aria-label={cellLabel}
                  className={cellClass}
                  data-line-event={lineMoment?.tone}
                  data-line-sequence={lineMoment?.sequence}
                  data-line-step={lineMoment?.step}
                  data-cell-index={index}
                  disabled={!isPlayable}
                  style={cellStyle}
                  title={localizedCoachHint?.explanation ?? coachHint?.explanation}
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
                  {finalGlyph ? (
                    <span
                      aria-hidden="true"
                      className={`scanner-final-glyph ${
                        isFinalPhaseBoth
                          ? 'final-glyph-both'
                          : isFinalPhaseScore
                            ? 'final-glyph-score'
                            : 'final-glyph-block'
                      }`}
                    >
                      {finalGlyph}
                    </span>
                  ) : null}
                  {powerGlyph ? (
                    <span
                      aria-hidden="true"
                      className={`scanner-power-glyph ${
                        powerPreview
                          ? `power-glyph-${powerPreview.kind}`
                          : isPowerCell
                            ? `power-glyph-${powerCell?.id ?? 'power-cell'}`
                            : isPowerSurge
                              ? 'power-glyph-surge-line'
                              : `power-glyph-${shieldChoice?.id ?? 'shield-line'}`
                      }`}
                    >
                      {powerGlyph}
                    </span>
                  ) : null}
                  {powerTrigger ? (
                    <span
                      aria-hidden="true"
                      className={`scanner-power-float ${
                        powerTrigger.shieldDenied ? 'denied' : 'bonus'
                      }`}
                    >
                      {powerTrigger.shieldDenied
                        ? 'Denied'
                        : `+${powerTrigger.bonus}`}
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
        <p className="scanner-caption">
          {t('scanner.caption', { floor: floor + 1 })}
        </p>
        {firstVisibleHint ? (
          <p className={`scanner-coach-note note-${firstVisibleHint.kind}`}>
            {translateCoachHint(i18n, firstVisibleHint, rival).explanation}
          </p>
        ) : null}
      </div>

      <div className="scanner-rail" aria-label={t('aria.floorSelector')}>
        {RAIL_LAYERS.map((layer) => (
          <button
            key={layer}
            aria-current={layer === floor}
            aria-label={`${
              i18n.locale === 'en'
                ? `Floor ${layer + 1}`
                : t('cell.floor', { floor: layer + 1 })
            }${hintLabelForFloor(layer)}`}
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
