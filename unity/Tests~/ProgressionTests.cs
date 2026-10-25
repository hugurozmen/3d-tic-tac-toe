using System;
using System.Collections.Generic;
using TicTacube.Core;
using TicTacube.Game;

public static class ProgressionTests
{
    private static int failures = 0;

    private static void Check(bool condition, string name)
    {
        Console.WriteLine((condition ? "PASS " : "FAIL ") + name);
        if (!condition) failures += 1;
    }

    public static int Main()
    {
        // --- achievements: once-only + counters ---
        var first = Achievements.OnLinesMove(1, true);
        Check(first.Count == 1 && first[0].Id == "first_line", "first line awarded once");
        Check(Achievements.OnLinesMove(1, true).Count == 0, "no duplicate award");
        var multi = Achievements.OnLinesMove(3, true);
        Check(multi.Exists(d => d.Id == "double_move") && multi.Exists(d => d.Id == "triple_move"),
            "double+triple from one move");
        Check(Achievements.OnLinesMove(5, false).Count == 0, "AI moves never award");
        Check(GamePrefs.TotalLines == 5, "total lines counter = 5, got " + GamePrefs.TotalLines);
        GamePrefs.AddTotalLines(95);
        var century = Achievements.OnLinesMove(1, true);
        Check(century.Exists(d => d.Id == "lines_100"), "century club at 100");

        var summary = new Achievements.RoundSummary
        {
            Solo = true, HumanWon = true, Draw = false, Ruleset = Ruleset.Classic,
            Difficulty = Difficulty.Master, MovesPlayed = 7, HumanOwnsCenter = false,
            MatchComplete = true, HumanWonMatch = true, StreakAfterMatch = 3,
        };
        var round = Achievements.OnRoundEnd(summary);
        Check(round.Exists(d => d.Id == "fast_classic"), "fast classic");
        Check(round.Exists(d => d.Id == "no_center_win"), "no-center win");
        Check(round.Exists(d => d.Id == "beat_master"), "beat master");
        Check(round.Exists(d => d.Id == "master_streak3"), "master streak 3");
        Check(!round.Exists(d => d.Id == "all_difficulties"), "all-difficulties needs stats");
        Check(Achievements.OnRoundEnd(new Achievements.RoundSummary { Solo = false, HumanWon = true }).Count == 0,
            "duo rounds never award");
        Check(Achievements.OnPuzzleStreak(6).Count == 0 && Achievements.OnPuzzleStreak(7).Count == 1,
            "puzzle week at 7");
        Check(Achievements.OnOnlineMatchComplete().Count == 1 && Achievements.OnOnlineMatchComplete().Count == 0,
            "online first once");

        // --- daily goals: deterministic selection, distinct ---
        var day1 = new DateTime(2026, 3, 10);
        var stateA = DailyGoals.Load(day1);
        var stateB = DailyGoals.Load(day1);
        Check(stateA.GoalIndices[0] == stateB.GoalIndices[0]
            && stateA.GoalIndices[1] == stateB.GoalIndices[1]
            && stateA.GoalIndices[2] == stateB.GoalIndices[2], "same day same goals");
        Check(stateA.GoalIndices[0] != stateA.GoalIndices[1]
            && stateA.GoalIndices[1] != stateA.GoalIndices[2]
            && stateA.GoalIndices[0] != stateA.GoalIndices[2], "three distinct goals");

        bool anyDifferent = false;
        for (int d = 1; d <= 10; d += 1)
        {
            var other = DailyGoals.Load(day1.AddDays(d));
            if (other.GoalIndices[0] != stateA.GoalIndices[0]
                || other.GoalIndices[1] != stateA.GoalIndices[1]
                || other.GoalIndices[2] != stateA.GoalIndices[2])
            {
                anyDifferent = true;
                break;
            }
        }
        Check(anyDifferent, "goal sets vary across days");

        // --- goal progress + day completion + star streak chaining ---
        var day2 = new DateTime(2026, 4, 1);
        var st = DailyGoals.Load(day2);
        bool starSeen = false;
        int completedGoals = 0;

        foreach (var gi in st.GoalIndices)
        {
            var goal = DailyGoals.Pool[gi];
            var report = DailyGoals.Report(day2, goal.Id, goal.Target);
            completedGoals += report.CompletedNow.Count;
            if (report.DayJustCompleted) { starSeen = true; Check(report.StarStreak == 1, "first star streak 1"); }
        }
        Check(completedGoals == 3, "all three goals completed, got " + completedGoals);
        Check(starSeen, "day completion detected");

        var day3 = day2.AddDays(1);
        var st3 = DailyGoals.Load(day3);
        bool star3 = false;
        foreach (var gi in st3.GoalIndices)
        {
            var goal = DailyGoals.Pool[gi];
            var report = DailyGoals.Report(day3, goal.Id, goal.Target);
            if (report.DayJustCompleted) { star3 = true; Check(report.StarStreak == 2, "consecutive star streak 2, got " + report.StarStreak); }
        }
        Check(star3, "second day completed");

        var day5 = day3.AddDays(2); // skipped a day
        var st5 = DailyGoals.Load(day5);
        foreach (var gi in st5.GoalIndices)
        {
            var goal = DailyGoals.Pool[gi];
            var report = DailyGoals.Report(day5, goal.Id, goal.Target);
            if (report.DayJustCompleted) Check(report.StarStreak == 1, "gap resets star streak, got " + report.StarStreak);
        }

        // progress is idempotent past target
        var extra = DailyGoals.Report(day5, "six_lines", 50);
        Check(extra.CompletedNow.Count == 0, "no re-completion past target");

        // --- ladder ---
        Check(Ladder.Steps.Length == 12, "12 ladder steps");
        bool ordered = true;
        for (int i = 0; i < 12; i += 1) if (Ladder.Steps[i].Number != i + 1) ordered = false;
        Check(ordered, "ladder steps numbered 1..12");
        Check(Ladder.HighestConquered() == 0, "ladder starts at 0");
        Check(Ladder.IsUnlocked(Ladder.Steps[0]) && !Ladder.IsUnlocked(Ladder.Steps[1]), "only step 1 unlocked at start");
        Check(!Ladder.Conquer(Ladder.Steps[2]), "cannot conquer out of order");
        Check(Ladder.Conquer(Ladder.Steps[0]) && Ladder.HighestConquered() == 1, "step 1 conquered");
        Check(Ladder.IsUnlocked(Ladder.Steps[1]), "step 2 unlocked after step 1");
        Check(!Ladder.Conquer(Ladder.Steps[0]), "replaying a conquered step doesn't re-advance");
        Check(Ladder.ConditionMet(Ladder.Steps[2], true, 5, 3), "margin 2 met with 5-3");
        Check(!Ladder.ConditionMet(Ladder.Steps[2], true, 4, 3), "margin 2 not met with 4-3");
        Check(!Ladder.ConditionMet(Ladder.Steps[0], false, 9, 0), "losing never meets a condition");

        Console.WriteLine(failures == 0 ? "ALL PROGRESSION TESTS PASSED" : failures + " FAILED");
        return failures == 0 ? 1 - 1 : 1;
    }
}
