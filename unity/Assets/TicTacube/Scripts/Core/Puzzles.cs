using System;
using System.Collections.Generic;

namespace TicTacube.Core
{
    public enum PuzzleKind
    {
        BestLines,
        MaxLines,
        ClassicWin,
        ClassicWinTwo,
    }

    /// <summary>
    /// A daily single-move puzzle. Boards and rotation mirror
    /// src/game/puzzles.ts exactly, so the Unity build serves the same daily
    /// puzzle as the web build on the same date.
    /// </summary>
    public sealed class DailyPuzzle
    {
        public PuzzleKind Kind;
        public Player?[] Board;
        public Player Mover = Player.X;
        public Ruleset Ruleset;
        public int BestMove = -1;
        public string DateKey = "";
        public int Id;
    }

    public static class Puzzles
    {
        private static readonly DateTime Epoch = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        private static Player?[] BoardWithMarks(params object[] pairs)
        {
            var board = Rules.CreateBoard();

            for (int i = 0; i < pairs.Length; i += 2)
            {
                board[(int)pairs[i]] = (Player)pairs[i + 1];
            }

            return board;
        }

        // ------------------------------------------------------------------
        // Solvers (mirroring puzzles.ts)
        // ------------------------------------------------------------------

        public static int FindClassicWinningMove(Player?[] board, Player player)
        {
            foreach (int move in Rules.GetAvailableMoves(board))
            {
                var next = (Player?[])board.Clone();
                next[move] = player;

                if (Rules.EvaluateClassicBoard(next).Winner == player)
                {
                    return move;
                }
            }

            return -1;
        }

        private static int ScoreDeltaAfterMove(Player?[] board, Player player, int move)
        {
            var rival = Rules.GetOtherPlayer(player);
            int beforeOwn = Rules.GetCompletedLines(board, player).Count;
            int beforeRival = Rules.GetCompletedLines(board, rival).Count;
            var next = (Player?[])board.Clone();
            next[move] = player;
            int afterOwn = Rules.GetCompletedLines(next, player).Count;
            int afterRival = Rules.GetCompletedLines(next, rival).Count;

            return afterOwn - beforeOwn - (afterRival - beforeRival);
        }

        /// <summary>Move completing the most lines (ties by score delta, then index).</summary>
        public static int FindMaxLineMove(Player?[] board, Player player, out int score)
        {
            int bestMove = -1;
            int bestScore = int.MinValue;

            foreach (int move in Rules.GetAvailableMoves(board))
            {
                var next = (Player?[])board.Clone();
                next[move] = player;
                int value = Rules.GetNewCompletedLines(board, next, player).Count * 100
                    + ScoreDeltaAfterMove(board, player, move);

                if (value > bestScore)
                {
                    bestScore = value;
                    bestMove = move;
                }
            }

            score = bestMove < 0 ? 0 : bestScore;
            return bestMove;
        }

        public static int FindBestScoringMove(Player?[] board, Player player, Ruleset ruleset)
        {
            if (ruleset == Ruleset.Classic)
            {
                var classic = Ai.ChooseMove(board, player, Difficulty.Master, Ruleset.Classic, () => 0.5);
                return classic ?? -1;
            }

            int score;
            int maxLineMove = FindMaxLineMove(board, player, out score);

            if (score > 0)
            {
                return maxLineMove;
            }

            var move = Ai.ChooseMove(board, player, Difficulty.Master, Ruleset.Lines, () => 0.5);
            return move ?? -1;
        }

        /// <summary>
        /// A move that wins immediately, or creates a double threat the rival
        /// cannot cover (win in two). -1 when none exists.
        /// </summary>
        public static int FindClassicWinInTwo(Player?[] board, Player player)
        {
            int immediate = FindClassicWinningMove(board, player);

            if (immediate >= 0)
            {
                return immediate;
            }

            var rival = Rules.GetOtherPlayer(player);

            foreach (int move in Rules.GetAvailableMoves(board))
            {
                var next = (Player?[])board.Clone();
                next[move] = player;
                var rivalMoves = Rules.GetAvailableMoves(next);

                if (rivalMoves.Count == 0)
                {
                    continue;
                }

                bool allRepliesLose = true;

                foreach (int rivalMove in rivalMoves)
                {
                    var reply = (Player?[])next.Clone();
                    reply[rivalMove] = rival;

                    if (Rules.EvaluateClassicBoard(reply).IsComplete
                        || FindClassicWinningMove(reply, player) < 0)
                    {
                        allRepliesLose = false;
                        break;
                    }
                }

                if (allRepliesLose)
                {
                    return move;
                }
            }

            return -1;
        }

        // ------------------------------------------------------------------
        // Daily rotation (fixed boards, date-keyed — same as the web build)
        // ------------------------------------------------------------------

        public static string DateKeyFor(DateTime localDate)
        {
            return localDate.Year + "-" + localDate.Month.ToString("00") + "-" + localDate.Day.ToString("00");
        }

        public static int IdFor(DateTime localDate)
        {
            var utcMidnight = new DateTime(localDate.Year, localDate.Month, localDate.Day, 0, 0, 0, DateTimeKind.Utc);
            int id = (int)Math.Floor((utcMidnight - Epoch).TotalDays) + 1;
            return Math.Max(1, id);
        }

        public static DailyPuzzle GetDailyPuzzle(DateTime localDate)
        {
            string dateKey = DateKeyFor(localDate);
            int id = IdFor(localDate);

            switch ((id - 1) % 4)
            {
                case 0:
                    return CreateBestLines(dateKey, id);
                case 1:
                    return CreateMaxLines(dateKey, id);
                case 2:
                    return CreateClassicWin(dateKey, id);
                default:
                    return CreateClassicWinTwo(dateKey, id);
            }
        }

        private static DailyPuzzle CreateBestLines(string dateKey, int id)
        {
            var board = BoardWithMarks(0, Player.X, 1, Player.X, 13, Player.O, 26, Player.O);

            return new DailyPuzzle
            {
                Kind = PuzzleKind.BestLines,
                Board = board,
                Ruleset = Ruleset.Lines,
                BestMove = FindBestScoringMove(board, Player.X, Ruleset.Lines),
                DateKey = dateKey,
                Id = id,
            };
        }

        private static DailyPuzzle CreateMaxLines(string dateKey, int id)
        {
            var board = BoardWithMarks(
                0, Player.X, 2, Player.X, 6, Player.X, 8, Player.X,
                18, Player.X, 20, Player.X, 24, Player.X, 26, Player.X,
                1, Player.O, 3, Player.O, 5, Player.O, 7, Player.O);
            int score;

            return new DailyPuzzle
            {
                Kind = PuzzleKind.MaxLines,
                Board = board,
                Ruleset = Ruleset.Lines,
                BestMove = FindMaxLineMove(board, Player.X, out score),
                DateKey = dateKey,
                Id = id,
            };
        }

        private static DailyPuzzle CreateClassicWin(string dateKey, int id)
        {
            var board = BoardWithMarks(9, Player.X, 10, Player.X, 13, Player.O, 14, Player.O);

            return new DailyPuzzle
            {
                Kind = PuzzleKind.ClassicWin,
                Board = board,
                Ruleset = Ruleset.Classic,
                BestMove = FindClassicWinningMove(board, Player.X),
                DateKey = dateKey,
                Id = id,
            };
        }

        private static DailyPuzzle CreateClassicWinTwo(string dateKey, int id)
        {
            var board = BoardWithMarks(4, Player.X, 15, Player.X, 12, Player.O, 18, Player.O);

            return new DailyPuzzle
            {
                Kind = PuzzleKind.ClassicWinTwo,
                Board = board,
                Ruleset = Ruleset.Classic,
                BestMove = FindClassicWinInTwo(board, Player.X),
                DateKey = dateKey,
                Id = id,
            };
        }
    }
}
