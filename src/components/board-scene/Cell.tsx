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
  coachExplanation,
  currentPlayer,
  disabled,
  eventMark,
  index,
  lineMark,
  layout,
  powerMark,
  powerText,
  tensionMark,
  theme,
  value,
  onArm,
  onHover,
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
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const coachColor =
    coachMark === 'score'
      ? '#74f0a7'
      : coachMark === 'soft-score'
      ? '#74f0a7'
      : coachMark === 'block'
        ? '#ff6f76'
        : coachMark === 'both'
          ? '#f8d65a'
          : null;
  const powerColor =
    powerMark === 'power-cell' ||
    powerMark === 'charged-cell' ||
    powerMark === 'power-preview' ||
    powerMark === 'power-charged-empty'
      ? '#f8d65a'
      : powerMark === 'surge-line'
        ? '#74f0a7'
        : powerMark === 'shield-line' || powerMark === 'shield-cell'
          ? '#ff6f76'
          : powerMark === 'power-trigger'
            ? '#f8d65a'
            : null;

  useCursor(isPlayable && hovered);

  useFrame(({ clock }) => {
    if (!ref.current) {
      return;
    }

    const pulse = prefersReducedMotion
      ? isActive && isPlayable
        ? 1.04
        : 1
      : isFinalLine
        ? 1 + Math.sin(clock.elapsedTime * 5.2) * 0.055
        : lineMark === 'scored'
          ? 1 + Math.sin(clock.elapsedTime * 6.6) * 0.045
          : eventMark === 'place'
            ? 1 + Math.sin(clock.elapsedTime * 9.2) * 0.035
          : eventMark === 'score' || eventMark === 'power'
            ? 1 + Math.sin(clock.elapsedTime * 7.4) * 0.055
          : eventMark === 'block'
            ? 1 + Math.sin(clock.elapsedTime * 6.8) * 0.045
          : powerMark === 'power-trigger'
            ? 1 + Math.sin(clock.elapsedTime * 7.4) * 0.06
          : powerColor && isPlayable
            ? 1 + Math.sin(clock.elapsedTime * 3.5) * 0.032
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
          onHover(index);
        }}
        onPointerLeave={() => {
          setHovered(false);
          onHover(null);
        }}
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
              : eventMark === 'score'
                ? '#74f0a7'
              : eventMark === 'block'
                ? '#ff6f76'
              : eventMark === 'power'
                ? '#f8d65a'
              : coachColor
                ? coachMark === 'soft-score' && !isActive
                  ? theme.edge
                  : coachColor
              : powerColor
                ? powerColor
              : tensionMark === 'score'
                ? '#74f0a7'
              : tensionMark === 'block'
                ? '#ff6f76'
              : tensionMark === 'both'
                ? '#f8d65a'
              : isActive && isPlayable
                ? theme.hover
                : theme.edge
          }
          opacity={
            isLineMarked
              ? 1
              : coachColor
                ? coachMark === 'soft-score' && !isActive
                  ? 0.54
                  : 0.98
              : eventMark
                ? 0.98
              : powerColor
                ? powerMark === 'power-preview'
                  ? 0.72
                  : 0.96
              : tensionMark
                ? 0.84
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
      {coachColor && isPlayable && (coachMark !== 'soft-score' || isActive) ? (
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={isActive ? 1.08 : 1}>
          <torusGeometry args={[0.42, 0.018, 8, 48]} />
          <meshBasicMaterial
            blending={THREE.AdditiveBlending}
            color={coachColor}
            depthWrite={false}
            opacity={isActive ? 0.48 : 0.28}
            transparent
          />
        </mesh>
      ) : null}
      {!coachColor && tensionMark && isPlayable ? (
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={isActive ? 1.04 : 0.98}>
          <torusGeometry args={[0.39, 0.012, 8, 48]} />
          <meshBasicMaterial
            blending={THREE.AdditiveBlending}
            color={
              tensionMark === 'score'
                ? '#74f0a7'
                : tensionMark === 'block'
                  ? '#ff6f76'
                  : '#f8d65a'
            }
            depthWrite={false}
            opacity={isActive ? 0.32 : 0.16}
            transparent
          />
        </mesh>
      ) : null}
      {powerColor && !value ? (
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={isActive ? 1.08 : 1}>
          <torusGeometry args={[0.43, 0.018, 8, 48]} />
          <meshBasicMaterial
            blending={THREE.AdditiveBlending}
            color={powerColor}
            depthWrite={false}
            opacity={
              powerMark === 'power-preview'
                ? isActive
                  ? 0.42
                  : 0.2
                : powerMark === 'power-charged-empty'
                  ? isActive
                    ? 0.22
                    : 0.1
                : 0.36
            }
            transparent
          />
        </mesh>
      ) : null}
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
          className={`cell-layer-badge ${armed ? 'cell-badge-armed' : ''}`}
          distanceFactor={10}
          position={[0, -0.48, 0]}
          style={{
            background: theme.labelBackground,
            borderColor: theme.labelBorder,
            color: theme.labelText,
          }}
        >
          {armed ? `${index + 1} · tap again to place` : index + 1}
        </Html>
      ) : null}
      {(hovered || armed) && coachExplanation ? (
        <Html
          center
          className={`cell-coach-badge coach-${coachMark ?? 'hint'}`}
          distanceFactor={9}
          position={[0, 0.62, 0]}
          style={{
            background: theme.labelBackground,
            borderColor: coachColor ?? theme.labelBorder,
            color: theme.labelText,
          }}
        >
          {coachExplanation}
        </Html>
      ) : null}
      {powerText && !value ? (
        <Html
          center
          className={`cell-power-badge power-${powerMark ?? 'hint'}`}
          distanceFactor={9}
          position={[0, 0.54, 0]}
          style={{
            background: theme.labelBackground,
            borderColor: powerColor ?? theme.labelBorder,
            color: theme.labelText,
          }}
        >
          {powerText}
        </Html>
      ) : null}
    </group>
  );
}
