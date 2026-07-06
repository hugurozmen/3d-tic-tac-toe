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
  currentPlayer,
  disabled,
  layout,
  theme,
  viewCommand,
  winningLine,
  onArmCell,
  onSelect,
}: SceneContentProps) {
  const group = useRef<THREE.Group>(null);

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
        {theme.winBeam && winningLine.length === 3 ? (
          <WinBeam layout={layout} line={winningLine} theme={theme} />
        ) : null}
        {board.map((value, index) => (
          <Cell
            key={index}
            armed={armedCell === index}
            currentPlayer={currentPlayer}
            disabled={disabled}
            index={index}
            isWinning={winningLine.includes(index)}
            layout={layout}
            theme={theme}
            value={value}
            onArm={onArmCell}
            onSelect={onSelect}
          />
        ))}
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
