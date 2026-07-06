import { Html, useCursor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { feedback } from '../../game/feedback';
import {
  cellGeometry,
  cellPosition,
  dotGeometry,
  jointGeometry,
} from './geometry';
import { Mark } from './Marks';
import type { CellProps } from './types';

export function Cell({
  armed,
  coachMark,
  currentPlayer,
  disabled,
  index,
  lineMark,
  layout,
  theme,
  value,
  onArm,
  onSelect,
}: CellProps) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<THREE.Group>(null);
  const isPlayable = !value && !disabled;
  const position = useMemo(() => cellPosition(index, layout), [index, layout]);
  const isGhost = theme.cellStyle === 'ghost';
  const isWire = theme.cellStyle === 'wire';
  const isActive = armed || (hovered && isPlayable);
  const isLineMarked = lineMark !== null;
  const isFinalLine = lineMark === 'final' || lineMark === 'win';
  const coachColor =
    coachMark === 'score'
      ? '#74f0a7'
      : coachMark === 'block'
        ? '#ff6f76'
        : coachMark === 'both'
          ? '#f8d65a'
          : null;

  useCursor(isPlayable && hovered);

  useFrame(({ clock }) => {
    if (!ref.current) {
      return;
    }

    const pulse = isFinalLine
      ? 1 + Math.sin(clock.elapsedTime * 5.2) * 0.055
      : lineMark === 'scored'
        ? 1 + Math.sin(clock.elapsedTime * 6.6) * 0.045
      : coachMark && isPlayable
        ? 1 + Math.sin(clock.elapsedTime * 3.1) * 0.025
      : isActive && isPlayable
        ? 1.06
        : 1;

    ref.current.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 0.22);
  });

  return (
    <group ref={ref} position={position}>
      <mesh
        geometry={cellGeometry}
        onClick={(event) => {
          event.stopPropagation();

          if (!isPlayable) {
            onArm(null);
            return;
          }

          const pointerType = (event.nativeEvent as PointerEvent).pointerType;
          const needsConfirm =
            pointerType === 'touch' ||
            window.matchMedia('(pointer: coarse)').matches;

          if (needsConfirm && !armed) {
            onArm(index);
            feedback.arm();
            return;
          }

          onArm(null);
          onSelect(index);
        }}
        onPointerEnter={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={theme.cell}
          depthWrite={!isGhost}
          metalness={0.05}
          opacity={isGhost ? 0 : theme.cellOpacity}
          roughness={0.52}
          transparent
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[cellGeometry]} />
        <lineBasicMaterial
          color={
            isFinalLine
              ? theme.win
              : lineMark === 'scored'
                ? '#74f0a7'
              : coachColor
                ? coachColor
              : isActive && isPlayable
                ? theme.hover
                : theme.edge
          }
          opacity={
            isLineMarked
              ? 1
              : coachColor
                ? 0.98
              : isActive && isPlayable
                ? 0.95
                : isGhost
                  ? 0
                  : isWire
                    ? 0.92
                    : 0.56
          }
          transparent
        />
      </lineSegments>
      {isGhost && !value ? (
        <mesh geometry={theme.cubeShell ? dotGeometry : jointGeometry}>
          {theme.cubeShell ? (
            <meshBasicMaterial color={theme.edge} opacity={0.55} transparent />
          ) : (
            <meshStandardMaterial
              color={theme.rail}
              metalness={0.3}
              roughness={0.45}
            />
          )}
        </mesh>
      ) : null}
      {!value && isActive && isPlayable ? (
        <group scale={0.75}>
          <Mark ghost player={currentPlayer} theme={theme} />
        </group>
      ) : null}
      {value ? (
        <group scale={isFinalLine ? 1.12 : lineMark === 'scored' ? 1.06 : 1}>
          <Mark player={value} theme={theme} />
        </group>
      ) : null}
      {hovered || armed ? (
        <Html
          center
          className="cell-layer-badge"
          distanceFactor={10}
          position={[0, -0.48, 0]}
          style={{
            background: theme.labelBackground,
            borderColor: theme.labelBorder,
            color: theme.labelText,
          }}
        >
          {index + 1}
        </Html>
      ) : null}
    </group>
  );
}
