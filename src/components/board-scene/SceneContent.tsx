import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { CameraControls, CameraRig } from './Camera';
import { Cell } from './Cell';
import {
  BoardRails,
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
  coachScoreCells,
  currentPlayer,
  disabled,
  highlightLines,
  layout,
  theme,
  viewCommand,
  winningLine,
  onArmCell,
  onSelect,
}: SceneContentProps) {
  const group = useRef<THREE.Group>(null);
  const highlightedCells = new Set([
    ...winningLine,
    ...highlightLines.flatMap((line) => line),
  ]);
  const scoreCells = new Set(coachScoreCells);
  const blockCells = new Set(coachBlockCells);
  const beamLine = winningLine.length === 3 ? winningLine : highlightLines[0] ?? [];

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
          <WinBeam layout={layout} line={beamLine} theme={theme} />
        ) : null}
        {board.map((value, index) => {
          const isScore = !value && scoreCells.has(index);
          const isBlock = !value && blockCells.has(index);
          const coachMark =
            isScore && isBlock
              ? 'both'
              : isScore
                ? 'score'
                : isBlock
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
              isWinning={highlightedCells.has(index)}
              layout={layout}
              theme={theme}
              value={value}
              onArm={onArmCell}
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
