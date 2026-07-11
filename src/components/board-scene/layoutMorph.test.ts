import { describe, expect, it } from 'vitest';
import {
  LAYOUT_MORPH_DURATION_MS,
  floorMorphTransform,
  interpolateLayoutMorph,
  layoutMorphTarget,
  morphCellPosition,
} from './layoutMorph';
import { cellPosition } from './geometry';

const distance = (
  first: [number, number, number],
  second: [number, number, number],
) =>
  Math.hypot(
    first[0] - second[0],
    first[1] - second[1],
    first[2] - second[2],
  );

describe('layout morph geometry', () => {
  it('matches the authored cube and floors positions at its endpoints', () => {
    for (let cell = 0; cell < 27; cell += 1) {
      expect(morphCellPosition(cell, 0)).toEqual(cellPosition(cell, 'cube'));
      expect(morphCellPosition(cell, 1)).toEqual(cellPosition(cell, 'floors'));
    }
  });

  it('moves each floor as a rigid plane without a midpoint collapse', () => {
    const sameFloorPairs = [
      [0, 2],
      [3, 7],
      [9, 17],
      [18, 26],
    ] as const;

    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      for (const [first, second] of sameFloorPairs) {
        expect(
          distance(
            morphCellPosition(first, progress),
            morphCellPosition(second, progress),
          ),
        ).toBeCloseTo(
          distance(morphCellPosition(first, 0), morphCellPosition(second, 0)),
          8,
        );
      }
    }

    expect(distance(morphCellPosition(0, 0.5), morphCellPosition(8, 0.5)))
      .toBeGreaterThan(2);
  });

  it('rotates and separates the three plane centers predictably', () => {
    expect(floorMorphTransform(0, 0)).toMatchObject({
      position: [0, 0, -1.08],
      rotationX: 0,
    });
    expect(floorMorphTransform(2, 1).position).toEqual([0, 1.8, 0]);
    expect(floorMorphTransform(1, 0.5).position).toEqual([0, 0, 0]);
  });

  it('eases to either layout over the authored duration', () => {
    expect(layoutMorphTarget('cube')).toBe(0);
    expect(layoutMorphTarget('floors')).toBe(1);
    expect(interpolateLayoutMorph(0, 1, 0)).toBe(0);
    expect(
      interpolateLayoutMorph(0, 1, LAYOUT_MORPH_DURATION_MS / 2),
    ).toBe(0.5);
    expect(
      interpolateLayoutMorph(0, 1, LAYOUT_MORPH_DURATION_MS),
    ).toBe(1);
  });
});
