import { Canvas } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { CAMERA_HOME } from './board-scene/geometry';
import { SceneContent } from './board-scene/SceneContent';
import type { BoardSceneProps } from './board-scene/types';

export type {
  BoardLayout,
  BoardViewAction,
  BoardViewCommand,
} from '../game/boardView';

export function BoardScene(props: BoardSceneProps) {
  const [armedCell, setArmedCell] = useState<number | null>(null);

  useEffect(() => {
    setArmedCell(null);
  }, [props.board, props.disabled, props.layout]);

  return (
    <Canvas
      camera={{ position: [CAMERA_HOME.x, CAMERA_HOME.y, CAMERA_HOME.z], fov: 42 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      onPointerMissed={() => setArmedCell(null)}
    >
      <color attach="background" args={[props.theme.background]} />
      <fog attach="fog" args={[props.theme.fog, 7.5, 16]} />
      <SceneContent
        {...props}
        armedCell={armedCell}
        onArmCell={setArmedCell}
      />
    </Canvas>
  );
}
