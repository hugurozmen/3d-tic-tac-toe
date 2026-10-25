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
        RoundOver,
        MatchOver,
    }

    /// <summary>
    /// Owns the match flow: builds the scene, routes taps into the rules,
    /// runs the AI on a background thread, and drives the HUD.
    /// </summary>
    public sealed class GameController : MonoBehaviour
    {
        private const float AiMinThinkSeconds = 0.5f;

        private BoardView boardView;
        private GameHud hud;
        private Camera gameCamera;

        private GamePhase phase = GamePhase.Menu;
        private bool soloMode = true;
        private Ruleset ruleset = Ruleset.Lines;
        private Difficulty difficulty = Difficulty.Balanced;
        private readonly Player humanPlayer = Player.X;

        private Player?[] board;
        private Player currentPlayer;
        private MatchState match;
        private GameResult lastResult;

        private Task<int?> aiTask;
        private float aiStartedAt;

        private void Awake()
        {
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

            var orbit = gameCamera.gameObject.GetComponent<CameraOrbit>();

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

            var hudObject = new GameObject("Hud");
            hudObject.transform.SetParent(transform, false);
            hud = hudObject.AddComponent<GameHud>();
            hud.Initialize(this);

            Application.targetFrameRate = 60;
        }

        // ------------------------------------------------------------------
        // Flow control (called from the HUD)
        // ------------------------------------------------------------------

        public void StartMatch(bool solo, Ruleset selectedRuleset, Difficulty selectedDifficulty)
        {
            soloMode = solo;
            ruleset = selectedRuleset;
            difficulty = selectedDifficulty;
            match = MatchState.Create(Player.X);
            StartRound();
            hud.ShowGame();
        }

        public void BackToMenu()
        {
            aiTask = null;
            phase = GamePhase.Menu;
            boardView.ClearBoard();
            hud.ShowMenu();
        }

        public void ResultContinuePressed()
        {
            if (phase == GamePhase.MatchOver)
            {
                match = MatchState.Create(Player.X);
                StartRound();
                hud.ShowGame();
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
            hud.HideResult();
            currentPlayer = match.Opener;
            lastResult = Rules.EvaluateBoard(board, ruleset);
            phase = GamePhase.Playing;
            RefreshHud();
            MaybeStartAiTurn();
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

            PlaceMark(index);
        }

        private void PlaceMark(int index)
        {
            var previous = (Player?[])board.Clone();
            board[index] = currentPlayer;
            boardView.SetMark(index, currentPlayer);

            if (ruleset == Ruleset.Lines)
            {
                foreach (var line in Rules.GetNewCompletedLines(previous, board, currentPlayer))
                {
                    boardView.AddLineBeam(line, currentPlayer);
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
            MaybeStartAiTurn();
        }

        private void MaybeStartAiTurn()
        {
            if (!soloMode || phase != GamePhase.Playing || currentPlayer == humanPlayer)
            {
                return;
            }

            phase = GamePhase.AiThinking;
            RefreshHud();

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

            if (task.IsFaulted || task.Result == null)
            {
                Debug.LogWarning("TicTacube: AI move failed, picking first free cell.");
                var moves = Rules.GetAvailableMoves(board);

                if (moves.Count == 0)
                {
                    phase = GamePhase.Playing;
                    return;
                }

                phase = GamePhase.Playing;
                PlaceAiMark(moves[0]);
                return;
            }

            phase = GamePhase.Playing;
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
            match.RecordRound(lastResult.Winner, lastResult.IsDraw);
            phase = match.IsComplete ? GamePhase.MatchOver : GamePhase.RoundOver;
            RefreshHud();

            string title;
            string subtitle;

            if (lastResult.Winner != null)
            {
                string winnerName = WinnerName(lastResult.Winner.Value);
                title = GameStrings.T(winnerName + " turu kazandı!", winnerName + " wins the round!");
            }
            else
            {
                title = GameStrings.T("Berabere!", "It's a draw!");
            }

            if (ruleset == Ruleset.Lines)
            {
                subtitle = GameStrings.T("Çizgiler  X: ", "Lines  X: ")
                    + lastResult.LineScoreX + "  O: " + lastResult.LineScoreO;
            }
            else
            {
                subtitle = GameStrings.T("Maç ", "Match ") + match.WinsX + " - " + match.WinsO;
            }

            string buttonLabel;

            if (match.IsComplete)
            {
                string matchWinner = WinnerName(match.Winner.Value);
                title = GameStrings.T(matchWinner + " maçı kazandı!", matchWinner + " wins the match!");
                subtitle = GameStrings.T("Skor ", "Score ") + match.WinsX + " - " + match.WinsO
                    + GameStrings.T("  Berabere: ", "  Draws: ") + match.Draws;
                buttonLabel = GameStrings.T("Yeni Maç", "New Match");
            }
            else
            {
                buttonLabel = GameStrings.T("Sonraki Tur", "Next Round");
            }

            hud.ShowResult(title, subtitle, buttonLabel);
        }

        private string WinnerName(Player player)
        {
            if (!soloMode)
            {
                return player.ToString();
            }

            return player == humanPlayer
                ? GameStrings.T("Sen", "You")
                : GameStrings.T("Rakip", "Opponent");
        }

        private void RefreshHud()
        {
            hud.SetTurn(currentPlayer, soloMode, humanPlayer, phase == GamePhase.AiThinking);
            hud.SetScores(match, lastResult, ruleset);
        }
    }
}
