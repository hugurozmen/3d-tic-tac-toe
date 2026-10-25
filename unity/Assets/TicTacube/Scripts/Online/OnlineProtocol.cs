using System.Collections.Generic;
using TicTacube.Core;

namespace TicTacube.Online
{
    /// <summary>
    /// Room settings as advertised by the host. Online Classic keeps the Pie
    /// Rule off (the server rejects anything else).
    /// </summary>
    public sealed class OnlineRoomSettings
    {
        public Ruleset Ruleset = Ruleset.Lines;

        public static OnlineRoomSettings FromJson(object value)
        {
            var map = value as Dictionary<string, object>;

            if (map == null)
            {
                return null;
            }

            var settings = new OnlineRoomSettings();
            object ruleset;

            if (map.TryGetValue("ruleset", out ruleset) && (ruleset as string) == "classic")
            {
                settings.Ruleset = Ruleset.Classic;
            }

            return settings;
        }
    }

    /// <summary>
    /// The server's authoritative room state. Mirrors createGameSnapshot in
    /// server/online-server.mjs; clients render this and never simulate ahead.
    /// </summary>
    public sealed class OnlineSnapshot
    {
        public Player?[] Board = new Player?[Rules.CellCount];
        public Player CurrentPlayer = Player.X;
        public int LastMove = -1;
        public long Sequence;

        public bool MatchComplete;
        public Player MatchOpener = Player.X;
        public int RoundNumber = 1;
        public int WinsX;
        public int WinsO;
        public int Draws;
        public int TargetWins = 3;
        public Player? MatchWinner;

        public bool ResultComplete;
        public bool ResultDraw;
        public Player? ResultWinner;
        public int LineScoreX;
        public int LineScoreO;

        public int LineScore(Player player)
        {
            return player == Player.X ? LineScoreX : LineScoreO;
        }

        public int Wins(Player player)
        {
            return player == Player.X ? WinsX : WinsO;
        }

        private static Player? ParsePlayer(object value)
        {
            var text = value as string;

            if (text == "X")
            {
                return Player.X;
            }

            if (text == "O")
            {
                return Player.O;
            }

            return null;
        }

        private static int ParseInt(Dictionary<string, object> map, string key, int fallback)
        {
            object value;

            if (map != null && map.TryGetValue(key, out value) && value is double)
            {
                return (int)(double)value;
            }

            return fallback;
        }

        private static bool ParseBool(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) && value is bool && (bool)value;
        }

        private static Dictionary<string, object> ChildMap(Dictionary<string, object> map, string key)
        {
            object value;
            map.TryGetValue(key, out value);
            return value as Dictionary<string, object>;
        }

        public static OnlineSnapshot FromJson(object value)
        {
            var map = value as Dictionary<string, object>;

            if (map == null)
            {
                return null;
            }

            var snapshot = new OnlineSnapshot();

            object boardValue;
            var board = (map.TryGetValue("board", out boardValue) ? boardValue : null) as List<object>;

            if (board == null || board.Count != Rules.CellCount)
            {
                return null;
            }

            for (int index = 0; index < Rules.CellCount; index += 1)
            {
                snapshot.Board[index] = ParsePlayer(board[index]);
            }

            object currentPlayer;
            map.TryGetValue("currentPlayer", out currentPlayer);
            snapshot.CurrentPlayer = ParsePlayer(currentPlayer) ?? Player.X;

            object lastMove;
            snapshot.LastMove = map.TryGetValue("lastMove", out lastMove) && lastMove is double
                ? (int)(double)lastMove
                : -1;
            snapshot.Sequence = ParseInt(map, "sequence", 0);

            var match = ChildMap(map, "match");

            if (match != null)
            {
                snapshot.MatchComplete = ParseBool(match, "isComplete");
                object opener;
                match.TryGetValue("opener", out opener);
                snapshot.MatchOpener = ParsePlayer(opener) ?? Player.X;
                snapshot.RoundNumber = ParseInt(match, "roundNumber", 1);
                snapshot.TargetWins = ParseInt(match, "targetWins", 3);
                object matchWinner;
                match.TryGetValue("winner", out matchWinner);
                snapshot.MatchWinner = ParsePlayer(matchWinner);

                var score = ChildMap(match, "score");
                snapshot.WinsX = ParseInt(score, "X", 0);
                snapshot.WinsO = ParseInt(score, "O", 0);
                snapshot.Draws = ParseInt(score, "draws", 0);
            }

            var result = ChildMap(map, "result");

            if (result != null)
            {
                snapshot.ResultComplete = ParseBool(result, "isComplete");
                snapshot.ResultDraw = ParseBool(result, "isDraw");
                object resultWinner;
                result.TryGetValue("winner", out resultWinner);
                snapshot.ResultWinner = ParsePlayer(resultWinner);

                var lineScores = ChildMap(result, "lineScores");
                snapshot.LineScoreX = ParseInt(lineScores, "X", 0);
                snapshot.LineScoreO = ParseInt(lineScores, "O", 0);
            }

            return snapshot;
        }
    }

    /// <summary>Builders for the client-to-server protocol messages.</summary>
    public static class OnlineMessages
    {
        public static string PlayerName(Player player)
        {
            return player == Player.X ? "X" : "O";
        }

        public static string CreateRoom(Ruleset ruleset)
        {
            return MiniJson.Serialize(new Dictionary<string, object>
            {
                { "type", "create-room" },
                {
                    "settings", new Dictionary<string, object>
                    {
                        { "ruleset", ruleset == Ruleset.Classic ? "classic" : "lines" },
                        { "classicPieRule", false },
                    }
                },
            });
        }

        public static string JoinRoom(string roomId)
        {
            return MiniJson.Serialize(new Dictionary<string, object>
            {
                { "type", "join-room" },
                { "roomId", roomId },
            });
        }

        public static string RejoinRoom(string roomId, Player player, string sessionId)
        {
            return MiniJson.Serialize(new Dictionary<string, object>
            {
                { "type", "rejoin-room" },
                { "roomId", roomId },
                { "player", PlayerName(player) },
                { "sessionId", sessionId },
            });
        }

        public static string Move(string actionId, long expectedSequence, int index, Player player)
        {
            return MiniJson.Serialize(new Dictionary<string, object>
            {
                { "type", "move" },
                { "actionId", actionId },
                { "expectedSequence", expectedSequence },
                { "index", index },
                { "player", PlayerName(player) },
            });
        }

        public static string ResetRound(string actionId, long expectedSequence)
        {
            return MiniJson.Serialize(new Dictionary<string, object>
            {
                { "type", "reset-round" },
                { "actionId", actionId },
                { "expectedSequence", expectedSequence },
            });
        }

        public static string ResetMatch(string actionId, long expectedSequence)
        {
            return MiniJson.Serialize(new Dictionary<string, object>
            {
                { "type", "reset-match" },
                { "actionId", actionId },
                { "expectedSequence", expectedSequence },
            });
        }
    }
}
