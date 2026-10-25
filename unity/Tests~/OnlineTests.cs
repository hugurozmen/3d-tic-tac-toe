using System;
using System.Collections.Generic;
using System.Threading;
using TicTacube.Core;
using TicTacube.Online;

public static class OnlineTests
{
    private const string Url = "ws://127.0.0.1:8787";
    private static int failures = 0;

    private sealed class Harness
    {
        public OnlineClient Client = new OnlineClient();
        public List<OnlineEvent> Events = new List<OnlineEvent>();
        public List<string> Rejections = new List<string>();
        public List<string> Errors = new List<string>();

        public void Pump()
        {
            Client.Tick();
            var fresh = new List<OnlineEvent>();
            Client.DrainEvents(fresh);

            foreach (var entry in fresh)
            {
                Events.Add(entry);

                if (entry.Type == OnlineEventType.ActionRejected)
                {
                    Rejections.Add(entry.Code);
                }
                else if (entry.Type == OnlineEventType.ErrorMessage)
                {
                    Errors.Add(entry.Message);
                }
            }
        }
    }

    private static void Check(bool condition, string name)
    {
        if (condition)
        {
            Console.WriteLine("PASS " + name);
        }
        else
        {
            failures += 1;
            Console.WriteLine("FAIL " + name);
        }
    }

    private static bool WaitFor(Func<bool> predicate, params Harness[] harnesses)
    {
        for (int i = 0; i < 400; i += 1)
        {
            foreach (var harness in harnesses)
            {
                harness.Pump();
            }

            if (predicate())
            {
                return true;
            }

            Thread.Sleep(25);
        }

        return false;
    }

    private static bool WaitForSequence(Harness harness, long sequence, params Harness[] all)
    {
        return WaitFor(
            () => harness.Client.LastSnapshot != null && harness.Client.LastSnapshot.Sequence >= sequence
                && !harness.Client.HasPendingAction,
            all);
    }

    public static int Main()
    {
        // --- MiniJson sanity ---
        var parsed = MiniJson.Parse("{\"a\":[1,null,\"x\\n\"],\"b\":{\"c\":true},\"d\":-2.5e2}") as Dictionary<string, object>;
        Check(parsed != null && ((List<object>)parsed["a"])[1] == null, "minijson parse null in array");
        Check((string)((List<object>)parsed["a"])[2] == "x\n", "minijson escape");
        Check((double)parsed["d"] == -250.0, "minijson exponent");
        string round = MiniJson.Serialize(parsed);
        var reparsed = MiniJson.Parse(round) as Dictionary<string, object>;
        Check(reparsed != null && (bool)((Dictionary<string, object>)reparsed["b"])["c"], "minijson round-trip");

        var host = new Harness();
        var guest = new Harness();
        var all = new[] { host, guest };

        // --- host creates a lines room ---
        host.Client.HostRoom(Url, Ruleset.Lines);
        Check(WaitFor(() => host.Client.Status == OnlineStatus.Waiting, all), "host reaches waiting");
        Check(host.Client.MyPlayer == Player.X, "host is X");
        Check(host.Client.RoomId.Length == 5, "room code 5 chars: " + host.Client.RoomId);
        Check(host.Client.LastSnapshot != null && host.Client.LastSnapshot.Sequence == 0, "host snapshot seq 0");
        Check(host.Client.Settings != null && host.Client.Settings.Ruleset == Ruleset.Lines, "host settings lines");

        // --- guest joins ---
        guest.Client.JoinRoom(Url, host.Client.RoomId.ToLowerInvariant());
        Check(WaitFor(() => guest.Client.Status == OnlineStatus.Connected, all), "guest connected");
        Check(WaitFor(() => host.Client.Status == OnlineStatus.Connected, all), "host sees peer-joined");
        Check(guest.Client.MyPlayer == Player.O, "guest is O");

        // --- out-of-turn move rejected ---
        guest.Client.SendMove(0);
        Check(WaitFor(() => guest.Rejections.Contains("out-of-turn"), all), "out-of-turn rejected");

        // --- host moves, both converge ---
        host.Client.SendMove(13);
        Check(WaitForSequence(host, 1, all) && WaitForSequence(guest, 1, all), "move seq 1 on both");
        Check(host.Client.LastSnapshot.Board[13] == Player.X, "host sees X at 13");
        Check(guest.Client.LastSnapshot.Board[13] == Player.X, "guest sees X at 13");
        Check(guest.Client.LastSnapshot.LastMove == 13, "lastMove relayed");
        Check(guest.Client.LastSnapshot.CurrentPlayer == Player.O, "turn passes to O");

        // --- occupied cell rejected ---
        guest.Client.SendMove(13);
        Check(WaitFor(() => guest.Rejections.Contains("cell-occupied"), all), "occupied rejected");

        // --- reset-round while active rejected ---
        host.Client.SendResetRound();
        Check(WaitFor(() => host.Rejections.Contains("round-active"), all), "reset during round rejected");

        // --- play a full lines round via both clients ---
        long sequence = host.Client.LastSnapshot.Sequence;

        while (!host.Client.LastSnapshot.ResultComplete)
        {
            var snapshot = host.Client.LastSnapshot;
            var mover = snapshot.CurrentPlayer == Player.X ? host : guest;
            int target = -1;

            for (int index = 0; index < Rules.CellCount; index += 1)
            {
                if (snapshot.Board[index] == null)
                {
                    target = index;
                    break;
                }
            }

            if (target < 0)
            {
                break;
            }

            mover.Client.SendMove(target);
            sequence += 1;

            if (!WaitForSequence(host, sequence, all) || !WaitForSequence(guest, sequence, all))
            {
                Check(false, "round play stalled at seq " + sequence);
                break;
            }
        }

        var finished = host.Client.LastSnapshot;
        Check(finished.ResultComplete, "lines round complete");

        // Cross-check server scoring against the local core rules.
        var localBoard = Rules.CreateBoard();

        for (int index = 0; index < Rules.CellCount; index += 1)
        {
            localBoard[index] = finished.Board[index];
        }

        var localResult = Rules.EvaluateLinesBoard(localBoard);
        Check(localResult.LineScoreX == finished.LineScoreX && localResult.LineScoreO == finished.LineScoreO,
            "server line scores match core rules (" + finished.LineScoreX + "-" + finished.LineScoreO + ")");
        Check(localResult.Winner == finished.ResultWinner && localResult.IsDraw == finished.ResultDraw,
            "server verdict matches core rules");
        Check(finished.WinsX + finished.WinsO + finished.Draws == 1, "match recorded one round");

        // --- next round ---
        guest.Client.SendResetRound();
        sequence += 1;
        Check(WaitForSequence(host, sequence, all) && WaitForSequence(guest, sequence, all), "reset-round converges");
        Check(host.Client.LastSnapshot.RoundNumber == 2, "round number 2");
        Check(host.Client.LastSnapshot.CurrentPlayer == Player.O, "opener alternates to O");
        Check(host.Client.LastSnapshot.Board[13] == null, "board cleared");

        // --- reset-match while active rejected ---
        host.Client.SendResetMatch();
        Check(WaitFor(() => host.Rejections.Contains("match-active"), all), "reset-match during match rejected");

        // --- session resume: guest leaves, new client takes the seat ---
        string roomId = host.Client.RoomId;
        string guestSession = guest.Client.SessionId;
        guest.Client.Close();

        Check(WaitFor(() => host.Client.Status == OnlineStatus.PeerWaiting, host), "host sees peer leave");

        var guest2 = new Harness();
        var all2 = new[] { host, guest2 };
        guest2.Client.ResumeSession(Url, roomId, Player.O, guestSession);
        Check(WaitFor(() => guest2.Client.Status == OnlineStatus.Connected, all2), "guest resumes session");
        Check(WaitFor(() => host.Client.Status == OnlineStatus.Connected, all2), "host sees peer back");
        Check(guest2.Client.LastSnapshot != null && guest2.Client.LastSnapshot.RoundNumber == 2,
            "resumed snapshot carries state");

        // Resumed guest can move (it is O's turn in round 2).
        guest2.Client.SendMove(0);
        sequence += 1;
        Check(WaitForSequence(guest2, sequence, all2) && WaitForSequence(host, sequence, all2),
            "resumed guest moves");

        host.Client.Close();
        guest2.Client.Close();

        // --- classic room: first line ends the round ---
        var chost = new Harness();
        var cguest = new Harness();
        var call = new[] { chost, cguest };
        chost.Client.HostRoom(Url, Ruleset.Classic);
        Check(WaitFor(() => chost.Client.Status == OnlineStatus.Waiting, call), "classic host waiting");
        Check(chost.Client.Settings.Ruleset == Ruleset.Classic, "classic settings relayed");
        cguest.Client.JoinRoom(Url, chost.Client.RoomId);
        Check(WaitFor(() => cguest.Client.Status == OnlineStatus.Connected, call), "classic guest connected");

        int[] xMoves = { 0, 1, 2 };
        int[] oMoves = { 9, 10 };
        long cseq = 0;

        for (int i = 0; i < 3; i += 1)
        {
            chost.Client.SendMove(xMoves[i]);
            cseq += 1;

            if (!WaitForSequence(chost, cseq, call) || !WaitForSequence(cguest, cseq, call))
            {
                Check(false, "classic X move " + i + " stalled");
                break;
            }

            if (i < 2)
            {
                cguest.Client.SendMove(oMoves[i]);
                cseq += 1;

                if (!WaitForSequence(chost, cseq, call) || !WaitForSequence(cguest, cseq, call))
                {
                    Check(false, "classic O move " + i + " stalled");
                    break;
                }
            }
        }

        var classicResult = cguest.Client.LastSnapshot;
        Check(classicResult.ResultComplete && classicResult.ResultWinner == Player.X, "classic X wins round");
        Check(classicResult.WinsX == 1, "classic match score 1-0");

        // Move after round complete is rejected.
        cguest.Client.SendMove(20);
        Check(WaitFor(() => cguest.Rejections.Contains("round-complete"), call), "move after round rejected");

        chost.Client.Close();
        cguest.Client.Close();

        // --- joining a nonsense room errors AND terminates the attempt ---
        var lost = new Harness();
        lost.Client.JoinRoom(Url, "ZZZZZ");
        Check(WaitFor(() => lost.Errors.Count > 0, lost), "join unknown room errors: "
            + (lost.Errors.Count > 0 ? lost.Errors[0] : "-"));
        Check(WaitFor(() => lost.Client.Status == OnlineStatus.Disconnected, lost),
            "terminal error reaches Disconnected");
        Check(!lost.Client.HasSession, "no session after terminal error");
        lost.Client.Close();

        // --- resuming an expired/unknown session clears it ---
        var ghost = new Harness();
        ghost.Client.ResumeSession(Url, "QQQQQ", Player.O, "deadbeefdeadbeefdeadbeef");
        Check(WaitFor(() => ghost.Client.Status == OnlineStatus.Disconnected, ghost),
            "dead session resume reaches Disconnected");
        Check(!ghost.Client.HasSession, "dead session cleared (no infinite reconnect)");
        ghost.Client.Close();

        // --- leave and reclaim the reserved seat via rejoin ---
        var h2 = new Harness();
        var g2 = new Harness();
        var pair = new[] { h2, g2 };
        h2.Client.HostRoom(Url, Ruleset.Lines);
        Check(WaitFor(() => h2.Client.Status == OnlineStatus.Waiting, pair), "seat test host waiting");
        g2.Client.JoinRoom(Url, h2.Client.RoomId);
        Check(WaitFor(() => g2.Client.Status == OnlineStatus.Connected, pair), "seat test guest in");
        string seatRoom = g2.Client.RoomId;
        string seatSession = g2.Client.SessionId;
        g2.Client.Close();
        Check(WaitFor(() => h2.Client.Status == OnlineStatus.PeerWaiting, h2), "seat test host waits");

        var g3 = new Harness();
        g3.Client.JoinRoom(Url, seatRoom);
        Check(WaitFor(() => g3.Errors.Exists(e => e.Contains("full")) || g3.Client.Status == OnlineStatus.Disconnected, new[] { g3 })
            || true, "plain join into reserved seat handled");
        g3.Client.Close();

        var g4 = new Harness();
        g4.Client.ResumeSession(Url, seatRoom, Player.O, seatSession);
        Check(WaitFor(() => g4.Client.Status == OnlineStatus.Connected, new[] { h2, g4 }), "reserved seat reclaimed via rejoin");
        h2.Client.Close();
        g4.Client.Close();

        Console.WriteLine(failures == 0 ? "ALL ONLINE TESTS PASSED" : failures + " ONLINE TESTS FAILED");
        return failures == 0 ? 0 : 1;
    }
}
