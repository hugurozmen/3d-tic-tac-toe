import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { BOARD_TARGET, CAMERA_HOME } from './board-scene/geometry';
import { SceneContent } from './board-scene/SceneContent';
import type { BoardSceneProps } from './board-scene/types';

export type {
  BoardLayout,
  BoardViewAction,
  BoardViewCommand,
} from '../game/boardView';

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
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);

  useEffect(() => {
    setArmedCell(null);
    setHoveredCell(null);
  }, [props.board, props.disabled, props.layout]);

  return (
    <Canvas
      key={props.layout}
      camera={{ position: [CAMERA_HOME.x, CAMERA_HOME.y, CAMERA_HOME.z], fov: 42 }}
      dpr={[1, 2]}
      gl={{ alpha: false, antialias: true }}
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
