import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { ComponentRef } from 'react';
import * as THREE from 'three';
import type { BoardLayout, BoardViewCommand } from '../../game/boardView';
import {
  BOARD_TARGET,
  CAMERA_HOME,
  MAX_DISTANCE,
  MIN_DISTANCE,
  fitCameraDistance,
} from './geometry';

export function CameraRig({ layout }: { layout: BoardLayout }) {
  const { camera, size } = useThree();

  useEffect(() => {
    const distance = fitCameraDistance(size.width / size.height, layout);

    camera.position.setLength(distance);
    camera.updateProjectionMatrix();
  }, [camera, layout, size]);

  return null;
}

export function CameraControls({
  command,
  layout,
}: {
  command: BoardViewCommand | null;
  layout: BoardLayout;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const lastCommand = useRef(0);
  const { camera, size } = useThree();

  useEffect(() => {
    if (!command || lastCommand.current === command.id || !controls.current) {
      return;
    }

    lastCommand.current = command.id;

    const target = controls.current.target.clone();
    const offset = camera.position.clone().sub(target);

    if (command.action === 'reset') {
      camera.position
        .copy(CAMERA_HOME)
        .setLength(fitCameraDistance(size.width / size.height, layout));
      controls.current.target.copy(BOARD_TARGET);
    }

    if (command.action === 'rotate-left' || command.action === 'rotate-right') {
      offset.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        command.action === 'rotate-left' ? -Math.PI / 9 : Math.PI / 9,
      );
      camera.position.copy(target).add(offset);
    }

    if (command.action === 'zoom-in' || command.action === 'zoom-out') {
      const nextDistance = THREE.MathUtils.clamp(
        offset.length() * (command.action === 'zoom-in' ? 0.84 : 1.18),
        MIN_DISTANCE,
        MAX_DISTANCE,
      );
      camera.position.copy(target).add(offset.setLength(nextDistance));
    }

    controls.current.update();
  }, [camera, command, layout, size]);

  return (
    <OrbitControls
      ref={controls}
      dampingFactor={0.08}
      enableDamping
      enablePan={false}
      maxDistance={MAX_DISTANCE}
      maxPolarAngle={Math.PI - 0.25}
      minDistance={MIN_DISTANCE}
      minPolarAngle={0.25}
      rotateSpeed={0.62}
      zoomSpeed={0.7}
    />
  );
}
