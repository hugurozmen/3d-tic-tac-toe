using System;
using TicTacube.Core;

public static class KomiAudit
{
    public static int Main()
    {
        Console.WriteLine("Lines mirror self-play: opener advantage, current rules vs opening komi");
        Console.WriteLine("(komi: on a tied full board, the NON-opener wins the round)\n");
        Console.WriteLine("| difficulty | games | opener win% (now) | draw% (now) | opener win% (komi) |");
        Console.WriteLine("|---|---:|---:|---:|---:|");

        // Deterministic difficulties collapse to one trajectory in plain
        // mirror play, so every game forces a different opening cell
        // (the same trick as the web harness's forcedOpenings).
        RunSet(Difficulty.Balanced, 400, 11, false);
        RunSet(Difficulty.Balanced, 216, 11, true);
        RunSet(Difficulty.Hard, 216, 23, true);
        RunSet(Difficulty.Master, 108, 37, true);
        return 0;
    }

    private static void RunSet(Difficulty difficulty, int games, int seed, bool forcedOpenings)
    {
        var rng = new Random(seed);
        Func<double> random = rng.NextDouble;
        int openerWins = 0;
        int draws = 0;
        int openerWinsKomi = 0;

        for (int game = 0; game < games; game += 1)
        {
            var opener = game % 2 == 0 ? Player.X : Player.O;
            var board = Rules.CreateBoard();
            var turn = opener;

            if (forcedOpenings)
            {
                board[(game / 2) % 27] = turn;
                turn = Rules.GetOtherPlayer(turn);
            }

            while (true)
            {
                var result = Rules.EvaluateLinesBoard(board);

                if (result.IsComplete)
                {
                    if (result.Winner == opener)
                    {
                        openerWins += 1;
                        openerWinsKomi += 1;
                    }
                    else if (result.Winner == null)
                    {
                        draws += 1; // komi: non-opener wins -> not an opener win
                    }

                    break;
                }

                var move = Ai.ChooseMove(board, turn, difficulty, Ruleset.Lines, random);
                board[move.Value] = turn;
                turn = Rules.GetOtherPlayer(turn);
            }
        }

        double now = 100.0 * openerWins / (games - draws);      // decisive games only
        double drawPct = 100.0 * draws / games;
        double komi = 100.0 * openerWinsKomi / games;           // every game decisive under komi
        Console.WriteLine("| " + difficulty + (forcedOpenings ? " (zorunlu açılışlar)" : "") + " | " + games
            + " | " + now.ToString("0.0") + "% (karar veren " + (games - draws) + " oyun)"
            + " | " + drawPct.ToString("0.0") + "%"
            + " | " + komi.ToString("0.0") + "% |");
    }
}
