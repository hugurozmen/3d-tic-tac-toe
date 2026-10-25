using System;
using TicTacube.Core;

public static class TowerAudit
{
    public static int Main()
    {
        Console.WriteLine("Tower (gravity) mirror self-play: opener advantage");
        Console.WriteLine("| set | games | opener win% (decisive) | draw% | opener overall% (draws=0.5) |");
        Console.WriteLine("|---|---:|---:|---:|---:|");
        Run(Ruleset.Lines, Difficulty.Balanced, 300, 5, false);
        Run(Ruleset.Lines, Difficulty.Hard, 108, 17, true);
        Run(Ruleset.Lines, Difficulty.Master, 54, 29, true);
        Run(Ruleset.Classic, Difficulty.Balanced, 300, 41, false);
        Run(Ruleset.Classic, Difficulty.Hard, 108, 53, true);
        Run(Ruleset.Classic, Difficulty.Master, 54, 61, true);
        return 0;
    }

    private static void Run(Ruleset ruleset, Difficulty difficulty, int games, int seed, bool forced)
    {
        var rng = new Random(seed);
        Func<double> random = rng.NextDouble;
        int openerWins = 0;
        int rivalWins = 0;
        int draws = 0;

        for (int game = 0; game < games; game += 1)
        {
            var opener = game % 2 == 0 ? Player.X : Player.O;
            var board = Rules.CreateBoard();
            var turn = opener;

            if (forced)
            {
                // Nine legal openings in Tower: cycle the floor cells.
                var openings = Rules.GetGravityMoves(board);
                board[openings[(game / 2) % openings.Count]] = turn;
                turn = Rules.GetOtherPlayer(turn);
            }

            while (true)
            {
                var result = Rules.EvaluateBoard(board, ruleset);

                if (result.IsComplete || (ruleset == Ruleset.Classic && result.Winner != null))
                {
                    if (result.Winner == opener) openerWins += 1;
                    else if (result.Winner == null) draws += 1;
                    else rivalWins += 1;
                    break;
                }

                var move = Ai.ChooseMove(board, turn, difficulty, ruleset, random, true);
                board[move.Value] = turn;
                turn = Rules.GetOtherPlayer(turn);
            }
        }

        int decisive = openerWins + rivalWins;
        double dec = decisive == 0 ? 0 : 100.0 * openerWins / decisive;
        double drawPct = 100.0 * draws / games;
        double overall = 100.0 * (openerWins + 0.5 * draws) / games;
        Console.WriteLine("| Kule-" + ruleset + " " + difficulty + (forced ? " (zorunlu)" : "")
            + " | " + games + " | " + dec.ToString("0.0") + "% (" + decisive + ")"
            + " | " + drawPct.ToString("0.0") + "% | " + overall.ToString("0.0") + "% |");
    }
}
