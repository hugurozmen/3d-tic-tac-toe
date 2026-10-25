using System;
using TicTacube.Core;
using UnityEngine;

namespace TicTacube.Game
{
    [Serializable]
    public struct StatsData
    {
        public int Wins;
        public int Losses;
        public int Draws;
        public int Streak;
        public int BestStreak;
    }

    [Serializable]
    public struct DailyPuzzleState
    {
        public string DateKey;
        public bool Attempted;
        public bool Solved;
        public int Streak;
        public int BestStreak;
        public string LastSolvedKey;
    }

    [Serializable]
    public struct SaveState
    {
        public bool Valid;
        public int Stage; // 0 = mid-round, 1 = between rounds
        public int[] Cells; // -1 empty, 0 X, 1 O
        public int CurrentPlayer;
        public int Ruleset;
        public int Difficulty;
        public bool Solo;
        public int HumanPlayer;
        public bool PieResolved;
        public int Opener;
        public int NextOpener;
        public int RoundNumber;
        public int WinsX;
        public int WinsO;
        public int Draws;
        public int TargetWins;
        public bool Gravity;
        public bool Tournament;
    }

    /// <summary>
    /// PlayerPrefs-backed settings, per-difficulty stats, and the
    /// resume-match snapshot. All persistence for the port lives here.
    /// </summary>
    public static class GamePrefs
    {
        private const string KeySound = "tictacube_sound";
        private const string KeyEffects = "tictacube_effects";
        private const string KeyQuickMove = "tictacube_quickmove";
        private const string KeyAnalysis = "tictacube_analysis";
        private const string KeyTurkish = "tictacube_turkish";
        private const string KeyTutorialDone = "tictacube_tutorial_done";
        private const string KeySave = "tictacube_save";
        private const string KeyStatsPrefix = "tictacube_stats_";

        private static bool GetBool(string key, bool fallback)
        {
            return PlayerPrefs.GetInt(key, fallback ? 1 : 0) != 0;
        }

        private static void SetBool(string key, bool value)
        {
            PlayerPrefs.SetInt(key, value ? 1 : 0);
            PlayerPrefs.Save();
        }

        public static bool Sound
        {
            get { return GetBool(KeySound, true); }
            set { SetBool(KeySound, value); }
        }

        public static bool Effects
        {
            get { return GetBool(KeyEffects, true); }
            set { SetBool(KeyEffects, value); }
        }

        /// <summary>true = tap places immediately; false = select then confirm.</summary>
        public static bool QuickMove
        {
            get { return GetBool(KeyQuickMove, false); }
            set { SetBool(KeyQuickMove, value); }
        }

        public static bool Analysis
        {
            get { return GetBool(KeyAnalysis, false); }
            set { SetBool(KeyAnalysis, value); }
        }

        public static bool TutorialDone
        {
            get { return GetBool(KeyTutorialDone, false); }
            set { SetBool(KeyTutorialDone, value); }
        }

        private const string KeyServerUrl = "tictacube_server_url";
        public const string DefaultServerUrl = "ws://127.0.0.1:8787";

        public static string ServerUrl
        {
            get
            {
                string stored = PlayerPrefs.GetString(KeyServerUrl, DefaultServerUrl);
                return string.IsNullOrEmpty(stored) ? DefaultServerUrl : stored;
            }
            set
            {
                PlayerPrefs.SetString(KeyServerUrl, value ?? DefaultServerUrl);
                PlayerPrefs.Save();
            }
        }

        public static bool LoadTurkish(bool deviceDefault)
        {
            return GetBool(KeyTurkish, deviceDefault);
        }

        public static void SaveTurkish(bool turkish)
        {
            SetBool(KeyTurkish, turkish);
        }

        // ------------------------------------------------------------------
        // Stats
        // ------------------------------------------------------------------

        private static string StatsKey(Ruleset ruleset, Difficulty difficulty, bool gravity, bool tournament)
        {
            return KeyStatsPrefix + (int)ruleset + "_" + (int)difficulty
                + (gravity ? "_g" : "") + (tournament ? "_t" : "");
        }

        public static StatsData LoadStats(Ruleset ruleset, Difficulty difficulty, bool gravity, bool tournament = false)
        {
            string json = PlayerPrefs.GetString(StatsKey(ruleset, difficulty, gravity, tournament), "");

            if (string.IsNullOrEmpty(json))
            {
                return new StatsData();
            }

            try
            {
                return JsonUtility.FromJson<StatsData>(json);
            }
            catch (Exception)
            {
                return new StatsData();
            }
        }

        public static StatsData RecordMatch(Ruleset ruleset, Difficulty difficulty, bool gravity, bool tournament, bool humanWon)
        {
            var stats = LoadStats(ruleset, difficulty, gravity, tournament);

            if (humanWon)
            {
                stats.Wins += 1;
                stats.Streak += 1;
                stats.BestStreak = Math.Max(stats.BestStreak, stats.Streak);
            }
            else
            {
                stats.Losses += 1;
                stats.Streak = 0;
            }

            PlayerPrefs.SetString(StatsKey(ruleset, difficulty, gravity, tournament), JsonUtility.ToJson(stats));
            PlayerPrefs.Save();
            return stats;
        }

        /// <summary>A drawn single-round match: counted, but streak survives.</summary>
        public static StatsData RecordDraw(Ruleset ruleset, Difficulty difficulty, bool gravity, bool tournament = false)
        {
            var stats = LoadStats(ruleset, difficulty, gravity, tournament);
            stats.Draws += 1;
            PlayerPrefs.SetString(StatsKey(ruleset, difficulty, gravity, tournament), JsonUtility.ToJson(stats));
            PlayerPrefs.Save();
            return stats;
        }

        // ------------------------------------------------------------------
        // Opening rotation: who opens the next local match.
        // ------------------------------------------------------------------

        private const string KeyNextOpenerO = "tictacube_next_opener_o";

        public static Player TakeNextOpener()
        {
            bool openerIsO = GetBool(KeyNextOpenerO, false);
            SetBool(KeyNextOpenerO, !openerIsO);
            return openerIsO ? Player.O : Player.X;
        }

        // ------------------------------------------------------------------
        // Daily puzzle
        // ------------------------------------------------------------------

        private const string KeyDailyPuzzle = "tictacube_daily_puzzle";

        public static DailyPuzzleState LoadDailyPuzzle()
        {
            string json = PlayerPrefs.GetString(KeyDailyPuzzle, "");

            if (string.IsNullOrEmpty(json))
            {
                return new DailyPuzzleState();
            }

            try
            {
                return JsonUtility.FromJson<DailyPuzzleState>(json);
            }
            catch (Exception)
            {
                return new DailyPuzzleState();
            }
        }

        public static void SaveDailyPuzzle(DailyPuzzleState state)
        {
            PlayerPrefs.SetString(KeyDailyPuzzle, JsonUtility.ToJson(state));
            PlayerPrefs.Save();
        }

        // ------------------------------------------------------------------
        // Achievements + lifetime counters (plain string formats: robust and
        // testable without JsonUtility)
        // ------------------------------------------------------------------

        private const string KeyAchievements = "tictacube_achievements";
        private const string KeyTotalLines = "tictacube_total_lines";
        private const string KeyDailyGoals = "tictacube_daily_goals";

        public static bool HasAchievement(string id)
        {
            string raw = PlayerPrefs.GetString(KeyAchievements, "");
            return ("," + raw + ",").Contains("," + id + ",");
        }

        /// <summary>true when this call newly awarded the achievement.</summary>
        public static bool AwardAchievement(string id)
        {
            if (HasAchievement(id))
            {
                return false;
            }

            string raw = PlayerPrefs.GetString(KeyAchievements, "");
            PlayerPrefs.SetString(KeyAchievements, string.IsNullOrEmpty(raw) ? id : raw + "," + id);
            PlayerPrefs.Save();
            return true;
        }

        public static int TotalLines
        {
            get { return PlayerPrefs.GetInt(KeyTotalLines, 0); }
        }

        public static int AddTotalLines(int count)
        {
            int total = TotalLines + count;
            PlayerPrefs.SetInt(KeyTotalLines, total);
            PlayerPrefs.Save();
            return total;
        }

        public static string DailyGoalsRaw
        {
            get { return PlayerPrefs.GetString(KeyDailyGoals, ""); }
            set
            {
                PlayerPrefs.SetString(KeyDailyGoals, value ?? "");
                PlayerPrefs.Save();
            }
        }

        private const string KeyLadder = "tictacube_ladder";

        /// <summary>Highest conquered ladder step (0..12).</summary>
        public static int LadderProgress
        {
            get { return PlayerPrefs.GetInt(KeyLadder, 0); }
            set
            {
                PlayerPrefs.SetInt(KeyLadder, value);
                PlayerPrefs.Save();
            }
        }

        // ------------------------------------------------------------------
        // Resume snapshot
        // ------------------------------------------------------------------

        public static bool HasSave()
        {
            return PlayerPrefs.HasKey(KeySave);
        }

        public static void WriteSave(SaveState state)
        {
            state.Valid = true;
            PlayerPrefs.SetString(KeySave, JsonUtility.ToJson(state));
            PlayerPrefs.Save();
        }

        public static SaveState ReadSave()
        {
            string json = PlayerPrefs.GetString(KeySave, "");

            if (string.IsNullOrEmpty(json))
            {
                return new SaveState();
            }

            try
            {
                var state = JsonUtility.FromJson<SaveState>(json);

                if (state.Cells == null || state.Cells.Length != Rules.CellCount)
                {
                    return new SaveState();
                }

                return state;
            }
            catch (Exception)
            {
                return new SaveState();
            }
        }

        public static void ClearSave()
        {
            PlayerPrefs.DeleteKey(KeySave);
            PlayerPrefs.Save();
        }
    }
}
