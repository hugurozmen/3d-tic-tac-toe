import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import {
  getAnimationCells,
  getAnimationLines,
} from '../../game/animationEvents';
import { CameraControls, CameraRig } from './Camera';
import { Cell } from './Cell';
import {
  BoardRails,
  CoachLinePath,
  CoreGlow,
  CubeShell,
  FloorPlates,
  ScanFloor,
  WinBeam,
} from './Environment';
import type { SceneContentProps } from './types';

export function SceneContent({
  armedCell,
  animationEvents,
  board,
  coachBlockCells,
  coachHints,
  coachScoreCells,
  coachSoftScoreCells,
  currentPlayer,
  disabled,
  finalPhase,
  finalLines,
  hoveredCell,
  layout,
  powerEffects,
  scoredLines,
  theme,
  viewCommand,
  winningLine,
  onArmCell,
  onHoverCell,
  onSelect,
}: SceneContentProps) {
  const group = useRef<THREE.Group>(null);
  const classicWinningCells = new Set(winningLine);
  const scoredCells = new Set(scoredLines.flatMap((line) => line));
  const finalCells = new Set(finalLines.flatMap((line) => line));
  const scoreCells = new Set(coachScoreCells);
  const blockCells = new Set(coachBlockCells);
  const softScoreCells = new Set(coachSoftScoreCells);
  const finalPhaseScoreCells = new Set(finalPhase?.scoringCells ?? []);
  const finalPhaseBlockCells = new Set(finalPhase?.blockingCells ?? []);
  const powerCellByCell = new Map(
    powerEffects.powerCells
      .filter((choice) => choice.cell !== null)
      .map((choice) => [choice.cell!, choice]),
  );
  const powerPreviewByCell = new Map(
    powerEffects.previewCells.map((preview) => [preview.cell, preview]),
  );
  const previewSurgeCells = new Set(
    powerEffects.previewLines
      .filter((preview) => preview.kind === 'surge-line')
      .flatMap((preview) => preview.line),
  );
  const previewShieldCells = new Set(
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
  const placeEventCells = new Set(
    animationEvents
      .filter((event) => event.type === 'place')
      .flatMap(getAnimationCells),
  );
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
  const hintsByCell = new Map(coachHints.map((hint) => [hint.cell, hint]));
  const activeCoachCell = armedCell ?? hoveredCell;
  const activeCoachHint =
    activeCoachCell === null ? null : hintsByCell.get(activeCoachCell) ?? null;
  const activeCoachColor =
    activeCoachHint?.kind === 'score'
      ? '#74f0a7'
      : activeCoachHint?.kind === 'block'
        ? '#ff6f76'
        : activeCoachHint?.kind === 'both'
          ? '#f8d65a'
          : null;
  const beamLine =
    scoredLines[0] ??
    (winningLine.length === 3 ? winningLine : finalLines[0] ?? []);
  const beamColor = scoredLines[0] ? '#74f0a7' : theme.win;

  useFrame(({ clock }) => {
    if (!group.current) {
      return;
    }

    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.16) * 0.06;
  });

  return (
    <>
      <ambientLight intensity={theme.ambient} />
      <directionalLight position={[3, 4, 5]} intensity={theme.directional} />
      <pointLight position={[-4, -3, -2]} color={theme.point} intensity={1.45} />
      <group ref={group}>
        <BoardRails layout={layout} theme={theme} />
        {layout === 'cube' && theme.cubeShell ? (
          <CubeShell theme={theme} />
        ) : null}
        {layout === 'floors' ? <FloorPlates theme={theme} /> : null}
        {theme.coreGlow ? <CoreGlow theme={theme} /> : null}
        {powerEffects.chargedState ? (
          <group>
            <pointLight color="#f8d65a" distance={6.8} intensity={1.05} />
            <mesh>
              <sphereGeometry args={[1.72, 28, 18]} />
              <meshBasicMaterial
                blending={THREE.AdditiveBlending}
                color="#f8d65a"
                depthWrite={false}
                opacity={0.055}
                transparent
              />
            </mesh>
          </group>
        ) : null}
        {theme.winBeam && beamLine.length === 3 ? (
          <WinBeam color={beamColor} layout={layout} line={beamLine} theme={theme} />
        ) : null}
        {activeCoachHint && activeCoachColor ? (
          <CoachLinePath
            color={activeCoachColor}
            layout={layout}
            line={activeCoachHint.primaryLine}
          />
        ) : null}
        {scoreEventLines.map((line, index) => (
          <CoachLinePath
            key={`score-event-${index}-${line.join('-')}`}
            color="#74f0a7"
            layout={layout}
            line={line}
          />
        ))}
        {blockEventLines.map((line, index) => (
          <CoachLinePath
            key={`block-event-${index}-${line.join('-')}`}
            color="#ff6f76"
            layout={layout}
            line={line}
          />
        ))}
        {powerEventLines.map((line, index) => (
          <CoachLinePath
            key={`power-event-${index}-${line.join('-')}`}
            color="#f8d65a"
            layout={layout}
            line={line}
          />
        ))}
        {powerEffects.previewLines.map((preview) => (
          <CoachLinePath
            key={`preview-${preview.kind}-${preview.player}-${preview.line.join('-')}`}
            color={preview.kind === 'surge-line' ? '#74f0a7' : '#ff6f76'}
            layout={layout}
            line={preview.line}
          />
        ))}
        {powerEffects.surgeLines.map((choice) =>
          choice.line ? (
            <CoachLinePath
              key={`surge-${choice.player}-${choice.line.join('-')}`}
              color={choice.triggered ? '#f8d65a' : '#74f0a7'}
              layout={layout}
              line={choice.line}
            />
          ) : null,
        )}
        {powerEffects.shieldLines.map((choice) =>
          choice.line ? (
            <CoachLinePath
              key={`shield-${choice.player}-${choice.line.join('-')}`}
              color={choice.triggered ? '#f8d65a' : '#ff6f76'}
              layout={layout}
              line={choice.line}
            />
          ) : null,
        )}
        {board.map((value, index) => {
          const isScore = !value && scoreCells.has(index);
          const isBlock = !value && blockCells.has(index);
          const isSoftScore = !value && softScoreCells.has(index);
          const isFinalPhaseScore = !value && finalPhaseScoreCells.has(index);
          const isFinalPhaseBlock = !value && finalPhaseBlockCells.has(index);
          const coachHint = hintsByCell.get(index);
          const powerCell = powerCellByCell.get(index);
          const powerPreview = powerPreviewByCell.get(index);
          const shieldChoice = shieldChoiceByCell.get(index);
          const isPowerSurge = surgeCells.has(index);
          const isPowerShield = shieldCells.has(index);
          const isPowerShieldCell = Boolean(shieldChoice);
          const isPowerPreviewSurge = previewSurgeCells.has(index);
          const isPowerPreviewShield = previewShieldCells.has(index);
          const isPowerTrigger = triggerCells.has(index);
          const isPowerChargedEmpty =
            !value &&
            chargedEmptyCells.has(index) &&
            !powerCell &&
            !powerPreview &&
            !isPowerShieldCell;
          const coachMark =
            isScore && isBlock
              ? 'both'
              : isScore
                ? 'score'
                : isBlock
                  ? 'block'
                  : isSoftScore
                    ? 'soft-score'
                    : null;
          const tensionMark =
            isFinalPhaseScore && isFinalPhaseBlock
              ? 'both'
              : isFinalPhaseScore
                ? 'score'
                : isFinalPhaseBlock
                  ? 'block'
                  : null;
          const cellPowerMark = isPowerTrigger
            ? 'power-trigger'
            : powerCell
              ? powerCell.id
              : powerPreview
                ? 'power-preview'
                : isPowerSurge || isPowerPreviewSurge
                  ? 'surge-line'
                  : isPowerShieldCell && shieldChoice
                    ? shieldChoice.id
                    : isPowerShield || isPowerPreviewShield
                      ? 'shield-line'
                      : isPowerChargedEmpty
                        ? 'power-charged-empty'
                        : null;
          const cellPowerText =
            powerPreview?.label ??
            (powerCell
              ? '+2'
              : isPowerSurge
                ? '+2'
                : isPowerShieldCell
                  ? shieldChoice?.id === 'shield-cell'
                    ? '+1'
                    : 'SH'
                  : null);
          const eventMark = powerEventCells.has(index)
            ? 'power'
            : scoreEventCells.has(index)
              ? 'score'
              : blockEventCells.has(index)
                ? 'block'
                : placeEventCells.has(index)
                  ? 'place'
                  : null;

          return (
            <Cell
              key={index}
              armed={armedCell === index}
              coachMark={coachMark}
              currentPlayer={currentPlayer}
              disabled={disabled}
              eventMark={eventMark}
              index={index}
              coachExplanation={coachHint?.shortLabel ?? null}
              lineMark={
                classicWinningCells.has(index)
                  ? 'win'
                  : finalCells.has(index)
                    ? 'final'
                    : scoredCells.has(index)
                      ? 'scored'
                      : null
              }
              layout={layout}
              powerMark={cellPowerMark}
              powerText={cellPowerText}
              tensionMark={tensionMark}
              theme={theme}
              value={value}
              onArm={onArmCell}
              onHover={onHoverCell}
              onSelect={onSelect}
            />
          );
        })}
      </group>
      {theme.scanFloor ? <ScanFloor layout={layout} theme={theme} /> : null}
      <Text
        anchorX="center"
        anchorY="middle"
        color={theme.title}
        fontSize={0.18}
        position={[0, -2.48, 0]}
        rotation={[-0.3, 0, 0]}
      >
        3D XOX
      </Text>
      <CameraRig layout={layout} />
      <CameraControls command={viewCommand} layout={layout} />
    </>
  );
}
