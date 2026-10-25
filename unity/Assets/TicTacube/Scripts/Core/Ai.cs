using System;
using System.Collections.Generic;
using System.Linq;

namespace TicTacube.Core
{
    /// <summary>
    /// AI opponent for both rulesets. Faithful port of src/game/ai.ts so the
    /// native build plays the same as the web build. Pure C# — safe to run on
    /// a background thread.
    /// </summary>
    public static class Ai
    {
        public const int CenterIndex = 13;

        /// <summary>
        /// When true, move enumeration is restricted to gravity-legal drops
        /// (Tower mode). Set per ChooseMove call; thread-static so a
        /// background AI task cannot leak the flag into other callers, and
        /// a no-op when false (web parity preserved).
        /// </summary>
        [ThreadStatic]
        private static bool gravityRules;

        /// <summary>
        /// When true (solo Classic with the Pie Rule live), the AI's own
        /// opening avoids handing the responder a free center takeover: it
        /// opens below its own swap thresholds instead. Off by default so
        /// web move parity is preserved.
        /// </summary>
        [ThreadStatic]
        private static bool pieAwareOpening;

        private static List<int> LegalMoves(Player?[] board)
        {
            return gravityRules ? Rules.GetGravityMoves(board) : Rules.GetAvailableMoves(board);
        }

        private static readonly double[] LineWeights = { 0, 4, 34, 420 };

        private static readonly HashSet<int> Corners = new HashSet<int> { 0, 2, 6, 8, 18, 20, 24, 26 };

        private static readonly HashSet<int> MiddleFaceCenters =
            new HashSet<int> { 1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25 };

        private static readonly HashSet<int> EdgeCenters = new HashSet<int> { 4, 10, 12, 14, 16, 22 };

        private sealed class RankedMove
        {
            public int Move;
            public double Score;
        }

        private sealed class LinesMoveAnalysis
        {
            public int BlockedThreats;
            public int CreatesThreats;
            public int DeniedRivalLines;
            public int FutureScoringPaths;
            public int ImmediateLines;
            public int MultiLineBonus;
            public int RivalPathsDenied;
        }

        private sealed class RankedLinesMove
        {
            public int Move;
            public double Score;
            public LinesMoveAnalysis Analysis;
            public int ReplyRisk;
        }

        private static int? TakeRandom(List<int> moves, Func<double> random)
        {
            if (moves.Count == 0)
            {
                return null;
            }

            int index = (int)Math.Floor(random() * moves.Count);

            if (index < 0 || index >= moves.Count)
            {
                index = moves.Count - 1;
            }

            return moves[index];
        }

        private static int? ChooseWeighted(List<RankedMove> ranked, Func<double> random, int maxChoices, double temperature)
        {
            var choices = ranked.Take(maxChoices).ToList();

            if (choices.Count == 0)
            {
                return null;
            }

            double bestScore = choices[0].Score;
            var weights = new double[choices.Count];
            double total = 0;

            for (int index = 0; index < choices.Count; index += 1)
            {
                double rankPenalty = 1.0 / (index + 1);
                weights[index] = Math.Max(0.015, Math.Exp((choices[index].Score - bestScore) / temperature)) * rankPenalty;
                total += weights[index];
            }

            double cursor = random() * total;

            for (int index = 0; index < choices.Count; index += 1)
            {
                cursor -= weights[index];

                if (cursor <= 0)
                {
                    return choices[index].Move;
                }
            }

            return choices[0].Move;
        }

        private static int? FindWinningMove(Player?[] board, Player player)
        {
            foreach (int move in LegalMoves(board))
            {
                var next = (Player?[])board.Clone();
                next[move] = player;

                if (Rules.EvaluateClassicBoard(next).Winner == player)
                {
                    return move;
                }
            }

            return null;
        }

        private static double LineScore(int ownCount, int rivalCount)
        {
            if (ownCount > 0 && rivalCount > 0)
            {
                return 0;
            }

            if (ownCount > 0)
            {
                return LineWeights[ownCount];
            }

            if (rivalCount > 0)
            {
                return -LineWeights[rivalCount] * 1.15;
            }

            return 1;
        }

        private static void CountLine(Player?[] board, int[] line, Player player, Player rival, out int ownCount, out int rivalCount)
        {
            ownCount = 0;
            rivalCount = 0;

            foreach (int index in line)
            {
                if (board[index] == player)
                {
                    ownCount += 1;
                }
                else if (board[index] == rival)
                {
                    rivalCount += 1;
                }
            }
        }

        private static double ScorePosition(Player?[] board, Player player)
        {
            var rival = Rules.GetOtherPlayer(player);
            var terminal = Rules.EvaluateClassicBoard(board);

            if (terminal.Winner == player)
            {
                return 10000;
            }

            if (terminal.Winner == rival)
            {
                return -10000;
            }

            double score = 0;

            foreach (var line in WinningLines.Lines)
            {
                int ownCount, rivalCount;
                CountLine(board, line, player, rival, out ownCount, out rivalCount);
                score += LineScore(ownCount, rivalCount);
            }

            if (board[CenterIndex] == player)
            {
                score += 20;
            }
            else if (board[CenterIndex] == rival)
            {
                score -= 20;
            }

            foreach (int corner in Corners)
            {
                if (board[corner] == player)
                {
                    score += 4;
                }
                else if (board[corner] == rival)
                {
                    score -= 4;
                }
            }

            return score;
        }

        private static List<int> GetCandidateMoves(Player?[] board)
        {
            var moves = LegalMoves(board);

            return moves
                .OrderByDescending(move => move == CenterIndex ? 3 : Corners.Contains(move) ? 2 : 1)
                .ToList();
        }

        private static double ForkScore(Player?[] board, Player player)
        {
            double score = 0;

            foreach (int move in LegalMoves(board))
            {
                var next = (Player?[])board.Clone();
                next[move] = player;
                int threats = Rules.GetLineThreats(next, player).Count;
                score += Math.Max(0, threats - 1) * 18;
            }

            return score;
        }

        private static double PositionalBonus(int move)
        {
            if (move == CenterIndex)
            {
                return 16;
            }

            if (Corners.Contains(move))
            {
                return 7;
            }

            if (MiddleFaceCenters.Contains(move))
            {
                return 4;
            }

            return 0;
        }

        private static double? ScoreTerminal(Player?[] board, Player aiPlayer, int depthRemaining)
        {
            var result = Rules.EvaluateClassicBoard(board);

            if (result.Winner == aiPlayer)
            {
                return 100000 + depthRemaining * 120;
            }

            if (result.Winner == Rules.GetOtherPlayer(aiPlayer))
            {
                return -100000 - depthRemaining * 120;
            }

            if (result.IsDraw)
            {
                return 0;
            }

            return null;
        }

        private static double Minimax(
            Player?[] board,
            Player aiPlayer,
            Player turn,
            int depth,
            int candidateLimit,
            double alpha,
            double beta)
        {
            var terminalScore = ScoreTerminal(board, aiPlayer, depth);

            if (terminalScore != null)
            {
                return terminalScore.Value;
            }

            if (depth <= 0)
            {
                var leafRival = Rules.GetOtherPlayer(aiPlayer);
                return ScorePosition(board, aiPlayer) + ForkScore(board, aiPlayer) - ForkScore(board, leafRival) * 1.18;
            }

            var moves = GetCandidateMoves(board)
                .Select(move =>
                {
                    var next = (Player?[])board.Clone();
                    next[move] = turn;
                    return new RankedMove
                    {
                        Move = move,
                        Score = ScorePosition(next, aiPlayer)
                            + PositionalBonus(move)
                            + ForkScore(next, turn) * (turn == aiPlayer ? 1 : -1.08),
                    };
                })
                .OrderBy(entry => turn == aiPlayer ? -entry.Score : entry.Score)
                .Take(candidateLimit)
                .ToList();

            if (turn == aiPlayer)
            {
                double best = double.NegativeInfinity;

                foreach (var entry in moves)
                {
                    var next = (Player?[])board.Clone();
                    next[entry.Move] = turn;
                    best = Math.Max(
                        best,
                        Minimax(next, aiPlayer, Rules.GetOtherPlayer(turn), depth - 1, candidateLimit, alpha, beta));
                    alpha = Math.Max(alpha, best);

                    if (beta <= alpha)
                    {
                        break;
                    }
                }

                return best;
            }

            double worst = double.PositiveInfinity;

            foreach (var entry in moves)
            {
                var next = (Player?[])board.Clone();
                next[entry.Move] = turn;
                worst = Math.Min(
                    worst,
                    Minimax(next, aiPlayer, Rules.GetOtherPlayer(turn), depth - 1, candidateLimit, alpha, beta));
                beta = Math.Min(beta, worst);

                if (beta <= alpha)
                {
                    break;
                }
            }

            return worst;
        }

        private static double ScoreMove(Player?[] board, int move, Player player, int depth, int candidateLimit)
        {
            var next = (Player?[])board.Clone();
            next[move] = player;

            return Minimax(
                next,
                player,
                Rules.GetOtherPlayer(player),
                depth,
                candidateLimit,
                double.NegativeInfinity,
                double.PositiveInfinity) + PositionalBonus(move);
        }

        private static int LineParticipation(int move)
        {
            int count = 0;

            foreach (var line in WinningLines.Lines)
            {
                if (Array.IndexOf(line, move) >= 0)
                {
                    count += 1;
                }
            }

            return count;
        }

        private static double LinesPositionalBonus(int move)
        {
            if (move == CenterIndex)
            {
                return 30;
            }

            if (Corners.Contains(move))
            {
                return 18;
            }

            if (EdgeCenters.Contains(move))
            {
                return 16;
            }

            if (MiddleFaceCenters.Contains(move))
            {
                return 11;
            }

            return 4;
        }

        private static int CountOpenLinesThroughMove(Player?[] board, int move, Player player)
        {
            var rival = Rules.GetOtherPlayer(player);
            int count = 0;

            foreach (var line in WinningLines.Lines)
            {
                if (Array.IndexOf(line, move) < 0)
                {
                    continue;
                }

                bool open = true;

                foreach (int index in line)
                {
                    if (index != move && board[index] == rival)
                    {
                        open = false;
                        break;
                    }
                }

                if (open)
                {
                    count += 1;
                }
            }

            return count;
        }

        private static LinesMoveAnalysis AnalyzeLinesMove(Player?[] board, int move, Player player)
        {
            var rival = Rules.GetOtherPlayer(player);
            var next = (Player?[])board.Clone();
            next[move] = player;
            int ownThreatsBefore = Rules.GetThreatCells(board, player).Count;
            int ownThreatsAfter = Rules.GetThreatCells(next, player).Count;
            int immediateLines = Rules.GetNewCompletedLines(board, next, player).Count;
            int blockedThreats = 0;

            foreach (var line in Rules.GetLineThreats(board, rival))
            {
                if (Array.IndexOf(line, move) < 0)
                {
                    continue;
                }

                int firstEmpty = -1;

                foreach (int index in line)
                {
                    if (board[index] == null)
                    {
                        firstEmpty = index;
                        break;
                    }
                }

                if (firstEmpty == move)
                {
                    blockedThreats += 1;
                }
            }

            int deniedRivalLines = 0;
            int futureScoringPaths = 0;
            int rivalPathsDenied = 0;

            foreach (var line in WinningLines.Lines)
            {
                if (Array.IndexOf(line, move) < 0)
                {
                    continue;
                }

                int ownCount, rivalCount;
                CountLine(board, line, player, rival, out ownCount, out rivalCount);

                if (rivalCount > 0 && ownCount == 0)
                {
                    deniedRivalLines += rivalCount == 2 ? 0 : rivalCount;
                    rivalPathsDenied += 1;
                }

                if (ownCount > 0 && rivalCount == 0)
                {
                    futureScoringPaths += ownCount + 1;
                }
                else if (ownCount == 0 && rivalCount == 0)
                {
                    futureScoringPaths += 1;
                }
            }

            return new LinesMoveAnalysis
            {
                BlockedThreats = blockedThreats,
                CreatesThreats = Math.Max(0, ownThreatsAfter - ownThreatsBefore),
                DeniedRivalLines = deniedRivalLines,
                FutureScoringPaths = futureScoringPaths,
                ImmediateLines = immediateLines,
                MultiLineBonus = Math.Max(0, immediateLines - 1),
                RivalPathsDenied = rivalPathsDenied,
            };
        }

        private static int GetBestImmediateLineGain(Player?[] board, Player player)
        {
            int best = 0;

            foreach (int move in LegalMoves(board))
            {
                var next = (Player?[])board.Clone();
                next[move] = player;
                best = Math.Max(best, Rules.GetNewCompletedLines(board, next, player).Count);
            }

            return best;
        }

        private static readonly double[] LinesOwnWeights = { 0, 14, 82, 190 };
        private static readonly double[] LinesRivalWeights = { 0, 16, 94, 210 };

        private static double ScoreLinesBoard(Player?[] board, Player player)
        {
            var rival = Rules.GetOtherPlayer(player);
            var result = Rules.EvaluateLinesBoard(board);
            int remaining = result.RemainingCells;
            int lineDiff = result.LineScore(player) - result.LineScore(rival);
            double diffWeight = result.IsComplete
                ? 1100
                : remaining < 6
                    ? 285
                    : remaining < 12
                        ? 225
                        : 165;
            double score = lineDiff * diffWeight;

            if (result.IsComplete)
            {
                if (result.Winner == player)
                {
                    return 120000 + score;
                }

                if (result.Winner == rival)
                {
                    return -120000 + score;
                }

                return score;
            }

            foreach (var line in WinningLines.Lines)
            {
                int ownCount, rivalCount;
                CountLine(board, line, player, rival, out ownCount, out rivalCount);

                if (ownCount > 0 && rivalCount > 0)
                {
                    continue;
                }

                if (ownCount > 0)
                {
                    score += LinesOwnWeights[ownCount];
                }
                else if (rivalCount > 0)
                {
                    score -= LinesRivalWeights[rivalCount] * 1.08;
                }
                else
                {
                    score += 2;
                }
            }

            score += Rules.GetThreatCells(board, player).Count * (remaining < 8 ? 54 : 42);
            score -= Rules.GetThreatCells(board, rival).Count * (remaining < 8 ? 72 : 58);

            if (board[CenterIndex] == player)
            {
                score += 26;
            }
            else if (board[CenterIndex] == rival)
            {
                score -= 24;
            }

            return score;
        }

        private static double ScoreLinesCandidateShallow(Player?[] board, int move, Player player, bool includeReplyRisk = true)
        {
            var rival = Rules.GetOtherPlayer(player);
            var next = (Player?[])board.Clone();
            int beforeOwn = Rules.GetCompletedLines(board, player).Count;
            next[move] = player;
            int afterOwn = Rules.GetCompletedLines(next, player).Count;
            int immediateGain = afterOwn - beforeOwn;
            var analysis = AnalyzeLinesMove(board, move, player);
            int remainingAfter = Rules.GetAvailableMoves(next).Count;
            double endgameMultiplier = remainingAfter < 6 ? 1.45 : remainingAfter < 10 ? 1.22 : 1;
            int replyRisk = includeReplyRisk ? GetBestImmediateLineGain(next, rival) : 0;

            return ScoreLinesBoard(next, player)
                + immediateGain * 270 * endgameMultiplier
                + analysis.ImmediateLines * 170
                + analysis.MultiLineBonus * 260
                + analysis.BlockedThreats * 185 * endgameMultiplier
                + Math.Max(0, analysis.BlockedThreats - 1) * 95
                + analysis.DeniedRivalLines * 34
                + analysis.CreatesThreats * 46
                + analysis.FutureScoringPaths * 12
                + analysis.RivalPathsDenied * 8
                + CountOpenLinesThroughMove(board, move, player) * 11
                + CountOpenLinesThroughMove(board, move, rival) * 8
                + LineParticipation(move) * 5
                + LinesPositionalBonus(move)
                - replyRisk * (remainingAfter < 8 ? 150 : 105);
        }

        private static double ScoreLinesCandidateOrder(Player?[] board, int move, Player player, HashSet<int> rivalThreatCells)
        {
            var next = (Player?[])board.Clone();
            next[move] = player;

            return Rules.GetNewCompletedLines(board, next, player).Count * 520
                + (rivalThreatCells.Contains(move) ? 210 : 0)
                + CountOpenLinesThroughMove(board, move, player) * 14
                + LineParticipation(move) * 6
                + LinesPositionalBonus(move);
        }

        private static List<int> GetLinesCandidateMoves(Player?[] board, Player player)
        {
            var rivalThreatCells = new HashSet<int>(Rules.GetThreatCells(board, Rules.GetOtherPlayer(player)));

            return LegalMoves(board)
                .Select(move => new RankedMove
                {
                    Move = move,
                    Score = ScoreLinesCandidateOrder(board, move, player, rivalThreatCells),
                })
                .OrderByDescending(entry => entry.Score)
                .Select(entry => entry.Move)
                .ToList();
        }

        private static double SearchLinesBoard(
            Player?[] board,
            Player aiPlayer,
            Player turn,
            int depth,
            int candidateLimit,
            double alpha,
            double beta)
        {
            var result = Rules.EvaluateLinesBoard(board);

            if (result.IsComplete || depth <= 0)
            {
                return ScoreLinesBoard(board, aiPlayer);
            }

            var moves = GetLinesCandidateMoves(board, turn).Take(candidateLimit).ToList();

            if (turn == aiPlayer)
            {
                double best = double.NegativeInfinity;

                foreach (int move in moves)
                {
                    var next = (Player?[])board.Clone();
                    next[move] = turn;
                    best = Math.Max(
                        best,
                        SearchLinesBoard(next, aiPlayer, Rules.GetOtherPlayer(turn), depth - 1, candidateLimit, alpha, beta));
                    alpha = Math.Max(alpha, best);

                    if (beta <= alpha)
                    {
                        break;
                    }
                }

                return best;
            }

            double worst = double.PositiveInfinity;

            foreach (int move in moves)
            {
                var next = (Player?[])board.Clone();
                next[move] = turn;
                worst = Math.Min(
                    worst,
                    SearchLinesBoard(next, aiPlayer, Rules.GetOtherPlayer(turn), depth - 1, candidateLimit, alpha, beta));
                beta = Math.Min(beta, worst);

                if (beta <= alpha)
                {
                    break;
                }
            }

            return worst;
        }

        private static double ScoreLinesMove(Player?[] board, int move, Player player, int depth, int candidateLimit)
        {
            var next = (Player?[])board.Clone();
            next[move] = player;
            double shallowScore = ScoreLinesCandidateShallow(board, move, player);

            if (depth <= 0 || Rules.GetAvailableMoves(next).Count == 0)
            {
                return shallowScore;
            }

            return SearchLinesBoard(
                next,
                player,
                Rules.GetOtherPlayer(player),
                depth,
                candidateLimit,
                double.NegativeInfinity,
                double.PositiveInfinity) + shallowScore * 0.35;
        }

        private static bool IsTacticallyAcceptableLinesMove(
            Player?[] board,
            Player player,
            RankedLinesMove candidate,
            RankedLinesMove best)
        {
            if (candidate.Analysis.ImmediateLines < best.Analysis.ImmediateLines)
            {
                return false;
            }

            if (best.Analysis.ImmediateLines == 0 && candidate.Analysis.BlockedThreats < best.Analysis.BlockedThreats)
            {
                return false;
            }

            var rival = Rules.GetOtherPlayer(player);
            var next = (Player?[])board.Clone();
            next[candidate.Move] = player;
            int candidateReplyRisk = GetBestImmediateLineGain(next, rival);

            return candidateReplyRisk <= best.ReplyRisk;
        }

        private static int? GetForcedLinesMove(
            Player?[] board,
            Player player,
            Difficulty difficulty,
            List<RankedLinesMove> ranked)
        {
            if (ranked.Count == 0 || difficulty == Difficulty.Easy)
            {
                return null;
            }

            var best = ranked[0];

            var bestScoringMove = ranked
                .OrderByDescending(entry => entry.Analysis.ImmediateLines)
                .ThenByDescending(entry => entry.Analysis.MultiLineBonus)
                .ThenByDescending(entry => entry.Score)
                .First();

            if (bestScoringMove.Analysis.ImmediateLines > 0
                && best.Analysis.ImmediateLines == 0
                && bestScoringMove.Score >= best.Score - 220
                && IsTacticallyAcceptableLinesMove(board, player, bestScoringMove, best))
            {
                return bestScoringMove.Move;
            }

            var bestBlockingMove = ranked
                .OrderByDescending(entry => entry.Analysis.BlockedThreats)
                .ThenByDescending(entry => entry.Analysis.ImmediateLines)
                .ThenByDescending(entry => entry.Score)
                .First();

            if (best.Analysis.ImmediateLines == 0
                && bestBlockingMove.Analysis.BlockedThreats > best.Analysis.BlockedThreats)
            {
                return bestBlockingMove.Move;
            }

            if (difficulty != Difficulty.Master || best.ReplyRisk == 0)
            {
                return null;
            }

            foreach (var candidate in ranked)
            {
                if (candidate.ReplyRisk < best.ReplyRisk
                    && candidate.Analysis.ImmediateLines >= best.Analysis.ImmediateLines
                    && candidate.Score >= best.Score - 220)
                {
                    return candidate.Move;
                }
            }

            return null;
        }

        private static int? ChooseLinesMove(Player?[] board, Player player, Difficulty difficulty, Func<double> random)
        {
            var moves = LegalMoves(board);

            if (moves.Count == 0)
            {
                return null;
            }

            int depth = difficulty == Difficulty.Hard ? 1 : difficulty == Difficulty.Master ? 2 : 0;
            int candidateLimit = difficulty == Difficulty.Easy ? 7 : difficulty == Difficulty.Master ? 9 : 8;

            var ranked = moves
                .Select(move =>
                {
                    var next = (Player?[])board.Clone();
                    next[move] = player;
                    return new RankedLinesMove
                    {
                        Analysis = AnalyzeLinesMove(board, move, player),
                        Move = move,
                        ReplyRisk = GetBestImmediateLineGain(next, Rules.GetOtherPlayer(player)),
                        Score = ScoreLinesMove(board, move, player, depth, candidateLimit),
                    };
                })
                .OrderByDescending(entry => entry.Score)
                .ToList();

            var forcedMove = GetForcedLinesMove(board, player, difficulty, ranked);

            if (forcedMove != null)
            {
                return forcedMove;
            }

            if (difficulty == Difficulty.Master || difficulty == Difficulty.Hard)
            {
                return ranked.Count > 0 ? ranked[0].Move : TakeRandom(moves, random);
            }

            if (difficulty == Difficulty.Balanced)
            {
                var best = ranked.Count > 0 ? ranked[0] : null;
                RankedLinesMove softerMove = null;

                for (int index = 1; index < Math.Min(3, ranked.Count); index += 1)
                {
                    var candidate = ranked[index];

                    if (best == null || IsTacticallyAcceptableLinesMove(board, player, candidate, best))
                    {
                        softerMove = candidate;
                        break;
                    }
                }

                if (softerMove != null && random() < 0.12)
                {
                    return softerMove.Move;
                }

                return best != null ? best.Move : TakeRandom(moves, random);
            }

            if (random() < 0.1)
            {
                return TakeRandom(moves, random);
            }

            var rankedPlain = ranked
                .Select(entry => new RankedMove { Move = entry.Move, Score = entry.Score })
                .ToList();

            var weighted = ChooseWeighted(rankedPlain, random, Math.Min(7, rankedPlain.Count), 680);

            return weighted != null ? weighted : TakeRandom(moves, random);
        }

        private static readonly int[] ClassicOpeningBook = { CenterIndex, 0, 2, 6, 8, 18, 20, 24, 26 };

        private static int? ChooseClassicMove(Player?[] board, Player player, Difficulty difficulty, Func<double> random)
        {
            var moves = LegalMoves(board);

            if (moves.Count == 0)
            {
                return null;
            }

            var rival = Rules.GetOtherPlayer(player);
            var winningMove = FindWinningMove(board, player);

            if (winningMove != null && (difficulty != Difficulty.Easy || random() < 0.78))
            {
                return winningMove;
            }

            var blockingMove = FindWinningMove(board, rival);

            if (blockingMove != null && (difficulty != Difficulty.Easy || random() < 0.45))
            {
                return blockingMove;
            }

            if (difficulty == Difficulty.Easy && random() < 0.12)
            {
                return TakeRandom(moves, random);
            }

            int movesPlayed = Rules.CellCount - Rules.GetAvailableMoves(board).Count;

            // Pie-aware opening: with the swap rule live, the center (swap
            // value 186) is a gift to the responder. Open under the
            // responder's own threshold instead: Balanced keeps a corner
            // (77 < its 78 threshold); Hard/Master take a face center
            // (40 < 66/54 — the strongest cell nobody swaps for).
            if (pieAwareOpening && movesPlayed == 0 && difficulty != Difficulty.Easy)
            {
                int[] pieOpenings = difficulty == Difficulty.Balanced
                    ? new[] { 0, 2, 6, 8, 18, 20, 24, 26 }
                    : new[] { 4, 10, 12, 14, 16, 22 };

                foreach (int move in pieOpenings)
                {
                    if (board[move] == null && (!gravityRules || Rules.IsGravityLegal(board, move)))
                    {
                        return move;
                    }
                }
            }

            if (difficulty != Difficulty.Easy && movesPlayed <= 1)
            {
                foreach (int move in ClassicOpeningBook)
                {
                    if (board[move] == null && (!gravityRules || Rules.IsGravityLegal(board, move)))
                    {
                        return move;
                    }
                }
            }

            var threatBonus = new Dictionary<int, double>();

            foreach (var threat in Rules.GetLineThreats(board, player))
            {
                foreach (int index in threat)
                {
                    if (board[index] == null)
                    {
                        double current;
                        threatBonus.TryGetValue(index, out current);
                        threatBonus[index] = current + 36;
                        break;
                    }
                }
            }

            foreach (var threat in Rules.GetLineThreats(board, rival))
            {
                foreach (int index in threat)
                {
                    if (board[index] == null)
                    {
                        double current;
                        threatBonus.TryGetValue(index, out current);
                        threatBonus[index] = current + 32;
                        break;
                    }
                }
            }

            int depth = difficulty == Difficulty.Easy
                ? 0
                : difficulty == Difficulty.Balanced
                    ? 1
                    : difficulty == Difficulty.Hard
                        ? 2
                        : 3;
            int candidateLimit = difficulty == Difficulty.Easy
                ? 7
                : difficulty == Difficulty.Balanced
                    ? 8
                    : difficulty == Difficulty.Hard
                        ? 10
                        : 12;

            if (difficulty == Difficulty.Master && moves.Count > 18)
            {
                depth = 2;
                candidateLimit = 9;
            }

            var ranked = GetCandidateMoves(board)
                .Select(move =>
                {
                    double bonus;
                    threatBonus.TryGetValue(move, out bonus);
                    return new RankedMove
                    {
                        Move = move,
                        Score = ScoreMove(board, move, player, depth, candidateLimit) + bonus,
                    };
                })
                .OrderByDescending(entry => entry.Score)
                .ToList();

            if (difficulty == Difficulty.Master || difficulty == Difficulty.Hard)
            {
                return ranked.Count > 0 ? ranked[0].Move : TakeRandom(moves, random);
            }

            if (difficulty == Difficulty.Balanced && ranked.Count > 1 && random() < 0.14)
            {
                return ranked[1].Move;
            }

            if (difficulty == Difficulty.Easy)
            {
                var weighted = ChooseWeighted(ranked, random, Math.Min(7, ranked.Count), 520);
                return weighted != null ? weighted : TakeRandom(moves, random);
            }

            return ranked.Count > 0 ? ranked[0].Move : TakeRandom(moves, random);
        }

        /// <summary>
        /// Classic Pie Rule: should the responding AI swap sides after the
        /// opener's first move?
        /// </summary>
        public static bool ShouldSwapClassicPie(Player?[] board, Difficulty difficulty)
        {
            int movesPlayed = 0;
            int firstMove = -1;

            for (int index = 0; index < board.Length; index += 1)
            {
                if (board[index] != null)
                {
                    movesPlayed += 1;

                    if (firstMove < 0)
                    {
                        firstMove = index;
                    }
                }
            }

            if (movesPlayed != 1)
            {
                return false;
            }

            double value = PositionalBonus(firstMove) * 3
                + LineParticipation(firstMove) * 8
                + (firstMove == CenterIndex ? 34 : 0);

            double threshold = difficulty == Difficulty.Easy
                ? 104
                : difficulty == Difficulty.Balanced
                    ? 78
                    : difficulty == Difficulty.Hard
                        ? 66
                        : 54;

            return value >= threshold;
        }

        /// <summary>Pick the AI's move; null when the board is full.</summary>
        public static int? ChooseMove(
            Player?[] board,
            Player player,
            Difficulty difficulty,
            Ruleset ruleset,
            Func<double> random = null,
            bool gravity = false,
            bool pieAware = false)
        {
            gravityRules = gravity;
            pieAwareOpening = pieAware;

            if (random == null)
            {
                var rng = new Random();
                random = rng.NextDouble;
            }

            try
            {
                return ruleset == Ruleset.Lines
                    ? ChooseLinesMove(board, player, difficulty, random)
                    : ChooseClassicMove(board, player, difficulty, random);
            }
            finally
            {
                gravityRules = false;
                pieAwareOpening = false;
            }
        }
    }
}
