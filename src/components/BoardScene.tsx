import { Canvas, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BOARD_TARGET, CAMERA_HOME } from './board-scene/geometry';
import { SceneContent } from './board-scene/SceneContent';
import type { BoardSceneProps } from './board-scene/types';

export type {
  BoardLayout,
  BoardViewAction,
  BoardViewCommand,
} from '../game/boardView';

const CONTEXT_RESTORE_TIMEOUT_MS = 1000;
const BORN_LOST_RETRY_DELAY_MS = 120;
const MAX_BORN_LOST_RETRIES = 3;

// Must be a stable reference: r3f re-applies the camera prop on every
// re-render, which would snap user zoom/rotation back to home.
const CAMERA_CONFIG = {
  fov: 42,
  position: [CAMERA_HOME.x, CAMERA_HOME.y, CAMERA_HOME.z] as [
    number,
    number,
    number,
  ],
};

function SceneFirstPaint({ background }: { background: string }) {
  const { camera, gl, invalidate, scene } = useThree();

  useEffect(() => {
    gl.setClearColor(background, 1);
    camera.lookAt(BOARD_TARGET);
    invalidate();

    const frame = window.requestAnimationFrame(() => {
      invalidate();
      gl.render(scene, camera);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [background, camera, gl, invalidate, scene]);

  return null;
}

export function BoardScene(props: BoardSceneProps) {
  const [armedCell, setArmedCell] = useState<number | null>(null);
  const [contextFailure, setContextFailure] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const bornLostRetryCountRef = useRef(0);
  const cleanupContextListenersRef = useRef<() => void>(() => {});

  useEffect(() => {
    setArmedCell(null);
    setHoveredCell(null);
  }, [props.board, props.disabled, props.layout]);

  useEffect(() => {
    bornLostRetryCountRef.current = 0;
    setContextFailure(false);
  }, [generation]);

  useEffect(
    () => () => {
      cleanupContextListenersRef.current();
    },
    [],
  );

  const remountCanvas = useCallback(() => {
    setGeneration((current) => current + 1);
  }, []);

  if (contextFailure) {
    throw new Error('3D board WebGL context could not be restored');
  }

  return (
    <Canvas
      key={generation}
      camera={CAMERA_CONFIG}
      dpr={[1, 2]}
      gl={{ alpha: false, antialias: true }}
      onCreated={({ gl, invalidate }) => {
        cleanupContextListenersRef.current();

        const canvas = gl.domElement;
        let restoreTimer: number | null = null;
        let bornLostTimer: number | null = null;

        const clearRestoreTimer = () => {
          if (restoreTimer === null) {
            return;
          }

          window.clearTimeout(restoreTimer);
          restoreTimer = null;
        };

        const clearBornLostTimer = () => {
          if (bornLostTimer === null) {
            return;
          }

          window.clearTimeout(bornLostTimer);
          bornLostTimer = null;
        };

        const handleContextLost = (event: Event) => {
          event.preventDefault();
          clearRestoreTimer();

          restoreTimer = window.setTimeout(() => {
            restoreTimer = null;
            remountCanvas();
          }, CONTEXT_RESTORE_TIMEOUT_MS);
        };

        const handleContextRestored = () => {
          clearRestoreTimer();
          invalidate();
        };

        canvas.addEventListener('webglcontextlost', handleContextLost);
        canvas.addEventListener('webglcontextrestored', handleContextRestored);

        cleanupContextListenersRef.current = () => {
          clearRestoreTimer();
          clearBornLostTimer();
          canvas.removeEventListener('webglcontextlost', handleContextLost);
          canvas.removeEventListener(
            'webglcontextrestored',
            handleContextRestored,
          );
        };

        if (gl.getContext().isContextLost()) {
          if (bornLostRetryCountRef.current >= MAX_BORN_LOST_RETRIES) {
            setContextFailure(true);
            return;
          }

          bornLostRetryCountRef.current += 1;
          bornLostTimer = window.setTimeout(
            remountCanvas,
            BORN_LOST_RETRY_DELAY_MS,
          );
          return;
        }

        bornLostRetryCountRef.current = 0;
        setContextFailure(false);
      }}
      onPointerMissed={() => setArmedCell(null)}
    >
      <SceneFirstPaint background={props.theme.background} />
      <color attach="background" args={[props.theme.background]} />
      <fog attach="fog" args={[props.theme.fog, 7.5, 16]} />
      <SceneContent
        {...props}
        armedCell={armedCell}
        hoveredCell={hoveredCell}
        onArmCell={setArmedCell}
        onHoverCell={setHoveredCell}
      />
    </Canvas>
  );
}
