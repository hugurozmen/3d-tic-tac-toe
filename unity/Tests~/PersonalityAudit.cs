using System;
using TicTacube.Core;

public static class PersonalityAudit
{
    static int Play(Difficulty diff, AiPersonality xProfile, AiPersonality oProfile, Player opener, int seed)
    {
        var board = Rules.CreateBoard();
        var turn = opener;
        var rng = new Random(seed);
        Func<double> random = rng.NextDouble;

        // Hard/Master play deterministically, so force a varied, fair
        // opening: each side gets one random non-center stone.
        for (int k = 0; k < 2; k += 1)
        {
            var open = Rules.GetAvailableMoves(board);
            int pick;
            do { pick = open[rng.Next(open.Count)]; } while (pick == Ai.CenterIndex);
            board[pick] = turn;
            turn = Rules.GetOtherPlayer(turn);
        }

        while (Rules.GetAvailableMoves(board).Count > 0)
        {
            var profile = turn == Player.X ? xProfile : oProfile;
            int? move = Ai.ChooseMove(board, turn, diff, Ruleset.Lines, random, false, false, profile);
            if (move == null) break;
            board[move.Value] = turn;
            turn = Rules.GetOtherPlayer(turn);
        }

        var result = Rules.EvaluateLinesBoard(board);
        int dx = result.LineScore(Player.X) - result.LineScore(Player.O);
        return dx;
    }

    static void Run(string name, Difficulty diff, AiPersonality profile, int rounds)
    {
        int profWins = 0, defWins = 0, draws = 0, totalDiff = 0;
        int defBig = 0, profBig = 0; // wins by 3+ lines

        for (int i = 0; i < rounds; i += 1)
        {
            // Profile plays O; opener alternates. diff>0 means default(X) leads.
            var opener = i % 2 == 0 ? Player.X : Player.O;
            int dx = Play(diff, null, profile, opener, 1000 + i);
            totalDiff += dx;
            if (dx > 0) defWins += 1; else if (dx < 0) profWins += 1; else draws += 1;
            if (dx >= 3) defBig += 1; else if (dx <= -3) profBig += 1;
        }

        Console.WriteLine(name + " @" + diff + ": profile wins " + profWins + "/" + rounds
            + " (default " + defWins + ", draws " + draws + "), avg lineDiff for default: "
            + ((double)totalDiff / rounds).ToString("0.00")
            + ", 3+ margin wins: default " + defBig + " / profile " + profBig);
    }

    public static void Main()
    {
        int n = 120;
        string focus = Environment.GetEnvironmentVariable("AUDIT_FOCUS");

        if (focus == "master")
        {
            Run("control (default)", Difficulty.Master, null, n);
            Run("aggressive", Difficulty.Master, AiPersonality.Aggressive, n);
            Run("drifter", Difficulty.Master, AiPersonality.Drifter, n);
            Run("fortress", Difficulty.Master, AiPersonality.Fortress, n);
            Run("gambler", Difficulty.Master, AiPersonality.Gambler, n);
            return;
        }

        Run("control (default)", Difficulty.Balanced, null, n);
        Run("gambler", Difficulty.Balanced, AiPersonality.Gambler, n);
        Run("fortress", Difficulty.Balanced, AiPersonality.Fortress, n);
        Run("control (default)", Difficulty.Hard, null, n);
        Run("aggressive", Difficulty.Hard, AiPersonality.Aggressive, n);
        Run("control (default)", Difficulty.Master, null, n);
        Run("drifter", Difficulty.Master, AiPersonality.Drifter, n);
        Run("fortress", Difficulty.Master, AiPersonality.Fortress, n);
    }
}
