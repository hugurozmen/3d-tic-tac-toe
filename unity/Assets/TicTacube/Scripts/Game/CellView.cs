using UnityEngine;

namespace TicTacube.Game
{
    /// <summary>
    /// One tappable cell of the 3x3x3 board. The collider is larger than the
    /// idle visual so touch targets stay comfortable on phones.
    /// </summary>
    public sealed class CellView : MonoBehaviour
    {
        public int Index;

        private GameObject idleVisual;
        private BoxCollider tapCollider;

        public void Build(int index, Material idleMaterial)
        {
            Index = index;

            tapCollider = gameObject.AddComponent<BoxCollider>();
            tapCollider.size = new Vector3(0.95f, 0.95f, 0.95f);

            idleVisual = GameObject.CreatePrimitive(PrimitiveType.Cube);
            idleVisual.name = "Idle";
            Object.Destroy(idleVisual.GetComponent<Collider>());
            idleVisual.transform.SetParent(transform, false);
            idleVisual.transform.localScale = new Vector3(0.22f, 0.22f, 0.22f);
            idleVisual.GetComponent<Renderer>().sharedMaterial = idleMaterial;
        }

        public void SetOccupied(bool occupied)
        {
            if (idleVisual != null)
            {
                idleVisual.SetActive(!occupied);
            }

            if (tapCollider != null)
            {
                tapCollider.enabled = !occupied;
            }
        }
    }
}
