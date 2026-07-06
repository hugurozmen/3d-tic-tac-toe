import * as THREE from 'three';
import type { Player } from '../../game/rules';
import type { SceneTheme } from '../../theme';
import {
  diamondGeometry,
  gemGeometry,
  orbGeometry,
  ringGeometry,
  xBarGeometry,
} from './geometry';

function XMark({ color }: { color: string }) {
  return (
    <group rotation={[0.18, 0.2, 0.08]}>
      <mesh geometry={xBarGeometry} rotation={[0, 0, Math.PI / 4]}>
        <meshStandardMaterial color={color} metalness={0.2} roughness={0.36} />
      </mesh>
      <mesh geometry={xBarGeometry} rotation={[0, 0, -Math.PI / 4]}>
        <meshStandardMaterial color={color} metalness={0.2} roughness={0.36} />
      </mesh>
    </group>
  );
}

function OMark({ color }: { color: string }) {
  return (
    <mesh geometry={ringGeometry} rotation={[Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color={color} metalness={0.18} roughness={0.34} />
    </mesh>
  );
}

export function Mark({
  ghost = false,
  player,
  theme,
}: {
  ghost?: boolean;
  player: Player;
  theme: SceneTheme;
}) {
  const color = player === 'X' ? theme.x : theme.o;

  if (theme.markStyle === 'shape') {
    if (player === 'X') {
      return (
        <mesh geometry={diamondGeometry}>
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={ghost ? 0.18 : 0.32}
            metalness={0.25}
            opacity={ghost ? 0.45 : 1}
            roughness={0.3}
            transparent={ghost}
          />
        </mesh>
      );
    }

    return (
      <mesh geometry={ringGeometry} rotation={[-0.45, -Math.PI / 4, 0]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={ghost ? 0.18 : 0.32}
          metalness={0.2}
          opacity={ghost ? 0.45 : 1}
          roughness={0.3}
          transparent={ghost}
        />
      </mesh>
    );
  }

  if (theme.markStyle === 'orb') {
    return (
      <mesh geometry={player === 'X' ? gemGeometry : orbGeometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={ghost ? 0.2 : 0.34}
          flatShading={player === 'X'}
          metalness={0.15}
          opacity={ghost ? 0.45 : 1}
          roughness={0.3}
          transparent={ghost}
        />
      </mesh>
    );
  }

  return player === 'X' ? <XMark color={color} /> : <OMark color={color} />;
}
