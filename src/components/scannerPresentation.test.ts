import { describe, expect, it } from 'vitest';
import {
  getCompletedCrossFloorCells,
  getCompletedCrossFloorLines,
  getInactiveScannerFloors,
} from './scannerPresentation';

describe('scanner presentation', () => {
  it('shows the two inactive floors alongside the active floor', () => {
    expect(getInactiveScannerFloors(0)).toEqual([1, 2]);
    expect(getInactiveScannerFloors(1)).toEqual([0, 2]);
    expect(getInactiveScannerFloors(2)).toEqual([0, 1]);
  });

  it('keeps only completed lines that cross floors', () => {
    const lines = [
      [0, 1, 2],
      [0, 9, 18],
      [2, 13, 24],
      [18, 19, 20],
    ];

    expect(getCompletedCrossFloorLines(lines)).toEqual([
      [0, 9, 18],
      [2, 13, 24],
    ]);
    expect([...getCompletedCrossFloorCells(lines)]).toEqual([
      0, 9, 18, 2, 13, 24,
    ]);
  });
});
