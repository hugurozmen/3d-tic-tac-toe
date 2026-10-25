using System;
using System.Collections.Generic;

namespace TicTacube.Core
{
    public enum Player
    {
        X,
        O,
    }

    public enum Ruleset
    {
        Lines,
        Classic,
    }

    public enum Difficulty
    {
        Easy,
        Balanced,
        Hard,
        Master,
    }

    /// <summary>
    /// Evaluation result for a board. Mirrors GameResult in src/game/rules.ts.
    /// </summary>
    public sealed class GameResult
    {
        public Ruleset Ruleset;
        public Player? Winner;
        public int[] WinningLine = Array.Empty<int>();
        public List<int[]> WinningLines = new List<int[]>();
        public bool IsDraw;
        public bool IsComplete;
        public int LineScoreX;
        public int LineScoreO;
        public List<int[]> CompletedX = new List<int[]>();
        public List<int[]> CompletedO = new List<int[]>();
        public int RemainingCells;

        public int LineScore(Player player)
        {
            return player == Player.X ? LineScoreX : LineScoreO;
        }

        public List<int[]> CompletedLines(Player player)
        {
            return player == Player.X ? CompletedX : CompletedO;
        }
    }

    /// <summary>
    /// Pure game rules for the 3x3x3 board. Mirrors src/game/rules.ts.
    /// The board is a 27-cell array; null = empty.
    /// </summary>
    public static class Rules
    {
        public const int BoardSize = WinningLines.BoardSize;
        public const int CellCount = WinningLines.CellCount;

        public static Player?[] CreateBoard()
        {
            return new Player?[CellCount];
        }

        public static Player GetOtherPlayer(Player player)
        {
            return player == Player.X ? Player.O : Player.X;
        }

        public static List<int> GetAvailableMoves(Player?[] board)
        {
            var moves = new List<int>();

            for (int index = 0; index < board.Length; index += 1)
            {
                if (board[index] == null)
                {
                    moves.Add(index);
                }
            }

            return moves;
        }

        public static int CountMarks(Player?[] board, Player player)
        {
            int count = 0;

            foreach (var cell in board)
            {
                if (cell == player)
                {
                    count += 1;
                }
            }

            return count;
        }

        public static List<int[]> GetCompletedLines(Player?[] board, Player player)
        {
            var lines = new List<int[]>();

            foreach (var line in WinningLines.Lines)
            {
                if (board[line[0]] == player && board[line[1]] == player && board[line[2]] == player)
                {
                    lines.Add(line);
                }
            }

            return lines;
        }

        public static List<int[]> GetNewCompletedLines(Player?[] previous, Player?[] next, Player player)
        {
            var previousKeys = new HashSet<string>();

            foreach (var line in GetCompletedLines(previous, player))
            {
                previousKeys.Add(WinningLines.LineKey(line));
            }

            var fresh = new List<int[]>();

            foreach (var line in GetCompletedLines(next, player))
            {
                if (!previousKeys.Contains(WinningLines.LineKey(line)))
                {
                    fresh.Add(line);
                }
            }

            return fresh;
        }

        public static GameResult EvaluateClassicBoard(Player?[] board)
        {
            var completedX = GetCompletedLines(board, Player.X);
            var completedO = GetCompletedLines(board, Player.O);
            int remaining = GetAvailableMoves(board).Count;

            foreach (var line in WinningLines.Lines)
            {
                var value = board[line[0]];

                if (value != null && value == board[line[1]] && value == board[line[2]])
                {
                    return new GameResult
                    {
                        Ruleset = Ruleset.Classic,
                        Winner = value,
                        WinningLine = line,
                        IsDraw = false,
                        IsComplete = true,
                        LineScoreX = completedX.Count,
                        LineScoreO = completedO.Count,
                        CompletedX = completedX,
                        CompletedO = completedO,
                        RemainingCells = remaining,
                    };
                }
            }

            return new GameResult
            {
                Ruleset = Ruleset.Classic,
                Winner = null,
                IsDraw = remaining == 0,
                IsComplete = remaining == 0,
                LineScoreX = completedX.Count,
                LineScoreO = completedO.Count,
                CompletedX = completedX,
                CompletedO = completedO,
                RemainingCells = remaining,
            };
        }

        public static GameResult EvaluateLinesBoard(Player?[] board)
        {
            var completedX = GetCompletedLines(board, Player.X);
            var completedO = GetCompletedLines(board, Player.O);
            int remaining = GetAvailableMoves(board).Count;
            bool isComplete = remaining == 0;
            Player? winner = null;

            if (isComplete && completedX.Count != completedO.Count)
            {
                winner = completedX.Count > completedO.Count ? Player.X : Player.O;
            }

            return new GameResult
            {
                Ruleset = Ruleset.Lines,
                Winner = winner,
                WinningLines = winner == Player.X ? completedX : winner == Player.O ? completedO : new List<int[]>(),
                IsDraw = isComplete && completedX.Count == completedO.Count,
                IsComplete = isComplete,
                LineScoreX = completedX.Count,
                LineScoreO = completedO.Count,
                CompletedX = completedX,
                CompletedO = completedO,
                RemainingCells = remaining,
            };
        }

        public static GameResult EvaluateBoard(Player?[] board, Ruleset ruleset)
        {
            return ruleset == Ruleset.Lines ? EvaluateLinesBoard(board) : EvaluateClassicBoard(board);
        }

        /// <summary>Lines where the player holds 2 cells and the third is empty.</summary>
        public static List<int[]> GetLineThreats(Player?[] board, Player player)
        {
            var threats = new List<int[]>();

            foreach (var line in WinningLines.Lines)
            {
                int ownCount = 0;
                int emptyCount = 0;

                foreach (int index in line)
                {
                    if (board[index] == player)
                    {
                        ownCount += 1;
                    }
                    else if (board[index] == null)
                    {
                        emptyCount += 1;
                    }
                }

                if (ownCount == BoardSize - 1 && emptyCount == 1)
                {
                    threats.Add(line);
                }
            }

            return threats;
        }

        /// <summary>Empty cells that would complete one of the player's threats.</summary>
        public static List<int> GetThreatCells(Player?[] board, Player player)
        {
            var cells = new HashSet<int>();

            foreach (var line in GetLineThreats(board, player))
            {
                foreach (int index in line)
                {
                    if (board[index] == null)
                    {
                        cells.Add(index);
                        break;
                    }
                }
            }

            return new List<int>(cells);
        }

        public static List<int> GetBlockingCells(Player?[] board, Player player)
        {
            return GetThreatCells(board, GetOtherPlayer(player));
        }

        /// <summary>
        /// Empty cells that complete at least one of the player's threats,
        /// with how many lines each cell would complete — a cell completing
        /// three lines is a very different move from one completing one.
        /// </summary>
        public static Dictionary<int, int> GetThreatCellCounts(Player?[] board, Player player)
        {
            var counts = new Dictionary<int, int>();

            foreach (var line in GetLineThreats(board, player))
            {
                foreach (int index in line)
                {
                    if (board[index] == null)
                    {
                        int current;
                        counts.TryGetValue(index, out current);
                        counts[index] = current + 1;
                        break;
                    }
                }
            }

            return counts;
        }

        /// <summary>Best single-move line gain available to the player.</summary>
        public static int GetBestImmediateLineGain(Player?[] board, Player player)
        {
            int best = 0;

            foreach (int move in GetAvailableMoves(board))
            {
                var next = (Player?[])board.Clone();
                next[move] = player;
                int gained = GetNewCompletedLines(board, next, player).Count;

                if (gained > best)
                {
                    best = gained;
                }
            }

            return best;
        }
    }
}
