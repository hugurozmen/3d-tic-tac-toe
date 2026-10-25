using System;
using System.Collections.Generic;
using System.Globalization;
using TicTacube.Core;

namespace TicTacube.Game
{
    /// <summary>
    /// Three date-seeded goals per day (design review §4.3) — deterministic,
    /// serverless, no reward but the counter and the star streak. State is a
    /// plain pipe-separated string in GamePrefs:
    ///   dateKey|g1,g2,g3|p1,p2,p3|starStreak|bestStarStreak|lastStarKey
    /// </summary>
    public static class DailyGoals
    {
        public sealed class Goal
        {
            public string Id;
            public int Target;
            public string TextTr;
            public string TextEn;

            public string Text()
            {
                return GameStrings.T(TextTr, TextEn);
            }
        }

        public sealed class State
        {
            public string DateKey = "";
            public int[] GoalIndices = new int[3];
            public int[] Progress = new int[3];
            public int StarStreak;
            public int BestStarStreak;
            public string LastStarKey = "";

            public bool DayComplete(Goal[] pool)
            {
                for (int i = 0; i < 3; i += 1)
                {
                    if (Progress[i] < pool[GoalIndices[i]].Target)
                    {
                        return false;
                    }
                }

                return true;
            }
        }

        public sealed class ProgressReport
        {
            public readonly List<Goal> CompletedNow = new List<Goal>();
            public bool DayJustCompleted;
            public int StarStreak;
        }

        public static readonly Goal[] Pool =
        {
            new Goal { Id = "win_balanced", Target = 1, TextTr = "Dengeli veya üstü zorlukta 1 tur kazan", TextEn = "Win a round at Balanced or higher" },
            new Goal { Id = "multi_line", Target = 1, TextTr = "Tek hamlede 2+ çizgi tamamla", TextEn = "Complete 2+ lines in one move" },
            new Goal { Id = "six_lines", Target = 6, TextTr = "Toplam 6 çizgi tamamla", TextEn = "Complete 6 lines in total" },
            new Goal { Id = "classic_win", Target = 1, TextTr = "1 Klasik turu kazan", TextEn = "Win a Classic round" },
            new Goal { Id = "solve_puzzle", Target = 1, TextTr = "Günlük bulmacayı çöz", TextEn = "Solve the daily puzzle" },
            new Goal { Id = "tower_round", Target = 1, TextTr = "1 Kule turu kazan", TextEn = "Win a Tower round" },
            new Goal { Id = "play_rounds", Target = 3, TextTr = "3 tur tamamla", TextEn = "Finish 3 rounds" },
        };

        // ------------------------------------------------------------------
        // State persistence
        // ------------------------------------------------------------------

        public static State Load(DateTime now)
        {
            var state = Parse(GamePrefs.DailyGoalsRaw);
            string today = Puzzles.DateKeyFor(now);

            if (state.DateKey != today)
            {
                // A new day: pick today's three goals; streak bookkeeping
                // survives (the streak itself resets lazily when a day was
                // missed, checked at star time).
                int id = Puzzles.IdFor(now);
                state.DateKey = today;
                state.GoalIndices = PickGoals(id);
                state.Progress = new int[3];
                Save(state);
            }

            return state;
        }

        /// <summary>Three distinct pool indices, deterministic per day id.</summary>
        private static int[] PickGoals(int dayId)
        {
            var indices = new List<int>();
            int cursor = dayId * 7919; // prime stride walks the pool evenly

            while (indices.Count < 3)
            {
                int candidate = Math.Abs(cursor) % Pool.Length;

                if (!indices.Contains(candidate))
                {
                    indices.Add(candidate);
                }

                cursor = cursor / 3 + 17 + indices.Count * 31 + dayId;
            }

            return indices.ToArray();
        }

        private static State Parse(string raw)
        {
            var state = new State();

            if (string.IsNullOrEmpty(raw))
            {
                return state;
            }

            var parts = raw.Split('|');

            if (parts.Length < 6)
            {
                return state;
            }

            state.DateKey = parts[0];
            state.GoalIndices = ParseTriple(parts[1]);
            state.Progress = ParseTriple(parts[2]);
            int.TryParse(parts[3], NumberStyles.Integer, CultureInfo.InvariantCulture, out state.StarStreak);
            int.TryParse(parts[4], NumberStyles.Integer, CultureInfo.InvariantCulture, out state.BestStarStreak);
            state.LastStarKey = parts[5];

            for (int i = 0; i < 3; i += 1)
            {
                if (state.GoalIndices[i] < 0 || state.GoalIndices[i] >= Pool.Length)
                {
                    return new State();
                }
            }

            return state;
        }

        private static int[] ParseTriple(string raw)
        {
            var result = new int[3];
            var parts = raw.Split(',');

            for (int i = 0; i < 3 && i < parts.Length; i += 1)
            {
                int.TryParse(parts[i], NumberStyles.Integer, CultureInfo.InvariantCulture, out result[i]);
            }

            return result;
        }

        private static void Save(State state)
        {
            GamePrefs.DailyGoalsRaw = state.DateKey
                + "|" + state.GoalIndices[0] + "," + state.GoalIndices[1] + "," + state.GoalIndices[2]
                + "|" + state.Progress[0] + "," + state.Progress[1] + "," + state.Progress[2]
                + "|" + state.StarStreak
                + "|" + state.BestStarStreak
                + "|" + state.LastStarKey;
        }

        // ------------------------------------------------------------------
        // Progress events
        // ------------------------------------------------------------------

        /// <summary>Apply progress to any of today's goals matching the event.</summary>
        public static ProgressReport Report(DateTime now, string goalId, int amount)
        {
            var state = Load(now);
            var report = new ProgressReport();
            bool wasComplete = state.DayComplete(Pool);
            bool changed = false;

            for (int i = 0; i < 3; i += 1)
            {
                var goal = Pool[state.GoalIndices[i]];

                if (goal.Id != goalId || state.Progress[i] >= goal.Target)
                {
                    continue;
                }

                state.Progress[i] = Math.Min(goal.Target, state.Progress[i] + amount);
                changed = true;

                if (state.Progress[i] >= goal.Target)
                {
                    report.CompletedNow.Add(goal);
                }
            }

            if (changed && !wasComplete && state.DayComplete(Pool))
            {
                report.DayJustCompleted = true;
                string yesterday = Puzzles.DateKeyFor(now.AddDays(-1));
                state.StarStreak = state.LastStarKey == yesterday ? state.StarStreak + 1 : 1;
                state.BestStarStreak = Math.Max(state.BestStarStreak, state.StarStreak);
                state.LastStarKey = state.DateKey;
            }

            if (changed)
            {
                Save(state);
            }

            report.StarStreak = state.StarStreak;
            return report;
        }

        /// <summary>How many of today's goals are done (for the menu label).</summary>
        public static int CompletedCount(DateTime now, out State state)
        {
            state = Load(now);
            int done = 0;

            for (int i = 0; i < 3; i += 1)
            {
                if (state.Progress[i] >= Pool[state.GoalIndices[i]].Target)
                {
                    done += 1;
                }
            }

            return done;
        }
    }
}
