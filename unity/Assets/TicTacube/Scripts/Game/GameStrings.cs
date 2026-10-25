using UnityEngine;

namespace TicTacube.Game
{
    /// <summary>
    /// Tiny TR/EN string table. Defaults to the device language.
    /// </summary>
    public static class GameStrings
    {
        public static bool Turkish = Application.systemLanguage == SystemLanguage.Turkish;

        public static string T(string turkish, string english)
        {
            return Turkish ? turkish : english;
        }
    }
}
