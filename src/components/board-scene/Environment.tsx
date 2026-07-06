import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { BoardLayout } from '../../game/boardView';
import type { SceneTheme } from '../../theme';
import {
  FLOOR_GAP,
  SPACING,
  boldRailGeometry,
  cellPosition,
  plateGeometry,
  plateGridGeometry,
  railGeometry,
  shellBoxGeometry,
  shellGridGeometry,
} from './geometry';

export function BoardRails({
  layout,
  theme,
}: {
  layout: BoardLayout;
  theme: SceneTheme;
}) {
  const railMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: theme.rail,
        metalness: 0.18,
        roughness: 0.64,
      }),
    [theme.rail],
  );
  const rails = useMemo(() => {
    const positions: Array<{
      position: [number, number, number];
      rotation: [number, number, number];
    }> = [];
    const range = [-SPACING, 0, SPACING];

    if (layout === 'floors') {
      for (const floorY of [-FLOOR_GAP, 0, FLOOR_GAP]) {
        for (const z of range) {
          positions.push({ position: [0, floorY, z], rotation: [0, 0, 0] });
        }

        for (const x of range) {
          positions.push({
            position: [x, floorY, 0],
            rotation: [0, Math.PI / 2, 0],
          });
        }
      }

      return positions;
    }

    for (const y of range) {
      for (const z of range) {
        positions.push({ position: [0, y, z], rotation: [0, 0, 0] });
      }
    }

    for (const x of range) {
      for (const z of range) {
        positions.push({
          position: [x, 0, z],
          rotation: [0, 0, Math.PI / 2],
        });
      }
    }

    for (const x of range) {
      for (const y of range) {
        positions.push({
          position: [x, y, 0],
          rotation: [0, Math.PI / 2, 0],
        });
      }
    }

    return positions;
  }, [layout]);

  if (theme.railStyle === 'none') {
    return null;
  }

  return (
    <group>
      {rails.map((rail, index) => (
        <mesh
          key={`${rail.position.join('-')}-${index}`}
          geometry={theme.railStyle === 'bold' ? boldRailGeometry : railGeometry}
          material={railMaterial}
          position={rail.position}
          rotation={rail.rotation}
        />
      ))}
    </group>
  );
}

export function CubeShell({ theme }: { theme: SceneTheme }) {
  return (
    <group>
      <mesh geometry={shellBoxGeometry}>
        <meshBasicMaterial
          color={theme.cell}
          depthWrite={false}
          opacity={theme.cellOpacity}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
      <lineSegments geometry={shellGridGeometry}>
        <lineBasicMaterial color={theme.edge} opacity={0.38} transparent />
      </lineSegments>
      <lineSegments>
        <edgesGeometry args={[shellBoxGeometry]} />
        <lineBasicMaterial color={theme.edge} opacity={0.85} transparent />
      </lineSegments>
    </group>
  );
}

export function FloorPlates({ theme }: { theme: SceneTheme }) {
  return (
    <group>
      {[-FLOOR_GAP, 0, FLOOR_GAP].map((floorY) => (
        <group key={floorY} position={[0, floorY - 0.55, 0]}>
          <mesh geometry={plateGeometry}>
            <meshStandardMaterial
              color={theme.cell}
              metalness={0.08}
              opacity={0.13}
              roughness={0.5}
              transparent
            />
          </mesh>
          <lineSegments geometry={plateGridGeometry} position={[0, 0.04, 0]}>
            <lineBasicMaterial color={theme.edge} opacity={0.5} transparent />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

export function CoreGlow({ theme }: { theme: SceneTheme }) {
  return (
    <group>
      <pointLight color={theme.point} distance={6.5} intensity={2.4} />
      <mesh>
        <sphereGeometry args={[1.45, 24, 18]} />
        <meshBasicMaterial
          blending={THREE.AdditiveBlending}
          color={theme.point}
          depthWrite={false}
          opacity={0.07}
          transparent
        />
      </mesh>
    </group>
  );
}

export function ScanFloor({
  layout,
  theme,
}: {
  layout: BoardLayout;
  theme: SceneTheme;
}) {
  return (
    <gridHelper
      args={[11, 22, theme.edge, theme.edge]}
      position={[0, layout === 'floors' ? -3.2 : -2.5, 0]}
      onUpdate={(grid) => {
        const material = grid.material as THREE.LineBasicMaterial;

        material.transparent = true;
        material.opacity = 0.3;
      }}
    />
  );
}

export function WinBeam({
  color,
  layout,
  line,
  theme,
}: {
  color?: string;
  layout: BoardLayout;
  line: number[];
  theme: SceneTheme;
}) {
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const { length, midpoint, quaternion } = useMemo(() => {
    const start = new THREE.Vector3(...cellPosition(line[0], layout));
    const end = new THREE.Vector3(...cellPosition(line[2], layout));
    const direction = end.clone().sub(start);
    const beamLength = direction.length() + 0.6;
    const beamMidpoint = start.clone().add(end).multiplyScalar(0.5);
    const beamQuaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );

    return {
      length: beamLength,
      midpoint: beamMidpoint,
      quaternion: beamQuaternion,
    };
  }, [layout, line]);

  useFrame(({ clock }) => {
    if (material.current) {
      material.current.opacity = 0.62 + Math.sin(clock.elapsedTime * 5.2) * 0.3;
    }
  });

  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[0.05, 0.05, length, 12]} />
      <meshBasicMaterial
        ref={material}
        blending={THREE.AdditiveBlending}
        color={color ?? theme.win}
        depthWrite={false}
        transparent
      />
    </mesh>
  );
}

export function CoachLinePath({
  color,
  layout,
  line,
}: {
  color: string;
  layout: BoardLayout;
  line: number[];
}) {
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const { length, midpoint, quaternion } = useMemo(() => {
    const start = new THREE.Vector3(...cellPosition(line[0], layout));
    const end = new THREE.Vector3(...cellPosition(line[2], layout));
    const direction = end.clone().sub(start);
    const beamLength = direction.length() + 0.34;
    const beamMidpoint = start.clone().add(end).multiplyScalar(0.5);
    const beamQuaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );

    return {
      length: beamLength,
      midpoint: beamMidpoint,
      quaternion: beamQuaternion,
    };
  }, [layout, line]);

  useFrame(({ clock }) => {
    if (material.current) {
      material.current.opacity = prefersReducedMotion
        ? 0.42
        : 0.34 + Math.sin(clock.elapsedTime * 3.2) * 0.08;
    }
  });

  if (line.length !== 3) {
    return null;
  }

  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[0.028, 0.028, length, 10]} />
      <meshBasicMaterial
        ref={material}
        blending={THREE.AdditiveBlending}
        color={color}
        depthWrite={false}
        transparent
      />
    </mesh>
  );
}
