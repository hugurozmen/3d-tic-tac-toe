using System;
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
        private bool gravityMode;
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

        // Lead-change narrative (Lines): -1 O leads, 0 tied, +1 X leads.
        private int lastLeadSign;
        private int onlineLeadSign;

        // Daily puzzle mode: a preset board, one move, a verdict.
        private bool puzzleMode;
        private DailyPuzzle currentPuzzle;

        // Achievement context for the current round.
        private bool pieSwapByHuman;
        private bool behindAt21;

        // Tower + quick move: a brief cooldown so an accidental double tap
        // can't stack a second (the opponent's!) mark into the same column.
        private float lastGravityPlacementAt = -10f;

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
        private long onlineCelebratedSequence = -1;

        // Last room credentials, kept after leaving so rejoining the same
        // room code reclaims the reserved seat instead of "Room is full".
        private string lastOnlineUrl = "";
        private string lastOnlineRoom = "";
        private string lastOnlineSession = "";
        private Player lastOnlinePlayer = Player.X;

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

        public void StartMatch(bool solo, Ruleset selectedRuleset, Difficulty selectedDifficulty, int targetWins, bool gravity)
        {
            GamePrefs.ClearSave();
            puzzleMode = false;
            soloMode = solo;
            gravityMode = gravity;
            ruleset = selectedRuleset;
            difficulty = selectedDifficulty;
            humanPlayer = Player.X;
            tutorialActive = !GamePrefs.TutorialDone;
            tutorialStep = 0;

            // Matches alternate who opens (the opener has a real edge); the
            // very first game keeps the human opening so the tutorial works.
            Player opener = tutorialActive ? Player.X : GamePrefs.TakeNextOpener();
            match = MatchState.Create(opener);
            match.TargetWins = Mathf.Max(1, targetWins);
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

            puzzleMode = false;
            soloMode = save.Solo;
            gravityMode = save.Gravity;
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
            lastLeadSign = Math.Sign(lastResult.LineScoreX - lastResult.LineScoreO);
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
                if (online.HasSession)
                {
                    lastOnlineUrl = GamePrefs.ServerUrl;
                    lastOnlineRoom = online.RoomId;
                    lastOnlineSession = online.SessionId;
                    lastOnlinePlayer = online.MyPlayer;
                }

                online.Close();
                onlineMode = false;
                onlineRendered = null;
                onlineRenderedSequence = -1;
                onlineResultShown = false;
                hud.SetOnlineUi(false);
                hud.HideRoomCode();
            }
            else if (puzzleMode)
            {
                // Leaving a puzzle must never overwrite a real match save.
                puzzleMode = false;
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
            if (puzzleMode)
            {
                // Practice: replay the same daily board (the recorded daily
                // result stays whatever the first attempt was).
                StartDailyPuzzle();
                return;
            }

            if (onlineMode)
            {
                var snapshot = online.LastSnapshot;

                if (snapshot == null
                    || online.Status != OnlineStatus.Connected
                    || online.HasPendingAction)
                {
                    hud.Toast(GameStrings.T(
                        "Rakip bağlı değilken tur başlatılamaz.",
                        "Can't start the next round while the opponent is away."), 2.5f);
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
                StartMatch(soloMode, ruleset, difficulty, match.TargetWins, gravityMode);
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
            pieSwapByHuman = false;
            behindAt21 = false;
            lastLeadSign = 0;
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
                    if (gravityMode)
                    {
                        hud.SetHint(GamePrefs.QuickMove
                            ? GameStrings.T(
                                "Bir sütuna dokun — taşın en alttaki boş hücreye düşer.",
                                "Tap a column — your mark drops to its lowest empty cell.")
                            : GameStrings.T(
                                "Bir sütuna dokun: seçim taşın düşeceği hücrede belirir. Sonra Onayla'ya bas.",
                                "Tap a column: the selection appears where the mark will land. Then press Confirm."));
                    }
                    else
                    {
                        hud.SetHint(GamePrefs.QuickMove
                            ? GameStrings.T("Boş bir hücreye dokunarak işaretini koy.", "Tap an empty cell to place your mark.")
                            : GameStrings.T(
                                "Boş bir hücreye dokun, sonra Onayla'ya bas.",
                                "Tap an empty cell, then press Confirm."));
                    }

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

            if (gravityMode)
            {
                if (GamePrefs.QuickMove && Time.time - lastGravityPlacementAt < 0.4f)
                {
                    return; // double-tap guard: don't stack a second mark
                }

                // Tower: any tap in a column drops to its lowest empty cell.
                index = Rules.GravityDropIndex(board, index);

                if (index < 0)
                {
                    return; // column full
                }
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

            // Analysis extra: warn when the selected move hands the rival an
            // immediate line (the AI's replyRisk idea, surfaced to humans).
            if (GamePrefs.Analysis && ruleset == Ruleset.Lines && !tutorialActive && !puzzleMode)
            {
                var next = (Player?[])board.Clone();
                next[index] = currentPlayer;
                int risk = Rules.GetBestImmediateLineGain(next, Rules.GetOtherPlayer(currentPlayer), gravityMode);

                if (risk > 0)
                {
                    hud.Toast(GameStrings.T(
                        "Dikkat: bu hamle rakibe " + risk + " çizgi bırakıyor.",
                        "Careful: this leaves the opponent " + risk + " line(s)."), 3.5f);
                }
            }
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
            if (puzzleMode)
            {
                PlacePuzzleMove(index);
                return;
            }

            ClearSelection();

            var previous = (Player?[])board.Clone();
            var mover = currentPlayer;
            board[index] = mover;
            boardView.SetMark(index, mover, true, gravityMode);
            moveHistory.Add(new KeyValuePair<int, Player>(index, mover));

            if (gravityMode)
            {
                lastGravityPlacementAt = Time.time;
            }
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

            if (ruleset == Ruleset.Lines)
            {
                UpdateLeadNarrative();

                if (soloMode && Rules.CellCount - lastResult.RemainingCells == 21)
                {
                    behindAt21 = lastResult.LineScore(humanPlayer)
                        < lastResult.LineScore(Rules.GetOtherPlayer(humanPlayer));
                }
            }

            currentPlayer = Rules.GetOtherPlayer(currentPlayer);
            RefreshHud();
            UpdateHints();
            UpdateEndgameBand();
            SaveProgress(0);

            if (HandlePieRule())
            {
                return;
            }

            MaybeStartAiTurn();
        }

        /// <summary>Toast when the Lines lead changes hands (mid-game drama).</summary>
        private void UpdateLeadNarrative()
        {
            int sign = Math.Sign(lastResult.LineScoreX - lastResult.LineScoreO);

            if (sign != lastLeadSign
                && lastResult.LineScoreX + lastResult.LineScoreO > 0
                && !tutorialActive)
            {
                hud.Toast(LeadText(sign, soloMode), 2.2f);
            }

            lastLeadSign = sign;
        }

        private string LeadText(int sign, bool youPerspective)
        {
            if (sign == 0)
            {
                return GameStrings.T("Eşitlik!", "All tied!");
            }

            if (!youPerspective)
            {
                return (sign > 0 ? "X" : "O") + GameStrings.T(" öne geçti!", " takes the lead!");
            }

            int humanSign = humanPlayer == Player.X ? sign : -sign;
            return humanSign > 0
                ? GameStrings.T("Öne geçtin!", "You take the lead!")
                : GameStrings.T("Rakip öne geçti.", "The opponent takes the lead.");
        }

        /// <summary>
        /// Final-six tension band (Lines): a persistent hint naming the swing
        /// still on the table for the side to move.
        /// </summary>
        private void UpdateEndgameBand()
        {
            if (ruleset != Ruleset.Lines || tutorialActive || lastResult.IsComplete)
            {
                return;
            }

            if (soloMode && currentPlayer != humanPlayer)
            {
                hud.ClearHint();
                return;
            }

            var endgame = LinesTension.Analyze(board, currentPlayer, gravityMode);
            hud.SetHint(endgame == null ? "" : BandText(endgame));
        }

        private static string BandText(LinesEndgame endgame)
        {
            string swing;

            if (endgame.MaxScoreLines > 0 && endgame.MaxBlockLines > 0)
            {
                swing = GameStrings.T(
                    "+" + endgame.MaxScoreLines + " şans ve " + endgame.MaxBlockLines + " blok canlı",
                    "up to +" + endgame.MaxScoreLines + " and " + endgame.MaxBlockLines + " block live");
            }
            else if (endgame.MaxScoreLines > 0)
            {
                swing = GameStrings.T(
                    "+" + endgame.MaxScoreLines + " çizgi şansı",
                    "up to +" + endgame.MaxScoreLines + " lines");
            }
            else if (endgame.MaxBlockLines > 0)
            {
                swing = GameStrings.T(
                    endgame.MaxBlockLines + " blok canlı",
                    endgame.MaxBlockLines + " block live");
            }
            else
            {
                swing = GameStrings.T("her hücre sayılır", "every cell matters");
            }

            return GameStrings.T("Son ", "Final ") + endgame.RemainingCells + ": " + swing;
        }

        private void CelebrateLines(List<int[]> newLines, Player mover, bool humanMoved)
        {
            gameAudio.PlayLines(newLines.Count);

            if (humanMoved && !puzzleMode)
            {
                var toasts = new List<string>();
                AppendAchievementToasts(Achievements.OnLinesMove(newLines.Count, true), toasts);

                if (newLines.Count >= 2)
                {
                    AppendGoalToasts(DailyGoals.Report(DateTime.Now, "multi_line", 1), toasts);
                }

                AppendGoalToasts(DailyGoals.Report(DateTime.Now, "six_lines", newLines.Count), toasts);
                ShowProgressionToasts(toasts);
            }

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
            // Tower has no pie: the column constraint already tempers the
            // opening, and dropped marks can't be 'taken over' meaningfully.
            if (ruleset != Ruleset.Classic || pieResolved || gravityMode)
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
            hud.ShowPiePrompt(soloMode && difficulty == Difficulty.Easy);
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
                    pieSwapByHuman = true;
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
            if (onlineMode || puzzleMode || phase != GamePhase.Playing || moveHistory.Count == 0)
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
            lastLeadSign = Math.Sign(lastResult.LineScoreX - lastResult.LineScoreO);
            RefreshHud();
            UpdateHints();
            UpdateEndgameBand();
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
            var aiGravity = gravityMode;
            var aiPieAware = aiRuleset == Ruleset.Classic && !aiGravity;
            aiStartedAt = Time.time;
            aiTask = Task.Run(() => Ai.ChooseMove(boardCopy, aiPlayer, aiDifficulty, aiRuleset, null, aiGravity, aiPieAware));
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
            if (board[index] != null || (gravityMode && !Rules.IsGravityLegal(board, index)))
            {
                var fallback = gravityMode
                    ? Rules.GetGravityMoves(board)
                    : Rules.GetAvailableMoves(board);

                if (fallback.Count == 0)
                {
                    return;
                }

                index = fallback[0];
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
                    stats = GamePrefs.RecordMatch(ruleset, difficulty, gravityMode, match.Winner.Value == humanPlayer);
                }
                else if (matchEndedByDraw && soloMode)
                {
                    // Draws leave a trace too (and don't break the streak).
                    GamePrefs.RecordDraw(ruleset, difficulty, gravityMode);
                }
            }
            else
            {
                SaveProgress(1);
            }

            if (!puzzleMode)
            {
                var toasts = new List<string>();

                if (soloMode)
                {
                    AppendAchievementToasts(Achievements.OnRoundEnd(new Achievements.RoundSummary
                    {
                        Solo = true,
                        HumanWon = humanWonRound,
                        Draw = lastResult.Winner == null && lastResult.IsDraw,
                        Ruleset = ruleset,
                        Gravity = gravityMode,
                        Difficulty = difficulty,
                        HumanLines = lastResult.LineScore(humanPlayer),
                        MovesPlayed = Rules.CellCount - lastResult.RemainingCells,
                        HumanOwnsCenter = board[Ai.CenterIndex] == humanPlayer,
                        BehindAt21 = behindAt21,
                        PieSwapWin = pieSwapByHuman,
                        MatchComplete = match.IsComplete,
                        HumanWonMatch = match.Winner != null && match.Winner.Value == humanPlayer,
                        StreakAfterMatch = stats != null ? stats.Value.Streak : 0,
                    }), toasts);

                    if (humanWonRound)
                    {
                        if (difficulty != Difficulty.Easy)
                        {
                            AppendGoalToasts(DailyGoals.Report(DateTime.Now, "win_balanced", 1), toasts);
                        }

                        if (ruleset == Ruleset.Classic)
                        {
                            AppendGoalToasts(DailyGoals.Report(DateTime.Now, "classic_win", 1), toasts);
                        }

                        if (gravityMode)
                        {
                            AppendGoalToasts(DailyGoals.Report(DateTime.Now, "tower_round", 1), toasts);
                        }
                    }
                }

                AppendGoalToasts(DailyGoals.Report(DateTime.Now, "play_rounds", 1), toasts);
                ShowProgressionToasts(toasts);
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
        // Daily puzzle
        // ------------------------------------------------------------------

        public void StartDailyPuzzle()
        {
            if (onlineMode)
            {
                online.Close();
                onlineMode = false;
                hud.SetOnlineUi(false);
                hud.HideRoomCode();
            }

            puzzleMode = true;
            gravityMode = false;
            tutorialActive = false;
            currentPuzzle = Puzzles.GetDailyPuzzle(DateTime.Now);
            ruleset = currentPuzzle.Ruleset;
            soloMode = true;
            humanPlayer = currentPuzzle.Mover;
            currentPlayer = currentPuzzle.Mover;
            board = (Player?[])currentPuzzle.Board.Clone();
            moveHistory.Clear();
            ClearSelection();

            if (resultRoutine != null)
            {
                StopCoroutine(resultRoutine);
                resultRoutine = null;
            }

            boardView.ClearBoard();
            boardView.ClearHints();

            for (int index = 0; index < board.Length; index += 1)
            {
                if (board[index] != null)
                {
                    boardView.SetMark(index, board[index].Value, false);
                }
            }

            boardView.HideLastMoveRing();
            phase = GamePhase.Playing;
            hud.HideResult();
            hud.SetUndoEnabled(false);
            hud.ShowGame();
            hud.SetTurn(currentPlayer, true, humanPlayer, false);
            hud.SetPuzzleHeader(currentPuzzle.Id, PuzzlePrompt(currentPuzzle.Kind));
        }

        private static string PuzzlePrompt(PuzzleKind kind)
        {
            switch (kind)
            {
                case PuzzleKind.BestLines:
                    return GameStrings.T(
                        "Bulmaca: en iyi Çizgiler hamlesini bul (X oynar).",
                        "Puzzle: find the best Lines move (X to play).");
                case PuzzleKind.MaxLines:
                    return GameStrings.T(
                        "Bulmaca: tek hamlede en çok çizgiyi tamamla (X oynar).",
                        "Puzzle: score the most lines in one move (X to play).");
                case PuzzleKind.ClassicWin:
                    return GameStrings.T(
                        "Bulmaca: Klasik'te kazanan hamleyi bul (X oynar).",
                        "Puzzle: find the Classic winning move (X to play).");
                default:
                    return GameStrings.T(
                        "Bulmaca: iki hamlede kazan — çifte tehdit kur (X oynar).",
                        "Puzzle: win in two — create a double threat (X to play).");
            }
        }

        private static string PuzzleExplanation(PuzzleKind kind, int bestMove)
        {
            string cell = GameStrings.T("Hücre ", "Cell ") + (bestMove + 1);

            switch (kind)
            {
                case PuzzleKind.BestLines:
                    return cell + GameStrings.T(
                        " en temiz Çizgiler skorunu getirir ve farkı korur.",
                        " completes the cleanest Lines score and protects the margin.");
                case PuzzleKind.MaxLines:
                    return cell + GameStrings.T(
                        " aynı anda dört uzay köşegenini tamamlar.",
                        " scores four space diagonals at once.");
                case PuzzleKind.ClassicWin:
                    return cell + GameStrings.T(
                        " orta katın sırasını tamamlayıp turu bitirir.",
                        " finishes the middle-floor row.");
                default:
                    return cell + GameStrings.T(
                        " iki tehdidi birden kurar; rakip ikisini de kapatamaz.",
                        " creates two threats at once; the rival cannot cover both.");
            }
        }

        private void PlacePuzzleMove(int index)
        {
            ClearSelection();

            var previous = (Player?[])board.Clone();
            board[index] = currentPlayer;
            boardView.SetMark(index, currentPlayer, true);
            gameAudio.PlayTap();

            bool solved = index == currentPuzzle.BestMove;

            if (ruleset == Ruleset.Lines)
            {
                var newLines = Rules.GetNewCompletedLines(previous, board, currentPlayer);

                if (newLines.Count > 0)
                {
                    boardView.AddLineBeams(newLines, currentPlayer);
                    gameAudio.PlayLines(newLines.Count);
                }
            }
            else
            {
                var result = Rules.EvaluateClassicBoard(board);

                if (result.Winner == currentPlayer)
                {
                    boardView.HighlightWinningLine(result.WinningLine, currentPlayer);
                }
            }

            phase = GamePhase.RoundOver;
            hud.ClearHint();

            var daily = RecordDailyAttempt(solved);
            gameAudio.PlayRoundEnd(solved, false);

            if (solved)
            {
                var toasts = new List<string>();
                AppendGoalToasts(DailyGoals.Report(DateTime.Now, "solve_puzzle", 1), toasts);
                AppendAchievementToasts(Achievements.OnPuzzleStreak(daily.Streak), toasts);
                ShowProgressionToasts(toasts);
            }

            if (solved)
            {
                boardView.PlayConfetti();
            }

            string title = solved
                ? GameStrings.T("Doğru!", "Correct!")
                : GameStrings.T("Olmadı.", "Not quite.");
            string explanation = solved
                ? PuzzleExplanation(currentPuzzle.Kind, currentPuzzle.BestMove)
                : GameStrings.T("En iyi hamle hücre ", "The best move was cell ")
                    + (currentPuzzle.BestMove + 1) + ".\n"
                    + PuzzleExplanation(currentPuzzle.Kind, currentPuzzle.BestMove);

            if (solved && daily.Streak > 1)
            {
                explanation += GameStrings.T(
                    "\nBulmaca serisi: " + daily.Streak + " gün!",
                    "\nPuzzle streak: " + daily.Streak + " days!");
            }

            string shareText = "TicTacube " + GameStrings.T("Günlük", "Daily") + " #" + currentPuzzle.Id
                + " — " + (solved ? GameStrings.T("çözüldü ✓", "solved ✓") : GameStrings.T("bir dahaki sefere ✗", "next time ✗"));

            if (resultRoutine != null)
            {
                StopCoroutine(resultRoutine);
            }

            resultRoutine = StartCoroutine(ShowPuzzleResultDelayed(
                title,
                explanation,
                GameStrings.T("Tekrar Dene", "Try Again"),
                shareText));
        }

        private IEnumerator ShowPuzzleResultDelayed(string title, string subtitle, string buttonLabel, string shareText)
        {
            yield return new WaitForSeconds(1.1f);
            hud.ShowPuzzleResult(title, subtitle, buttonLabel, shareText);
            resultRoutine = null;
        }

        /// <summary>
        /// Only the first attempt of the day counts; later replays are
        /// practice. Solving on consecutive days grows the puzzle streak.
        /// </summary>
        private DailyPuzzleState RecordDailyAttempt(bool solved)
        {
            var state = GamePrefs.LoadDailyPuzzle();
            string today = Puzzles.DateKeyFor(DateTime.Now);

            if (state.DateKey == today && state.Attempted)
            {
                return state; // practice run
            }

            string yesterday = Puzzles.DateKeyFor(DateTime.Now.AddDays(-1));
            state.DateKey = today;
            state.Attempted = true;
            state.Solved = solved;

            if (solved)
            {
                state.Streak = state.LastSolvedKey == yesterday ? state.Streak + 1 : 1;
                state.BestStreak = Mathf.Max(state.BestStreak, state.Streak);
                state.LastSolvedKey = today;
            }

            GamePrefs.SaveDailyPuzzle(state);
            return state;
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
            puzzleMode = false;
            gravityMode = false;
            tutorialActive = false;
            onlineRendered = null;
            onlineRenderedSequence = -1;
            onlineResultShown = false;
            onlineCelebratedSequence = -1;
            onlineLeadSign = 0;
            phase = GamePhase.Playing;

            ClearSelection();
            boardView.ClearBoard();
            boardView.ClearHints();
            hud.HideResult();
            hud.SetOnlineUi(true);
            hud.SetUndoEnabled(false);

            // Neutralize HUD text left over from a previous local game.
            hud.ClearTurnDisplay();
            hud.SetOnlineScores(null, humanPlayer, ruleset);

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

            // Rejoining the room we just left: the server reserves our seat
            // for the grace window, so a plain join would get "Room is full".
            string normalized = (code ?? "").Trim().ToUpperInvariant();

            if (normalized == lastOnlineRoom
                && url == lastOnlineUrl
                && !string.IsNullOrEmpty(lastOnlineSession))
            {
                online.ResumeSession(url, lastOnlineRoom, lastOnlinePlayer, lastOnlineSession);
                return;
            }

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
                    ApplyOnlineSnapshot(entry.Snapshot, entry.Cause);
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

            if (status != OnlineStatus.Waiting)
            {
                hud.HideRoomCode();
            }

            switch (status)
            {
                case OnlineStatus.Connecting:
                    hud.SetHint(GameStrings.T("Sunucuya bağlanılıyor…", "Connecting to server…"));
                    break;
                case OnlineStatus.Waiting:
                    hud.ClearHint();
                    hud.ShowRoomCode(online.RoomId);
                    break;
                case OnlineStatus.Connected:
                    hud.ClearHint();
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

        private void ApplyOnlineSnapshot(OnlineSnapshot snapshot, string cause)
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

                    // Lead-change narrative, from the human's perspective.
                    if (!snapshot.ResultComplete)
                    {
                        int sign = Math.Sign(snapshot.LineScoreX - snapshot.LineScoreO);

                        if (sign != onlineLeadSign && snapshot.LineScoreX + snapshot.LineScoreO > 0)
                        {
                            hud.Toast(LeadText(sign, true), 2.2f);
                        }

                        onlineLeadSign = sign;
                    }
                }
                else if (snapshot.ResultComplete && snapshot.ResultWinner != null)
                {
                    HighlightOnlineClassicWin(snapshot);
                }
            }

            // Re-delivered equal-sequence snapshots (peer-left, rejected
            // actions) must not cancel a selection the player is still making.
            bool boardChanged = onlineRendered == null || added > 0 || removed > 0;
            onlineRendered = (Player?[])snapshot.Board.Clone();
            onlineRenderedSequence = snapshot.Sequence;

            if (boardChanged || (pendingIndex >= 0 && snapshot.Board[pendingIndex] != null))
            {
                ClearSelection();
            }

            hud.SetTurn(snapshot.CurrentPlayer, true, humanPlayer, false);
            hud.SetOnlineScores(snapshot, humanPlayer, ruleset);
            UpdateOnlineEndgameBand(snapshot);
            HandleOnlineRoundState(snapshot, cause);
        }

        /// <summary>Final-six band online: only when connected and it's our turn.</summary>
        private void UpdateOnlineEndgameBand(OnlineSnapshot snapshot)
        {
            if (ruleset != Ruleset.Lines || online.Status != OnlineStatus.Connected)
            {
                return;
            }

            if (snapshot.ResultComplete || snapshot.CurrentPlayer != humanPlayer)
            {
                hud.ClearHint();
                return;
            }

            var mirror = (Player?[])snapshot.Board.Clone();
            var endgame = LinesTension.Analyze(mirror, humanPlayer);
            hud.SetHint(endgame == null ? "" : BandText(endgame));
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

        private void HandleOnlineRoundState(OnlineSnapshot snapshot, string cause)
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
                    onlineLeadSign = 0;
                    phase = GamePhase.Playing;
                    hud.HideResult();

                    // The rematch moment deserves more than a generic toast.
                    if (cause == "reset-match")
                    {
                        hud.Toast(GameStrings.T(
                            "Rakip rövanş istedi — başlıyor!",
                            "The opponent wants a rematch — here we go!"), 2.5f);
                        gameAudio.PlayLines(2);
                    }
                    else if (cause == "reset-round")
                    {
                        hud.Toast(GameStrings.T("Rakip yeni turu başlattı!", "The opponent started the next round!"), 2f);
                    }
                    else
                    {
                        hud.Toast(GameStrings.T("Yeni tur!", "New round!"), 2f);
                    }
                }

                return;
            }

            if (onlineResultShown)
            {
                return;
            }

            onlineResultShown = true;
            phase = snapshot.MatchComplete ? GamePhase.MatchOver : GamePhase.RoundOver;

            // Celebrate each round end once: a rejected reset re-delivers the
            // same completed snapshot, which should re-show the panel quietly.
            bool celebrate = snapshot.Sequence != onlineCelebratedSequence;
            onlineCelebratedSequence = snapshot.Sequence;
            bool humanWon = snapshot.ResultWinner != null && snapshot.ResultWinner.Value == humanPlayer;

            if (celebrate && snapshot.MatchComplete)
            {
                var toasts = new List<string>();
                AppendAchievementToasts(Achievements.OnOnlineMatchComplete(), toasts);
                ShowProgressionToasts(toasts);
            }

            if (celebrate)
            {
                gameAudio.PlayRoundEnd(humanWon, snapshot.ResultWinner == null);

                if (snapshot.ResultWinner != null)
                {
                    boardView.PulseBeams(snapshot.ResultWinner.Value, ResultDelaySeconds);

                    if (humanWon)
                    {
                        boardView.PlayConfetti();
                    }
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
                ? GameStrings.T("Rövanş", "Rematch")
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
            // Online: fairness; puzzle: hints would spell out the answer.
            if (onlineMode || puzzleMode)
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

            var danger = Rules.GetThreatCellCounts(board, Rules.GetOtherPlayer(currentPlayer));
            var scoring = Rules.GetThreatCellCounts(board, currentPlayer);

            if (gravityMode)
            {
                // Tower: only show threats playable THIS turn — a floating
                // "block here" cube would bait the player into dropping a
                // mark underneath it and legalizing the rival's win.
                danger = FilterGravityLegal(danger);
                scoring = FilterGravityLegal(scoring);
            }

            boardView.ShowHints(danger, scoring);
        }

        private Dictionary<int, int> FilterGravityLegal(Dictionary<int, int> cells)
        {
            var filtered = new Dictionary<int, int>();

            foreach (var entry in cells)
            {
                if (Rules.IsGravityLegal(board, entry.Key))
                {
                    filtered[entry.Key] = entry.Value;
                }
            }

            return filtered;
        }

        // ------------------------------------------------------------------
        // Persistence
        // ------------------------------------------------------------------

        private void SaveProgress(int stage)
        {
            if (onlineMode || puzzleMode || match == null || match.IsComplete)
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
                Gravity = gravityMode,
            });
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused && !onlineMode && !puzzleMode
                && match != null && !match.IsComplete && !matchEndedByDraw
                && phase != GamePhase.Menu && phase != GamePhase.MatchOver)
            {
                SaveProgress(phase == GamePhase.RoundOver ? 1 : 0);
            }
        }

        // ------------------------------------------------------------------
        // Progression celebration (achievements + daily goals)
        // ------------------------------------------------------------------

        private static void AppendAchievementToasts(List<Achievements.Def> earned, List<string> toasts)
        {
            foreach (var def in earned)
            {
                toasts.Add(GameStrings.T("Başarım: ", "Achievement: ") + def.Name() + "!");
            }
        }

        private static void AppendGoalToasts(DailyGoals.ProgressReport report, List<string> toasts)
        {
            foreach (var goal in report.CompletedNow)
            {
                toasts.Add(GameStrings.T("Hedef tamam: ", "Goal done: ") + goal.Text());
            }

            if (report.DayJustCompleted)
            {
                toasts.Add(GameStrings.T(
                    "Günün 3 hedefi tamam! Yıldız serisi: " + report.StarStreak,
                    "All 3 daily goals done! Star streak: " + report.StarStreak));
            }
        }

        private void ShowProgressionToasts(List<string> toasts)
        {
            if (toasts.Count == 0)
            {
                return;
            }

            gameAudio.PlayLines(2);
            hud.Toast(string.Join("\n", toasts.ToArray()), 2.2f + toasts.Count * 0.9f);
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
