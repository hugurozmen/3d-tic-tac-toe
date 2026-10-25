using System;
using System.Collections;
using TicTacube.Core;
using TicTacube.Online;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace TicTacube.Game
{
    /// <summary>
    /// Runtime-built uGUI: main menu (with ruleset explanations, match length,
    /// stats and settings), in-game HUD (turn strip, scores, hint bar, confirm
    /// and undo buttons, layer/analysis toggles), floating score text, the Pie
    /// Rule prompt, and the round/match result overlay. No prefabs needed.
    /// </summary>
    public sealed class GameHud : MonoBehaviour
    {
        private static readonly Color PanelColor = new Color(0.08f, 0.1f, 0.16f, 0.92f);
        private static readonly Color ButtonColor = new Color(0.17f, 0.22f, 0.33f, 1f);
        private static readonly Color AccentColor = new Color(0.33f, 0.62f, 0.95f, 1f);
        private static readonly Color AccentDimColor = new Color(0.25f, 0.42f, 0.62f, 1f);
        private static readonly Color TextColor = new Color(0.92f, 0.94f, 0.98f, 1f);
        private static readonly Color MutedColor = new Color(0.68f, 0.73f, 0.82f, 1f);
        private static readonly Color XColor = new Color(0.96f, 0.47f, 0.37f, 1f);
        private static readonly Color OColor = new Color(0.42f, 0.68f, 0.97f, 1f);

        private GameController controller;
        private Font font;

        private GameObject menuPanel;
        private GameObject hudPanel;
        private GameObject resultPanel;
        private GameObject piePanel;
        private GameObject returnToResultButton;

        private Text modeLabel;
        private Text rulesetLabel;
        private Text rulesetDescription;
        private Text difficultyLabel;
        private Text statsLabel;
        private Text matchLengthLabel;
        private Text soundLabel;
        private Text effectsLabel;
        private Text quickMoveLabel;
        private Text languageLabel;
        private Text subtitleLabel;
        private Text startLabel;
        private Button resumeButton;
        private Text resumeLabel;

        private Image turnStrip;
        private Text turnLabel;
        private Text scoreLabel;
        private Text lineScoreLabel;
        private Text hintLabel;
        private Image hintBackground;
        private Text thinkingLabel;
        private Button confirmButton;
        private Text confirmLabel;
        private Button undoButton;
        private Text undoLabel;
        private Text layersLabel;
        private Text analysisLabel;
        private Text menuButtonLabel;

        private Text resultTitle;
        private Text resultSubtitle;
        private Text resultButtonLabel;
        private Text peekLabel;
        private Text toMenuLabel;
        private Text pieQuestion;
        private Text pieYesLabel;
        private Text pieNoLabel;
        private Text returnLabel;

        private GameObject roomCodePanel;
        private Text roomCodeText;
        private Text roomCodeCaption;
        private Text roomCodeCopyLabel;
        private string shownRoomCode = "";
        private Text dailyPuzzleLabel;
        private Text progressLabel;
        private GameObject progressPanel;
        private RectTransform progressContent;

        private int shownLineA = -1;
        private int shownLineB = -1;
        private Coroutine lineScoreRoutine;
        private Coroutine thinkingRoutine;
        private bool puzzleResultMode;
        private string puzzleShareText = "";

        private int menuMode; // 0 solo, 1 duo, 2 online
        private int menuRulesetIndex; // 0 Lines, 1 Classic, 2 Tower Lines, 3 Tower Classic
        private Difficulty menuDifficulty = Difficulty.Balanced;
        private int menuTargetWins = 1;

        private GameObject difficultyRowObject;
        private GameObject matchRowObject;
        private InputField serverUrlField;
        private GameObject serverUrlRowObject;
        private InputField roomCodeField;
        private GameObject joinRowObject;
        private Text joinLabel;
        private Button reconnectButton;
        private Text reconnectLabel;
        private GameObject undoButtonObject;
        private GameObject analysisButtonObject;

        private Coroutine toastRoutine;

        private bool MenuSolo { get { return menuMode == 0; } }
        private bool MenuOnline { get { return menuMode == 2; } }

        public void Initialize(GameController gameController)
        {
            controller = gameController;
            font = LoadFont();

            EnsureEventSystem();
            BuildCanvas();
            BuildMenu();
            BuildHud();
            BuildResultOverlay();
            BuildRoomCodePanel();
            BuildPiePanel();
            BuildProgressPanel();
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

        // ------------------------------------------------------------------
        // Small factories
        // ------------------------------------------------------------------

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

        private Button CreateButton(Transform parent, string name, int fontSize, Action onClick, out Text labelText)
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

            labelText = CreateText(rect, "Label", "", fontSize, TextAnchor.MiddleCenter, TextColor);
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

        private InputField CreateInputField(Transform parent, string name, Vector2 position, Vector2 size, int fontSize)
        {
            var rect = CreateRect(name, parent);
            Place(rect, new Vector2(0.5f, 1f), position, size);
            var background = rect.gameObject.AddComponent<Image>();
            background.color = new Color(0.12f, 0.15f, 0.23f, 1f);

            var input = rect.gameObject.AddComponent<InputField>();

            var placeholder = CreateText(rect, "Placeholder", "", fontSize, TextAnchor.MiddleCenter, MutedColor);
            Stretch((RectTransform)placeholder.transform);

            var text = CreateText(rect, "Text", "", fontSize, TextAnchor.MiddleCenter, TextColor);
            Stretch((RectTransform)text.transform);
            text.supportRichText = false;

            input.textComponent = text;
            input.placeholder = placeholder;
            return input;
        }

        private static void AddOutline(Text text)
        {
            var outline = text.gameObject.AddComponent<Outline>();
            outline.effectColor = new Color(0f, 0f, 0f, 0.75f);
            outline.effectDistance = new Vector2(2f, -2f);
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

            var title = CreateText(rect, "Title", "TicTacube", 100, TextAnchor.MiddleCenter, TextColor);
            title.fontStyle = FontStyle.Bold;
            Place((RectTransform)title.transform, new Vector2(0.5f, 1f), new Vector2(0f, -140f), new Vector2(900f, 130f));

            subtitleLabel = CreateText(rect, "Subtitle", "", 40, TextAnchor.MiddleCenter, MutedColor);
            Place((RectTransform)subtitleLabel.transform, new Vector2(0.5f, 1f), new Vector2(0f, -268f), new Vector2(900f, 58f));

            statsLabel = CreateText(rect, "Stats", "", 34, TextAnchor.MiddleCenter, MutedColor);
            Place((RectTransform)statsLabel.transform, new Vector2(0.5f, 1f), new Vector2(0f, -330f), new Vector2(900f, 50f));

            var rowSize = new Vector2(760f, 108f);

            CreateMenuRow(rect, "ModeRow", new Vector2(0f, -412f), rowSize, CycleMode, out modeLabel);
            CreateMenuRow(rect, "RulesetRow", new Vector2(0f, -544f), rowSize, CycleRuleset, out rulesetLabel);

            rulesetDescription = CreateText(rect, "RulesetDesc", "", 30, TextAnchor.MiddleCenter, MutedColor);
            Place((RectTransform)rulesetDescription.transform, new Vector2(0.5f, 1f), new Vector2(0f, -658f), new Vector2(880f, 76f));

            CreateMenuRow(rect, "DifficultyRow", new Vector2(0f, -744f), rowSize, CycleDifficulty, out difficultyLabel);
            difficultyRowObject = difficultyLabel.transform.parent.gameObject;
            CreateMenuRow(rect, "MatchRow", new Vector2(0f, -876f), rowSize, CycleMatchLength, out matchLengthLabel);
            matchRowObject = matchLengthLabel.transform.parent.gameObject;

            // Online rows occupy the difficulty/match slots in online mode.
            serverUrlField = CreateInputField(rect, "ServerUrlRow", new Vector2(0f, -744f), rowSize, 34);
            serverUrlRowObject = serverUrlField.gameObject;

            roomCodeField = CreateInputField(rect, "RoomCodeRow", new Vector2(-190f, -876f), new Vector2(380f, 108f), 48);
            roomCodeField.characterLimit = 5;
            Text joinText;
            var joinButton = CreateButton(rect, "JoinRow", 44, JoinPressed, out joinText);
            joinLabel = joinText;
            Place((RectTransform)joinButton.transform, new Vector2(0.5f, 1f), new Vector2(190f, -876f), new Vector2(360f, 108f));
            joinButton.GetComponent<Image>().color = AccentDimColor;
            joinRowObject = joinButton.gameObject;

            var halfSize = new Vector2(368f, 94f);
            CreateMenuRow(rect, "SoundRow", new Vector2(-198f, -1008f), halfSize, ToggleSound, out soundLabel);
            CreateMenuRow(rect, "EffectsRow", new Vector2(198f, -1008f), halfSize, ToggleEffects, out effectsLabel);
            CreateMenuRow(rect, "QuickRow", new Vector2(-198f, -1122f), halfSize, ToggleQuickMove, out quickMoveLabel);
            CreateMenuRow(rect, "LanguageRow", new Vector2(198f, -1122f), halfSize, CycleLanguage, out languageLabel);

            Text progressText;
            var progressButton = CreateButton(rect, "Progress", 32, ProgressPressed, out progressText);
            progressLabel = progressText;
            Place((RectTransform)progressButton.transform, new Vector2(0f, 1f), new Vector2(28f, -28f), new Vector2(330f, 130f));
            progressButton.GetComponent<Image>().color = AccentDimColor;

            Text dailyText;
            var dailyButton = CreateButton(rect, "DailyPuzzle", 34, DailyPuzzlePressed, out dailyText);
            dailyPuzzleLabel = dailyText;
            Place((RectTransform)dailyButton.transform, new Vector2(1f, 1f), new Vector2(-28f, -28f), new Vector2(330f, 130f));
            dailyButton.GetComponent<Image>().color = AccentDimColor;

            resumeButton = CreateButton(rect, "Resume", 48, ResumePressed, out resumeLabel);
            Place((RectTransform)resumeButton.transform, new Vector2(0.5f, 1f), new Vector2(0f, -1248f), new Vector2(760f, 108f));
            resumeButton.GetComponent<Image>().color = AccentDimColor;

            Text startText;
            var startButton = CreateButton(rect, "Start", 56, StartPressed, out startText);
            startLabel = startText;
            Place((RectTransform)startButton.transform, new Vector2(0.5f, 1f), new Vector2(0f, -1386f), new Vector2(760f, 140f));
            startButton.GetComponent<Image>().color = AccentColor;
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
            Text text;
            var button = CreateButton(parent, name, 44, onClick, out text);
            label = text;
            Place((RectTransform)button.transform, new Vector2(0.5f, 1f), position, size);
        }

        private void CycleMode()
        {
            menuMode = (menuMode + 1) % 3;
            RefreshMenuLabels();
        }

        private Ruleset MenuRulesetBase
        {
            get { return menuRulesetIndex % 2 == 0 ? Ruleset.Lines : Ruleset.Classic; }
        }

        private bool MenuGravity
        {
            get { return menuRulesetIndex >= 2; }
        }

        private void CycleRuleset()
        {
            // Tower variants are local-only (the online server fixes rules).
            int optionCount = MenuOnline ? 2 : 4;
            menuRulesetIndex = (menuRulesetIndex + 1) % optionCount;
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

        private void CycleMatchLength()
        {
            menuTargetWins = menuTargetWins == 1 ? 2 : menuTargetWins == 2 ? 3 : 1;
            RefreshMenuLabels();
        }

        private void ToggleSound()
        {
            GamePrefs.Sound = !GamePrefs.Sound;
            RefreshMenuLabels();
        }

        private void ToggleEffects()
        {
            GamePrefs.Effects = !GamePrefs.Effects;
            RefreshMenuLabels();
        }

        private void ToggleQuickMove()
        {
            GamePrefs.QuickMove = !GamePrefs.QuickMove;
            RefreshMenuLabels();
        }

        private void CycleLanguage()
        {
            GameStrings.Turkish = !GameStrings.Turkish;
            GamePrefs.SaveTurkish(GameStrings.Turkish);
            RefreshMenuLabels();
            RefreshHudLabels();
        }

        private string MenuRulesetOptionName()
        {
            switch (menuRulesetIndex)
            {
                case 0:
                    return GameStrings.T("Çizgiler", "Lines");
                case 1:
                    return GameStrings.T("Klasik", "Classic");
                case 2:
                    return GameStrings.T("Kule (Çizgiler)", "Tower (Lines)");
                default:
                    return GameStrings.T("Kule (Klasik)", "Tower (Classic)");
            }
        }

        private string MenuRulesetDescription()
        {
            switch (menuRulesetIndex)
            {
                case 0:
                    return GameStrings.T(
                        "Tahta dolana kadar oynanır; tamamladığın her 3'lü çizgi 1 puan.\nEn çok çizgiyi yapan turu kazanır.",
                        "Play until the board fills; every completed 3-in-a-row scores 1.\nMost lines wins the round.");
                case 1:
                    return GameStrings.T(
                        "İlk 3'lü çizgiyi yapan turu kazanır.\nİlk hamleden sonra rakip taraf değişimi isteyebilir (Pie kuralı).",
                        "First 3-in-a-row wins the round.\nAfter the first move the opponent may swap sides (Pie rule).");
                case 2:
                    return GameStrings.T(
                        "Taşlar sütuna bırakılır, en alttaki boş hücreye düşer (9 hedef).\nTahta dolunca en çok çizgisi olan kazanır.",
                        "Marks drop into a column and land on its lowest empty cell (9 targets).\nMost lines on the full board wins.");
                default:
                    return GameStrings.T(
                        "Taşlar sütuna düşer; ilk 3'lü çizgiyi yapan turu kazanır.\n(Kule'de Pie kuralı yoktur.)",
                        "Marks drop into columns; first 3-in-a-row wins the round.\n(No Pie rule in Tower.)");
            }
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

        private static string OnOff(bool value)
        {
            return value ? GameStrings.T("Açık", "On") : GameStrings.T("Kapalı", "Off");
        }

        private void RefreshMenuLabels()
        {
            subtitleLabel.text = GameStrings.T("3x3x3 XOX strateji oyunu", "3x3x3 XOX strategy game");
            modeLabel.text = GameStrings.T("Mod: ", "Mode: ")
                + (menuMode == 0
                    ? GameStrings.T("Tek Oyuncu", "Single Player")
                    : menuMode == 1
                        ? GameStrings.T("İki Oyuncu", "Two Players")
                        : GameStrings.T("Online Oda", "Online Room"));
            if (MenuOnline && menuRulesetIndex >= 2)
            {
                menuRulesetIndex %= 2;
            }

            rulesetLabel.text = GameStrings.T("Kurallar: ", "Ruleset: ") + MenuRulesetOptionName();
            rulesetDescription.text = MenuRulesetDescription();
            difficultyLabel.text = GameStrings.T("Zorluk: ", "Difficulty: ") + DifficultyName(menuDifficulty);
            difficultyLabel.color = MenuSolo ? TextColor : MutedColor;
            matchLengthLabel.text = GameStrings.T("Maç: ", "Match: ")
                + (menuTargetWins == 1
                    ? GameStrings.T("Tek Tur", "Single Round")
                    : menuTargetWins + GameStrings.T(" galibiyet", " wins"));

            // Online mode swaps the difficulty/match rows for server + room code.
            difficultyRowObject.SetActive(!MenuOnline);
            matchRowObject.SetActive(!MenuOnline);
            serverUrlRowObject.SetActive(MenuOnline);
            roomCodeField.gameObject.SetActive(MenuOnline);
            joinRowObject.SetActive(MenuOnline);

            if (MenuOnline)
            {
                if (string.IsNullOrEmpty(serverUrlField.text))
                {
                    serverUrlField.text = GamePrefs.ServerUrl;
                }

                var codePlaceholder = roomCodeField.placeholder as Text;

                if (codePlaceholder != null)
                {
                    codePlaceholder.text = GameStrings.T("Oda kodu", "Room code");
                }

                joinLabel.text = GameStrings.T("Odaya Katıl", "Join Room");
            }
            soundLabel.text = GameStrings.T("Ses: ", "Sound: ") + OnOff(GamePrefs.Sound);
            effectsLabel.text = GameStrings.T("Efektler: ", "Effects: ") + OnOff(GamePrefs.Effects);
            quickMoveLabel.text = GameStrings.T("Hızlı hamle: ", "Quick move: ") + OnOff(GamePrefs.QuickMove);
            languageLabel.text = GameStrings.T("Dil: Türkçe", "Language: English");
            startLabel.text = MenuOnline
                ? GameStrings.T("Oda Kur", "Host Room")
                : GameStrings.T("Başlat", "Start");

            if (MenuSolo)
            {
                var stats = GamePrefs.LoadStats(MenuRulesetBase, menuDifficulty, MenuGravity);
                statsLabel.text = stats.Wins + stats.Losses + stats.Draws == 0
                    ? GameStrings.T("Bu zorlukta henüz maç oynamadın.", "No matches at this difficulty yet.")
                    : DifficultyName(menuDifficulty) + ": "
                        + stats.Wins + GameStrings.T("G", "W")
                        + "-" + stats.Losses + GameStrings.T("M", "L")
                        + "-" + stats.Draws + GameStrings.T("B", "D")
                        + GameStrings.T("  Seri: ", "  Streak: ") + stats.Streak
                        + GameStrings.T("  En iyi: ", "  Best: ") + stats.BestStreak;
            }
            else
            {
                statsLabel.text = "";
            }

            bool hasSave = GamePrefs.HasSave() && !MenuOnline;
            resumeButton.gameObject.SetActive(hasSave);

            if (hasSave)
            {
                resumeLabel.text = GameStrings.T("Devam Et (kayıtlı maç)", "Continue (saved match)");
            }

            RefreshDailyPuzzleLabel();
            RefreshProgressLabel();
        }

        private void RefreshProgressLabel()
        {
            DailyGoals.State goals;
            int done = DailyGoals.CompletedCount(DateTime.Now, out goals);
            progressLabel.text = GameStrings.T("Hedefler ", "Goals ") + done + "/3"
                + (goals.StarStreak > 0 ? " *" + goals.StarStreak : "")
                + "\n" + GameStrings.T("Rozet ", "Badges ") + Achievements.EarnedCount() + "/" + Achievements.All.Length;
        }

        private void ProgressPressed()
        {
            RefreshProgressPanel();
            progressPanel.SetActive(true);
        }

        private void RefreshDailyPuzzleLabel()
        {
            var daily = GamePrefs.LoadDailyPuzzle();
            string todayKey = Puzzles.DateKeyFor(DateTime.Now);
            bool playedToday = daily.DateKey == todayKey && daily.Attempted;
            string streakLine = daily.Streak > 0
                ? "\n" + GameStrings.T("Seri: ", "Streak: ") + daily.Streak
                : "";

            if (playedToday)
            {
                dailyPuzzleLabel.text = (daily.Solved
                    ? GameStrings.T("Bulmaca: çözüldü", "Puzzle: solved")
                    : GameStrings.T("Bulmaca: oynandı", "Puzzle: played")) + streakLine;
            }
            else
            {
                dailyPuzzleLabel.text = GameStrings.T("Günlük Bulmaca", "Daily Puzzle") + streakLine;
            }
        }

        private void DailyPuzzlePressed()
        {
            controller.StartDailyPuzzle();
        }

        private string ReadServerUrl()
        {
            string url = (serverUrlField.text ?? "").Trim();

            if (string.IsNullOrEmpty(url))
            {
                url = GamePrefs.ServerUrl;
            }

            GamePrefs.ServerUrl = url;
            return url;
        }

        private void StartPressed()
        {
            if (MenuOnline)
            {
                controller.StartOnlineHost(ReadServerUrl(), MenuRulesetBase);
                return;
            }

            controller.StartMatch(MenuSolo, MenuRulesetBase, menuDifficulty, menuTargetWins, MenuGravity);
        }

        private void JoinPressed()
        {
            string code = (roomCodeField.text ?? "").Trim();

            if (code.Length == 0)
            {
                Toast(GameStrings.T("Önce oda kodunu yaz.", "Enter the room code first."), 2.5f);
                return;
            }

            controller.StartOnlineJoin(ReadServerUrl(), code);
        }

        private void ResumePressed()
        {
            controller.ResumeSavedMatch();
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
            Place(topBar, new Vector2(0.5f, 1f), new Vector2(0f, 0f), new Vector2(1080f, 180f));
            var topImage = topBar.gameObject.AddComponent<Image>();
            topImage.color = new Color(0.08f, 0.1f, 0.16f, 0.75f);
            topImage.raycastTarget = false;

            var strip = CreateRect("TurnStrip", topBar);
            Place(strip, new Vector2(0.5f, 1f), new Vector2(0f, 0f), new Vector2(1080f, 12f));
            turnStrip = strip.gameObject.AddComponent<Image>();
            turnStrip.raycastTarget = false;

            turnLabel = CreateText(topBar, "Turn", "", 50, TextAnchor.MiddleLeft, TextColor);
            turnLabel.fontStyle = FontStyle.Bold;
            AddOutline(turnLabel);
            Place((RectTransform)turnLabel.transform, new Vector2(0f, 0.5f), new Vector2(40f, 0f), new Vector2(520f, 150f));

            scoreLabel = CreateText(topBar, "Score", "", 42, TextAnchor.MiddleRight, TextColor);
            AddOutline(scoreLabel);
            Place((RectTransform)scoreLabel.transform, new Vector2(1f, 0.5f), new Vector2(-40f, 32f), new Vector2(520f, 72f));

            lineScoreLabel = CreateText(topBar, "LineScore", "", 52, TextAnchor.MiddleRight, TextColor);
            lineScoreLabel.fontStyle = FontStyle.Bold;
            AddOutline(lineScoreLabel);
            Place((RectTransform)lineScoreLabel.transform, new Vector2(1f, 0.5f), new Vector2(-40f, -38f), new Vector2(520f, 78f));

            // The hint bar lives on the canvas root so toasts show over the
            // menu too (e.g. join-form validation).
            var hintRect = CreateRect("HintBar", transform);
            Place(hintRect, new Vector2(0.5f, 1f), new Vector2(0f, -196f), new Vector2(980f, 96f));
            hintBackground = hintRect.gameObject.AddComponent<Image>();
            hintBackground.color = new Color(0.08f, 0.1f, 0.16f, 0.72f);
            hintBackground.raycastTarget = false;
            hintLabel = CreateText(hintRect, "Hint", "", 38, TextAnchor.MiddleCenter, new Color(1f, 0.88f, 0.55f, 1f));
            Stretch((RectTransform)hintLabel.transform);
            hintRect.gameObject.SetActive(false);

            thinkingLabel = CreateText(rect, "Thinking", "", 40, TextAnchor.MiddleCenter, MutedColor);
            AddOutline(thinkingLabel);
            Place((RectTransform)thinkingLabel.transform, new Vector2(0.5f, 0f), new Vector2(0f, 400f), new Vector2(800f, 64f));

            confirmButton = CreateButton(rect, "Confirm", 52, ConfirmPressed, out confirmLabel);
            Place((RectTransform)confirmButton.transform, new Vector2(0.5f, 0f), new Vector2(0f, 220f), new Vector2(480f, 140f));
            confirmButton.GetComponent<Image>().color = AccentColor;
            confirmLabel.fontStyle = FontStyle.Bold;
            confirmButton.gameObject.SetActive(false);

            Text menuText;
            var menuButton = CreateButton(rect, "MenuButton", 40, controller.BackToMenu, out menuText);
            menuButtonLabel = menuText;
            Place((RectTransform)menuButton.transform, new Vector2(0f, 0f), new Vector2(40f, 40f), new Vector2(260f, 100f));

            Text layersText;
            var layersButton = CreateButton(rect, "LayersButton", 36, controller.ToggleLayersPressed, out layersText);
            layersLabel = layersText;
            Place((RectTransform)layersButton.transform, new Vector2(0f, 0f), new Vector2(40f, 158f), new Vector2(260f, 100f));

            Text undoText;
            undoButton = CreateButton(rect, "UndoButton", 40, controller.UndoPressed, out undoText);
            undoLabel = undoText;
            Place((RectTransform)undoButton.transform, new Vector2(1f, 0f), new Vector2(-40f, 40f), new Vector2(260f, 100f));
            undoButtonObject = undoButton.gameObject;

            Text analysisText;
            var analysisButton = CreateButton(rect, "AnalysisButton", 36, controller.ToggleAnalysisPressed, out analysisText);
            analysisLabel = analysisText;
            Place((RectTransform)analysisButton.transform, new Vector2(1f, 0f), new Vector2(-40f, 158f), new Vector2(260f, 100f));
            analysisButtonObject = analysisButton.gameObject;

            Text reconnectText;
            reconnectButton = CreateButton(rect, "ReconnectButton", 36, controller.OnlineReconnectPressed, out reconnectText);
            reconnectLabel = reconnectText;
            Place((RectTransform)reconnectButton.transform, new Vector2(1f, 0f), new Vector2(-40f, 40f), new Vector2(300f, 100f));
            reconnectButton.GetComponent<Image>().color = AccentColor;
            reconnectButton.gameObject.SetActive(false);
        }

        /// <summary>Online games hide the local-only controls (undo, hints).</summary>
        public void SetOnlineUi(bool online)
        {
            undoButtonObject.SetActive(!online);
            analysisButtonObject.SetActive(!online);

            if (!online)
            {
                reconnectButton.gameObject.SetActive(false);
            }
        }

        public void SetReconnectVisible(bool visible)
        {
            reconnectButton.gameObject.SetActive(visible);
        }

        public void RefreshHudLabels()
        {
            menuButtonLabel.text = GameStrings.T("Menü", "Menu");
            undoLabel.text = GameStrings.T("Geri Al", "Undo");
            reconnectLabel.text = GameStrings.T("Yeniden Bağlan", "Reconnect");
            confirmLabel.text = GameStrings.T("Onayla", "Confirm");
            layersLabel.text = GameStrings.T("Katmanlar", "Layers");
            analysisLabel.text = GameStrings.T("Analiz: ", "Hints: ") + OnOff(GamePrefs.Analysis);
            peekLabel.text = GameStrings.T("Tahtaya Bak", "View Board");
            toMenuLabel.text = GameStrings.T("Menüye Dön", "Back to Menu");
            returnLabel.text = GameStrings.T("Sonuca Dön", "Back to Result");
            pieYesLabel.text = GameStrings.T("Evet, değiştir", "Yes, swap");
            pieNoLabel.text = GameStrings.T("Hayır", "No");
        }

        // ------------------------------------------------------------------
        // Result overlay
        // ------------------------------------------------------------------

        private void BuildResultOverlay()
        {
            var rect = CreateRect("Result", transform);
            Stretch(rect);
            resultPanel = rect.gameObject;

            // Light dim so the finished board (and its beams) stays visible.
            var backdrop = rect.gameObject.AddComponent<Image>();
            backdrop.color = new Color(0.03f, 0.04f, 0.08f, 0.42f);

            resultTitle = CreateText(rect, "ResultTitle", "", 78, TextAnchor.MiddleCenter, TextColor);
            resultTitle.fontStyle = FontStyle.Bold;
            AddOutline(resultTitle);
            Place((RectTransform)resultTitle.transform, new Vector2(0.5f, 0f), new Vector2(0f, 660f), new Vector2(1000f, 120f));

            resultSubtitle = CreateText(rect, "ResultSubtitle", "", 44, TextAnchor.MiddleCenter, TextColor);
            AddOutline(resultSubtitle);
            Place((RectTransform)resultSubtitle.transform, new Vector2(0.5f, 0f), new Vector2(0f, 548f), new Vector2(1000f, 100f));

            var continueButton = CreateButton(rect, "Continue", 52, controller.ResultContinuePressed, out resultButtonLabel);
            Place((RectTransform)continueButton.transform, new Vector2(0.5f, 0f), new Vector2(0f, 368f), new Vector2(620f, 140f));
            continueButton.GetComponent<Image>().color = AccentColor;
            resultButtonLabel.fontStyle = FontStyle.Bold;

            Text peekText;
            var peekButton = CreateButton(rect, "Peek", 36, PeekPressed, out peekText);
            peekLabel = peekText;
            Place((RectTransform)peekButton.transform, new Vector2(0.5f, 0f), new Vector2(-175f, 230f), new Vector2(330f, 104f));

            Text toMenuText;
            var toMenuButton = CreateButton(rect, "ToMenu", 36, controller.BackToMenu, out toMenuText);
            toMenuLabel = toMenuText;
            Place((RectTransform)toMenuButton.transform, new Vector2(0.5f, 0f), new Vector2(175f, 230f), new Vector2(330f, 104f));

            // Small floating button shown while the result panel is hidden.
            Text returnText;
            var returnButton = CreateButton(transform, "ReturnToResult", 34, ReturnToResultPressed, out returnText);
            returnLabel = returnText;
            Place((RectTransform)returnButton.transform, new Vector2(1f, 1f), new Vector2(-40f, -220f), new Vector2(300f, 100f));
            returnButton.GetComponent<Image>().color = AccentDimColor;
            returnToResultButton = returnButton.gameObject;
            returnToResultButton.SetActive(false);
        }

        private void PeekPressed()
        {
            if (puzzleResultMode)
            {
                GUIUtility.systemCopyBuffer = puzzleShareText;
                Toast(GameStrings.T("Sonuç panoya kopyalandı!", "Result copied to clipboard!"), 2f);
                return;
            }

            resultPanel.SetActive(false);
            returnToResultButton.SetActive(true);
        }

        private void ReturnToResultPressed()
        {
            returnToResultButton.SetActive(false);
            resultPanel.SetActive(true);
        }

        // ------------------------------------------------------------------
        // Progress panel: today's goals + the achievement grid
        // ------------------------------------------------------------------

        private void BuildProgressPanel()
        {
            var rect = CreateRect("ProgressPanel", transform);
            Stretch(rect);
            progressPanel = rect.gameObject;

            var backdrop = rect.gameObject.AddComponent<Image>();
            backdrop.color = PanelColor;

            var content = CreateRect("Content", rect);
            Stretch(content);
            progressContent = content;

            Text closeText;
            var closeButton = CreateButton(rect, "Close", 44, () => progressPanel.SetActive(false), out closeText);
            Place((RectTransform)closeButton.transform, new Vector2(0.5f, 0f), new Vector2(0f, 40f), new Vector2(420f, 110f));
            closeButton.GetComponent<Image>().color = AccentColor;
            closeText.text = GameStrings.T("Kapat", "Close");

            progressPanel.SetActive(false);
        }

        /// <summary>Rebuilt on each open: content is small (3 goals + 16 badges).</summary>
        private void RefreshProgressPanel()
        {
            for (int i = progressContent.transform.childCount - 1; i >= 0; i -= 1)
            {
                UnityEngine.Object.Destroy(progressContent.transform.GetChild(i).gameObject);
            }

            var title = CreateText(progressContent, "Title",
                GameStrings.T("Hedefler & Başarımlar", "Goals & Achievements"), 56, TextAnchor.MiddleCenter, TextColor);
            title.fontStyle = FontStyle.Bold;
            Place((RectTransform)title.transform, new Vector2(0.5f, 1f), new Vector2(0f, -60f), new Vector2(900f, 90f));

            DailyGoals.State goals;
            DailyGoals.CompletedCount(DateTime.Now, out goals);

            var goalsHeading = CreateText(progressContent, "GoalsHeading",
                GameStrings.T("Bugünün hedefleri", "Today's goals")
                + (goals.StarStreak > 0
                    ? GameStrings.T("  (yıldız serisi: ", "  (star streak: ") + goals.StarStreak + ")"
                    : ""),
                40, TextAnchor.MiddleLeft, MutedColor);
            Place((RectTransform)goalsHeading.transform, new Vector2(0.5f, 1f), new Vector2(0f, -170f), new Vector2(920f, 60f));

            for (int i = 0; i < 3; i += 1)
            {
                var goal = DailyGoals.Pool[goals.GoalIndices[i]];
                bool done = goals.Progress[i] >= goal.Target;
                string progress = goal.Target > 1 ? "  (" + goals.Progress[i] + "/" + goal.Target + ")" : "";
                var row = CreateText(progressContent, "Goal" + i,
                    (done ? "+ " : "- ") + goal.Text() + progress,
                    36, TextAnchor.MiddleLeft, done ? new Color(0.55f, 0.9f, 0.6f, 1f) : TextColor);
                Place((RectTransform)row.transform, new Vector2(0.5f, 1f), new Vector2(0f, -236f - i * 62f), new Vector2(920f, 58f));
            }

            var badgeHeading = CreateText(progressContent, "BadgeHeading",
                GameStrings.T("Başarımlar ", "Achievements ") + Achievements.EarnedCount() + "/" + Achievements.All.Length,
                40, TextAnchor.MiddleLeft, MutedColor);
            Place((RectTransform)badgeHeading.transform, new Vector2(0.5f, 1f), new Vector2(0f, -460f), new Vector2(920f, 60f));

            for (int i = 0; i < Achievements.All.Length; i += 1)
            {
                var def = Achievements.All[i];
                bool earned = Achievements.IsEarned(def.Id);
                int column = i % 2;
                int row = i / 2;
                var cell = CreateText(progressContent, "Badge" + i,
                    def.Name() + "\n" + def.Desc(),
                    27, TextAnchor.UpperLeft,
                    earned ? new Color(1f, 0.84f, 0.32f, 1f) : new Color(0.5f, 0.54f, 0.62f, 1f));
                Place((RectTransform)cell.transform, new Vector2(0.5f, 1f),
                    new Vector2(column == 0 ? -240f : 240f, -530f - row * 104f), new Vector2(460f, 100f));
            }
        }

        // ------------------------------------------------------------------
        // Room code showcase (online hosting)
        // ------------------------------------------------------------------

        private void BuildRoomCodePanel()
        {
            var rect = CreateRect("RoomCode", transform);
            Place(rect, new Vector2(0.5f, 0.5f), new Vector2(0f, 140f), new Vector2(780f, 560f));
            roomCodePanel = rect.gameObject;

            var card = rect.gameObject.AddComponent<Image>();
            card.color = PanelColor;

            var heading = CreateText(rect, "Heading", "", 40, TextAnchor.MiddleCenter, MutedColor);
            roomCodeCaption = heading;
            Place((RectTransform)heading.transform, new Vector2(0.5f, 1f), new Vector2(0f, -26f), new Vector2(720f, 130f));

            roomCodeText = CreateText(rect, "Code", "", 150, TextAnchor.MiddleCenter, new Color(1f, 0.84f, 0.32f, 1f));
            roomCodeText.fontStyle = FontStyle.Bold;
            Place((RectTransform)roomCodeText.transform, new Vector2(0.5f, 0.5f), new Vector2(0f, 20f), new Vector2(720f, 200f));

            Text copyText;
            var copyButton = CreateButton(rect, "CopyCode", 42, CopyRoomCodePressed, out copyText);
            roomCodeCopyLabel = copyText;
            Place((RectTransform)copyButton.transform, new Vector2(0.5f, 0f), new Vector2(0f, 28f), new Vector2(420f, 110f));
            copyButton.GetComponent<Image>().color = AccentColor;

            roomCodePanel.SetActive(false);
        }

        public void ShowRoomCode(string code)
        {
            shownRoomCode = code ?? "";
            roomCodeText.text = shownRoomCode;
            roomCodeCaption.text = GameStrings.T(
                "Oda kurdun! Kodu arkadaşına gönder;\no 'Odaya Katıl'dan girsin.",
                "Room is up! Send this code to a friend;\nthey enter it under 'Join Room'.");
            roomCodeCopyLabel.text = GameStrings.T("Kodu Kopyala", "Copy Code");
            roomCodePanel.SetActive(true);
        }

        public void HideRoomCode()
        {
            roomCodePanel.SetActive(false);
        }

        private void CopyRoomCodePressed()
        {
            GUIUtility.systemCopyBuffer = shownRoomCode;
            Toast(GameStrings.T("Kod panoya kopyalandı!", "Code copied to clipboard!"), 2f);
        }

        // ------------------------------------------------------------------
        // Pie Rule prompt
        // ------------------------------------------------------------------

        private void BuildPiePanel()
        {
            var rect = CreateRect("PiePanel", transform);
            Stretch(rect);
            piePanel = rect.gameObject;

            var backdrop = rect.gameObject.AddComponent<Image>();
            backdrop.color = new Color(0.03f, 0.04f, 0.08f, 0.6f);

            var card = CreateRect("Card", rect);
            Place(card, new Vector2(0.5f, 0.5f), new Vector2(0f, 0f), new Vector2(860f, 440f));
            var cardImage = card.gameObject.AddComponent<Image>();
            cardImage.color = PanelColor;

            pieQuestion = CreateText(card, "Question", "", 42, TextAnchor.MiddleCenter, TextColor);
            Place((RectTransform)pieQuestion.transform, new Vector2(0.5f, 1f), new Vector2(0f, -30f), new Vector2(780f, 220f));

            Text yesText;
            var yesButton = CreateButton(card, "PieYes", 42, () => controller.PieAnswer(true), out yesText);
            pieYesLabel = yesText;
            Place((RectTransform)yesButton.transform, new Vector2(0.5f, 0f), new Vector2(-180f, 36f), new Vector2(330f, 120f));
            yesButton.GetComponent<Image>().color = AccentColor;

            Text noText;
            var noButton = CreateButton(card, "PieNo", 42, () => controller.PieAnswer(false), out noText);
            pieNoLabel = noText;
            Place((RectTransform)noButton.transform, new Vector2(0.5f, 0f), new Vector2(180f, 36f), new Vector2(330f, 120f));

            piePanel.SetActive(false);
            RefreshHudLabels();
        }

        public void ShowPiePrompt(bool showHint)
        {
            pieQuestion.text = GameStrings.T(
                "Rakip ilk hamlesini yaptı.\nTaraf değiştirmek ister misin?\n(Açılış hamlesini ve işaretini devralırsın)",
                "The opponent made the first move.\nDo you want to swap sides?\n(You take over the opening mark)");

            if (showHint)
            {
                pieQuestion.text += GameStrings.T(
                    "\nİpucu: merkez açılışı güçlüdür — takas etmek genelde iyidir.",
                    "\nHint: a center opening is strong — swapping is usually good.");
            }

            piePanel.SetActive(true);
        }

        public void HidePiePrompt()
        {
            piePanel.SetActive(false);
        }

        // ------------------------------------------------------------------
        // Public API used by the controller
        // ------------------------------------------------------------------

        public void ShowMenu()
        {
            progressPanel.SetActive(false);
            menuPanel.SetActive(true);
            hudPanel.SetActive(false);
            resultPanel.SetActive(false);
            piePanel.SetActive(false);
            returnToResultButton.SetActive(false);
            RefreshMenuLabels();
        }

        public void ShowGame()
        {
            progressPanel.SetActive(false);
            menuPanel.SetActive(false);
            hudPanel.SetActive(true);
            resultPanel.SetActive(false);
            returnToResultButton.SetActive(false);
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
            turnLabel.color = player == Player.X ? XColor : OColor;
            turnStrip.color = player == Player.X ? XColor : OColor;
            SetThinking(aiThinking);
        }

        private void SetThinking(bool thinking)
        {
            if (thinkingRoutine != null)
            {
                StopCoroutine(thinkingRoutine);
                thinkingRoutine = null;
            }

            if (!thinking)
            {
                thinkingLabel.text = "";
                return;
            }

            thinkingRoutine = StartCoroutine(AnimateThinking());
        }

        private IEnumerator AnimateThinking()
        {
            string baseText = GameStrings.T("Rakip düşünüyor", "Opponent is thinking");
            int dots = 1;

            while (true)
            {
                thinkingLabel.text = baseText + new string('.', dots);
                dots = dots % 3 + 1;
                yield return new WaitForSeconds(0.45f);
            }
        }

        /// <summary>Header for daily-puzzle play (no match context).</summary>
        public void SetPuzzleHeader(int id, string prompt)
        {
            scoreLabel.text = GameStrings.T("Bulmaca #", "Puzzle #") + id;
            ClearLineScore();
            SetHint(prompt);
        }

        public void SetScores(MatchState match, GameResult result, Ruleset ruleset, bool soloMode, Player humanPlayer)
        {
            string matchText;

            if (match.TargetWins <= 1)
            {
                matchText = GameStrings.T("Tek tur", "Single round");
            }
            else if (soloMode)
            {
                int humanWins = match.Wins(humanPlayer);
                int aiWins = match.Wins(Rules.GetOtherPlayer(humanPlayer));
                matchText = GameStrings.T("Sen ", "You ") + humanWins + " - " + aiWins
                    + GameStrings.T(" Rakip   Tur ", " Opp   Round ") + match.RoundNumber;
            }
            else
            {
                matchText = "X " + match.WinsX + " - " + match.WinsO + " O"
                    + GameStrings.T("   Tur ", "   Round ") + match.RoundNumber;
            }

            scoreLabel.text = matchText;

            if (ruleset == Ruleset.Lines && result != null)
            {
                if (soloMode)
                {
                    SetLineScore(result.LineScore(humanPlayer), result.LineScore(Rules.GetOtherPlayer(humanPlayer)), true);
                }
                else
                {
                    SetLineScore(result.LineScoreX, result.LineScoreO, false);
                }
            }
            else
            {
                ClearLineScore();
            }
        }

        /// <summary>
        /// Animated line score: counts up to new values with a brief gold
        /// flash, so a point lands with some weight. Decreases (round resets)
        /// snap instantly.
        /// </summary>
        private void SetLineScore(int a, int b, bool youLabels)
        {
            bool increase = shownLineA >= 0 && (a > shownLineA || b > shownLineB)
                && a >= shownLineA && b >= shownLineB;

            if (lineScoreRoutine != null)
            {
                StopCoroutine(lineScoreRoutine);
                lineScoreRoutine = null;
            }

            if (!increase || !GamePrefs.Effects)
            {
                shownLineA = a;
                shownLineB = b;
                lineScoreLabel.color = TextColor;
                lineScoreLabel.text = FormatLineScore(a, b, youLabels);
                return;
            }

            lineScoreRoutine = StartCoroutine(AnimateLineScore(a, b, youLabels));
        }

        private void ClearLineScore()
        {
            if (lineScoreRoutine != null)
            {
                StopCoroutine(lineScoreRoutine);
                lineScoreRoutine = null;
            }

            shownLineA = -1;
            shownLineB = -1;
            lineScoreLabel.color = TextColor;
            lineScoreLabel.text = "";
        }

        private static string FormatLineScore(int a, int b, bool youLabels)
        {
            return youLabels
                ? GameStrings.T("Çizgi  Sen ", "Lines  You ") + a + " - " + b + GameStrings.T(" Rakip", " Opp")
                : GameStrings.T("Çizgi  ", "Lines  ") + "X " + a + " - " + b + " O";
        }

        private IEnumerator AnimateLineScore(int targetA, int targetB, bool youLabels)
        {
            lineScoreLabel.color = new Color(1f, 0.84f, 0.32f, 1f);

            while (shownLineA < targetA || shownLineB < targetB)
            {
                if (shownLineA < targetA)
                {
                    shownLineA += 1;
                }

                if (shownLineB < targetB)
                {
                    shownLineB += 1;
                }

                lineScoreLabel.text = FormatLineScore(shownLineA, shownLineB, youLabels);
                yield return new WaitForSeconds(0.09f);
            }

            yield return new WaitForSeconds(0.35f);
            lineScoreLabel.color = TextColor;
            lineScoreRoutine = null;
        }

        public void SetConfirmVisible(bool visible)
        {
            confirmButton.gameObject.SetActive(visible);
        }

        /// <summary>Blank the turn indicator (entering online before data).</summary>
        public void ClearTurnDisplay()
        {
            turnLabel.text = "";
            thinkingLabel.text = "";
            turnStrip.color = new Color(0.17f, 0.22f, 0.33f, 1f);
        }

        /// <summary>HUD scores for online games, straight from the snapshot.</summary>
        public void SetOnlineScores(OnlineSnapshot snapshot, Player myPlayer, Ruleset ruleset)
        {
            if (snapshot == null)
            {
                scoreLabel.text = "";
                ClearLineScore();
                return;
            }

            scoreLabel.text = GameStrings.T("Sen ", "You ") + snapshot.Wins(myPlayer)
                + " - " + snapshot.Wins(Rules.GetOtherPlayer(myPlayer))
                + GameStrings.T(" Rakip   Tur ", " Opp   Round ") + snapshot.RoundNumber;

            if (ruleset == Ruleset.Lines)
            {
                SetLineScore(snapshot.LineScore(myPlayer), snapshot.LineScore(Rules.GetOtherPlayer(myPlayer)), true);
            }
            else
            {
                ClearLineScore();
            }
        }

        private void ConfirmPressed()
        {
            controller.ConfirmPressed();
        }

        public void SetUndoEnabled(bool enabled)
        {
            undoButton.interactable = enabled;
        }

        public void SetAnalysisLabel()
        {
            analysisLabel.text = GameStrings.T("Analiz: ", "Hints: ") + OnOff(GamePrefs.Analysis);
        }

        // ------------------------------------------------------------------
        // Hint bar, toasts, floating score
        // ------------------------------------------------------------------

        private string baselineHint = "";

        private void ApplyHintText(string message)
        {
            hintBackground.gameObject.SetActive(!string.IsNullOrEmpty(message));
            hintLabel.text = message ?? "";
        }

        /// <summary>
        /// Persistent baseline hint (tutorial step, endgame band, online
        /// status). Toasts draw over it and restore it when they expire.
        /// </summary>
        public void SetHint(string message)
        {
            baselineHint = message ?? "";

            if (toastRoutine == null)
            {
                ApplyHintText(baselineHint);
            }
        }

        public void ClearHint()
        {
            SetHint("");
        }

        public void Toast(string message, float seconds)
        {
            if (toastRoutine != null)
            {
                StopCoroutine(toastRoutine);
            }

            ApplyHintText(message);
            toastRoutine = StartCoroutine(RestoreBaselineAfter(seconds));
        }

        private IEnumerator RestoreBaselineAfter(float seconds)
        {
            yield return new WaitForSeconds(seconds);
            toastRoutine = null;
            ApplyHintText(baselineHint);
        }

        /// <summary>Floating score text ("+1") rising from a world position.</summary>
        public void ShowFloatingScore(Vector3 worldPosition, string message, bool big)
        {
            if (!GamePrefs.Effects)
            {
                return;
            }

            var camera = Camera.main;

            if (camera == null)
            {
                return;
            }

            var screen = camera.WorldToScreenPoint(worldPosition);

            if (screen.z <= 0f)
            {
                return;
            }

            // Parent under the HUD panel so menu/result transitions hide it
            // instead of letting it float over every screen.
            var text = CreateText(hudPanel.transform, "Floating", message, big ? 72 : 54, TextAnchor.MiddleCenter, big ? new Color(1f, 0.84f, 0.32f, 1f) : TextColor);
            text.fontStyle = FontStyle.Bold;
            AddOutline(text);
            var rect = (RectTransform)text.transform;
            rect.sizeDelta = new Vector2(420f, 110f);
            rect.position = new Vector3(screen.x, screen.y, 0f);
            StartCoroutine(FloatAndFade(text));
        }

        private IEnumerator FloatAndFade(Text text)
        {
            float elapsed = 0f;
            const float duration = 1.1f;
            var baseColor = text.color;
            var rect = (RectTransform)text.transform;
            var start = rect.position;

            while (elapsed < duration && text != null)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                rect.position = new Vector3(start.x, start.y + t * 130f, 0f);
                text.color = new Color(baseColor.r, baseColor.g, baseColor.b, 1f - t * t);
                yield return null;
            }

            if (text != null)
            {
                UnityEngine.Object.Destroy(text.gameObject);
            }
        }

        // ------------------------------------------------------------------
        // Result API
        // ------------------------------------------------------------------

        public void ShowResult(string title, string subtitle, string buttonLabel)
        {
            puzzleResultMode = false;
            peekLabel.text = GameStrings.T("Tahtaya Bak", "View Board");
            returnToResultButton.SetActive(false);
            resultPanel.SetActive(true);
            resultTitle.text = title;
            resultSubtitle.text = subtitle;
            resultButtonLabel.text = buttonLabel;
        }

        /// <summary>
        /// Daily-puzzle result: the peek button becomes a share-copy button.
        /// </summary>
        public void ShowPuzzleResult(string title, string subtitle, string buttonLabel, string shareText)
        {
            ShowResult(title, subtitle, buttonLabel);
            puzzleResultMode = true;
            puzzleShareText = shareText ?? "";
            peekLabel.text = GameStrings.T("Paylaş (kopyala)", "Share (copy)");
        }

        public void HideResult()
        {
            resultPanel.SetActive(false);
            returnToResultButton.SetActive(false);
        }
    }
}
