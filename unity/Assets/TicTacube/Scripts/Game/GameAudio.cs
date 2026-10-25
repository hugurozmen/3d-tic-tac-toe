using UnityEngine;

namespace TicTacube.Game
{
    /// <summary>
    /// Procedurally generated audio (no asset files): short sine-based blips
    /// for moves, rising chimes for completed lines, and end-of-round tones.
    /// Also owns haptic feedback. Everything respects the Sound preference.
    /// </summary>
    public sealed class GameAudio : MonoBehaviour
    {
        private const int SampleRate = 22050;

        private AudioSource source;
        private AudioClip tapClip;
        private AudioClip selectClip;
        private AudioClip lineClip;
        private AudioClip multiLineClip;
        private AudioClip winClip;
        private AudioClip loseClip;
        private AudioClip drawClip;

        public void Initialize()
        {
            source = gameObject.AddComponent<AudioSource>();
            source.playOnAwake = false;
            source.volume = 0.8f;

            tapClip = BuildClip("tap", new[] { 880f }, new[] { 0f }, 0.07f, 0.5f);
            selectClip = BuildClip("select", new[] { 523f }, new[] { 0f }, 0.05f, 0.3f);
            lineClip = BuildClip("line", new[] { 660f, 990f }, new[] { 0f, 0.09f }, 0.3f, 0.6f);
            multiLineClip = BuildClip("multi", new[] { 660f, 880f, 1175f }, new[] { 0f, 0.08f, 0.16f }, 0.42f, 0.7f);
            winClip = BuildClip("win", new[] { 523f, 659f, 784f, 1047f }, new[] { 0f, 0.1f, 0.2f, 0.3f }, 0.7f, 0.65f);
            loseClip = BuildClip("lose", new[] { 330f, 262f }, new[] { 0f, 0.16f }, 0.5f, 0.5f);
            drawClip = BuildClip("draw", new[] { 440f, 440f }, new[] { 0f, 0.14f }, 0.4f, 0.45f);
        }

        /// <summary>
        /// Mix exponentially decaying sine tones (one per frequency, offset by
        /// startTimes) into a single clip.
        /// </summary>
        private static AudioClip BuildClip(string name, float[] frequencies, float[] startTimes, float length, float gain)
        {
            int sampleCount = (int)(SampleRate * length);
            var data = new float[sampleCount];

            for (int tone = 0; tone < frequencies.Length; tone += 1)
            {
                int start = (int)(SampleRate * startTimes[tone]);
                float frequency = frequencies[tone];

                for (int i = start; i < sampleCount; i += 1)
                {
                    float t = (i - start) / (float)SampleRate;
                    float envelope = Mathf.Pow(1f - Mathf.Clamp01(t / (length - startTimes[tone])), 2.2f);
                    data[i] += Mathf.Sin(2f * Mathf.PI * frequency * t) * envelope;
                }
            }

            // Normalize against tone overlap, apply gain, soften attack.
            for (int i = 0; i < sampleCount; i += 1)
            {
                data[i] = Mathf.Clamp(data[i] / Mathf.Max(1f, frequencies.Length * 0.7f), -1f, 1f) * gain;
            }

            var clip = AudioClip.Create(name, sampleCount, 1, SampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }

        private void Play(AudioClip clip)
        {
            if (clip != null && source != null && GamePrefs.Sound)
            {
                source.PlayOneShot(clip);
            }
        }

        public void PlayTap()
        {
            Play(tapClip);
        }

        public void PlaySelect()
        {
            Play(selectClip);
        }

        public void PlayLines(int lineCount)
        {
            Play(lineCount > 1 ? multiLineClip : lineClip);
            Vibrate();
        }

        public void PlayRoundEnd(bool humanWon, bool isDraw)
        {
            if (isDraw)
            {
                Play(drawClip);
            }
            else if (humanWon)
            {
                Play(winClip);
                Vibrate();
            }
            else
            {
                Play(loseClip);
            }
        }

        public static void Vibrate()
        {
            if (!GamePrefs.Effects)
            {
                return;
            }

#if UNITY_ANDROID || UNITY_IOS
            Handheld.Vibrate();
#endif
        }
    }
}
