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
        public int Streak;
        public int BestStreak;
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

        private static string StatsKey(Ruleset ruleset, Difficulty difficulty)
        {
            return KeyStatsPrefix + (int)ruleset + "_" + (int)difficulty;
        }

        public static StatsData LoadStats(Ruleset ruleset, Difficulty difficulty)
        {
            string json = PlayerPrefs.GetString(StatsKey(ruleset, difficulty), "");

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

        public static StatsData RecordMatch(Ruleset ruleset, Difficulty difficulty, bool humanWon)
        {
            var stats = LoadStats(ruleset, difficulty);

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

            PlayerPrefs.SetString(StatsKey(ruleset, difficulty), JsonUtility.ToJson(stats));
            PlayerPrefs.Save();
            return stats;
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
