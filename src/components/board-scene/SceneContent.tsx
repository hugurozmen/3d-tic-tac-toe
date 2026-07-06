import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
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
        {board.map((value, index) => {
          const isScore = !value && scoreCells.has(index);
          const isBlock = !value && blockCells.has(index);
          const isSoftScore = !value && softScoreCells.has(index);
          const isFinalPhaseScore = !value && finalPhaseScoreCells.has(index);
          const isFinalPhaseBlock = !value && finalPhaseBlockCells.has(index);
          const coachHint = hintsByCell.get(index);
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

          return (
            <Cell
              key={index}
              armed={armedCell === index}
              coachMark={coachMark}
              currentPlayer={currentPlayer}
              disabled={disabled}
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
