using System.Collections;
using System.Collections.Generic;
using TicTacube.Core;
using UnityEngine;

namespace TicTacube.Game
{
    /// <summary>
    /// Builds and updates the 3x3x3 board: layer-tinted cells, square layer
    /// frames, marks with pop-in animation, a last-move ring, shape-coded
    /// completed-line beams (X = square bars, O = round bars; older beams dim
    /// so the newest reads), optional threat-hint cubes, and an exploded
    /// layer view. Everything is generated from primitives at runtime;
    /// materials come from Resources so they survive shader stripping.
    /// </summary>
    public sealed class BoardView : MonoBehaviour
    {
        public const float CellSpacing = 1.15f;
        private const float LayerExtraGap = 1.35f;
        private const float FrameHalf = CellSpacing + 0.62f;

        private sealed class BeamEntry
        {
            public GameObject Beam;
            public Player Owner;
            public int[] Line;
        }

        private readonly CellView[] cells = new CellView[Rules.CellCount];
        private readonly Dictionary<int, GameObject> marks = new Dictionary<int, GameObject>();
        private readonly List<BeamEntry> beams = new List<BeamEntry>();
        private readonly List<GameObject> hintObjects = new List<GameObject>();
        private readonly List<GameObject> frameParts = new List<GameObject>();

        private Material[] layerIdleMaterials;
        private Material markXMaterial;
        private Material markOMaterial;
        private Material beamXMaterial;
        private Material beamOMaterial;
        private Material beamXDimMaterial;
        private Material beamODimMaterial;
        private Material winMaterial;
        private Material hintRedMaterial;
        private Material hintGreenMaterial;
        private Material frameMaterial;

        private GameObject lastMoveRing;
        private Coroutine lastMovePulse;
        private Material ringMaterialX;
        private Material ringMaterialO;
        private Color ringBaseColorX;
        private Color ringBaseColorO;
        private Coroutine separationRoutine;
        private float layerSeparation;

        public bool LayersSeparated { get; private set; }

        public static Vector3 CellPosition(int index)
        {
            int x, y, z;
            WinningLines.ToCoordinate(index, out x, out y, out z);
            return new Vector3((x - 1) * CellSpacing, (y - 1) * CellSpacing, (z - 1) * CellSpacing);
        }

        private Vector3 SeparatedCellPosition(int index)
        {
            int x, y, z;
            WinningLines.ToCoordinate(index, out x, out y, out z);
            var position = CellPosition(index);
            position.y += (y - 1) * LayerExtraGap * layerSeparation;
            return position;
        }

        private static Material LoadMaterial(string name, Color fallbackColor)
        {
            var material = Resources.Load<Material>("TicTacube/" + name);

            if (material != null)
            {
                return material;
            }

            var shader = Shader.Find("Standard");
            var created = new Material(shader);
            created.color = fallbackColor;
            return created;
        }

        public void Build()
        {
            var cellIdle = LoadMaterial("CellIdle", new Color(0.58f, 0.62f, 0.7f));
            markXMaterial = LoadMaterial("MarkX", new Color(0.96f, 0.42f, 0.32f));
            markOMaterial = LoadMaterial("MarkO", new Color(0.33f, 0.62f, 0.95f));
            beamXMaterial = LoadMaterial("BeamX", new Color(1f, 0.56f, 0.45f));
            beamOMaterial = LoadMaterial("BeamO", new Color(0.5f, 0.76f, 1f));
            beamXDimMaterial = LoadMaterial("BeamXDim", new Color(0.45f, 0.27f, 0.23f));
            beamODimMaterial = LoadMaterial("BeamODim", new Color(0.23f, 0.33f, 0.45f));
            winMaterial = LoadMaterial("Win", new Color(1f, 0.84f, 0.32f));
            hintRedMaterial = LoadMaterial("HintRed", new Color(0.9f, 0.25f, 0.25f, 0.4f));
            hintGreenMaterial = LoadMaterial("HintGreen", new Color(0.3f, 0.85f, 0.45f, 0.4f));
            frameMaterial = LoadMaterial("Frame", new Color(0.3f, 0.34f, 0.44f));

            // One reusable ring material per player (avoids leaking a new
            // material instance on every placement).
            ringMaterialX = new Material(markXMaterial);
            ringMaterialO = new Material(markOMaterial);
            ringBaseColorX = ringMaterialX.color;
            ringBaseColorO = ringMaterialO.color;

            // Slightly different tint per Y layer so depth reads at a glance.
            layerIdleMaterials = new Material[3];

            for (int layer = 0; layer < 3; layer += 1)
            {
                var tinted = new Material(cellIdle);
                float tone = 0.82f + layer * 0.18f;
                tinted.color = new Color(cellIdle.color.r * tone, cellIdle.color.g * tone, cellIdle.color.b * tone);
                layerIdleMaterials[layer] = tinted;
            }

            for (int index = 0; index < Rules.CellCount; index += 1)
            {
                int x, y, z;
                WinningLines.ToCoordinate(index, out x, out y, out z);

                var cellObject = new GameObject("Cell " + index);
                cellObject.transform.SetParent(transform, false);
                cellObject.transform.localPosition = CellPosition(index);

                var cell = cellObject.AddComponent<CellView>();
                cell.Build(index, y, layerIdleMaterials[y], winMaterial);
                cells[index] = cell;
            }

            BuildLayerFrames();
        }

        /// <summary>Thin square outlines around each Y layer: depth cue + structure.</summary>
        private void BuildLayerFrames()
        {
            for (int layer = 0; layer < 3; layer += 1)
            {
                float y = (layer - 1) * CellSpacing;

                for (int edge = 0; edge < 4; edge += 1)
                {
                    bool alongX = edge < 2;
                    float side = edge % 2 == 0 ? -FrameHalf : FrameHalf;

                    var bar = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    Object.Destroy(bar.GetComponent<Collider>());
                    bar.name = "Frame L" + layer + " E" + edge;
                    bar.transform.SetParent(transform, false);
                    bar.transform.localPosition = alongX
                        ? new Vector3(0f, y, side)
                        : new Vector3(side, y, 0f);
                    bar.transform.localScale = alongX
                        ? new Vector3(FrameHalf * 2f, 0.025f, 0.025f)
                        : new Vector3(0.025f, 0.025f, FrameHalf * 2f);
                    bar.GetComponent<Renderer>().sharedMaterial = frameMaterial;

                    var tag = bar.AddComponent<CellView>();
                    tag.enabled = false;
                    tag.LayerIndex = layer;
                    frameParts.Add(bar);
                }
            }
        }

        // ------------------------------------------------------------------
        // Marks
        // ------------------------------------------------------------------

        public void SetMark(int index, Player player, bool animate)
        {
            SetMark(index, player, animate, false);
        }

        public void SetMark(int index, Player player, bool animate, bool drop)
        {
            cells[index].SetOccupied(true);

            var mark = player == Player.X ? CreateXMark() : CreateOMark();
            mark.name = "Mark " + player;
            mark.transform.SetParent(cells[index].transform, false);
            mark.transform.localPosition = Vector3.zero;
            marks[index] = mark;

            if (animate && GamePrefs.Effects)
            {
                if (drop)
                {
                    StartCoroutine(DropIn(mark.transform, index));
                }
                else
                {
                    StartCoroutine(PopIn(mark.transform));
                }
            }

            MoveLastMoveRing(index, player, animate);
        }

        /// <summary>Tower mode: the mark falls into its column and settles.</summary>
        private IEnumerator DropIn(Transform target, int index)
        {
            int x, y, z;
            WinningLines.ToCoordinate(index, out x, out y, out z);

            // Fall from above the tower even in the exploded layer view.
            float spacing = CellSpacing + LayerExtraGap * layerSeparation;
            float startHeight = (2 - y) * spacing + 1.3f;
            const float duration = 0.22f;
            float elapsed = 0f;

            while (elapsed < duration && target != null)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                target.localPosition = new Vector3(0f, startHeight * (1f - t * t), 0f);
                yield return null;
            }

            // Tiny settle bounce.
            float bounce = 0f;

            while (bounce < 0.12f && target != null)
            {
                bounce += Time.deltaTime;
                float t = Mathf.Clamp01(bounce / 0.12f);
                target.localPosition = new Vector3(0f, Mathf.Sin(t * Mathf.PI) * 0.12f, 0f);
                yield return null;
            }

            if (target != null)
            {
                target.localPosition = Vector3.zero;
            }
        }

        private IEnumerator PopIn(Transform target)
        {
            const float duration = 0.16f;
            float elapsed = 0f;
            var baseRotation = target.localRotation;

            while (elapsed < duration && target != null)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float scale = t < 0.75f ? Mathf.Lerp(0.05f, 1.15f, t / 0.75f) : Mathf.Lerp(1.15f, 1f, (t - 0.75f) / 0.25f);
                target.localScale = new Vector3(scale, scale, scale);
                target.localRotation = baseRotation;
                yield return null;
            }

            if (target != null)
            {
                target.localScale = Vector3.one;
            }
        }

        /// <summary>Flat ring (squashed cylinder) under the most recent mark.</summary>
        private void MoveLastMoveRing(int index, Player player, bool animate)
        {
            if (lastMovePulse != null)
            {
                StopCoroutine(lastMovePulse);
                lastMovePulse = null;
            }

            // Reset both ring tints in case an earlier pulse was interrupted.
            ringMaterialX.color = ringBaseColorX;
            ringMaterialO.color = ringBaseColorO;

            if (lastMoveRing == null)
            {
                lastMoveRing = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                Object.Destroy(lastMoveRing.GetComponent<Collider>());
                lastMoveRing.name = "LastMoveRing";
            }

            lastMoveRing.SetActive(true);
            lastMoveRing.transform.SetParent(cells[index].transform, false);
            lastMoveRing.transform.localPosition = new Vector3(0f, -0.42f, 0f);
            lastMoveRing.transform.localScale = new Vector3(0.8f, 0.02f, 0.8f);

            var ringMaterial = player == Player.X ? ringMaterialX : ringMaterialO;
            var ringBaseColor = player == Player.X ? ringBaseColorX : ringBaseColorO;
            lastMoveRing.GetComponent<Renderer>().sharedMaterial = ringMaterial;

            if (animate && GamePrefs.Effects)
            {
                lastMovePulse = StartCoroutine(PulseRing(ringMaterial, ringBaseColor));
            }
        }

        private IEnumerator PulseRing(Material ringMaterial, Color baseColor)
        {
            float elapsed = 0f;

            while (elapsed < 1.6f)
            {
                elapsed += Time.deltaTime;
                float wave = (Mathf.Sin(elapsed * 9f) + 1f) * 0.5f;
                ringMaterial.color = Color.Lerp(baseColor, Color.white, wave * 0.65f);
                yield return null;
            }

            ringMaterial.color = baseColor;
            lastMovePulse = null;
        }

        private GameObject CreateXMark()
        {
            var container = new GameObject("X");

            for (int axis = 0; axis < 3; axis += 1)
            {
                var bar = GameObject.CreatePrimitive(PrimitiveType.Cube);
                Object.Destroy(bar.GetComponent<Collider>());
                bar.transform.SetParent(container.transform, false);
                bar.transform.localScale = axis == 0
                    ? new Vector3(0.72f, 0.15f, 0.15f)
                    : axis == 1
                        ? new Vector3(0.15f, 0.72f, 0.15f)
                        : new Vector3(0.15f, 0.15f, 0.72f);
                bar.GetComponent<Renderer>().sharedMaterial = markXMaterial;
            }

            container.transform.localRotation = Quaternion.Euler(45f, 45f, 0f);
            return container;
        }

        private GameObject CreateOMark()
        {
            var container = new GameObject("O");
            var sphere = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Object.Destroy(sphere.GetComponent<Collider>());
            sphere.transform.SetParent(container.transform, false);
            sphere.transform.localScale = new Vector3(0.58f, 0.58f, 0.58f);
            sphere.GetComponent<Renderer>().sharedMaterial = markOMaterial;
            return container;
        }

        public void HideLastMoveRing()
        {
            if (lastMovePulse != null)
            {
                StopCoroutine(lastMovePulse);
                lastMovePulse = null;
            }

            if (lastMoveRing != null)
            {
                lastMoveRing.transform.SetParent(transform, false);
                lastMoveRing.SetActive(false);
            }
        }

        public void RemoveMark(int index)
        {
            GameObject mark;

            if (marks.TryGetValue(index, out mark))
            {
                if (lastMoveRing != null && lastMoveRing.transform.parent == cells[index].transform)
                {
                    lastMoveRing.transform.SetParent(transform, false);
                    lastMoveRing.SetActive(false);
                }

                Object.Destroy(mark);
                marks.Remove(index);
            }

            cells[index].SetOccupied(false);
        }

        public void SetSelected(int index, bool selected)
        {
            cells[index].SetSelected(selected);
        }

        public void ClearSelection()
        {
            foreach (var cell in cells)
            {
                cell.SetSelected(false);
            }
        }

        // ------------------------------------------------------------------
        // Beams (completed lines)
        // ------------------------------------------------------------------

        /// <summary>
        /// Draw beams through lines completed by one move. X beams are square
        /// bars, O beams are round bars, so ownership reads without color.
        /// The player's older beams dim once per move, so a multi-line move
        /// keeps all of its new beams bright together.
        /// </summary>
        public void AddLineBeams(List<int[]> lines, Player player)
        {
            if (lines == null || lines.Count == 0)
            {
                return;
            }

            foreach (var entry in beams)
            {
                if (entry.Owner == player)
                {
                    entry.Beam.GetComponent<Renderer>().sharedMaterial =
                        player == Player.X ? beamXDimMaterial : beamODimMaterial;
                }
            }

            foreach (var line in lines)
            {
                var beam = CreateBeam(line, player == Player.X ? beamXMaterial : beamOMaterial, player == Player.X, 0.12f);
                beam.name = "Beam " + player;
                beams.Add(new BeamEntry { Beam = beam, Owner = player, Line = line });
                beam.SetActive(!LayersSeparated);
            }
        }

        /// <summary>Highlight the round-winning line (Classic ruleset).</summary>
        public void HighlightWinningLine(int[] line, Player player)
        {
            foreach (int index in line)
            {
                GameObject mark;

                if (marks.TryGetValue(index, out mark))
                {
                    foreach (var markRenderer in mark.GetComponentsInChildren<Renderer>())
                    {
                        markRenderer.sharedMaterial = winMaterial;
                    }
                }
            }

            var beam = CreateBeam(line, winMaterial, player == Player.X, 0.14f);
            beam.name = "WinBeam";
            beams.Add(new BeamEntry { Beam = beam, Owner = player, Line = line });
            beam.SetActive(!LayersSeparated);
        }

        private GameObject CreateBeam(int[] line, Material material, bool square, float thickness)
        {
            var start = CellPosition(line[0]);
            var end = CellPosition(line[line.Length - 1]);
            float length = (end - start).magnitude + 0.3f;
            GameObject beam;

            if (square)
            {
                beam = GameObject.CreatePrimitive(PrimitiveType.Cube);
                Object.Destroy(beam.GetComponent<Collider>());
                beam.transform.SetParent(transform, false);
                beam.transform.localPosition = (start + end) * 0.5f;
                beam.transform.localRotation = Quaternion.LookRotation(end - start);
                beam.transform.localScale = new Vector3(thickness, thickness, length);
            }
            else
            {
                // Cylinder's long axis is Y; rotate it onto the line direction.
                beam = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                Object.Destroy(beam.GetComponent<Collider>());
                beam.transform.SetParent(transform, false);
                beam.transform.localPosition = (start + end) * 0.5f;
                beam.transform.localRotation = Quaternion.LookRotation(end - start) * Quaternion.Euler(90f, 0f, 0f);
                beam.transform.localScale = new Vector3(thickness, length * 0.5f, thickness);
            }

            beam.GetComponent<Renderer>().sharedMaterial = material;
            return beam;
        }

        /// <summary>Pulse the given player's beams (used while the result panel waits).</summary>
        public void PulseBeams(Player player, float duration)
        {
            if (!GamePrefs.Effects)
            {
                return;
            }

            foreach (var entry in beams)
            {
                if (entry.Owner == player)
                {
                    StartCoroutine(PulseScale(entry.Beam.transform, duration));
                }
            }
        }

        private IEnumerator PulseScale(Transform target, float duration)
        {
            if (target == null)
            {
                yield break;
            }

            var baseScale = target.localScale;
            float elapsed = 0f;

            while (elapsed < duration && target != null)
            {
                elapsed += Time.deltaTime;
                float wave = 1f + Mathf.Sin(elapsed * 7f) * 0.25f;
                target.localScale = new Vector3(baseScale.x * wave, baseScale.y, baseScale.z * wave);
                yield return null;
            }

            if (target != null)
            {
                target.localScale = baseScale;
            }
        }

        // ------------------------------------------------------------------
        // Threat hints (analysis layer)
        // ------------------------------------------------------------------

        /// <summary>
        /// Threat hints sized by how many lines each cell completes: a
        /// triple-line kill move reads bigger than a single-line one.
        /// </summary>
        public void ShowHints(Dictionary<int, int> dangerCells, Dictionary<int, int> scoringCells)
        {
            ClearHints();

            foreach (var entry in dangerCells)
            {
                hintObjects.Add(CreateHintCube(entry.Key, hintRedMaterial, entry.Value));
            }

            foreach (var entry in scoringCells)
            {
                if (!dangerCells.ContainsKey(entry.Key))
                {
                    hintObjects.Add(CreateHintCube(entry.Key, hintGreenMaterial, entry.Value));
                }
            }
        }

        private GameObject CreateHintCube(int index, Material material, int lineCount)
        {
            float scale = lineCount >= 3 ? 0.86f : lineCount == 2 ? 0.72f : 0.56f;
            var hint = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Object.Destroy(hint.GetComponent<Collider>());
            hint.name = "Hint " + index + " x" + lineCount;
            hint.transform.SetParent(cells[index].transform, false);
            hint.transform.localScale = new Vector3(scale, scale, scale);
            hint.GetComponent<Renderer>().sharedMaterial = material;
            return hint;
        }

        public void ClearHints()
        {
            foreach (var hint in hintObjects)
            {
                Object.Destroy(hint);
            }

            hintObjects.Clear();
        }

        // ------------------------------------------------------------------
        // Exploded layer view
        // ------------------------------------------------------------------

        public void SetLayersSeparated(bool separated)
        {
            LayersSeparated = separated;

            foreach (var entry in beams)
            {
                entry.Beam.SetActive(!separated);
            }

            if (separationRoutine != null)
            {
                StopCoroutine(separationRoutine);
            }

            separationRoutine = StartCoroutine(AnimateSeparation(separated ? 1f : 0f));
        }

        private IEnumerator AnimateSeparation(float target)
        {
            float start = layerSeparation;
            float elapsed = 0f;
            const float duration = 0.3f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                layerSeparation = Mathf.Lerp(start, target, Mathf.Clamp01(elapsed / duration));
                ApplySeparation();
                yield return null;
            }

            layerSeparation = target;
            ApplySeparation();
            separationRoutine = null;
        }

        private void ApplySeparation()
        {
            foreach (var cell in cells)
            {
                cell.transform.localPosition = SeparatedCellPosition(cell.Index);
            }

            foreach (var part in frameParts)
            {
                var tag = part.GetComponent<CellView>();
                var position = part.transform.localPosition;
                position.y = (tag.LayerIndex - 1) * (CellSpacing + LayerExtraGap * layerSeparation);
                part.transform.localPosition = position;
            }
        }

        /// <summary>World position of a cell's visual center (follows explosion).</summary>
        public Vector3 CellWorldPosition(int index)
        {
            return cells[index].transform.position;
        }

        // ------------------------------------------------------------------
        // Celebration
        // ------------------------------------------------------------------

        /// <summary>Confetti: small physics cubes raining over the board.</summary>
        public void PlayConfetti()
        {
            if (!GamePrefs.Effects)
            {
                return;
            }

            var palette = new[]
            {
                markXMaterial, markOMaterial, winMaterial, beamXMaterial, beamOMaterial,
            };

            for (int i = 0; i < 42; i += 1)
            {
                var piece = GameObject.CreatePrimitive(PrimitiveType.Cube);
                Object.Destroy(piece.GetComponent<Collider>());
                piece.name = "Confetti";
                piece.transform.SetParent(transform, false);
                piece.transform.localPosition = new Vector3(
                    Random.Range(-2.2f, 2.2f),
                    Random.Range(2.6f, 4.4f),
                    Random.Range(-2.2f, 2.2f));
                piece.transform.localRotation = Quaternion.Euler(
                    Random.Range(0f, 360f), Random.Range(0f, 360f), Random.Range(0f, 360f));
                float size = Random.Range(0.07f, 0.14f);
                piece.transform.localScale = new Vector3(size, size * 0.4f, size);
                piece.GetComponent<Renderer>().sharedMaterial = palette[i % palette.Length];

                var body = piece.AddComponent<Rigidbody>();
                body.mass = 0.05f;
                body.linearVelocity = new Vector3(Random.Range(-0.6f, 0.6f), Random.Range(-0.4f, 0.2f), Random.Range(-0.6f, 0.6f));
                body.angularVelocity = new Vector3(Random.Range(-6f, 6f), Random.Range(-6f, 6f), Random.Range(-6f, 6f));

                Object.Destroy(piece, 3.2f);
            }
        }

        // ------------------------------------------------------------------
        // Reset
        // ------------------------------------------------------------------

        public void ClearBoard()
        {
            foreach (var mark in marks.Values)
            {
                Object.Destroy(mark);
            }

            marks.Clear();

            foreach (var entry in beams)
            {
                Object.Destroy(entry.Beam);
            }

            beams.Clear();
            ClearHints();

            if (lastMoveRing != null)
            {
                lastMoveRing.transform.SetParent(transform, false);
                lastMoveRing.SetActive(false);
            }

            foreach (var cell in cells)
            {
                cell.SetOccupied(false);
            }
        }
    }
}
