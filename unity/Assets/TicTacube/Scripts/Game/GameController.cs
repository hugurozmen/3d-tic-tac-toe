using System.Collections;
using System.Collections.Generic;
using System.Threading.Tasks;
using TicTacube.Core;
using TicTacube.Online;
using UnityEngine;

namespace TicTacube.Game
{
    public enum GamePhase
    {
        Menu,
        Playing,
        AiThinking,
        PieDecision,
        RoundOver,
        MatchOver,
    }

    /// <summary>
    /// Owns the match flow: builds the scene, routes taps through the
    /// select-confirm flow into the rules, runs the AI on a background
    /// thread, drives the HUD, and handles undo, the Pie Rule, tutorial
    /// hints, stats, and match persistence.
    /// </summary>
    public sealed class GameController : MonoBehaviour
    {
        private const float AiMinThinkSeconds = 0.5f;
        private const float ResultDelaySeconds = 1.4f;

        private BoardView boardView;
        private GameHud hud;
        private GameAudio gameAudio;
        private Camera gameCamera;
        private CameraOrbit orbit;

        private GamePhase phase = GamePhase.Menu;
        private bool soloMode = true;
        private Ruleset ruleset = Ruleset.Lines;
        private Difficulty difficulty = Difficulty.Balanced;
        private Player humanPlayer = Player.X;

        private Player?[] board;
        private Player currentPlayer;
        private MatchState match;
        private GameResult lastResult;
        private bool pieResolved;
        private bool matchEndedByDraw;

        // Undo replays from this snapshot: empty for a fresh round, or the
        // restored position when the round was resumed from a save.
        private Player?[] baselineBoard;
        private Player baselineTurn;
        private int pendingIndex = -1;
        private readonly List<KeyValuePair<int, Player>> moveHistory = new List<KeyValuePair<int, Player>>();

        private bool tutorialActive;
        private int tutorialStep;

        private Task<int?> aiTask;
        private float aiStartedAt;
        private Coroutine resultRoutine;

        // Online room state: the server is authoritative, so the client only
        // renders snapshots and submits actions.
        private OnlineClient online;
        private bool onlineMode;
        private readonly List<OnlineEvent> onlineEvents = new List<OnlineEvent>();
        private Player?[] onlineRendered;
        private long onlineRenderedSequence = -1;
        private bool onlineResultShown;

        private void Awake()
        {
            GameStrings.Turkish = GamePrefs.LoadTurkish(GameStrings.Turkish);
            BuildScene();
        }

        private void BuildScene()
        {
            gameCamera = Camera.main;

            if (gameCamera == null)
            {
                var cameraObject = new GameObject("Main Camera");
                cameraObject.tag = "MainCamera";
                gameCamera = cameraObject.AddComponent<Camera>();
            }

            gameCamera.clearFlags = CameraClearFlags.SolidColor;
            gameCamera.backgroundColor = new Color(0.055f, 0.07f, 0.11f);
            gameCamera.fieldOfView = 50f;

            orbit = gameCamera.gameObject.GetComponent<CameraOrbit>();

            if (orbit == null)
            {
                orbit = gameCamera.gameObject.AddComponent<CameraOrbit>();
            }

            orbit.Initialize(this, gameCamera);

            var lightObject = new GameObject("Key Light");
            var keyLight = lightObject.AddComponent<Light>();
            keyLight.type = LightType.Directional;
            keyLight.intensity = 1.05f;
            keyLight.color = new Color(1f, 0.98f, 0.94f);
            lightObject.transform.rotation = Quaternion.Euler(55f, -32f, 0f);

            RenderSettings.ambientLight = new Color(0.36f, 0.39f, 0.46f);

            var boardObject = new GameObject("Board");
            boardObject.transform.SetParent(transform, false);
            boardView = boardObject.AddComponent<BoardView>();
            boardView.Build();

            gameAudio = gameObject.AddComponent<GameAudio>();
            gameAudio.Initialize();

            var hudObject = new GameObject("Hud");
            hudObject.transform.SetParent(transform, false);
            hud = hudObject.AddComponent<GameHud>();
            hud.Initialize(this);

            Application.targetFrameRate = 60;
        }

        // ------------------------------------------------------------------
        // Flow control (called from the HUD)
        // ------------------------------------------------------------------

        public void StartMatch(bool solo, Ruleset selectedRuleset, Difficulty selectedDifficulty, int targetWins)
        {
            GamePrefs.ClearSave();
            soloMode = solo;
            ruleset = selectedRuleset;
            difficulty = selectedDifficulty;
            humanPlayer = Player.X;
            match = MatchState.Create(Player.X);
            match.TargetWins = Mathf.Max(1, targetWins);
            tutorialActive = !GamePrefs.TutorialDone;
            tutorialStep = 0;
            StartRound();
            hud.ShowGame();
        }

        public void ResumeSavedMatch()
        {
            var save = GamePrefs.ReadSave();

            if (!save.Valid)
            {
                // Corrupt or incompatible snapshot: drop it so the resume
                // button doesn't stay as a dead control.
                GamePrefs.ClearSave();
                hud.ShowMenu();
                return;
            }

            soloMode = save.Solo;
            ruleset = (Ruleset)save.Ruleset;
            difficulty = (Difficulty)save.Difficulty;
            humanPlayer = (Player)save.HumanPlayer;
            pieResolved = save.PieResolved;
            tutorialActive = false;

            match = MatchState.Create((Player)save.Opener);
            match.TargetWins = save.TargetWins;
            match.NextOpener = (Player)save.NextOpener;
            match.RoundNumber = save.RoundNumber;
            match.WinsX = save.WinsX;
            match.WinsO = save.WinsO;
            match.Draws = save.Draws;

            if (save.Stage == 1)
            {
                match.AdvanceRound();
                StartRound();
                hud.ShowGame();
                return;
            }

            board = Rules.CreateBoard();
            boardView.ClearBoard();
            moveHistory.Clear();
            ClearSelection();
            hud.HideResult();

            for (int index = 0; index < save.Cells.Length; index += 1)
            {
                if (save.Cells[index] >= 0)
                {
                    board[index] = (Player)save.Cells[index];
                    boardView.SetMark(index, (Player)save.Cells[index], false);
                }
            }

            RebuildBeams();
            currentPlayer = (Player)save.CurrentPlayer;
            baselineBoard = (Player?[])board.Clone();
            baselineTurn = currentPlayer;
            lastResult = Rules.EvaluateBoard(board, ruleset);
            phase = GamePhase.Playing;
            hud.ShowGame();
            RefreshHud();
            UpdateHints();

            // A pending Pie decision (Classic, one move played) survives the
            // save/resume cycle instead of silently disappearing.
            if (HandlePieRule())
            {
                return;
            }

            MaybeStartAiTurn();
        }

        public void BackToMenu()
        {
            if (resultRoutine != null)
            {
                StopCoroutine(resultRoutine);
                resultRoutine = null;
            }

            if (onlineMode)
            {
                online.Close();
                onlineMode = false;
                onlineRendered = null;
                onlineRenderedSequence = -1;
                onlineResultShown = false;
                hud.SetOnlineUi(false);
            }
            else if (match != null && !match.IsComplete && !matchEndedByDraw && phase != GamePhase.Menu)
            {
                SaveProgress(phase == GamePhase.RoundOver ? 1 : 0);
            }

            aiTask = null;
            phase = GamePhase.Menu;
            ClearSelection();
            boardView.ClearBoard();
            boardView.ClearHints();
            hud.ClearHint();
            hud.HidePiePrompt();
            hud.ShowMenu();
        }

        public void ResultContinuePressed()
        {
            if (onlineMode)
            {
                var snapshot = online.LastSnapshot;

                if (snapshot == null)
                {
                    return;
                }

                if (snapshot.MatchComplete)
                {
                    online.SendResetMatch();
                }
                else if (snapshot.ResultComplete)
                {
                    online.SendResetRound();
                }

                hud.HideResult();
                onlineResultShown = false;
                phase = GamePhase.Playing;
                return;
            }

            if (phase == GamePhase.MatchOver)
            {
                StartMatch(soloMode, ruleset, difficulty, match.TargetWins);
                return;
            }

            if (phase == GamePhase.RoundOver)
            {
                match.AdvanceRound();
                StartRound();
                hud.ShowGame();
            }
        }

        private void StartRound()
        {
            board = Rules.CreateBoard();
            baselineBoard = Rules.CreateBoard();
            baselineTurn = match.Opener;
            matchEndedByDraw = false;
            boardView.ClearBoard();
            moveHistory.Clear();
            ClearSelection();
            hud.HideResult();
            hud.ClearHint();
            pieResolved = false;
            currentPlayer = match.Opener;
            lastResult = Rules.EvaluateBoard(board, ruleset);
            phase = GamePhase.Playing;
            RefreshHud();
            UpdateHints();
            ShowTutorialStep(0);
            MaybeStartAiTurn();
        }

        // ------------------------------------------------------------------
        // Tutorial hints
        // ------------------------------------------------------------------

        private void ShowTutorialStep(int step)
        {
            if (!tutorialActive || match.RoundNumber > 1 || step < tutorialStep)
            {
                return;
            }

            tutorialStep = step;

            switch (step)
            {
                case 0:
                    hud.SetHint(GamePrefs.QuickMove
                        ? GameStrings.T("Boş bir hücreye dokunarak işaretini koy.", "Tap an empty cell to place your mark.")
                        : GameStrings.T(
                            "Boş bir hücreye dokun, sonra Onayla'ya bas.",
                            "Tap an empty cell, then press Confirm."));
                    break;
                case 1:
                    hud.SetHint(ruleset == Ruleset.Lines
                        ? GameStrings.T(
                            "Üç işaretini aynı hizaya getir — her 3'lü çizgi 1 puan.",
                            "Line up three of your marks — every 3-in-a-row scores 1.")
                        : GameStrings.T(
                            "İlk 3'lü çizgiyi yapan turu kazanır.",
                            "First 3-in-a-row wins the round."));
                    break;
                case 2:
                    hud.SetHint(GameStrings.T(
                        "+1 puan! Tahta dolunca en çok çizgisi olan kazanır.",
                        "+1 point! When the board fills, most lines wins."));
                    break;
            }
        }

        // ------------------------------------------------------------------
        // Moves
        // ------------------------------------------------------------------

        public void OnCellTapped(int index)
        {
            if (phase != GamePhase.Playing)
            {
                return;
            }

            if (onlineMode)
            {
                OnlineCellTapped(index);
                return;
            }

            if (soloMode && currentPlayer != humanPlayer)
            {
                return;
            }

            if (board[index] != null)
            {
                return;
            }

            if (GamePrefs.QuickMove)
            {
                PlaceMark(index);
                return;
            }

            if (pendingIndex == index)
            {
                PlaceMark(index);
                return;
            }

            pendingIndex = index;
            boardView.ClearSelection();
            boardView.SetSelected(index, true);
            hud.SetConfirmVisible(true);
            gameAudio.PlaySelect();
        }

        public void ConfirmPressed()
        {
            if (phase != GamePhase.Playing || pendingIndex < 0)
            {
                return;
            }

            if (onlineMode)
            {
                SendOnlineMove(pendingIndex);
                return;
            }

            if (board[pendingIndex] == null)
            {
                PlaceMark(pendingIndex);
            }
        }

        private void ClearSelection()
        {
            pendingIndex = -1;
            boardView.ClearSelection();

            if (hud != null)
            {
                hud.SetConfirmVisible(false);
            }
        }

        private void PlaceMark(int index)
        {
            ClearSelection();

            var previous = (Player?[])board.Clone();
            var mover = currentPlayer;
            board[index] = mover;
            boardView.SetMark(index, mover, true);
            moveHistory.Add(new KeyValuePair<int, Player>(index, mover));
            gameAudio.PlayTap();

            bool humanMoved = !soloMode || mover == humanPlayer;

            if (humanMoved && tutorialStep == 0)
            {
                ShowTutorialStep(1);
            }

            if (ruleset == Ruleset.Lines)
            {
                var newLines = Rules.GetNewCompletedLines(previous, board, mover);

                if (newLines.Count > 0)
                {
                    boardView.AddLineBeams(newLines, mover);
                    CelebrateLines(newLines, mover, humanMoved);
                }
            }

            lastResult = Rules.EvaluateBoard(board, ruleset);

            if (ruleset == Ruleset.Classic && lastResult.Winner != null)
            {
                boardView.HighlightWinningLine(lastResult.WinningLine, lastResult.Winner.Value);
                FinishRound();
                return;
            }

            if (lastResult.IsComplete)
            {
                FinishRound();
                return;
            }

            currentPlayer = Rules.GetOtherPlayer(currentPlayer);
            RefreshHud();
            UpdateHints();
            SaveProgress(0);

            if (HandlePieRule())
            {
                return;
            }

            MaybeStartAiTurn();
        }

        private void CelebrateLines(List<int[]> newLines, Player mover, bool humanMoved)
        {
            gameAudio.PlayLines(newLines.Count);

            if (newLines.Count > 1)
            {
                var center = boardView.CellWorldPosition(newLines[0][1]);
                hud.ShowFloatingScore(
                    center,
                    "+" + newLines.Count + " " + GameStrings.T("ÇİFT!", "MULTI!"),
                    true);
                orbit.Shake(0.22f);
            }
            else
            {
                hud.ShowFloatingScore(boardView.CellWorldPosition(newLines[0][1]), "+1", false);
            }

            if (humanMoved && ruleset == Ruleset.Lines && tutorialStep == 1)
            {
                ShowTutorialStep(2);
            }
        }

        // ------------------------------------------------------------------
        // Pie Rule (Classic)
        // ------------------------------------------------------------------

        /// <summary>
        /// After the opening move in Classic, the responding side may swap
        /// sides. Returns true when the flow is paused waiting on a human.
        /// </summary>
        private bool HandlePieRule()
        {
            if (ruleset != Ruleset.Classic || pieResolved)
            {
                return false;
            }

            int movesPlayed = Rules.CellCount - Rules.GetAvailableMoves(board).Count;

            if (movesPlayed != 1)
            {
                return false;
            }

            if (soloMode && currentPlayer != humanPlayer)
            {
                // AI responds to the human's opening. Resolve immediately and
                // persist, so a kill right after this point resumes correctly.
                pieResolved = true;

                if (Ai.ShouldSwapClassicPie(board, difficulty))
                {
                    humanPlayer = Rules.GetOtherPlayer(humanPlayer);
                    match.RemapForSideSwap();
                    hud.Toast(GameStrings.T(
                        "Rakip taraf değiştirdi — açılış hamlesi artık onun!",
                        "The opponent swapped sides — the opening move is theirs now!"), 3.5f);
                    RefreshHud();
                    UpdateHints();
                }

                SaveProgress(0);
                return false;
            }

            // A human responds (the human in solo, or player 2 in duo).
            // pieResolved stays false until they answer, so a save taken
            // while the prompt is open re-raises the decision on resume.
            phase = GamePhase.PieDecision;
            hud.ShowPiePrompt();
            return true;
        }

        public void PieAnswer(bool swap)
        {
            if (phase != GamePhase.PieDecision)
            {
                return;
            }

            pieResolved = true;
            hud.HidePiePrompt();

            if (swap)
            {
                if (soloMode)
                {
                    humanPlayer = Rules.GetOtherPlayer(humanPlayer);
                }

                match.RemapForSideSwap();
                hud.Toast(GameStrings.T(
                    soloMode ? "Tarafları değiştirdin — açılış hamlesi senin!" : "Taraflar değişti!",
                    soloMode ? "You swapped sides — the opening move is yours!" : "Sides swapped!"), 3f);
            }

            phase = GamePhase.Playing;
            RefreshHud();
            UpdateHints();
            SaveProgress(0);
            MaybeStartAiTurn();
        }

        // ------------------------------------------------------------------
        // Undo
        // ------------------------------------------------------------------

        public void UndoPressed()
        {
            if (onlineMode || phase != GamePhase.Playing || moveHistory.Count == 0)
            {
                return;
            }

            int undoCount = soloMode ? 2 : 1;

            // In solo, only undo when it's the human's turn...
            if (soloMode && currentPlayer != humanPlayer)
            {
                return;
            }

            // ...and only when a human move gets taken back — otherwise the
            // player could re-roll the AI's opening until they like it.
            if (soloMode)
            {
                bool hasHumanMove = false;

                foreach (var move in moveHistory)
                {
                    if (move.Value == humanPlayer)
                    {
                        hasHumanMove = true;
                        break;
                    }
                }

                if (!hasHumanMove)
                {
                    return;
                }
            }

            undoCount = Mathf.Min(undoCount, moveHistory.Count);

            for (int i = 0; i < undoCount; i += 1)
            {
                moveHistory.RemoveAt(moveHistory.Count - 1);
            }

            ReplayFromHistory();
            SaveProgress(0);

            // If the undo landed on the AI's turn (odd history after a pie
            // swap), restart its move so the game can't stall.
            MaybeStartAiTurn();
        }

        private void ReplayFromHistory()
        {
            ClearSelection();
            boardView.ClearBoard();

            // Rebuild from the round baseline (a restored save keeps its
            // position), then re-apply the remaining history on top.
            board = (Player?[])baselineBoard.Clone();

            for (int index = 0; index < board.Length; index += 1)
            {
                if (board[index] != null)
                {
                    boardView.SetMark(index, board[index].Value, false);
                }
            }

            RebuildBeams();

            foreach (var move in moveHistory)
            {
                var previous = (Player?[])board.Clone();
                board[move.Key] = move.Value;
                boardView.SetMark(move.Key, move.Value, false);

                if (ruleset == Ruleset.Lines)
                {
                    boardView.AddLineBeams(Rules.GetNewCompletedLines(previous, board, move.Value), move.Value);
                }
            }

            if (moveHistory.Count == 0)
            {
                boardView.HideLastMoveRing();
            }

            currentPlayer = moveHistory.Count > 0
                ? Rules.GetOtherPlayer(moveHistory[moveHistory.Count - 1].Value)
                : baselineTurn;
            lastResult = Rules.EvaluateBoard(board, ruleset);
            RefreshHud();
            UpdateHints();
        }

        /// <summary>Rebuild beams from a restored board (no move order known).</summary>
        private void RebuildBeams()
        {
            if (ruleset != Ruleset.Lines)
            {
                return;
            }

            boardView.AddLineBeams(Rules.GetCompletedLines(board, Player.X), Player.X);
            boardView.AddLineBeams(Rules.GetCompletedLines(board, Player.O), Player.O);
        }

        // ------------------------------------------------------------------
        // AI turn
        // ------------------------------------------------------------------

        private void MaybeStartAiTurn()
        {
            if (!soloMode || phase != GamePhase.Playing || currentPlayer == humanPlayer)
            {
                return;
            }

            phase = GamePhase.AiThinking;
            RefreshHud();
            boardView.ClearHints();

            var boardCopy = (Player?[])board.Clone();
            var aiPlayer = currentPlayer;
            var aiDifficulty = difficulty;
            var aiRuleset = ruleset;
            aiStartedAt = Time.time;
            aiTask = Task.Run(() => Ai.ChooseMove(boardCopy, aiPlayer, aiDifficulty, aiRuleset));
        }

        private void Update()
        {
            if (onlineMode)
            {
                PumpOnline();
                return;
            }

            if (phase != GamePhase.AiThinking || aiTask == null)
            {
                return;
            }

            if (!aiTask.IsCompleted || Time.time - aiStartedAt < AiMinThinkSeconds)
            {
                return;
            }

            var task = aiTask;
            aiTask = null;
            phase = GamePhase.Playing;

            if (task.IsFaulted || task.Result == null)
            {
                Debug.LogWarning("TicTacube: AI move failed, picking first free cell.");
                var moves = Rules.GetAvailableMoves(board);

                if (moves.Count == 0)
                {
                    return;
                }

                PlaceAiMark(moves[0]);
                return;
            }

            PlaceAiMark(task.Result.Value);
        }

        private void PlaceAiMark(int index)
        {
            if (board[index] != null)
            {
                foreach (int move in Rules.GetAvailableMoves(board))
                {
                    index = move;
                    break;
                }
            }

            PlaceMark(index);
        }

        // ------------------------------------------------------------------
        // Round / match end
        // ------------------------------------------------------------------

        private void FinishRound()
        {
            if (tutorialActive)
            {
                tutorialActive = false;
                GamePrefs.TutorialDone = true;
            }

            hud.ClearHint();
            boardView.ClearHints();
            match.RecordRound(lastResult.Winner, lastResult.IsDraw);

            // A single-round match ends on a draw too — draws don't count
            // toward the win target, so without this it would never finish.
            matchEndedByDraw = !match.IsComplete && match.TargetWins == 1 && lastResult.IsDraw;
            bool matchOver = match.IsComplete || matchEndedByDraw;
            phase = matchOver ? GamePhase.MatchOver : GamePhase.RoundOver;
            RefreshHud();

            bool humanWonRound = lastResult.Winner != null
                && (!soloMode || lastResult.Winner.Value == humanPlayer);
            gameAudio.PlayRoundEnd(humanWonRound, lastResult.Winner == null);

            if (lastResult.Winner != null)
            {
                boardView.PulseBeams(lastResult.Winner.Value, ResultDelaySeconds);

                if (humanWonRound)
                {
                    boardView.PlayConfetti();
                }
            }

            StatsData? stats = null;

            if (matchOver)
            {
                GamePrefs.ClearSave();

                if (match.IsComplete && soloMode && match.Winner != null)
                {
                    stats = GamePrefs.RecordMatch(ruleset, difficulty, match.Winner.Value == humanPlayer);
                }
            }
            else
            {
                SaveProgress(1);
            }

            string title = BuildResultTitle();
            string subtitle = BuildResultSubtitle(stats);
            string buttonLabel = matchOver
                ? GameStrings.T("Yeni Maç", "New Match")
                : GameStrings.T("Sonraki Tur", "Next Round");

            if (resultRoutine != null)
            {
                StopCoroutine(resultRoutine);
            }

            resultRoutine = StartCoroutine(ShowResultDelayed(title, subtitle, buttonLabel));
        }

        private IEnumerator ShowResultDelayed(string title, string subtitle, string buttonLabel)
        {
            yield return new WaitForSeconds(ResultDelaySeconds);
            hud.ShowResult(title, subtitle, buttonLabel);
            resultRoutine = null;
        }

        private string BuildResultTitle()
        {
            if (match.IsComplete && match.Winner != null)
            {
                if (!soloMode)
                {
                    return match.Winner.Value + GameStrings.T(" maçı kazandı!", " wins the match!");
                }

                return match.Winner.Value == humanPlayer
                    ? GameStrings.T("Maçı kazandın!", "You win the match!")
                    : GameStrings.T("Rakip maçı kazandı.", "The opponent wins the match.");
            }

            if (lastResult.Winner == null)
            {
                return GameStrings.T("Berabere!", "It's a draw!");
            }

            if (!soloMode)
            {
                return lastResult.Winner.Value + GameStrings.T(" turu kazandı!", " wins the round!");
            }

            return lastResult.Winner.Value == humanPlayer
                ? GameStrings.T("Turu kazandın!", "You win the round!")
                : GameStrings.T("Rakip turu kazandı.", "The opponent wins the round.");
        }

        private string BuildResultSubtitle(StatsData? stats)
        {
            string subtitle;

            if (ruleset == Ruleset.Lines)
            {
                subtitle = GameStrings.T("Çizgi  X ", "Lines  X ")
                    + lastResult.LineScoreX + " - " + lastResult.LineScoreO + " O";

                // Consolation: losing with completed lines still reads as progress.
                if (soloMode && lastResult.Winner != null && lastResult.Winner.Value != humanPlayer
                    && lastResult.LineScore(humanPlayer) > 0)
                {
                    subtitle += GameStrings.T(
                        "\nYine de " + lastResult.LineScore(humanPlayer) + " çizgi tamamladın!",
                        "\nStill, you completed " + lastResult.LineScore(humanPlayer) + " lines!");
                }
            }
            else if (match.TargetWins > 1)
            {
                subtitle = GameStrings.T("Maç ", "Match ") + match.WinsX + " - " + match.WinsO;
            }
            else
            {
                subtitle = "";
            }

            if (match.IsComplete)
            {
                subtitle = GameStrings.T("Skor ", "Score ") + match.WinsX + " - " + match.WinsO
                    + GameStrings.T("  Berabere: ", "  Draws: ") + match.Draws;

                if (stats != null && stats.Value.Streak > 1)
                {
                    subtitle += GameStrings.T("\nSeri: ", "\nStreak: ") + stats.Value.Streak
                        + GameStrings.T(" maç!", " matches!");
                }
            }

            return subtitle;
        }

        // ------------------------------------------------------------------
        // Online rooms
        // ------------------------------------------------------------------

        private void EnterOnlineMode()
        {
            if (online == null)
            {
                online = new OnlineClient();
            }

            onlineMode = true;
            tutorialActive = false;
            onlineRendered = null;
            onlineRenderedSequence = -1;
            onlineResultShown = false;
            phase = GamePhase.Playing;

            ClearSelection();
            boardView.ClearBoard();
            boardView.ClearHints();
            hud.HideResult();
            hud.SetOnlineUi(true);
            hud.SetUndoEnabled(false);
            hud.ShowGame();
            hud.SetHint(GameStrings.T("Sunucuya bağlanılıyor…", "Connecting to server…"));
        }

        public void StartOnlineHost(string url, Ruleset selectedRuleset)
        {
            EnterOnlineMode();
            ruleset = selectedRuleset;
            online.HostRoom(url, selectedRuleset);
        }

        public void StartOnlineJoin(string url, string code)
        {
            EnterOnlineMode();
            online.JoinRoom(url, code);
        }

        public void OnlineReconnectPressed()
        {
            if (onlineMode && online.HasSession)
            {
                hud.SetReconnectVisible(false);
                online.Reconnect();
            }
        }

        private void PumpOnline()
        {
            online.Tick();
            onlineEvents.Clear();
            online.DrainEvents(onlineEvents);

            foreach (var entry in onlineEvents)
            {
                if (!onlineMode)
                {
                    break; // an event handler returned to the menu
                }

                ProcessOnlineEvent(entry);
            }
        }

        private void ProcessOnlineEvent(OnlineEvent entry)
        {
            switch (entry.Type)
            {
                case OnlineEventType.SessionEstablished:
                    humanPlayer = entry.PlayerMark;

                    if (entry.Settings != null)
                    {
                        ruleset = entry.Settings.Ruleset;
                    }

                    // Force a full redraw from the next snapshot.
                    onlineRendered = null;
                    onlineRenderedSequence = -1;
                    onlineResultShown = false;
                    hud.HideResult();
                    break;

                case OnlineEventType.StatusChanged:
                    OnOnlineStatusChanged(entry.Status);
                    break;

                case OnlineEventType.SnapshotUpdated:
                    ApplyOnlineSnapshot(entry.Snapshot);
                    break;

                case OnlineEventType.ActionRejected:
                    OnOnlineActionRejected(entry.Code, entry.Message);
                    break;

                case OnlineEventType.ErrorMessage:
                    hud.Toast(GameStrings.T("Sunucu: ", "Server: ") + entry.Message, 4f);
                    break;
            }
        }

        private void OnOnlineStatusChanged(OnlineStatus status)
        {
            hud.SetReconnectVisible(status == OnlineStatus.Disconnected && online.HasSession);

            switch (status)
            {
                case OnlineStatus.Connecting:
                    hud.SetHint(GameStrings.T("Sunucuya bağlanılıyor…", "Connecting to server…"));
                    break;
                case OnlineStatus.Waiting:
                    hud.SetHint(GameStrings.T(
                        "Oda kodu: " + online.RoomId + " — rakibini bekle",
                        "Room code: " + online.RoomId + " — waiting for your opponent"));
                    break;
                case OnlineStatus.Connected:
                    hud.Toast(GameStrings.T("Rakip bağlı — iyi oyunlar!", "Opponent connected — good luck!"), 2.5f);
                    break;
                case OnlineStatus.PeerWaiting:
                    hud.SetHint(GameStrings.T(
                        "Rakibin bağlantısı koptu — bekleniyor…",
                        "Opponent disconnected — waiting…"));
                    break;
                case OnlineStatus.Reconnecting:
                    hud.SetHint(GameStrings.T("Yeniden bağlanılıyor…", "Reconnecting…"));
                    break;
                case OnlineStatus.Disconnected:
                    hud.SetHint(online.HasSession
                        ? GameStrings.T(
                            "Bağlantı koptu. Yeniden Bağlan'a bas.",
                            "Connection lost. Press Reconnect.")
                        : GameStrings.T(
                            "Bağlanılamadı. Menüden tekrar dene.",
                            "Could not connect. Try again from the menu."));
                    break;
            }
        }

        private void OnOnlineActionRejected(string code, string message)
        {
            ClearSelection();

            switch (code)
            {
                case "sequence-mismatch":
                    return; // the snapshot that follows resyncs silently
                case "out-of-turn":
                    hud.Toast(GameStrings.T("Sıra sende değil.", "It's not your turn."), 2f);
                    return;
                case "cell-occupied":
                    hud.Toast(GameStrings.T("Bu hücre dolu.", "That cell is occupied."), 2f);
                    return;
                case "peer-unavailable":
                    hud.Toast(GameStrings.T("Rakip şu an bağlı değil.", "Your opponent is not connected."), 2.5f);
                    return;
                case "round-complete":
                    hud.Toast(GameStrings.T("Tur bitti.", "The round is over."), 2f);
                    return;
                case "ack-timeout":
                    hud.Toast(GameStrings.T(
                        "Sunucu yanıtı zaman aşımına uğradı.",
                        "The server confirmation timed out."), 3f);
                    return;
                default:
                    hud.Toast(GameStrings.T("Sunucu: ", "Server: ") + message, 3f);
                    return;
            }
        }

        private void OnlineCellTapped(int index)
        {
            var snapshot = online.LastSnapshot;

            if (online.Status != OnlineStatus.Connected
                || snapshot == null
                || snapshot.ResultComplete
                || snapshot.CurrentPlayer != humanPlayer
                || snapshot.Board[index] != null
                || online.HasPendingAction)
            {
                return;
            }

            if (GamePrefs.QuickMove || pendingIndex == index)
            {
                SendOnlineMove(index);
                return;
            }

            pendingIndex = index;
            boardView.ClearSelection();
            boardView.SetSelected(index, true);
            hud.SetConfirmVisible(true);
            gameAudio.PlaySelect();
        }

        private void SendOnlineMove(int index)
        {
            var snapshot = online.LastSnapshot;

            if (online.Status != OnlineStatus.Connected
                || snapshot == null
                || snapshot.Board[index] != null
                || online.HasPendingAction)
            {
                return;
            }

            // Keep the cell highlighted as a "sending" cue; the snapshot that
            // confirms the move clears the selection.
            hud.SetConfirmVisible(false);
            online.SendMove(index);
        }

        private void ApplyOnlineSnapshot(OnlineSnapshot snapshot)
        {
            if (snapshot.Sequence < onlineRenderedSequence)
            {
                return;
            }

            int added = 0;
            int removed = 0;
            int addedIndex = -1;
            Player addedPlayer = Player.X;

            if (onlineRendered != null)
            {
                for (int index = 0; index < Rules.CellCount; index += 1)
                {
                    var before = onlineRendered[index];
                    var after = snapshot.Board[index];

                    if (before == after)
                    {
                        continue;
                    }

                    if (before == null && after != null)
                    {
                        added += 1;
                        addedIndex = index;
                        addedPlayer = after.Value;
                    }
                    else
                    {
                        removed += 1;
                    }
                }
            }

            if (onlineRendered == null || removed > 0 || added > 1)
            {
                RebuildOnlineBoard(snapshot);
            }
            else if (added == 1)
            {
                var previous = (Player?[])onlineRendered.Clone();
                boardView.SetMark(addedIndex, addedPlayer, true);
                gameAudio.PlayTap();

                if (ruleset == Ruleset.Lines)
                {
                    var next = (Player?[])previous.Clone();
                    next[addedIndex] = addedPlayer;
                    var newLines = Rules.GetNewCompletedLines(previous, next, addedPlayer);

                    if (newLines.Count > 0)
                    {
                        boardView.AddLineBeams(newLines, addedPlayer);
                        CelebrateLines(newLines, addedPlayer, addedPlayer == humanPlayer);
                    }
                }
                else if (snapshot.ResultComplete && snapshot.ResultWinner != null)
                {
                    HighlightOnlineClassicWin(snapshot);
                }
            }

            onlineRendered = (Player?[])snapshot.Board.Clone();
            onlineRenderedSequence = snapshot.Sequence;
            ClearSelection();
            hud.SetTurn(snapshot.CurrentPlayer, true, humanPlayer, false);
            hud.SetOnlineScores(snapshot, humanPlayer, ruleset);
            HandleOnlineRoundState(snapshot);
        }

        private void RebuildOnlineBoard(OnlineSnapshot snapshot)
        {
            boardView.ClearBoard();

            for (int index = 0; index < Rules.CellCount; index += 1)
            {
                if (index != snapshot.LastMove && snapshot.Board[index] != null)
                {
                    boardView.SetMark(index, snapshot.Board[index].Value, false);
                }
            }

            // Place the last move last so the ring lands on it.
            if (snapshot.LastMove >= 0 && snapshot.Board[snapshot.LastMove] != null)
            {
                boardView.SetMark(snapshot.LastMove, snapshot.Board[snapshot.LastMove].Value, false);
            }
            else
            {
                boardView.HideLastMoveRing();
            }

            if (ruleset == Ruleset.Lines)
            {
                var mirror = (Player?[])snapshot.Board.Clone();
                boardView.AddLineBeams(Rules.GetCompletedLines(mirror, Player.X), Player.X);
                boardView.AddLineBeams(Rules.GetCompletedLines(mirror, Player.O), Player.O);
            }
            else if (snapshot.ResultComplete && snapshot.ResultWinner != null)
            {
                HighlightOnlineClassicWin(snapshot);
            }
        }

        private void HighlightOnlineClassicWin(OnlineSnapshot snapshot)
        {
            var mirror = (Player?[])snapshot.Board.Clone();
            var completed = Rules.GetCompletedLines(mirror, snapshot.ResultWinner.Value);

            if (completed.Count > 0)
            {
                boardView.HighlightWinningLine(completed[0], snapshot.ResultWinner.Value);
            }
        }

        private void HandleOnlineRoundState(OnlineSnapshot snapshot)
        {
            if (!snapshot.ResultComplete)
            {
                // A pending delayed result panel must not pop over the round
                // the opponent just reset.
                if (resultRoutine != null)
                {
                    StopCoroutine(resultRoutine);
                    resultRoutine = null;
                }

                if (onlineResultShown || phase != GamePhase.Playing)
                {
                    onlineResultShown = false;
                    phase = GamePhase.Playing;
                    hud.HideResult();
                    hud.Toast(GameStrings.T("Yeni tur!", "New round!"), 2f);
                }

                return;
            }

            if (onlineResultShown)
            {
                return;
            }

            onlineResultShown = true;
            phase = snapshot.MatchComplete ? GamePhase.MatchOver : GamePhase.RoundOver;

            bool humanWon = snapshot.ResultWinner != null && snapshot.ResultWinner.Value == humanPlayer;
            gameAudio.PlayRoundEnd(humanWon, snapshot.ResultWinner == null);

            if (snapshot.ResultWinner != null)
            {
                boardView.PulseBeams(snapshot.ResultWinner.Value, ResultDelaySeconds);

                if (humanWon)
                {
                    boardView.PlayConfetti();
                }
            }

            string title;

            if (snapshot.MatchComplete && snapshot.MatchWinner != null)
            {
                title = snapshot.MatchWinner.Value == humanPlayer
                    ? GameStrings.T("Maçı kazandın!", "You win the match!")
                    : GameStrings.T("Rakip maçı kazandı.", "The opponent wins the match.");
            }
            else if (snapshot.ResultWinner == null)
            {
                title = GameStrings.T("Berabere!", "It's a draw!");
            }
            else
            {
                title = humanWon
                    ? GameStrings.T("Turu kazandın!", "You win the round!")
                    : GameStrings.T("Rakip turu kazandı.", "The opponent wins the round.");
            }

            string subtitle = ruleset == Ruleset.Lines
                ? GameStrings.T("Çizgi  X ", "Lines  X ") + snapshot.LineScoreX + " - " + snapshot.LineScoreO + " O"
                : "";
            subtitle += (subtitle.Length > 0 ? "\n" : "")
                + GameStrings.T("Maç  Sen ", "Match  You ") + snapshot.Wins(humanPlayer)
                + " - " + snapshot.Wins(Rules.GetOtherPlayer(humanPlayer)) + GameStrings.T(" Rakip", " Opp");

            string buttonLabel = snapshot.MatchComplete
                ? GameStrings.T("Yeni Maç", "New Match")
                : GameStrings.T("Sonraki Tur", "Next Round");

            if (resultRoutine != null)
            {
                StopCoroutine(resultRoutine);
            }

            resultRoutine = StartCoroutine(ShowResultDelayed(title, subtitle, buttonLabel));
        }

        // ------------------------------------------------------------------
        // Toggles
        // ------------------------------------------------------------------

        public void ToggleLayersPressed()
        {
            boardView.SetLayersSeparated(!boardView.LayersSeparated);
        }

        public void ToggleAnalysisPressed()
        {
            GamePrefs.Analysis = !GamePrefs.Analysis;
            hud.SetAnalysisLabel();
            UpdateHints();
        }

        /// <summary>Threat hints for the side to move (red = must block, green = can score).</summary>
        private void UpdateHints()
        {
            if (onlineMode)
            {
                boardView.ClearHints();
                return;
            }

            if (!GamePrefs.Analysis
                || phase != GamePhase.Playing && phase != GamePhase.AiThinking
                || (soloMode && currentPlayer != humanPlayer))
            {
                boardView.ClearHints();
                return;
            }

            var danger = Rules.GetBlockingCells(board, currentPlayer);
            var scoring = Rules.GetThreatCells(board, currentPlayer);
            boardView.ShowHints(danger, scoring);
        }

        // ------------------------------------------------------------------
        // Persistence
        // ------------------------------------------------------------------

        private void SaveProgress(int stage)
        {
            if (onlineMode || match == null || match.IsComplete)
            {
                return;
            }

            var cells = new int[Rules.CellCount];

            for (int index = 0; index < board.Length; index += 1)
            {
                cells[index] = board[index] == null ? -1 : (int)board[index].Value;
            }

            GamePrefs.WriteSave(new SaveState
            {
                Stage = stage,
                Cells = cells,
                CurrentPlayer = (int)currentPlayer,
                Ruleset = (int)ruleset,
                Difficulty = (int)difficulty,
                Solo = soloMode,
                HumanPlayer = (int)humanPlayer,
                PieResolved = pieResolved,
                Opener = (int)match.Opener,
                NextOpener = (int)match.NextOpener,
                RoundNumber = match.RoundNumber,
                WinsX = match.WinsX,
                WinsO = match.WinsO,
                Draws = match.Draws,
                TargetWins = match.TargetWins,
            });
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused && match != null && !match.IsComplete && !matchEndedByDraw
                && phase != GamePhase.Menu && phase != GamePhase.MatchOver)
            {
                SaveProgress(phase == GamePhase.RoundOver ? 1 : 0);
            }
        }

        private void RefreshHud()
        {
            hud.SetTurn(currentPlayer, soloMode, humanPlayer, phase == GamePhase.AiThinking);
            hud.SetScores(match, lastResult, ruleset, soloMode, humanPlayer);
            hud.SetUndoEnabled(
                phase == GamePhase.Playing
                && moveHistory.Count > 0
                && (!soloMode || currentPlayer == humanPlayer));
        }
    }
}
