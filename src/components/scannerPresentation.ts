const floorOf = (cell: number) => Math.floor(cell / 9);

export const getInactiveScannerFloors = (activeFloor: number) =>
  [0, 1, 2].filter((floor) => floor !== activeFloor);

export const getCompletedCrossFloorLines = (completedLines: number[][]) =>
  completedLines.filter(
    (line) => new Set(line.map((cell) => floorOf(cell))).size > 1,
  );

export const getCompletedCrossFloorCells = (completedLines: number[][]) =>
  new Set(getCompletedCrossFloorLines(completedLines).flat());
