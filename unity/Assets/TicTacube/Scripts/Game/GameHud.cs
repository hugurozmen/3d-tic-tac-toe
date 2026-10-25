using System;
using TicTacube.Core;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace TicTacube.Game
{
    /// <summary>
    /// Runtime-built uGUI: main menu, in-game HUD, and the round/match result
    /// overlay. No prefabs or scene wiring needed.
    /// </summary>
    public sealed class GameHud : MonoBehaviour
    {
        private static readonly Color PanelColor = new Color(0.08f, 0.1f, 0.16f, 0.92f);
        private static readonly Color ButtonColor = new Color(0.17f, 0.22f, 0.33f, 1f);
        private static readonly Color AccentColor = new Color(0.33f, 0.62f, 0.95f, 1f);
        private static readonly Color TextColor = new Color(0.92f, 0.94f, 0.98f, 1f);
        private static readonly Color MutedColor = new Color(0.65f, 0.7f, 0.8f, 1f);

        private GameController controller;
        private Font font;

        private GameObject menuPanel;
        private GameObject hudPanel;
        private GameObject resultPanel;

        private Text modeLabel;
        private Text rulesetLabel;
        private Text difficultyLabel;
        private Text languageLabel;
        private Text turnLabel;
        private Text scoreLabel;
        private Text lineScoreLabel;
        private Text thinkingLabel;
        private Text resultTitle;
        private Text resultSubtitle;
        private Text resultButtonLabel;

        private bool menuSolo = true;
        private Ruleset menuRuleset = Ruleset.Lines;
        private Difficulty menuDifficulty = Difficulty.Balanced;

        public void Initialize(GameController gameController)
        {
            controller = gameController;
            font = LoadFont();

            EnsureEventSystem();
            BuildCanvas();
            BuildMenu();
            BuildHud();
            BuildResultOverlay();
            ShowMenu();
        }

        private static Font LoadFont()
        {
            Font loaded = null;

            try
            {
                loaded = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            }
            catch (Exception)
            {
                loaded = null;
            }

            if (loaded == null)
            {
                try
                {
                    loaded = Resources.GetBuiltinResource<Font>("Arial.ttf");
                }
                catch (Exception)
                {
                    loaded = null;
                }
            }

            return loaded;
        }

        private static void EnsureEventSystem()
        {
            if (UnityEngine.Object.FindObjectOfType<EventSystem>() != null)
            {
                return;
            }

            var eventSystemObject = new GameObject("EventSystem");
            eventSystemObject.AddComponent<EventSystem>();
            eventSystemObject.AddComponent<StandaloneInputModule>();
        }

        private void BuildCanvas()
        {
            var canvas = gameObject.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10;

            var scaler = gameObject.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080f, 1920f);
            scaler.matchWidthOrHeight = 0.5f;

            gameObject.AddComponent<GraphicRaycaster>();
        }

        private RectTransform CreateRect(string name, Transform parent)
        {
            var child = new GameObject(name);
            var rect = child.AddComponent<RectTransform>();
            rect.SetParent(parent, false);
            return rect;
        }

        private static void Stretch(RectTransform rect)
        {
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
        }

        private Text CreateText(Transform parent, string name, string value, int size, TextAnchor anchor, Color color)
        {
            var rect = CreateRect(name, parent);
            var text = rect.gameObject.AddComponent<Text>();
            text.font = font;
            text.text = value;
            text.fontSize = size;
            text.alignment = anchor;
            text.color = color;
            text.raycastTarget = false;
            return text;
        }

        private Button CreateButton(Transform parent, string name, string label, int fontSize, Action onClick, out Text labelText)
        {
            var rect = CreateRect(name, parent);
            var image = rect.gameObject.AddComponent<Image>();
            image.color = ButtonColor;

            var button = rect.gameObject.AddComponent<Button>();
            button.targetGraphic = image;
            button.onClick.AddListener(() =>
            {
                if (onClick != null)
                {
                    onClick();
                }
            });

            labelText = CreateText(rect, "Label", label, fontSize, TextAnchor.MiddleCenter, TextColor);
            Stretch((RectTransform)labelText.transform);

            return button;
        }

        private static void Place(RectTransform rect, Vector2 anchor, Vector2 position, Vector2 size)
        {
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = anchor;
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
        }

        // ------------------------------------------------------------------
        // Menu
        // ------------------------------------------------------------------

        private void BuildMenu()
        {
            var rect = CreateRect("Menu", transform);
            Stretch(rect);
            menuPanel = rect.gameObject;

            var backdrop = rect.gameObject.AddComponent<Image>();
            backdrop.color = PanelColor;

            var title = CreateText(rect, "Title", "TicTacube", 110, TextAnchor.MiddleCenter, TextColor);
            Place((RectTransform)title.transform, new Vector2(0.5f, 1f), new Vector2(0f, -220f), new Vector2(900f, 140f));

            var subtitle = CreateText(
                rect,
                "Subtitle",
                GameStrings.T("3x3x3 XOX strateji oyunu", "3x3x3 XOX strategy game"),
                44,
                TextAnchor.MiddleCenter,
                MutedColor);
            Place((RectTransform)subtitle.transform, new Vector2(0.5f, 1f), new Vector2(0f, -340f), new Vector2(900f, 70f));

            float y = -560f;
            const float rowHeight = 130f;
            const float rowGap = 40f;
            var rowSize = new Vector2(760f, rowHeight);

            CreateMenuRow(rect, "ModeRow", new Vector2(0f, y), rowSize, CycleMode, out modeLabel);
            y -= rowHeight + rowGap;
            CreateMenuRow(rect, "RulesetRow", new Vector2(0f, y), rowSize, CycleRuleset, out rulesetLabel);
            y -= rowHeight + rowGap;
            CreateMenuRow(rect, "DifficultyRow", new Vector2(0f, y), rowSize, CycleDifficulty, out difficultyLabel);
            y -= rowHeight + rowGap;
            CreateMenuRow(rect, "LanguageRow", new Vector2(0f, y), rowSize, CycleLanguage, out languageLabel);
            y -= rowHeight + rowGap * 2f;

            Text startLabel;
            var startButton = CreateButton(rect, "Start", "", 56, StartPressed, out startLabel);
            var startRect = (RectTransform)startButton.transform;
            Place(startRect, new Vector2(0.5f, 1f), new Vector2(0f, y), new Vector2(760f, 150f));
            startButton.GetComponent<Image>().color = AccentColor;
            startLabel.text = GameStrings.T("Başlat", "Start");
            startLabel.fontStyle = FontStyle.Bold;

            RefreshMenuLabels();
        }

        private void CreateMenuRow(
            RectTransform parent,
            string name,
            Vector2 position,
            Vector2 size,
            Action onClick,
            out Text label)
        {
            var button = CreateButton(parent, name, "", 48, onClick, out label);
            Place((RectTransform)button.transform, new Vector2(0.5f, 1f), position, size);
        }

        private void CycleMode()
        {
            menuSolo = !menuSolo;
            RefreshMenuLabels();
        }

        private void CycleRuleset()
        {
            menuRuleset = menuRuleset == Ruleset.Lines ? Ruleset.Classic : Ruleset.Lines;
            RefreshMenuLabels();
        }

        private void CycleDifficulty()
        {
            menuDifficulty = menuDifficulty == Difficulty.Easy
                ? Difficulty.Balanced
                : menuDifficulty == Difficulty.Balanced
                    ? Difficulty.Hard
                    : menuDifficulty == Difficulty.Hard
                        ? Difficulty.Master
                        : Difficulty.Easy;
            RefreshMenuLabels();
        }

        private void CycleLanguage()
        {
            GameStrings.Turkish = !GameStrings.Turkish;
            RefreshMenuLabels();
        }

        public static string RulesetName(Ruleset ruleset)
        {
            return ruleset == Ruleset.Lines
                ? GameStrings.T("Çizgiler", "Lines")
                : GameStrings.T("Klasik", "Classic");
        }

        public static string DifficultyName(Difficulty difficulty)
        {
            switch (difficulty)
            {
                case Difficulty.Easy:
                    return GameStrings.T("Kolay", "Easy");
                case Difficulty.Balanced:
                    return GameStrings.T("Dengeli", "Balanced");
                case Difficulty.Hard:
                    return GameStrings.T("Zor", "Hard");
                default:
                    return GameStrings.T("Usta", "Master");
            }
        }

        private void RefreshMenuLabels()
        {
            modeLabel.text = GameStrings.T("Mod: ", "Mode: ")
                + (menuSolo
                    ? GameStrings.T("Tek Oyuncu", "Single Player")
                    : GameStrings.T("İki Oyuncu", "Two Players"));
            rulesetLabel.text = GameStrings.T("Kurallar: ", "Ruleset: ") + RulesetName(menuRuleset);
            difficultyLabel.text = GameStrings.T("Zorluk: ", "Difficulty: ") + DifficultyName(menuDifficulty);
            difficultyLabel.color = menuSolo ? TextColor : MutedColor;
            languageLabel.text = GameStrings.T("Dil: Türkçe", "Language: English");

            var startLabel = menuPanel.transform.Find("Start/Label");

            if (startLabel != null)
            {
                startLabel.GetComponent<Text>().text = GameStrings.T("Başlat", "Start");
            }

            var subtitle = menuPanel.transform.Find("Subtitle");

            if (subtitle != null)
            {
                subtitle.GetComponent<Text>().text =
                    GameStrings.T("3x3x3 XOX strateji oyunu", "3x3x3 XOX strategy game");
            }
        }

        private void StartPressed()
        {
            controller.StartMatch(menuSolo, menuRuleset, menuDifficulty);
        }

        // ------------------------------------------------------------------
        // In-game HUD
        // ------------------------------------------------------------------

        private void BuildHud()
        {
            var rect = CreateRect("Hud", transform);
            Stretch(rect);
            hudPanel = rect.gameObject;

            var topBar = CreateRect("TopBar", rect);
            Place(topBar, new Vector2(0.5f, 1f), new Vector2(0f, 0f), new Vector2(1080f, 170f));
            var topImage = topBar.gameObject.AddComponent<Image>();
            topImage.color = new Color(0.08f, 0.1f, 0.16f, 0.75f);
            topImage.raycastTarget = false;

            turnLabel = CreateText(topBar, "Turn", "", 52, TextAnchor.MiddleLeft, TextColor);
            Place((RectTransform)turnLabel.transform, new Vector2(0f, 0.5f), new Vector2(40f, 0f), new Vector2(520f, 150f));

            scoreLabel = CreateText(topBar, "Score", "", 46, TextAnchor.MiddleRight, TextColor);
            Place((RectTransform)scoreLabel.transform, new Vector2(1f, 0.5f), new Vector2(-40f, 25f), new Vector2(520f, 80f));

            lineScoreLabel = CreateText(topBar, "LineScore", "", 40, TextAnchor.MiddleRight, MutedColor);
            Place((RectTransform)lineScoreLabel.transform, new Vector2(1f, 0.5f), new Vector2(-40f, -40f), new Vector2(520f, 70f));

            thinkingLabel = CreateText(rect, "Thinking", "", 44, TextAnchor.MiddleCenter, MutedColor);
            Place((RectTransform)thinkingLabel.transform, new Vector2(0.5f, 0f), new Vector2(0f, 220f), new Vector2(800f, 70f));

            Text menuButtonLabel;
            var menuButton = CreateButton(rect, "MenuButton", "", 42, controller.BackToMenu, out menuButtonLabel);
            Place((RectTransform)menuButton.transform, new Vector2(0f, 0f), new Vector2(40f, 40f), new Vector2(260f, 110f));
            menuButtonLabel.text = GameStrings.T("Menü", "Menu");
        }

        // ------------------------------------------------------------------
        // Result overlay
        // ------------------------------------------------------------------

        private void BuildResultOverlay()
        {
            var rect = CreateRect("Result", transform);
            Stretch(rect);
            resultPanel = rect.gameObject;

            var backdrop = rect.gameObject.AddComponent<Image>();
            backdrop.color = new Color(0.03f, 0.04f, 0.08f, 0.82f);

            resultTitle = CreateText(rect, "ResultTitle", "", 86, TextAnchor.MiddleCenter, TextColor);
            Place((RectTransform)resultTitle.transform, new Vector2(0.5f, 0.5f), new Vector2(0f, 180f), new Vector2(980f, 140f));
            resultTitle.fontStyle = FontStyle.Bold;

            resultSubtitle = CreateText(rect, "ResultSubtitle", "", 50, TextAnchor.MiddleCenter, MutedColor);
            Place((RectTransform)resultSubtitle.transform, new Vector2(0.5f, 0.5f), new Vector2(0f, 60f), new Vector2(980f, 90f));

            var continueButton = CreateButton(rect, "Continue", "", 54, controller.ResultContinuePressed, out resultButtonLabel);
            Place((RectTransform)continueButton.transform, new Vector2(0.5f, 0.5f), new Vector2(0f, -120f), new Vector2(620f, 150f));
            continueButton.GetComponent<Image>().color = AccentColor;

            Text toMenuLabel;
            var toMenuButton = CreateButton(rect, "ToMenu", "", 46, controller.BackToMenu, out toMenuLabel);
            Place((RectTransform)toMenuButton.transform, new Vector2(0.5f, 0.5f), new Vector2(0f, -310f), new Vector2(620f, 120f));
            toMenuLabel.text = GameStrings.T("Menüye Dön", "Back to Menu");
        }

        // ------------------------------------------------------------------
        // Public API used by the controller
        // ------------------------------------------------------------------

        public void ShowMenu()
        {
            menuPanel.SetActive(true);
            hudPanel.SetActive(false);
            resultPanel.SetActive(false);
            RefreshMenuLabels();
        }

        public void ShowGame()
        {
            menuPanel.SetActive(false);
            hudPanel.SetActive(true);
            resultPanel.SetActive(false);
        }

        public void SetTurn(Player player, bool soloMode, Player humanPlayer, bool aiThinking)
        {
            string who;

            if (soloMode)
            {
                who = player == humanPlayer
                    ? GameStrings.T("Sıra sende", "Your turn") + " (" + player + ")"
                    : GameStrings.T("Rakibin sırası", "Opponent's turn") + " (" + player + ")";
            }
            else
            {
                who = GameStrings.T("Sıra: ", "Turn: ") + player;
            }

            turnLabel.text = who;
            thinkingLabel.text = aiThinking ? GameStrings.T("Rakip düşünüyor…", "Opponent is thinking…") : "";
        }

        public void SetScores(MatchState match, GameResult result, Ruleset ruleset)
        {
            scoreLabel.text = GameStrings.T("Maç ", "Match ")
                + match.WinsX + " - " + match.WinsO
                + GameStrings.T("  Tur ", "  Round ") + match.RoundNumber;

            if (ruleset == Ruleset.Lines && result != null)
            {
                lineScoreLabel.text = GameStrings.T("Çizgiler  X: ", "Lines  X: ")
                    + result.LineScoreX + "  O: " + result.LineScoreO;
            }
            else
            {
                lineScoreLabel.text = "";
            }
        }

        public void ShowResult(string title, string subtitle, string buttonLabel)
        {
            resultPanel.SetActive(true);
            resultTitle.text = title;
            resultSubtitle.text = subtitle;
            resultButtonLabel.text = buttonLabel;
        }

        public void HideResult()
        {
            resultPanel.SetActive(false);
        }
    }
}
