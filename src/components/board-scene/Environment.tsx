import { Html } from '@react-three/drei';
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
import { useLayoutMorphProgress } from './LayoutMorphContext';
import { floorMorphTransform } from './layoutMorph';

const LINE_STEP_DELAY_MS = 120;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubic = (value: number) => 1 - Math.pow(1 - clamp01(value), 3);

const usePrefersReducedMotion = () =>
  useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

const useLineMetrics = (line: number[], layout: BoardLayout) =>
  useMemo(() => {
    const points = line.map(
      (cell) => new THREE.Vector3(...cellPosition(cell, layout)),
    );
    const start = points[0] ?? new THREE.Vector3();
    const end = points[2] ?? start;
    const direction = end.clone().sub(start);
    const length = Math.max(direction.length() + 0.34, 0.01);
    const unit =
      direction.length() > 0
        ? direction.clone().normalize()
        : new THREE.Vector3(0, 1, 0);
    const midpoint = start.clone().add(end).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      unit,
    );

    return {
      direction: unit,
      end,
      length,
      midpoint,
      points,
      quaternion,
      start,
    };
  }, [layout, line]);

export function BoardRails({
  theme,
}: {
  theme: SceneTheme;
}) {
  const morphProgress = useLayoutMorphProgress();
  const railMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: theme.rail,
        metalness: 0.18,
        roughness: 0.64,
      }),
    [theme.rail],
  );
  const depthMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: theme.rail,
        metalness: 0.18,
        roughness: 0.64,
        transparent: true,
      }),
    [theme.rail],
  );
  const depthGroup = useRef<THREE.Group>(null);
  const range = [-SPACING, 0, SPACING];

  useFrame(() => {
    const cubeOpacity = 1 - morphProgress.current;

    depthMaterial.opacity = cubeOpacity;

    if (depthGroup.current) {
      depthGroup.current.visible = cubeOpacity > 0.001;
    }
  });

  if (theme.railStyle === 'none') {
    return null;
  }

  return (
    <group>
      {[0, 1, 2].map((floorIndex) => (
        <MorphingFloorRails
          key={floorIndex}
          floorIndex={floorIndex}
          material={railMaterial}
          railStyle={theme.railStyle}
        />
      ))}
      <group ref={depthGroup}>
        {range.flatMap((x) =>
          range.map((y) => (
            <mesh
              key={`${x}-${y}`}
              geometry={
                theme.railStyle === 'bold' ? boldRailGeometry : railGeometry
              }
              material={depthMaterial}
              position={[x, y, 0]}
              rotation={[0, Math.PI / 2, 0]}
            />
          )),
        )}
      </group>
    </group>
  );
}

function MorphingFloorRails({
  floorIndex,
  material,
  railStyle,
}: {
  floorIndex: number;
  material: THREE.Material;
  railStyle: SceneTheme['railStyle'];
}) {
  const group = useRef<THREE.Group>(null);
  const morphProgress = useLayoutMorphProgress();
  const range = [-SPACING, 0, SPACING];

  useFrame(() => {
    if (!group.current) {
      return;
    }

    const transform = floorMorphTransform(floorIndex, morphProgress.current);

    group.current.position.set(...transform.position);
    group.current.rotation.x = transform.rotationX;
  });

  const transform = floorMorphTransform(floorIndex, morphProgress.current);
  const geometry = railStyle === 'bold' ? boldRailGeometry : railGeometry;

  return (
    <group position={transform.position} rotation={[transform.rotationX, 0, 0]} ref={group}>
      {range.map((localY) => (
        <mesh
          key={`row-${localY}`}
          geometry={geometry}
          material={material}
          position={[0, localY, 0]}
        />
      ))}
      {range.map((localX) => (
        <mesh
          key={`column-${localX}`}
          geometry={geometry}
          material={material}
          position={[localX, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        />
      ))}
    </group>
  );
}

export function CubeShell({ theme }: { theme: SceneTheme }) {
  const group = useRef<THREE.Group>(null);
  const surfaceMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const gridMaterial = useRef<THREE.LineBasicMaterial>(null);
  const edgeMaterial = useRef<THREE.LineBasicMaterial>(null);
  const morphProgress = useLayoutMorphProgress();

  useFrame(() => {
    const opacity = 1 - morphProgress.current;

    if (group.current) {
      group.current.visible = opacity > 0.001;
    }

    if (surfaceMaterial.current) {
      surfaceMaterial.current.opacity = theme.cellOpacity * opacity;
    }

    if (gridMaterial.current) {
      gridMaterial.current.opacity = 0.38 * opacity;
    }

    if (edgeMaterial.current) {
      edgeMaterial.current.opacity = 0.85 * opacity;
    }
  });

  return (
    <group ref={group}>
      <mesh geometry={shellBoxGeometry}>
        <meshBasicMaterial
          ref={surfaceMaterial}
          color={theme.cell}
          depthWrite={false}
          opacity={theme.cellOpacity}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
      <lineSegments geometry={shellGridGeometry}>
        <lineBasicMaterial
          ref={gridMaterial}
          color={theme.edge}
          opacity={0.38}
          transparent
        />
      </lineSegments>
      <lineSegments>
        <edgesGeometry args={[shellBoxGeometry]} />
        <lineBasicMaterial
          ref={edgeMaterial}
          color={theme.edge}
          opacity={0.85}
          transparent
        />
      </lineSegments>
    </group>
  );
}

export function FloorPlates({ theme }: { theme: SceneTheme }) {
  return (
    <group>
      {[0, 1, 2].map((floorIndex) => (
        <FloorPlate key={floorIndex} floorIndex={floorIndex} theme={theme} />
      ))}
    </group>
  );
}

function FloorPlate({
  floorIndex,
  theme,
}: {
  floorIndex: number;
  theme: SceneTheme;
}) {
  const group = useRef<THREE.Group>(null);
  const surfaceMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const gridMaterial = useRef<THREE.LineBasicMaterial>(null);
  const morphProgress = useLayoutMorphProgress();
  const floorY = (floorIndex - 1) * FLOOR_GAP;

  useFrame(() => {
    const opacity = morphProgress.current;

    if (group.current) {
      group.current.visible = opacity > 0.001;
    }

    if (surfaceMaterial.current) {
      surfaceMaterial.current.opacity = 0.13 * opacity;
    }

    if (gridMaterial.current) {
      gridMaterial.current.opacity = 0.5 * opacity;
    }
  });

  return (
    <group
      ref={group}
      position={[0, floorY - 0.55, 0]}
      visible={morphProgress.current > 0.001}
    >
      <mesh geometry={plateGeometry}>
        <meshStandardMaterial
          ref={surfaceMaterial}
          color={theme.cell}
          metalness={0.08}
          opacity={0.13 * morphProgress.current}
          roughness={0.5}
          transparent
        />
      </mesh>
      <lineSegments geometry={plateGridGeometry} position={[0, 0.04, 0]}>
        <lineBasicMaterial
          ref={gridMaterial}
          color={theme.edge}
          opacity={0.5 * morphProgress.current}
          transparent
        />
      </lineSegments>
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
  theme,
}: {
  theme: SceneTheme;
}) {
  const grid = useRef<THREE.GridHelper>(null);
  const morphProgress = useLayoutMorphProgress();

  useFrame(() => {
    if (grid.current) {
      grid.current.position.y = THREE.MathUtils.lerp(
        -2.5,
        -3.2,
        morphProgress.current,
      );
    }
  });

  return (
    <gridHelper
      ref={grid}
      args={[11, 22, theme.edge, theme.edge]}
      position={[
        0,
        THREE.MathUtils.lerp(-2.5, -3.2, morphProgress.current),
        0,
      ]}
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

export function AuthoredLineBeam({
  color,
  delayMs = 0,
  impactCell,
  isCombo = false,
  layout,
  line,
  tone,
}: {
  color: string;
  delayMs?: number;
  impactCell?: number | null;
  isCombo?: boolean;
  layout: BoardLayout;
  line: number[];
  tone: 'block' | 'power' | 'score';
}) {
  const beamRef = useRef<THREE.Mesh>(null);
  const beamMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const headMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const sparkRefs = useRef<Array<THREE.Mesh | null>>([]);
  const sparkMaterialRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const startTimeRef = useRef<number | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { direction, length, midpoint, points, quaternion, start } =
    useLineMetrics(line, layout);
  const impactPosition =
    impactCell === undefined || impactCell === null
      ? midpoint
      : new THREE.Vector3(...cellPosition(impactCell, layout));
  const radius =
    tone === 'power'
      ? 0.07
      : tone === 'block'
        ? 0.052
        : isCombo
          ? 0.058
          : 0.048;

  useFrame(({ clock }) => {
    if (!beamRef.current || !beamMaterialRef.current) {
      return;
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = clock.elapsedTime;
    }

    const localMs = (clock.elapsedTime - startTimeRef.current) * 1000 - delayMs;

    if (prefersReducedMotion) {
      beamRef.current.position.copy(midpoint);
      beamRef.current.scale.set(1, length, 1);
      beamMaterialRef.current.opacity = tone === 'block' ? 0.34 : 0.44;

      if (headRef.current && headMaterialRef.current) {
        headRef.current.visible = false;
        headMaterialRef.current.opacity = 0;
      }

      sparkRefs.current.forEach((spark, index) => {
        const material = sparkMaterialRefs.current[index];

        if (spark && material) {
          spark.scale.setScalar(0.92);
          material.opacity = tone === 'block' ? 0.28 : 0.36;
        }
      });
      return;
    }

    if (tone === 'block') {
      const appear = easeOutCubic(localMs / 170);
      const collapse = easeOutCubic((localMs - 360) / 330);
      const visibleLength = length * (1 - collapse);

      beamRef.current.position.copy(
        collapse > 0 ? impactPosition : midpoint,
      );
      beamRef.current.scale.set(1, Math.max(visibleLength, 0.001), 1);
      beamMaterialRef.current.opacity =
        appear * (1 - collapse) * (isCombo ? 0.86 : 0.72);

      if (headRef.current && headMaterialRef.current) {
        headRef.current.position.copy(impactPosition);
        headRef.current.scale.setScalar(1 + appear * 0.8);
        headMaterialRef.current.opacity =
          clamp01((localMs - 250) / 170) * (1 - collapse);
      }
    } else {
      const progress = easeOutCubic(localMs / 520);
      const fade = 1 - clamp01((localMs - 760) / 300);
      const visibleLength = length * progress;

      beamRef.current.position.copy(
        start.clone().add(direction.clone().multiplyScalar(visibleLength / 2)),
      );
      beamRef.current.scale.set(1, Math.max(visibleLength, 0.001), 1);
      beamMaterialRef.current.opacity =
        progress * fade * (tone === 'power' ? 0.9 : isCombo ? 0.82 : 0.7);

      if (headRef.current && headMaterialRef.current) {
        headRef.current.position.copy(
          start.clone().add(direction.clone().multiplyScalar(length * progress)),
        );
        headRef.current.scale.setScalar(0.92 + progress * 0.42);
        headMaterialRef.current.opacity = progress * fade;
      }
    }

    points.forEach((_, index) => {
      const spark = sparkRefs.current[index];
      const material = sparkMaterialRefs.current[index];

      if (!spark || !material) {
        return;
      }

      const stepLocal = localMs - index * LINE_STEP_DELAY_MS;
      const sparkLevel =
        tone === 'block'
          ? clamp01((stepLocal - 140) / 150) *
            (1 - clamp01((stepLocal - 520) / 260))
          : clamp01(stepLocal / 120) *
            (1 - clamp01((stepLocal - 420) / 260));

      spark.scale.setScalar(
        0.72 + sparkLevel * (tone === 'power' ? 0.8 : 0.56),
      );
      material.opacity = sparkLevel * (tone === 'block' ? 0.78 : 0.86);
    });
  });

  if (line.length !== 3) {
    return null;
  }

  return (
    <group>
      <mesh ref={beamRef} quaternion={quaternion}>
        <cylinderGeometry args={[radius, radius, 1, 14]} />
        <meshBasicMaterial
          ref={beamMaterialRef}
          blending={THREE.AdditiveBlending}
          color={color}
          depthWrite={false}
          opacity={0}
          transparent
        />
      </mesh>
      <mesh ref={headRef} position={start}>
        <sphereGeometry args={[tone === 'power' ? 0.18 : 0.14, 18, 12]} />
        <meshBasicMaterial
          ref={headMaterialRef}
          blending={THREE.AdditiveBlending}
          color={color}
          depthWrite={false}
          opacity={0}
          transparent
        />
      </mesh>
      {points.map((point, index) => (
        <mesh
          key={`${line[index]}-${index}`}
          ref={(mesh) => {
            sparkRefs.current[index] = mesh;
          }}
          position={point}
        >
          <sphereGeometry args={[0.13, 16, 10]} />
          <meshBasicMaterial
            ref={(material) => {
              sparkMaterialRefs.current[index] = material;
            }}
            blending={THREE.AdditiveBlending}
            color={color}
            depthWrite={false}
            opacity={0}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

export function FinalSixChargePulse({
  cells,
  layout,
}: {
  cells: number[];
  layout: BoardLayout;
}) {
  const shellRef = useRef<THREE.Mesh>(null);
  const shellMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const startTimeRef = useRef<number | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const cellPositions = useMemo(
    () => cells.map((cell) => cellPosition(cell, layout)),
    [cells, layout],
  );

  useFrame(({ clock }) => {
    if (!shellRef.current || !shellMaterialRef.current) {
      return;
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = clock.elapsedTime;
    }

    const elapsedMs = (clock.elapsedTime - startTimeRef.current) * 1000;
    const progress = prefersReducedMotion ? 1 : easeOutCubic(elapsedMs / 900);
    const fade = prefersReducedMotion
      ? 0.42
      : 1 - clamp01((elapsedMs - 860) / 480);

    shellRef.current.scale.setScalar(1.05 + progress * 0.34);
    shellMaterialRef.current.opacity =
      fade * (prefersReducedMotion ? 0.08 : 0.18);

    if (lightRef.current) {
      lightRef.current.intensity = fade * (prefersReducedMotion ? 0.75 : 2.1);
    }
  });

  return (
    <group>
      <pointLight ref={lightRef} color="#f8d65a" distance={7.5} intensity={0} />
      <mesh ref={shellRef}>
        <sphereGeometry args={[1.9, 30, 18]} />
        <meshBasicMaterial
          ref={shellMaterialRef}
          blending={THREE.AdditiveBlending}
          color="#ffffff"
          depthWrite={false}
          opacity={0}
          transparent
        />
      </mesh>
      {cellPositions.map((position, index) => (
        <mesh key={`${position.join('-')}-${index}`} position={position}>
          <sphereGeometry args={[0.105, 12, 8]} />
          <meshBasicMaterial
            blending={THREE.AdditiveBlending}
            color="#f8d65a"
            depthWrite={false}
            opacity={prefersReducedMotion ? 0.2 : 0.34}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

export function PowerBonusFloat({
  bonus,
  cell,
  layout,
  shieldDenied = false,
}: {
  bonus: number;
  cell?: number | null;
  layout: BoardLayout;
  shieldDenied?: boolean;
}) {
  if (cell === undefined || cell === null) {
    return null;
  }

  const position = cellPosition(cell, layout);

  return (
    <Html
      center
      className={`power-impact-float ${shieldDenied ? 'denied' : 'bonus'}`}
      distanceFactor={8}
      position={[position[0], position[1] + 0.36, position[2]]}
    >
      {shieldDenied ? 'Denied' : `+${bonus}`}
    </Html>
  );
}

export function ShieldImpact({
  cell,
  layout,
}: {
  cell?: number | null;
  layout: BoardLayout;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTimeRef = useRef<number | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useFrame(({ clock }) => {
    if (!ringRef.current || !materialRef.current) {
      return;
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = clock.elapsedTime;
    }

    const elapsedMs = (clock.elapsedTime - startTimeRef.current) * 1000;
    const progress = prefersReducedMotion ? 1 : easeOutCubic(elapsedMs / 460);
    const fade = prefersReducedMotion
      ? 0.42
      : 1 - clamp01((elapsedMs - 520) / 360);

    ringRef.current.scale.setScalar(0.7 + progress * 0.72);
    materialRef.current.opacity = fade * 0.82;
  });

  if (cell === undefined || cell === null) {
    return null;
  }

  return (
    <mesh
      ref={ringRef}
      position={cellPosition(cell, layout)}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <torusGeometry args={[0.43, 0.032, 10, 64]} />
      <meshBasicMaterial
        ref={materialRef}
        blending={THREE.AdditiveBlending}
        color="#ff6f76"
        depthWrite={false}
        opacity={0}
        transparent
      />
    </mesh>
  );
}
