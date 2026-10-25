using System;
using System.Collections.Generic;

namespace TicTacube.Core
{
    /// <summary>
    /// Generates the 49 unique 3-cell winning lines of the 3x3x3 board.
    /// Mirrors src/game/winningLines.mjs from the web build.
    /// </summary>
    public static class WinningLines
    {
        public const int BoardSize = 3;
        public const int CellCount = BoardSize * BoardSize * BoardSize;

        public static readonly int[][] Lines = CreateLines();

        public static int ToIndex(int x, int y, int z)
        {
            return z * BoardSize * BoardSize + y * BoardSize + x;
        }

        public static void ToCoordinate(int index, out int x, out int y, out int z)
        {
            z = index / (BoardSize * BoardSize);
            int local = index % (BoardSize * BoardSize);
            y = local / BoardSize;
            x = local % BoardSize;
        }

        private static bool InBounds(int x, int y, int z)
        {
            return x >= 0 && y >= 0 && z >= 0 && x < BoardSize && y < BoardSize && z < BoardSize;
        }

        private static int[][] CreateLines()
        {
            var directions = new List<int[]>();

            for (int x = -1; x <= 1; x += 1)
            {
                for (int y = -1; y <= 1; y += 1)
                {
                    for (int z = -1; z <= 1; z += 1)
                    {
                        if (x == 0 && y == 0 && z == 0)
                        {
                            continue;
                        }

                        int firstNonZero = x != 0 ? x : y != 0 ? y : z;

                        if (firstNonZero == 1)
                        {
                            directions.Add(new[] { x, y, z });
                        }
                    }
                }
            }

            var lines = new List<int[]>();

            for (int index = 0; index < CellCount; index += 1)
            {
                int sx, sy, sz;
                ToCoordinate(index, out sx, out sy, out sz);

                foreach (var direction in directions)
                {
                    int px = sx - direction[0];
                    int py = sy - direction[1];
                    int pz = sz - direction[2];

                    if (InBounds(px, py, pz))
                    {
                        continue;
                    }

                    var line = new int[BoardSize];
                    bool valid = true;

                    for (int step = 0; step < BoardSize; step += 1)
                    {
                        int cx = sx + direction[0] * step;
                        int cy = sy + direction[1] * step;
                        int cz = sz + direction[2] * step;

                        if (!InBounds(cx, cy, cz))
                        {
                            valid = false;
                            break;
                        }

                        line[step] = ToIndex(cx, cy, cz);
                    }

                    if (valid)
                    {
                        lines.Add(line);
                    }
                }
            }

            Validate(lines);

            return lines.ToArray();
        }

        public static string LineKey(int[] line)
        {
            var sorted = (int[])line.Clone();
            Array.Sort(sorted);
            return string.Join("-", sorted);
        }

        private static void Validate(List<int[]> lines)
        {
            if (lines.Count != 49)
            {
                throw new InvalidOperationException("TicTacube requires exactly 49 unique 3-cell lines.");
            }

            var keys = new HashSet<string>();

            foreach (var line in lines)
            {
                if (line.Length != BoardSize)
                {
                    throw new InvalidOperationException("TicTacube lines must have 3 cells.");
                }

                foreach (int index in line)
                {
                    if (index < 0 || index >= CellCount)
                    {
                        throw new InvalidOperationException("TicTacube line index out of range.");
                    }
                }

                keys.Add(LineKey(line));
            }

            if (keys.Count != 49)
            {
                throw new InvalidOperationException("TicTacube requires exactly 49 unique 3-cell lines.");
            }
        }
    }
}
