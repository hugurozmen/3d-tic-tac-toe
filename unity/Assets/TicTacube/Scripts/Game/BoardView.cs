using System.Collections.Generic;
using TicTacube.Core;
using UnityEngine;

namespace TicTacube.Game
{
    /// <summary>
    /// Builds and updates the 3x3x3 board: cells, marks, and completed-line
    /// beams. Everything is generated from primitives at runtime; materials
    /// come from Resources so they survive shader stripping in device builds.
    /// </summary>
    public sealed class BoardView : MonoBehaviour
    {
        public const float CellSpacing = 1.15f;

        private readonly CellView[] cells = new CellView[Rules.CellCount];
        private readonly Dictionary<int, GameObject> marks = new Dictionary<int, GameObject>();
        private readonly List<GameObject> beams = new List<GameObject>();

        private Material cellIdleMaterial;
        private Material markXMaterial;
        private Material markOMaterial;
        private Material beamXMaterial;
        private Material beamOMaterial;
        private Material winMaterial;

        public static Vector3 CellPosition(int index)
        {
            int x, y, z;
            WinningLines.ToCoordinate(index, out x, out y, out z);
            return new Vector3((x - 1) * CellSpacing, (y - 1) * CellSpacing, (z - 1) * CellSpacing);
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
            cellIdleMaterial = LoadMaterial("CellIdle", new Color(0.58f, 0.62f, 0.7f));
            markXMaterial = LoadMaterial("MarkX", new Color(0.96f, 0.42f, 0.32f));
            markOMaterial = LoadMaterial("MarkO", new Color(0.33f, 0.62f, 0.95f));
            beamXMaterial = LoadMaterial("BeamX", new Color(1f, 0.56f, 0.45f));
            beamOMaterial = LoadMaterial("BeamO", new Color(0.5f, 0.76f, 1f));
            winMaterial = LoadMaterial("Win", new Color(1f, 0.84f, 0.32f));

            for (int index = 0; index < Rules.CellCount; index += 1)
            {
                var cellObject = new GameObject("Cell " + index);
                cellObject.transform.SetParent(transform, false);
                cellObject.transform.localPosition = CellPosition(index);

                var cell = cellObject.AddComponent<CellView>();
                cell.Build(index, cellIdleMaterial);
                cells[index] = cell;
            }
        }

        public void SetMark(int index, Player player)
        {
            cells[index].SetOccupied(true);

            var mark = player == Player.X ? CreateXMark() : CreateOMark();
            mark.name = "Mark " + player + " " + index;
            mark.transform.SetParent(transform, false);
            mark.transform.localPosition = CellPosition(index);
            marks[index] = mark;
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

        /// <summary>Draw a beam through a completed line (Lines ruleset scoring).</summary>
        public void AddLineBeam(int[] line, Player player)
        {
            var start = CellPosition(line[0]);
            var end = CellPosition(line[line.Length - 1]);
            var beam = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Object.Destroy(beam.GetComponent<Collider>());
            beam.name = "Beam " + player;
            beam.transform.SetParent(transform, false);
            beam.transform.localPosition = (start + end) * 0.5f;
            beam.transform.localRotation = Quaternion.LookRotation(end - start);
            beam.transform.localScale = new Vector3(0.07f, 0.07f, (end - start).magnitude + 0.3f);
            beam.GetComponent<Renderer>().sharedMaterial = player == Player.X ? beamXMaterial : beamOMaterial;
            beams.Add(beam);
        }

        /// <summary>Highlight the round-winning line (Classic ruleset).</summary>
        public void HighlightWinningLine(int[] line, Player player)
        {
            foreach (int index in line)
            {
                GameObject mark;

                if (marks.TryGetValue(index, out mark))
                {
                    foreach (var renderer in mark.GetComponentsInChildren<Renderer>())
                    {
                        renderer.sharedMaterial = winMaterial;
                    }
                }
            }

            var start = CellPosition(line[0]);
            var end = CellPosition(line[line.Length - 1]);
            var beam = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Object.Destroy(beam.GetComponent<Collider>());
            beam.name = "WinBeam";
            beam.transform.SetParent(transform, false);
            beam.transform.localPosition = (start + end) * 0.5f;
            beam.transform.localRotation = Quaternion.LookRotation(end - start);
            beam.transform.localScale = new Vector3(0.09f, 0.09f, (end - start).magnitude + 0.35f);
            beam.GetComponent<Renderer>().sharedMaterial = winMaterial;
            beams.Add(beam);
        }

        public void ClearBoard()
        {
            foreach (var mark in marks.Values)
            {
                Object.Destroy(mark);
            }

            marks.Clear();

            foreach (var beam in beams)
            {
                Object.Destroy(beam);
            }

            beams.Clear();

            foreach (var cell in cells)
            {
                cell.SetOccupied(false);
            }
        }
    }
}
