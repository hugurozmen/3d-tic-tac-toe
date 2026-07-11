import { toCoordinate } from '../../game/rules';
import type { BoardLayout } from '../../game/boardView';
import { FLOOR_GAP, SPACING } from './geometry';

export const LAYOUT_MORPH_DURATION_MS = 600;

export type FloorMorphTransform = {
  position: [number, number, number];
  rotationX: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const layoutMorphTarget = (layout: BoardLayout) =>
  layout === 'floors' ? 1 : 0;

export const easeLayoutMorph = (progress: number) => {
  const clamped = clamp01(progress);

  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
};

export const interpolateLayoutMorph = (
  start: number,
  target: number,
  elapsedMs: number,
  durationMs = LAYOUT_MORPH_DURATION_MS,
) => {
  if (durationMs <= 0) {
    return target;
  }

  const progress = easeLayoutMorph(elapsedMs / durationMs);

  return start + (target - start) * progress;
};

/**
 * Treats every logical z-layer as one rigid plane. During the explode/collapse
 * transition the plane rotates around X while its center travels from the
 * cube's depth axis to the floors view's height axis. Cells on a plane never
 * converge through the board center.
 */
export const floorMorphTransform = (
  floorIndex: number,
  progress: number,
): FloorMorphTransform => {
  const clamped = clamp01(progress);
  const floorOffset = floorIndex - 1;

  return {
    position: [
      0,
      floorOffset * FLOOR_GAP * clamped || 0,
      floorOffset * SPACING * (1 - clamped) || 0,
    ],
    rotationX: clamped * (Math.PI / 2),
  };
};

export const morphCellPosition = (
  index: number,
  progress: number,
): [number, number, number] => {
  const { x, y, z } = toCoordinate(index);
  const clamped = clamp01(progress);
  const localX = (x - 1) * SPACING;
  const localY = (y - 1) * SPACING;

  if (clamped === 0) {
    return [localX, localY, (z - 1) * SPACING];
  }

  if (clamped === 1) {
    return [localX, (z - 1) * FLOOR_GAP, localY];
  }

  const plane = floorMorphTransform(z, clamped);

  return [
    localX,
    plane.position[1] + localY * Math.cos(plane.rotationX),
    plane.position[2] + localY * Math.sin(plane.rotationX),
  ];
};
