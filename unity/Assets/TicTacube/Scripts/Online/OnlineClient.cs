using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using TicTacube.Core;

namespace TicTacube.Online
{
    public enum OnlineStatus
    {
        Idle,
        Connecting,
        Waiting, // hosting, no guest yet
        Connected,
        PeerWaiting, // in room, peer disconnected
        Reconnecting,
        Disconnected,
    }

    public enum OnlineEventType
    {
        StatusChanged,
        SessionEstablished,
        SnapshotUpdated,
        ActionRejected,
        ErrorMessage,
    }

    public sealed class OnlineEvent
    {
        public OnlineEventType Type;
        public OnlineStatus Status;
        public string Message = "";
        public string Code = "";
        public OnlineSnapshot Snapshot;
        public OnlineRoomSettings Settings;
        public string RoomId = "";
        public Player PlayerMark;
        public string Cause = "";
    }

    /// <summary>
    /// Engine-agnostic WebSocket client for the online room server
    /// (server/online-server.mjs). All network work runs on background tasks;
    /// callers poll <see cref="DrainEvents"/> and <see cref="Tick"/> from
    /// their main loop. The server is authoritative: every accepted action
    /// comes back as a snapshot, which is the only state this client stores.
    ///
    /// Every state mutation that originates from a socket is stamped with the
    /// socket's generation and re-validated under the lock, so a message read
    /// just before Close/HostRoom/JoinRoom replaced the transport can never
    /// poison the next session's state.
    /// </summary>
    public sealed class OnlineClient
    {
        private const double ActionAckTimeoutSeconds = 8.0;
        private static readonly int[] RejoinDelaysMs = { 1000, 2000, 4000 };

        /// <summary>
        /// Origin offered during the handshake. The server only checks it
        /// when ONLINE_ALLOWED_ORIGINS is configured; deployments that serve
        /// native clients should allowlist this value (or use '*').
        /// </summary>
        public static string OriginHeader = "app://tictacube-unity";

        private readonly object gate = new object();
        private readonly ConcurrentQueue<OnlineEvent> events = new ConcurrentQueue<OnlineEvent>();
        private readonly SemaphoreSlim sendLock = new SemaphoreSlim(1, 1);
        private readonly Stopwatch clock = Stopwatch.StartNew();

        private ClientWebSocket socket;
        private int generation;
        private bool closedByUser;
        private bool establishedOnSocket;
        private int rejoinAttempts;

        private string serverUrl = "";
        private string roomId = "";
        private string sessionId = "";
        private Player myPlayer = Player.X;
        private bool hasSession;

        private OnlineStatus status = OnlineStatus.Idle;
        private OnlineRoomSettings settings;
        private OnlineSnapshot lastSnapshot;

        private string pendingActionId;
        private long pendingActionSentAtMs;
        private int actionCounter;

        public OnlineStatus Status
        {
            get { lock (gate) { return status; } }
        }

        public string RoomId
        {
            get { lock (gate) { return roomId; } }
        }

        public string SessionId
        {
            get { lock (gate) { return sessionId; } }
        }

        public Player MyPlayer
        {
            get { lock (gate) { return myPlayer; } }
        }

        public bool HasSession
        {
            get { lock (gate) { return hasSession; } }
        }

        public bool HasPendingAction
        {
            get { lock (gate) { return pendingActionId != null; } }
        }

        public OnlineRoomSettings Settings
        {
            get { lock (gate) { return settings; } }
        }

        public OnlineSnapshot LastSnapshot
        {
            get { lock (gate) { return lastSnapshot; } }
        }

        // ------------------------------------------------------------------
        // Public API (call from the main thread)
        // ------------------------------------------------------------------

        public void HostRoom(string url, Ruleset ruleset)
        {
            StartFresh(url);
            RunConnect(OnlineMessages.CreateRoom(ruleset));
        }

        public void JoinRoom(string url, string code)
        {
            string normalized = (code ?? "").Trim().ToUpperInvariant();
            StartFresh(url);
            RunConnect(OnlineMessages.JoinRoom(normalized));
        }

        /// <summary>
        /// Resume a room session from stored credentials (e.g. after leaving
        /// the room screen). Possession of the private session id authorizes
        /// taking the seat over, even from a socket still closing.
        /// </summary>
        public void ResumeSession(string url, string room, Player player, string session)
        {
            StartFresh(url);

            lock (gate)
            {
                roomId = (room ?? "").Trim().ToUpperInvariant();
                sessionId = session ?? "";
                myPlayer = player;
                hasSession = true;
            }

            RunConnect(OnlineMessages.RejoinRoom(RoomId, player, SessionId));
        }

        /// <summary>Manual reconnect with the stored room session.</summary>
        public void Reconnect()
        {
            string room;
            string session;
            Player player;

            lock (gate)
            {
                if (!hasSession)
                {
                    return;
                }

                closedByUser = false;
                rejoinAttempts = 0;
                room = roomId;
                session = sessionId;
                player = myPlayer;
                pendingActionId = null;
            }

            SetStatus(OnlineStatus.Reconnecting);
            RunConnect(OnlineMessages.RejoinRoom(room, player, session));
        }

        public void SendMove(int index)
        {
            SendAction(sequence => OnlineMessages.Move(NextActionId(), sequence, index, MyPlayer));
        }

        public void SendResetRound()
        {
            SendAction(sequence => OnlineMessages.ResetRound(NextActionId(), sequence));
        }

        public void SendResetMatch()
        {
            SendAction(sequence => OnlineMessages.ResetMatch(NextActionId(), sequence));
        }

        /// <summary>Intentional close: leaves the room and clears the session.</summary>
        public void Close()
        {
            ClientWebSocket toClose;

            lock (gate)
            {
                closedByUser = true;
                generation += 1;
                toClose = socket;
                socket = null;
                hasSession = false;
                establishedOnSocket = false;
                rejoinAttempts = 0;
                roomId = "";
                sessionId = "";
                settings = null;
                lastSnapshot = null;
                pendingActionId = null;
                status = OnlineStatus.Idle;
            }

            DropQueuedEvents();

            if (toClose != null)
            {
                AbortQuietly(toClose);
            }
        }

        /// <summary>Move queued events into the caller's list (main thread).</summary>
        public void DrainEvents(List<OnlineEvent> into)
        {
            OnlineEvent entry;

            while (events.TryDequeue(out entry))
            {
                into.Add(entry);
            }
        }

        /// <summary>Main-loop housekeeping: pending-action ack timeout.</summary>
        public void Tick()
        {
            bool timedOut = false;
            int myGeneration;

            lock (gate)
            {
                myGeneration = generation;

                if (pendingActionId != null
                    && (clock.ElapsedMilliseconds - pendingActionSentAtMs) / 1000.0 > ActionAckTimeoutSeconds)
                {
                    pendingActionId = null;
                    timedOut = true;
                }
            }

            if (timedOut)
            {
                // Mirror the web client: a lost acknowledgement means the
                // transport can't be trusted; drop it and recover via rejoin.
                Emit(new OnlineEvent
                {
                    Type = OnlineEventType.ActionRejected,
                    Code = "ack-timeout",
                    Message = "Action confirmation timed out",
                });
                HandleTransportLoss(null, myGeneration);
            }
        }

        // ------------------------------------------------------------------
        // Connection management
        // ------------------------------------------------------------------

        private void DropQueuedEvents()
        {
            OnlineEvent ignored;

            while (events.TryDequeue(out ignored))
            {
            }
        }

        private void StartFresh(string url)
        {
            ClientWebSocket toClose;

            lock (gate)
            {
                closedByUser = false;
                generation += 1;
                toClose = socket;
                socket = null;
                serverUrl = (url ?? "").Trim();
                hasSession = false;
                establishedOnSocket = false;
                rejoinAttempts = 0;
                roomId = "";
                sessionId = "";
                settings = null;
                lastSnapshot = null;
                pendingActionId = null;
            }

            DropQueuedEvents();

            if (toClose != null)
            {
                AbortQuietly(toClose);
            }

            SetStatus(OnlineStatus.Connecting);
        }

        private static void AbortQuietly(ClientWebSocket target)
        {
            try
            {
                target.Abort();
                target.Dispose();
            }
            catch (Exception)
            {
                // The transport is already gone; nothing to clean up.
            }
        }

        private static ClientWebSocket CreateSocket()
        {
            var fresh = new ClientWebSocket();

            try
            {
                if (!string.IsNullOrEmpty(OriginHeader))
                {
                    fresh.Options.SetRequestHeader("Origin", OriginHeader);
                }
            }
            catch (Exception)
            {
                // Some platforms restrict handshake headers; the server only
                // enforces origins when an allowlist is configured.
            }

            return fresh;
        }

        private void RunConnect(string helloMessage)
        {
            int myGeneration;
            string url;

            lock (gate)
            {
                myGeneration = generation;
                url = serverUrl;
            }

            Task.Run(async () =>
            {
                var fresh = CreateSocket();

                try
                {
                    using (var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10)))
                    {
                        await fresh.ConnectAsync(new Uri(url), timeout.Token).ConfigureAwait(false);
                    }
                }
                catch (Exception caught)
                {
                    fresh.Dispose();

                    if (IsCurrent(myGeneration))
                    {
                        EmitError("Could not connect: " + caught.Message);
                        HandleTransportLoss(null, myGeneration);
                    }

                    return;
                }

                int freshGeneration;

                lock (gate)
                {
                    if (myGeneration != generation)
                    {
                        AbortQuietly(fresh);
                        return;
                    }

                    generation += 1;
                    freshGeneration = generation;
                    socket = fresh;
                    establishedOnSocket = false;
                }

                await SendRawAsync(fresh, helloMessage).ConfigureAwait(false);
                await ReceiveLoop(fresh, freshGeneration).ConfigureAwait(false);
            });
        }

        private bool IsCurrent(int myGeneration)
        {
            lock (gate)
            {
                return myGeneration == generation;
            }
        }

        private async Task ReceiveLoop(ClientWebSocket active, int myGeneration)
        {
            var buffer = new byte[16 * 1024];
            var builder = new StringBuilder();
            string closeDescription = null;

            try
            {
                while (active.State == WebSocketState.Open)
                {
                    var segment = new ArraySegment<byte>(buffer);
                    WebSocketReceiveResult result = await active.ReceiveAsync(segment, CancellationToken.None)
                        .ConfigureAwait(false);

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        closeDescription = result.CloseStatusDescription;
                        break;
                    }

                    builder.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));

                    if (!result.EndOfMessage)
                    {
                        continue;
                    }

                    string text = builder.ToString();
                    builder.Length = 0;
                    HandleMessage(text, myGeneration);
                }
            }
            catch (Exception)
            {
                // Fall through to the shared transport-loss handling.
            }

            if (IsCurrent(myGeneration))
            {
                if (!string.IsNullOrEmpty(closeDescription))
                {
                    EmitError(closeDescription);
                }

                HandleTransportLoss(active, myGeneration);
            }
            else
            {
                AbortQuietly(active);
            }
        }

        /// <summary>
        /// Shared recovery after a dead transport (socket closed, errored, or
        /// an ack timed out). Attempts are counted across reconnects so an
        /// accept-then-close server can't keep the client in a retry loop
        /// forever; the counter resets only when a room is re-established or
        /// the user acts (Reconnect / new Host / Join).
        /// </summary>
        private void HandleTransportLoss(ClientWebSocket lost, int myGeneration)
        {
            bool shouldRejoin;
            int attempt;
            int nextGeneration;

            lock (gate)
            {
                if (closedByUser || myGeneration != generation)
                {
                    if (lost != null && socket != lost)
                    {
                        AbortQuietly(lost);
                    }

                    return;
                }

                generation += 1;
                nextGeneration = generation;

                if (socket != null)
                {
                    AbortQuietly(socket);
                    socket = null;
                }
                else if (lost != null)
                {
                    AbortQuietly(lost);
                }

                establishedOnSocket = false;
                pendingActionId = null;
                rejoinAttempts += 1;
                attempt = rejoinAttempts;
                shouldRejoin = hasSession && rejoinAttempts <= RejoinDelaysMs.Length;
            }

            if (!shouldRejoin)
            {
                if (HasSession)
                {
                    EmitError("Reconnect failed");
                }

                SetStatus(OnlineStatus.Disconnected);
                return;
            }

            SetStatus(OnlineStatus.Reconnecting);
            int delay = RejoinDelaysMs[attempt - 1];
            Task.Run(() => RejoinOnce(nextGeneration, delay));
        }

        private async Task RejoinOnce(int myGeneration, int delayMs)
        {
            await Task.Delay(delayMs).ConfigureAwait(false);

            string url;
            string room;
            string session;
            Player player;

            lock (gate)
            {
                if (myGeneration != generation || closedByUser || !hasSession)
                {
                    return;
                }

                url = serverUrl;
                room = roomId;
                session = sessionId;
                player = myPlayer;
            }

            var fresh = CreateSocket();

            try
            {
                using (var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(8)))
                {
                    await fresh.ConnectAsync(new Uri(url), timeout.Token).ConfigureAwait(false);
                }
            }
            catch (Exception)
            {
                fresh.Dispose();

                // A failed connect consumes this attempt and schedules the
                // next one (or gives up) through the shared recovery path.
                HandleTransportLoss(null, myGeneration);
                return;
            }

            int freshGeneration;

            lock (gate)
            {
                if (myGeneration != generation || closedByUser)
                {
                    AbortQuietly(fresh);
                    return;
                }

                generation += 1;
                freshGeneration = generation;
                socket = fresh;
                establishedOnSocket = false;
            }

            await SendRawAsync(fresh, OnlineMessages.RejoinRoom(room, player, session)).ConfigureAwait(false);
            await ReceiveLoop(fresh, freshGeneration).ConfigureAwait(false);
        }

        // ------------------------------------------------------------------
        // Sending
        // ------------------------------------------------------------------

        private string NextActionId()
        {
            lock (gate)
            {
                actionCounter += 1;
                return "u" + actionCounter + "-" + Guid.NewGuid().ToString("N").Substring(0, 12);
            }
        }

        private void SendAction(Func<long, string> build)
        {
            ClientWebSocket active;
            string payload;

            lock (gate)
            {
                if (socket == null || lastSnapshot == null || pendingActionId != null)
                {
                    return;
                }

                payload = build(lastSnapshot.Sequence);

                // Remember the action id from the payload we just built.
                var parsed = MiniJson.Parse(payload) as Dictionary<string, object>;
                object id;
                pendingActionId = parsed != null && parsed.TryGetValue("actionId", out id) ? id as string : null;
                pendingActionSentAtMs = clock.ElapsedMilliseconds;
                active = socket;
            }

            Task.Run(() => SendRawAsync(active, payload));
        }

        private async Task SendRawAsync(ClientWebSocket active, string payload)
        {
            var bytes = Encoding.UTF8.GetBytes(payload);
            await sendLock.WaitAsync().ConfigureAwait(false);

            try
            {
                await active.SendAsync(
                    new ArraySegment<byte>(bytes),
                    WebSocketMessageType.Text,
                    true,
                    CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception)
            {
                // The receive loop notices the dead transport and recovers.
            }
            finally
            {
                sendLock.Release();
            }
        }

        // ------------------------------------------------------------------
        // Incoming messages (all stamped with the socket's generation)
        // ------------------------------------------------------------------

        private void HandleMessage(string text, int myGeneration)
        {
            object parsed;

            if (!MiniJson.TryParse(text, out parsed))
            {
                return;
            }

            var map = parsed as Dictionary<string, object>;

            if (map == null)
            {
                return;
            }

            object typeValue;
            string type = map.TryGetValue("type", out typeValue) ? typeValue as string : null;

            if (type == null)
            {
                return;
            }

            switch (type)
            {
                case "room-created":
                case "room-joined":
                case "room-rejoined":
                    HandleRoomEstablished(type, map, myGeneration);
                    return;
                case "peer-joined":
                    StoreSettings(map, myGeneration);
                    StoreSnapshot(map, "peer-joined", myGeneration);
                    SetStatus(OnlineStatus.Connected, myGeneration);
                    return;
                case "peer-left":
                    StoreSnapshot(map, "peer-left", myGeneration);
                    ClearPending(null, myGeneration);
                    SetStatus(OnlineStatus.PeerWaiting, myGeneration);
                    return;
                case "action-ack":
                    ClearPending(StringField(map, "actionId"), myGeneration);
                    StoreSnapshot(map, "action-ack", myGeneration);
                    return;
                case "move":
                case "reset-round":
                case "reset-match":
                    StoreSnapshot(map, type, myGeneration);
                    return;
                case "action-rejected":
                    HandleActionRejected(map, myGeneration);
                    return;
                case "error":
                    HandleServerError(StringField(map, "message"), myGeneration);
                    return;
            }
        }

        private static string StringField(Dictionary<string, object> map, string key)
        {
            object value;
            return map.TryGetValue(key, out value) ? value as string ?? "" : "";
        }

        private void HandleRoomEstablished(string type, Dictionary<string, object> map, int myGeneration)
        {
            var player = StringField(map, "player") == "O" ? Player.O : Player.X;
            var incomingSettings = OnlineRoomSettings.FromJson(
                map.ContainsKey("settings") ? map["settings"] : null) ?? new OnlineRoomSettings();
            string room = StringField(map, "roomId");
            string session = StringField(map, "sessionId");

            lock (gate)
            {
                if (myGeneration != generation)
                {
                    return;
                }

                myPlayer = player;
                roomId = room;
                sessionId = session;
                settings = incomingSettings;
                hasSession = true;
                establishedOnSocket = true;
                rejoinAttempts = 0;
                pendingActionId = null;
            }

            Emit(new OnlineEvent
            {
                Type = OnlineEventType.SessionEstablished,
                RoomId = room,
                PlayerMark = player,
                Settings = incomingSettings,
                Cause = type,
            });

            StoreSnapshot(map, type, myGeneration);

            if (type == "room-created")
            {
                SetStatus(OnlineStatus.Waiting, myGeneration);
            }
            else if (type == "room-rejoined")
            {
                object peerConnected;
                bool connected = map.TryGetValue("peerConnected", out peerConnected)
                    && peerConnected is bool && (bool)peerConnected;
                SetStatus(connected ? OnlineStatus.Connected : OnlineStatus.PeerWaiting, myGeneration);
            }
            else
            {
                SetStatus(OnlineStatus.Connected, myGeneration);
            }
        }

        /// <summary>
        /// The server's '{type:"error"}' replies leave the socket open, but
        /// before a room is established on this socket they are terminal for
        /// the attempt (invalid code, room full, server full, host gone), and
        /// some of them mean the stored session is dead for good.
        /// </summary>
        private void HandleServerError(string message, int myGeneration)
        {
            if (!IsCurrent(myGeneration))
            {
                return;
            }

            EmitError(message);

            bool sessionKilling = message == "Session expired"
                || message == "Room not found"
                || message.StartsWith("Host session expired", StringComparison.Ordinal)
                || message.StartsWith("Host disconnected", StringComparison.Ordinal);

            ClientWebSocket toClose = null;
            bool fatal;

            lock (gate)
            {
                if (myGeneration != generation)
                {
                    return;
                }

                fatal = !establishedOnSocket || sessionKilling;

                if (fatal)
                {
                    if (sessionKilling)
                    {
                        hasSession = false;
                    }

                    generation += 1;
                    toClose = socket;
                    socket = null;
                    establishedOnSocket = false;
                    pendingActionId = null;
                }
            }

            if (fatal)
            {
                if (toClose != null)
                {
                    AbortQuietly(toClose);
                }

                SetStatus(OnlineStatus.Disconnected);
            }
        }

        private void HandleActionRejected(Dictionary<string, object> map, int myGeneration)
        {
            string actionId = StringField(map, "actionId");
            ClearPending(string.IsNullOrEmpty(actionId) ? null : actionId, myGeneration);

            if (!IsCurrent(myGeneration))
            {
                return;
            }

            Emit(new OnlineEvent
            {
                Type = OnlineEventType.ActionRejected,
                Code = StringField(map, "code"),
                Message = StringField(map, "message"),
            });

            // Rejections carry the authoritative snapshot; resync from it.
            StoreSnapshot(map, "action-rejected", myGeneration);
        }

        private void ClearPending(string actionId, int myGeneration)
        {
            lock (gate)
            {
                if (myGeneration != generation)
                {
                    return;
                }

                if (actionId == null || pendingActionId == actionId)
                {
                    pendingActionId = null;
                }
            }
        }

        private void StoreSettings(Dictionary<string, object> map, int myGeneration)
        {
            var incoming = OnlineRoomSettings.FromJson(map.ContainsKey("settings") ? map["settings"] : null);

            if (incoming != null)
            {
                lock (gate)
                {
                    if (myGeneration != generation)
                    {
                        return;
                    }

                    settings = incoming;
                }
            }
        }

        private void StoreSnapshot(Dictionary<string, object> map, string cause, int myGeneration)
        {
            var snapshot = OnlineSnapshot.FromJson(map.ContainsKey("snapshot") ? map["snapshot"] : null);

            if (snapshot == null)
            {
                return;
            }

            lock (gate)
            {
                if (myGeneration != generation)
                {
                    return;
                }

                if (lastSnapshot != null && snapshot.Sequence < lastSnapshot.Sequence)
                {
                    return; // stale
                }

                lastSnapshot = snapshot;
            }

            Emit(new OnlineEvent
            {
                Type = OnlineEventType.SnapshotUpdated,
                Snapshot = snapshot,
                Cause = cause,
            });
        }

        // ------------------------------------------------------------------
        // Event plumbing
        // ------------------------------------------------------------------

        private void SetStatus(OnlineStatus next)
        {
            lock (gate)
            {
                if (status == next)
                {
                    return;
                }

                status = next;
            }

            Emit(new OnlineEvent { Type = OnlineEventType.StatusChanged, Status = next });
        }

        private void SetStatus(OnlineStatus next, int myGeneration)
        {
            lock (gate)
            {
                if (myGeneration != generation || status == next)
                {
                    return;
                }

                status = next;
            }

            Emit(new OnlineEvent { Type = OnlineEventType.StatusChanged, Status = next });
        }

        private void EmitError(string message)
        {
            Emit(new OnlineEvent { Type = OnlineEventType.ErrorMessage, Message = message ?? "" });
        }

        private void Emit(OnlineEvent entry)
        {
            events.Enqueue(entry);
        }
    }
}
