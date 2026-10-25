using TicTacube.Core;

namespace TicTacube.Game
{
    /// <summary>
    /// The 12-step opponent ladder (design review §4.4): each step packages a
    /// difficulty, ruleset and win condition. Steps are conquered in order;
    /// conquered steps stay replayable. Progress persists as a single int.
    /// </summary>
    public static class Ladder
    {
        public sealed class Step
        {
            public int Number;
            public Difficulty Difficulty;
            public Ruleset Ruleset;
            public bool Gravity;
            public bool AiOpens;
            public int TargetWins = 1;
            public int RequiredMargin; // Lines: win by at least this many lines
            public string TitleTr;
            public string TitleEn;
            public string ConditionTr;
            public string ConditionEn;

            public string Title()
            {
                return GameStrings.T(TitleTr, TitleEn);
            }

            public string Condition()
            {
                return GameStrings.T(ConditionTr, ConditionEn);
            }
        }

        public static readonly Step[] Steps =
        {
            new Step { Number = 1, Difficulty = Difficulty.Easy, Ruleset = Ruleset.Lines,
                TitleTr = "Çaylak", TitleEn = "Rookie",
                ConditionTr = "Kolay'a karşı bir Çizgiler turu kazan", ConditionEn = "Win a Lines round vs Easy" },
            new Step { Number = 2, Difficulty = Difficulty.Easy, Ruleset = Ruleset.Classic,
                TitleTr = "İlk Hat", TitleEn = "First Line",
                ConditionTr = "Kolay'a karşı bir Klasik turu kazan", ConditionEn = "Win a Classic round vs Easy" },
            new Step { Number = 3, Difficulty = Difficulty.Balanced, Ruleset = Ruleset.Lines, RequiredMargin = 2,
                TitleTr = "Fark Atan", TitleEn = "Margin Maker",
                ConditionTr = "Dengeli'yi 2+ çizgi farkla yen", ConditionEn = "Beat Balanced by 2+ lines" },
            new Step { Number = 4, Difficulty = Difficulty.Balanced, Ruleset = Ruleset.Lines, Gravity = true,
                TitleTr = "Kule Ustası", TitleEn = "Tower Hand",
                ConditionTr = "Dengeli'ye karşı bir Kule turu kazan", ConditionEn = "Win a Tower round vs Balanced" },
            new Step { Number = 5, Difficulty = Difficulty.Balanced, Ruleset = Ruleset.Classic,
                TitleTr = "Pasta Pazarlığı", TitleEn = "Pie Bargain",
                ConditionTr = "Dengeli'ye karşı Klasik kazan (Pie açık)", ConditionEn = "Win Classic vs Balanced (Pie on)" },
            new Step { Number = 6, Difficulty = Difficulty.Hard, Ruleset = Ruleset.Lines, AiOpens = true,
                TitleTr = "Ters Rüzgâr", TitleEn = "Headwind",
                ConditionTr = "Zor açarken Çizgiler turu kazan", ConditionEn = "Win Lines with Hard opening" },
            new Step { Number = 7, Difficulty = Difficulty.Hard, Ruleset = Ruleset.Lines, Gravity = true,
                TitleTr = "Yüksek Kule", TitleEn = "High Tower",
                ConditionTr = "Zor'a karşı bir Kule turu kazan", ConditionEn = "Win a Tower round vs Hard" },
            new Step { Number = 8, Difficulty = Difficulty.Hard, Ruleset = Ruleset.Classic,
                TitleTr = "Soğukkanlı", TitleEn = "Cold Blood",
                ConditionTr = "Zor'a karşı bir Klasik turu kazan", ConditionEn = "Win a Classic round vs Hard" },
            new Step { Number = 9, Difficulty = Difficulty.Master, Ruleset = Ruleset.Lines,
                TitleTr = "Usta Kapısı", TitleEn = "Master's Gate",
                ConditionTr = "Usta'ya karşı bir Çizgiler turu kazan", ConditionEn = "Win a Lines round vs Master" },
            new Step { Number = 10, Difficulty = Difficulty.Master, Ruleset = Ruleset.Lines, RequiredMargin = 3,
                TitleTr = "Ezici Üstünlük", TitleEn = "Crusher",
                ConditionTr = "Usta'yı 3+ çizgi farkla yen", ConditionEn = "Beat Master by 3+ lines" },
            new Step { Number = 11, Difficulty = Difficulty.Master, Ruleset = Ruleset.Classic,
                TitleTr = "Son Hat", TitleEn = "Last Line",
                ConditionTr = "Usta'ya karşı bir Klasik turu kazan", ConditionEn = "Win a Classic round vs Master" },
            new Step { Number = 12, Difficulty = Difficulty.Master, Ruleset = Ruleset.Lines, TargetWins = 2,
                TitleTr = "Zirve", TitleEn = "The Summit",
                ConditionTr = "Usta'ya karşı 2 galibiyetlik maçı al", ConditionEn = "Win a 2-win match vs Master" },
        };

        /// <summary>Steps conquered so far (0..12).</summary>
        public static int HighestConquered()
        {
            return GamePrefs.LadderProgress;
        }

        /// <summary>A step is playable when every earlier step is conquered.</summary>
        public static bool IsUnlocked(Step step)
        {
            return step.Number <= HighestConquered() + 1;
        }

        /// <summary>Record a conquest; returns true when it advanced progress.</summary>
        public static bool Conquer(Step step)
        {
            if (step.Number != HighestConquered() + 1)
            {
                return false;
            }

            GamePrefs.LadderProgress = step.Number;
            return true;
        }

        /// <summary>Did this finished match satisfy the step's condition?</summary>
        public static bool ConditionMet(Step step, bool humanWonMatch, int humanLines, int rivalLines)
        {
            if (!humanWonMatch)
            {
                return false;
            }

            if (step.RequiredMargin > 0 && humanLines - rivalLines < step.RequiredMargin)
            {
                return false;
            }

            return true;
        }
    }
}
