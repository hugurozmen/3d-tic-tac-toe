using UnityEngine;

namespace TicTacube.Game
{
    /// <summary>
    /// One tappable cell of the 3x3x3 board. The collider is larger than the
    /// idle visual so touch targets stay comfortable on phones. The collider
    /// stays enabled when occupied so taps never ray through a placed mark
    /// into a hidden cell behind it — the controller ignores occupied cells.
    /// </summary>
    public sealed class CellView : MonoBehaviour
    {
        public int Index;
        public int LayerIndex;

        private GameObject idleVisual;
        private Renderer idleRenderer;
        private Material idleMaterial;
        private Material selectedMaterial;
        private bool occupied;
        private bool selected;

        public void Build(int index, int layerIndex, Material idle, Material highlight)
        {
            Index = index;
            LayerIndex = layerIndex;
            idleMaterial = idle;
            selectedMaterial = highlight;

            var tapCollider = gameObject.AddComponent<BoxCollider>();
            tapCollider.size = new Vector3(0.95f, 0.95f, 0.95f);

            idleVisual = GameObject.CreatePrimitive(PrimitiveType.Cube);
            idleVisual.name = "Idle";
            Object.Destroy(idleVisual.GetComponent<Collider>());
            idleVisual.transform.SetParent(transform, false);
            idleVisual.transform.localScale = new Vector3(0.3f, 0.3f, 0.3f);
            idleRenderer = idleVisual.GetComponent<Renderer>();
            idleRenderer.sharedMaterial = idleMaterial;
        }

        public void SetOccupied(bool value)
        {
            occupied = value;

            if (occupied)
            {
                SetSelected(false);
            }

            Refresh();
        }

        /// <summary>Pending-move highlight: enlarged, accent-colored cell.</summary>
        public void SetSelected(bool value)
        {
            selected = value && !occupied;
            Refresh();
        }

        private void Refresh()
        {
            if (idleVisual == null)
            {
                return;
            }

            idleVisual.SetActive(!occupied);

            if (occupied)
            {
                return;
            }

            idleVisual.transform.localScale = selected
                ? new Vector3(0.52f, 0.52f, 0.52f)
                : new Vector3(0.3f, 0.3f, 0.3f);
            idleRenderer.sharedMaterial = selected ? selectedMaterial : idleMaterial;
        }
    }
}
