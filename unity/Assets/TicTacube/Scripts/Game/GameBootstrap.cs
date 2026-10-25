using UnityEngine;

namespace TicTacube.Game
{
    /// <summary>
    /// Builds the whole game at startup, so any scene — even an empty one —
    /// boots into TicTacube without prefab or scene wiring.
    /// </summary>
    public static class GameBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if (Object.FindObjectOfType<GameController>() != null)
            {
                return;
            }

            var root = new GameObject("TicTacube");
            root.AddComponent<GameController>();
            Object.DontDestroyOnLoad(root);
        }
    }
}
