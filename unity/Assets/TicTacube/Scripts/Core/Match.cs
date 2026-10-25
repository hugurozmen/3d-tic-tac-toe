namespace TicTacube.Core
{
    /// <summary>
    /// Best-of-5 match state. Mirrors src/game/match.ts.
    /// </summary>
    public sealed class MatchState
    {
        public const int TargetWinsDefault = 3;

        public bool IsComplete;
        public Player NextOpener;
        public Player Opener;
        public int RoundNumber;
        public int WinsX;
        public int WinsO;
        public int Draws;
        public int TargetWins = TargetWinsDefault;
        public Player? Winner;

        public static MatchState Create(Player opener = Player.X)
        {
            return new MatchState
            {
                IsComplete = false,
                NextOpener = Rules.GetOtherPlayer(opener),
                Opener = opener,
                RoundNumber = 1,
                WinsX = 0,
                WinsO = 0,
                Draws = 0,
                TargetWins = TargetWinsDefault,
                Winner = null,
            };
        }

        public int Wins(Player player)
        {
            return player == Player.X ? WinsX : WinsO;
        }

        /// <summary>Record a finished round. Draws do not count toward the target.</summary>
        public void RecordRound(Player? winner, bool isDraw)
        {
            if (IsComplete)
            {
                return;
            }

            if (winner == Player.X)
            {
                WinsX += 1;
            }
            else if (winner == Player.O)
            {
                WinsO += 1;
            }
            else if (isDraw)
            {
                Draws += 1;
            }

            Winner = WinsX >= TargetWins ? Player.X : WinsO >= TargetWins ? (Player?)Player.O : null;
            IsComplete = Winner != null;
        }

        /// <summary>Advance to the next round, alternating the opener.</summary>
        public void AdvanceRound()
        {
            Opener = NextOpener;
            NextOpener = Rules.GetOtherPlayer(Opener);
            RoundNumber += 1;
        }

        /// <summary>
        /// When the Classic Pie Rule swaps who controls X and O, remap score
        /// and opener buckets so earlier wins stay with the same people.
        /// </summary>
        public void RemapForSideSwap()
        {
            NextOpener = Rules.GetOtherPlayer(NextOpener);
            Opener = Rules.GetOtherPlayer(Opener);
            int winsX = WinsX;
            WinsX = WinsO;
            WinsO = winsX;

            if (Winner != null)
            {
                Winner = Rules.GetOtherPlayer(Winner.Value);
            }
        }
    }
}
