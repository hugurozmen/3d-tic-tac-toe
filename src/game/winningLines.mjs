export const BOARD_SIZE = 3;
export const CELL_COUNT = BOARD_SIZE ** 3;

const inBounds = ({ x, y, z }) =>
  x >= 0 &&
  y >= 0 &&
  z >= 0 &&
  x < BOARD_SIZE &&
  y < BOARD_SIZE &&
  z < BOARD_SIZE;

const toIndex = ({ x, y, z }) =>
  z * BOARD_SIZE * BOARD_SIZE + y * BOARD_SIZE + x;

const toCoordinate = (index) => {
  const z = Math.floor(index / (BOARD_SIZE * BOARD_SIZE));
  const local = index % (BOARD_SIZE * BOARD_SIZE);
  const y = Math.floor(local / BOARD_SIZE);
  const x = local % BOARD_SIZE;

  return { x, y, z };
};

const directions = [];

for (let x = -1; x <= 1; x += 1) {
  for (let y = -1; y <= 1; y += 1) {
    for (let z = -1; z <= 1; z += 1) {
      if (x === 0 && y === 0 && z === 0) {
        continue;
      }

      const firstNonZero = [x, y, z].find((value) => value !== 0);

      if (firstNonZero === 1) {
        directions.push({ x, y, z });
      }
    }
  }
}

const createWinningLines = () =>
  Array.from({ length: CELL_COUNT }, (_, index) =>
    toCoordinate(index),
  ).flatMap((start) =>
    directions.flatMap((direction) => {
      const previous = {
        x: start.x - direction.x,
        y: start.y - direction.y,
        z: start.z - direction.z,
      };

      if (inBounds(previous)) {
        return [];
      }

      const line = Array.from({ length: BOARD_SIZE }, (_, step) => ({
        x: start.x + direction.x * step,
        y: start.y + direction.y * step,
        z: start.z + direction.z * step,
      }));

      return line.every(inBounds) ? [line.map(toIndex)] : [];
    }),
  );

const lineKey = (line) => [...line].sort((a, b) => a - b).join('-');

export const WINNING_LINES = createWinningLines();

if (
  WINNING_LINES.length !== 49 ||
  new Set(WINNING_LINES.map(lineKey)).size !== 49 ||
  WINNING_LINES.some(
    (line) =>
      line.length !== BOARD_SIZE ||
      new Set(line).size !== BOARD_SIZE ||
      line.some(
        (index) =>
          !Number.isInteger(index) || index < 0 || index >= CELL_COUNT,
      ),
  )
) {
  throw new Error('3D XOX requires exactly 49 unique 3-cell lines.');
}
