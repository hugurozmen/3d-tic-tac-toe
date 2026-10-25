namespace TicTacube.Core
{
    /// <summary>
    /// AI personality: a multiplier profile layered over the Lines
    /// heuristics (design review §4.4 v2). The Default profile equals the
    /// baseline constants exactly, so the web move-parity claim holds
    /// whenever no personality is selected (x * 1.0 is IEEE-exact).
    /// Personalities are Unity-only and only shape the Lines ruleset;
    /// Classic play is unchanged under every profile.
    /// </summary>
    public sealed class AiPersonality
    {
        public string Id = "default";

        /// <summary>Weight of the rival-line penalty in board scoring.</summary>
        public double RivalWeightMul = 1.0;

        /// <summary>Weight of threat blocking and rival-threat pressure.</summary>
        public double DefenseMul = 1.0;

        /// <summary>Weight of the own-threat creation bonus.</summary>
        public double CreatesThreatsMul = 1.0;

        /// <summary>Positional bonus of the center cell (baseline 30).</summary>
        public double CenterBonus = 30.0;

        /// <summary>
        /// Weight of the center-ownership terms in Lines board scoring
        /// (baseline +26 own / -24 rival).
        /// </summary>
        public double CenterOwnershipMul = 1.0;

        /// <summary>
        /// While fewer than this many stones are on the board, the profile
        /// refuses an open center outright (unless it is the only legal
        /// move). Probe-harness finding: the review's "center bonus 30→8"
        /// nudge alone never changed a single Hard/Master move — the center
        /// is usually the tactically forced pick — so the Drifter's visible
        /// identity (and its deliberately exploitable weakness) comes from
        /// this opening rule instead. 0 = baseline, never refuses.
        /// </summary>
        public int CenterAvoidPlies;

        /// <summary>Balanced-only chance of playing a softer top-3 move.</summary>
        public double SofterMoveChance = 0.12;

        // Display strings live here as plain TR/EN pairs; the Game layer
        // formats them through GameStrings (Core stays engine-free).
        public string NameTr = "";
        public string NameEn = "";
        public string IntroTr = "";
        public string IntroEn = "";

        public static readonly AiPersonality Default = new AiPersonality();

        public static readonly AiPersonality Aggressive = new AiPersonality
        {
            Id = "aggressive",
            RivalWeightMul = 0.85,
            CreatesThreatsMul = 1.5,
            NameTr = "Saldırgan",
            NameEn = "Striker",
            IntroTr = "Tehdit üstüne tehdit kurar, savunmayı savsaklar.",
            IntroEn = "Stacks threat on threat and skimps on defense.",
        };

        public static readonly AiPersonality Fortress = new AiPersonality
        {
            Id = "fortress",
            RivalWeightMul = 1.2,
            DefenseMul = 1.2,
            NameTr = "Kale",
            NameEn = "Fortress",
            IntroTr = "Önce senin çizgilerini keser, sabırla bekler.",
            IntroEn = "Cuts your lines first and waits you out.",
        };

        public static readonly AiPersonality Drifter = new AiPersonality
        {
            Id = "drifter",
            CenterBonus = -120.0,
            CenterOwnershipMul = 0.25,
            CenterAvoidPlies = 10,
            NameTr = "Merkezkaç",
            NameEn = "Drifter",
            IntroTr = "Merkezden kaçınır, oyunu kenarlarda kurar.",
            IntroEn = "Shuns the center and builds along the edges.",
        };

        public static readonly AiPersonality Gambler = new AiPersonality
        {
            Id = "gambler",
            SofterMoveChance = 0.35,
            NameTr = "Kumarbaz",
            NameEn = "Gambler",
            IntroTr = "En iyi hamle yerine sürprizi dener — bazen tutar.",
            IntroEn = "Trades the best move for a surprise — sometimes it lands.",
        };

        public static readonly AiPersonality[] All = { Aggressive, Fortress, Drifter, Gambler };

        /// <summary>Profile for a stored id; Default for null or unknown.</summary>
        public static AiPersonality ById(string id)
        {
            foreach (var personality in All)
            {
                if (personality.Id == id)
                {
                    return personality;
                }
            }

            return Default;
        }
    }
}
