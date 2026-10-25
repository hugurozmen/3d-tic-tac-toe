using System;
using System.Collections.Generic;

namespace TicTacube.Core
{
    /// <summary>
    /// Endgame swing summary for the Lines ruleset, shown when six or fewer
    /// cells remain. Mirrors src/game/linesTension.ts.
    /// </summary>
    public sealed class LinesEndgame
    {
        public int RemainingCells;
        public int MaxScoreLines;
        public int MaxBlockLines;
    }

    public static class LinesTension
    {
        /// <summary>
        /// Null outside the final six cells (or on a full board). With
        /// gravity, the swing is computed over legal drops only, while the
        /// "Final N" count stays the true number of empty cells.
        /// </summary>
        public static LinesEndgame Analyze(Player?[] board, Player currentPlayer, bool gravity = false)
        {
            var remaining = Rules.GetAvailableMoves(board);

            if (remaining.Count == 0 || remaining.Count > 6)
            {
                return null;
            }

            var moves = gravity ? Rules.GetGravityMoves(board) : remaining;

            var rival = Rules.GetOtherPlayer(currentPlayer);
            var rivalThreats = Rules.GetLineThreats(board, rival);
            int maxScore = 0;
            int maxBlock = 0;

            foreach (int cell in moves)
            {
                var next = (Player?[])board.Clone();
                next[cell] = currentPlayer;
                maxScore = Math.Max(maxScore, Rules.GetNewCompletedLines(board, next, currentPlayer).Count);

                int blocks = 0;

                foreach (var line in rivalThreats)
                {
                    foreach (int index in line)
                    {
                        if (board[index] == null)
                        {
                            if (index == cell)
                            {
                                blocks += 1;
                            }

                            break;
                        }
                    }
                }

                maxBlock = Math.Max(maxBlock, blocks);
            }

            return new LinesEndgame
            {
                RemainingCells = remaining.Count,
                MaxScoreLines = maxScore,
                MaxBlockLines = maxBlock,
            };
        }
    }
}
