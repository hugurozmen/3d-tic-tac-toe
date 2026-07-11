import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import * as THREE from 'three';
import type { BoardLayout, BoardViewCommand } from '../../game/boardView';
import { orbitZoomSpeed, resolveCameraFit } from './cameraFit';
import {
  BOARD_TARGET,
  CAMERA_HOME,
  MAX_DISTANCE,
  MIN_DISTANCE,
  fitCameraDistance,
} from './geometry';

const COARSE_POINTER_QUERY = '(pointer: coarse)';
const appliedFitDistances = new WeakMap<THREE.Camera, number>();

function useCoarsePointer() {
  const [coarsePointer, setCoarsePointer] = useState(() =>
    window.matchMedia(COARSE_POINTER_QUERY).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(COARSE_POINTER_QUERY);
    const updatePointer = () => setCoarsePointer(mediaQuery.matches);

    updatePointer();
    mediaQuery.addEventListener('change', updatePointer);

    return () => mediaQuery.removeEventListener('change', updatePointer);
  }, []);

  return coarsePointer;
}

function exposeCameraDistance(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
) {
  if (!import.meta.env.DEV) {
    return;
  }

  canvas.dataset.cameraDistance = camera.position
    .distanceTo(BOARD_TARGET)
    .toFixed(4);
}

export function CameraRig({ layout }: { layout: BoardLayout }) {
  const { camera, gl, size } = useThree();

  useEffect(() => {
    const nextFittedDistance = fitCameraDistance(
      size.width / size.height,
      layout,
    );
    const resolution = resolveCameraFit({
      currentDistance: camera.position.distanceTo(BOARD_TARGET),
      nextFittedDistance,
      previousFittedDistance: appliedFitDistances.get(camera) ?? null,
    });

    if (resolution.shouldApplyFit) {
      const offset = camera.position.clone().sub(BOARD_TARGET);

      if (offset.lengthSq() === 0) {
        offset.copy(CAMERA_HOME);
      }

      camera.position
        .copy(BOARD_TARGET)
        .add(offset.setLength(resolution.distance));
      appliedFitDistances.set(camera, resolution.fittedDistance);
    }

    camera.updateProjectionMatrix();

    if (import.meta.env.DEV) {
      gl.domElement.dataset.cameraFitDistance = nextFittedDistance.toFixed(4);
    }

    exposeCameraDistance(gl.domElement, camera);
  }, [camera, gl, layout, size.height, size.width]);

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
  const coarsePointer = useCoarsePointer();
  const { camera, gl, size } = useThree();
  const updateExposedDistance = useCallback(
    () => exposeCameraDistance(gl.domElement, camera),
    [camera, gl],
  );

  useEffect(() => {
    if (!command || lastCommand.current === command.id || !controls.current) {
      return;
    }

    lastCommand.current = command.id;

    const target = controls.current.target.clone();
    const offset = camera.position.clone().sub(target);

    if (command.action === 'reset') {
      const fittedDistance = fitCameraDistance(
        size.width / size.height,
        layout,
      );

      camera.position.copy(CAMERA_HOME).setLength(fittedDistance);
      controls.current.target.copy(BOARD_TARGET);
      appliedFitDistances.set(camera, fittedDistance);
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
    updateExposedDistance();
  }, [camera, command, layout, size.height, size.width, updateExposedDistance]);

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
      zoomSpeed={orbitZoomSpeed(coarsePointer)}
    />
  );
}
