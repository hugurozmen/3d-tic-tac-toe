using System.Collections;
using System.Collections.Generic;
using System.Threading.Tasks;
using TicTacube.Core;
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
        private int pendingIndex = -1;
        private readonly List<KeyValuePair<int, Player>> moveHistory = new List<KeyValuePair<int, Player>>();

        private bool tutorialActive;
        private int tutorialStep;

        private Task<int?> aiTask;
        private float aiStartedAt;
        private Coroutine resultRoutine;

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
            lastResult = Rules.EvaluateBoard(board, ruleset);
            phase = GamePhase.Playing;
            hud.ShowGame();
            RefreshHud();
            UpdateHints();
            MaybeStartAiTurn();
        }

        public void BackToMenu()
        {
            if (resultRoutine != null)
            {
                StopCoroutine(resultRoutine);
                resultRoutine = null;
            }

            if (match != null && !match.IsComplete && phase != GamePhase.Menu)
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
            if (phase == GamePhase.Playing && pendingIndex >= 0 && board[pendingIndex] == null)
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
                    foreach (var line in newLines)
                    {
                        boardView.AddLineBeam(line, mover);
                    }

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

            pieResolved = true;

            if (soloMode && currentPlayer != humanPlayer)
            {
                // AI responds to the human's opening.
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

                return false;
            }

            // A human responds (the human in solo, or player 2 in duo).
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
            if (phase != GamePhase.Playing || moveHistory.Count == 0)
            {
                return;
            }

            int undoCount = soloMode ? 2 : 1;

            // In solo, only undo when it's the human's turn and a full
            // human+AI pair exists; a single trailing human move also works.
            if (soloMode && currentPlayer != humanPlayer)
            {
                return;
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
            board = Rules.CreateBoard();

            foreach (var move in moveHistory)
            {
                var previous = (Player?[])board.Clone();
                board[move.Key] = move.Value;
                boardView.SetMark(move.Key, move.Value, false);

                if (ruleset == Ruleset.Lines)
                {
                    foreach (var line in Rules.GetNewCompletedLines(previous, board, move.Value))
                    {
                        boardView.AddLineBeam(line, move.Value);
                    }
                }
            }

            currentPlayer = moveHistory.Count > 0
                ? Rules.GetOtherPlayer(moveHistory[moveHistory.Count - 1].Value)
                : match.Opener;
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

            foreach (var line in Rules.GetCompletedLines(board, Player.X))
            {
                boardView.AddLineBeam(line, Player.X);
            }

            foreach (var line in Rules.GetCompletedLines(board, Player.O))
            {
                boardView.AddLineBeam(line, Player.O);
            }
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
            phase = match.IsComplete ? GamePhase.MatchOver : GamePhase.RoundOver;
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

            if (match.IsComplete)
            {
                GamePrefs.ClearSave();

                if (soloMode && match.Winner != null)
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
            string buttonLabel = match.IsComplete
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
            if (match == null || match.IsComplete)
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
            if (paused && match != null && !match.IsComplete && phase != GamePhase.Menu)
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
