using System.Collections.Generic;
using TicTacube.Core;

namespace TicTacube.Game
{
    /// <summary>
    /// One-time badges earned from play (design review §4.2). Definitions are
    /// static; earned ids persist via GamePrefs. Event methods return the
    /// defs that were NEWLY earned so the caller can celebrate them.
    /// </summary>
    public static class Achievements
    {
        public sealed class Def
        {
            public string Id;
            public string NameTr;
            public string NameEn;
            public string DescTr;
            public string DescEn;

            public string Name()
            {
                return GameStrings.T(NameTr, NameEn);
            }

            public string Desc()
            {
                return GameStrings.T(DescTr, DescEn);
            }
        }

        public struct RoundSummary
        {
            public bool Solo;
            public bool HumanWon;
            public bool Draw;
            public Ruleset Ruleset;
            public bool Gravity;
            public Difficulty Difficulty;
            public int HumanLines;
            public int MovesPlayed;
            public bool HumanOwnsCenter;
            public bool BehindAt21;
            public bool PieSwapWin;
            public bool MatchComplete;
            public bool HumanWonMatch;
            public int StreakAfterMatch;
        }

        public static readonly Def[] All =
        {
            new Def { Id = "first_line", NameTr = "İlk Çizgi", NameEn = "First Line", DescTr = "İlk 3'lü çizgini tamamla", DescEn = "Complete your first 3-in-a-row" },
            new Def { Id = "double_move", NameTr = "Çifte Darbe", NameEn = "Double Strike", DescTr = "Tek hamlede 2 çizgi tamamla", DescEn = "Complete 2 lines in one move" },
            new Def { Id = "triple_move", NameTr = "Üçlü Şölen", NameEn = "Triple Feast", DescTr = "Tek hamlede 3+ çizgi tamamla", DescEn = "Complete 3+ lines in one move" },
            new Def { Id = "no_center_win", NameTr = "Merkezsiz Zafer", NameEn = "No-Center Win", DescTr = "Merkez hücre sende değilken tur kazan", DescEn = "Win a round without owning the center" },
            new Def { Id = "comeback21", NameTr = "Geri Dönüş", NameEn = "Comeback", DescTr = "21. hamlede gerideyken turu kazan", DescEn = "Win a round after trailing at move 21" },
            new Def { Id = "pie_win", NameTr = "Pastayı Kapan", NameEn = "Pie Grabber", DescTr = "Taraf takası sonrası turu kazan", DescEn = "Win a round after a Pie swap" },
            new Def { Id = "beat_hard", NameTr = "Zor Lokma", NameEn = "Hard Beaten", DescTr = "Zor'a karşı maç kazan", DescEn = "Win a match against Hard" },
            new Def { Id = "beat_master", NameTr = "Ustayı Devir", NameEn = "Master Down", DescTr = "Usta'ya karşı maç kazan", DescEn = "Win a match against Master" },
            new Def { Id = "master_streak3", NameTr = "Usta Serisi", NameEn = "Master Streak", DescTr = "Usta'ya karşı üst üste 3 maç kazan", DescEn = "Win 3 matches in a row against Master" },
            new Def { Id = "ten_lines", NameTr = "Çizgi Yağmuru", NameEn = "Line Storm", DescTr = "Bir turda 10+ çizgi tamamla", DescEn = "Complete 10+ lines in one round" },
            new Def { Id = "master_draw", NameTr = "Kaya Gibi", NameEn = "Solid Rock", DescTr = "Usta'ya karşı beraberliği koru", DescEn = "Hold a draw against Master" },
            new Def { Id = "fast_classic", NameTr = "Yıldırım Zafer", NameEn = "Lightning Win", DescTr = "Klasik'te en çok 7 hamlede kazan", DescEn = "Win Classic in 7 moves or fewer" },
            new Def { Id = "lines_100", NameTr = "Yüzler Kulübü", NameEn = "Century Club", DescTr = "Toplam 100 çizgi tamamla", DescEn = "Complete 100 lines in total" },
            new Def { Id = "all_difficulties", NameTr = "Dört Köşe", NameEn = "Four Corners", DescTr = "Her zorlukta en az bir maç kazan", DescEn = "Win a match at every difficulty" },
            new Def { Id = "puzzle_week", NameTr = "Bulmaca Haftası", NameEn = "Puzzle Week", DescTr = "Günlük bulmacayı 7 gün üst üste çöz", DescEn = "Solve the daily puzzle 7 days in a row" },
            new Def { Id = "online_first", NameTr = "Dünyaya Açıl", NameEn = "Going Online", DescTr = "İlk online maçını tamamla", DescEn = "Finish your first online match" },
        };

        public static bool IsEarned(string id)
        {
            return GamePrefs.HasAchievement(id);
        }

        public static int EarnedCount()
        {
            int count = 0;

            foreach (var def in All)
            {
                if (GamePrefs.HasAchievement(def.Id))
                {
                    count += 1;
                }
            }

            return count;
        }

        private static void Award(string id, List<Def> earned)
        {
            if (!GamePrefs.AwardAchievement(id))
            {
                return;
            }

            foreach (var def in All)
            {
                if (def.Id == id)
                {
                    earned.Add(def);
                    return;
                }
            }
        }

        /// <summary>A human just completed lineCount lines with one move.</summary>
        public static List<Def> OnLinesMove(int lineCount, bool humanMover)
        {
            var earned = new List<Def>();

            if (!humanMover || lineCount <= 0)
            {
                return earned;
            }

            Award("first_line", earned);

            if (lineCount >= 2)
            {
                Award("double_move", earned);
            }

            if (lineCount >= 3)
            {
                Award("triple_move", earned);
            }

            if (GamePrefs.AddTotalLines(lineCount) >= 100)
            {
                Award("lines_100", earned);
            }

            return earned;
        }

        public static List<Def> OnRoundEnd(RoundSummary s)
        {
            var earned = new List<Def>();

            if (!s.Solo)
            {
                return earned;
            }

            if (s.HumanWon)
            {
                if (!s.HumanOwnsCenter)
                {
                    Award("no_center_win", earned);
                }

                if (s.Ruleset == Ruleset.Lines && s.BehindAt21)
                {
                    Award("comeback21", earned);
                }

                if (s.PieSwapWin)
                {
                    Award("pie_win", earned);
                }

                if (s.Ruleset == Ruleset.Lines && s.HumanLines >= 10)
                {
                    Award("ten_lines", earned);
                }

                if (s.Ruleset == Ruleset.Classic && s.MovesPlayed <= 7)
                {
                    Award("fast_classic", earned);
                }
            }

            if (s.Draw && s.Difficulty == Difficulty.Master)
            {
                Award("master_draw", earned);
            }

            if (s.MatchComplete && s.HumanWonMatch)
            {
                if (s.Difficulty == Difficulty.Hard)
                {
                    Award("beat_hard", earned);
                }

                if (s.Difficulty == Difficulty.Master)
                {
                    Award("beat_master", earned);

                    if (s.StreakAfterMatch >= 3)
                    {
                        Award("master_streak3", earned);
                    }
                }

                if (HasWinAtEveryDifficulty())
                {
                    Award("all_difficulties", earned);
                }
            }

            return earned;
        }

        private static bool HasWinAtEveryDifficulty()
        {
            foreach (Difficulty difficulty in new[]
                { Difficulty.Easy, Difficulty.Balanced, Difficulty.Hard, Difficulty.Master })
            {
                bool hasWin = false;

                foreach (Ruleset ruleset in new[] { Ruleset.Lines, Ruleset.Classic })
                {
                    if (GamePrefs.LoadStats(ruleset, difficulty, false).Wins > 0
                        || GamePrefs.LoadStats(ruleset, difficulty, true).Wins > 0)
                    {
                        hasWin = true;
                        break;
                    }
                }

                if (!hasWin)
                {
                    return false;
                }
            }

            return true;
        }

        public static List<Def> OnPuzzleStreak(int streak)
        {
            var earned = new List<Def>();

            if (streak >= 7)
            {
                Award("puzzle_week", earned);
            }

            return earned;
        }

        public static List<Def> OnOnlineMatchComplete()
        {
            var earned = new List<Def>();
            Award("online_first", earned);
            return earned;
        }
    }
}
