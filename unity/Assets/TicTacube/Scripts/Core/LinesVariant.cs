using System.Collections.Generic;

namespace TicTacube.Core
{
    /// <summary>
    /// Tournament Lines scoring (design review §3.2, mirroring the web
    /// prototype in src/game/linesVariant.ts): lines through the center
    /// count 0.75 instead of 1 (the center participates in 13 of 49 lines,
    /// which is the root of the opener's edge), and a tied full board goes
    /// to the NON-opener (the opening komi — no draws, live comeback target).
    /// </summary>
    public static class LinesVariant
    {
        public const double CenterLineWeight = 0.75;

        /// <summary>Weighted score of a set of completed lines.</summary>
        public static double WeightedScore(List<int[]> completedLines)
        {
            double score = 0;

            foreach (var line in completedLines)
            {
                bool throughCenter = false;

                foreach (int index in line)
                {
                    if (index == Ai.CenterIndex)
                    {
                        throughCenter = true;
                        break;
                    }
                }

                score += throughCenter ? CenterLineWeight : 1.0;
            }

            return score;
        }

        /// <summary>
        /// Tournament verdict for a complete board: higher weighted score
        /// wins; an exact tie goes to whoever did NOT open. Never a draw.
        /// </summary>
        public static Player Verdict(double weightedX, double weightedO, Player opener)
        {
            if (weightedX > weightedO)
            {
                return Player.X;
            }

            if (weightedO > weightedX)
            {
                return Player.O;
            }

            return Rules.GetOtherPlayer(opener);
        }

        /// <summary>"7,5" style display: trims the trailing ".0".</summary>
        public static string Format(double score)
        {
            long quarters = (long)System.Math.Round(score * 4.0);

            if (quarters % 4 == 0)
            {
                return (quarters / 4).ToString();
            }

            return (quarters / 4.0).ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);
        }
    }
}
