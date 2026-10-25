// Minimal UnityEngine API stubs — compile-time validation only, never shipped.
#pragma warning disable 0649
using System;

namespace UnityEngine
{
    public struct Vector2
    {
        public float x, y;
        public Vector2(float x, float y) { this.x = x; this.y = y; }
        public static Vector2 zero { get { return new Vector2(0, 0); } }
        public static Vector2 one { get { return new Vector2(1, 1); } }
        public float magnitude { get { return (float)Math.Sqrt(x * x + y * y); } }
        public static Vector2 operator -(Vector2 a, Vector2 b) { return new Vector2(a.x - b.x, a.y - b.y); }
        public static Vector2 operator +(Vector2 a, Vector2 b) { return new Vector2(a.x + b.x, a.y + b.y); }
        public static implicit operator Vector2(Vector3 v) { return new Vector2(v.x, v.y); }
    }

    public struct Vector3
    {
        public float x, y, z;
        public Vector3(float x, float y, float z) { this.x = x; this.y = y; this.z = z; }
        public static Vector3 zero { get { return new Vector3(0, 0, 0); } }
        public static Vector3 one { get { return new Vector3(1, 1, 1); } }
        public static Vector3 up { get { return new Vector3(0, 1, 0); } }
        public static Vector3 Lerp(Vector3 a, Vector3 b, float t) { t = Mathf.Clamp01(t); return new Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t); }
        public static Vector3 operator -(Vector3 a) { return new Vector3(-a.x, -a.y, -a.z); }
        public float magnitude { get { return (float)Math.Sqrt(x * x + y * y + z * z); } }
        public static Vector3 operator +(Vector3 a, Vector3 b) { return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z); }
        public static Vector3 operator -(Vector3 a, Vector3 b) { return new Vector3(a.x - b.x, a.y - b.y, a.z - b.z); }
        public static Vector3 operator *(Vector3 a, float d) { return new Vector3(a.x * d, a.y * d, a.z * d); }
        public static implicit operator Vector3(Vector2 v) { return new Vector3(v.x, v.y, 0); }
    }

    public struct Quaternion
    {
        public static Quaternion identity { get { return new Quaternion(); } }
        public static Quaternion Euler(float x, float y, float z) { return new Quaternion(); }
        public static Quaternion LookRotation(Vector3 forward) { return new Quaternion(); }
        public static Vector3 operator *(Quaternion rotation, Vector3 point) { return point; }
        public static Quaternion operator *(Quaternion a, Quaternion b) { return a; }
        public static Quaternion Slerp(Quaternion a, Quaternion b, float t) { return a; }
    }

    public struct Color
    {
        public float r, g, b, a;
        public Color(float r, float g, float b) { this.r = r; this.g = g; this.b = b; a = 1; }
        public Color(float r, float g, float b, float a) { this.r = r; this.g = g; this.b = b; this.a = a; }
        public static Color white { get { return new Color(1, 1, 1); } }
        public static Color black { get { return new Color(0, 0, 0); } }
        public static Color clear { get { return new Color(0, 0, 0, 0); } }
        public static Color Lerp(Color a, Color b, float t) { t = Mathf.Clamp01(t); return new Color(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t, a.a + (b.a - a.a) * t); }
    }

    public static class Mathf
    {
        public const float PI = 3.14159274f;
        public static float Clamp(float value, float min, float max) { return Math.Min(max, Math.Max(min, value)); }
        public static float Clamp01(float value) { return Clamp(value, 0f, 1f); }
        public static float Abs(float value) { return Math.Abs(value); }
        public static float Sin(float f) { return (float)Math.Sin(f); }
        public static float Cos(float f) { return (float)Math.Cos(f); }
        public static float Pow(float f, float p) { return (float)Math.Pow(f, p); }
        public static float Sqrt(float f) { return (float)Math.Sqrt(f); }
        public static float Lerp(float a, float b, float t) { return a + (b - a) * Clamp01(t); }
        public static float Min(float a, float b) { return Math.Min(a, b); }
        public static float Max(float a, float b) { return Math.Max(a, b); }
        public static int Min(int a, int b) { return Math.Min(a, b); }
        public static int Max(int a, int b) { return Math.Max(a, b); }
        public static int FloorToInt(float f) { return (int)Math.Floor(f); }
        public static float Repeat(float t, float length) { return t - (float)Math.Floor(t / length) * length; }
    }

    public class Object
    {
        public string name;
        public static void Destroy(Object obj) { }
        public static void Destroy(Object obj, float delay) { }
        public static void DontDestroyOnLoad(Object obj) { }
        public static T FindObjectOfType<T>() where T : Object { return null; }
    }

    public class GameObject : Object
    {
        public Transform transform = new Transform();
        public string tag;
        public GameObject() { }
        public GameObject(string name) { }
        public T AddComponent<T>() where T : Component, new() { var c = new T(); c.gameObject = this; return c; }
        public T GetComponent<T>() where T : class { return null; }
        public T[] GetComponentsInChildren<T>() where T : class { return new T[0]; }
        public void SetActive(bool active) { }
        public static GameObject CreatePrimitive(PrimitiveType type) { return new GameObject(); }
    }

    public enum PrimitiveType { Sphere, Capsule, Cylinder, Cube, Plane, Quad }

    public enum Space { World, Self }

    public class Component : Object
    {
        public GameObject gameObject = new GameObject();
        public Transform transform { get { return gameObject.transform; } }
        public T GetComponent<T>() where T : class { return gameObject.GetComponent<T>(); }
        public T[] GetComponentsInChildren<T>() where T : class { return new T[0]; }
    }

    public class Behaviour : Component
    {
        public bool enabled;
    }

    public class MonoBehaviour : Behaviour
    {
        public Coroutine StartCoroutine(System.Collections.IEnumerator routine) { return new Coroutine(); }
        public void StopCoroutine(Coroutine routine) { }
        public void StopAllCoroutines() { }
    }

    public class YieldInstruction { }

    public class Coroutine : YieldInstruction { }

    public class WaitForSeconds : YieldInstruction
    {
        public WaitForSeconds(float seconds) { }
    }

    public class Transform : Component
    {
        public Vector3 position;
        public Quaternion rotation;
        public Vector3 localPosition;
        public Quaternion localRotation;
        public Vector3 localScale;
        public Transform parent;
        public void SetParent(Transform parent, bool worldPositionStays) { }
        public Transform Find(string name) { return null; }
        public void Rotate(float xAngle, float yAngle, float zAngle) { }
        public void Rotate(Vector3 eulers, Space relativeTo) { }
        public Vector3 localEulerAngles;
        public int childCount { get { return 0; } }
        public Transform GetChild(int index) { return null; }
    }

    public class RectTransform : Transform
    {
        public Vector2 anchorMin;
        public Vector2 anchorMax;
        public Vector2 pivot;
        public Vector2 anchoredPosition;
        public Vector2 sizeDelta;
        public Vector2 offsetMin;
        public Vector2 offsetMax;
    }

    public class Renderer : Component
    {
        public Material material;
        public Material sharedMaterial;
    }

    public class Collider : Component
    {
        public bool enabled;
    }

    public class BoxCollider : Collider
    {
        public Vector3 size;
        public Vector3 center;
    }

    public class Shader : Object
    {
        public static Shader Find(string name) { return new Shader(); }
    }

    public class Material : Object
    {
        public Color color;
        public Material(Shader shader) { }
        public Material(Material source) { }
        public void SetColor(string name, Color value) { }
        public void EnableKeyword(string keyword) { }
    }

    public class AudioClip : Object
    {
        public delegate void PCMReaderCallback(float[] data);
        public delegate void PCMSetPositionCallback(int position);
        public static AudioClip Create(string name, int lengthSamples, int channels, int frequency, bool stream) { return new AudioClip(); }
        public bool SetData(float[] data, int offsetSamples) { return true; }
    }

    public class AudioSource : Behaviour
    {
        public float volume;
        public bool playOnAwake;
        public void PlayOneShot(AudioClip clip) { }
        public void PlayOneShot(AudioClip clip, float volumeScale) { }
    }

    public class AudioListener : Behaviour
    {
    }

    public static class Handheld
    {
        public static void Vibrate() { }
    }

    public static class PlayerPrefs
    {
        // Dictionary-backed so persistence-dependent logic is testable.
        private static readonly System.Collections.Generic.Dictionary<string, object> store =
            new System.Collections.Generic.Dictionary<string, object>();
        public static int GetInt(string key, int fallback) { object v; return store.TryGetValue(key, out v) && v is int ? (int)v : fallback; }
        public static void SetInt(string key, int value) { store[key] = value; }
        public static string GetString(string key, string fallback) { object v; return store.TryGetValue(key, out v) && v is string ? (string)v : fallback; }
        public static void SetString(string key, string value) { store[key] = value; }
        public static bool HasKey(string key) { return store.ContainsKey(key); }
        public static void DeleteKey(string key) { store.Remove(key); }
        public static void Save() { }
    }

    public static class JsonUtility
    {
        public static string ToJson(object obj) { return ""; }
        public static T FromJson<T>(string json) { return default(T); }
    }

    public class Rigidbody : Component
    {
        public float mass;
        public bool useGravity;
        public Vector3 velocity;
        public Vector3 linearVelocity;
        public Vector3 angularVelocity;
        public void AddForce(Vector3 force) { }
    }

    public static class Random
    {
        public static float Range(float min, float max) { return min; }
        public static int Range(int min, int max) { return min; }
    }

    public class Font : Object
    {
    }

    public static class Resources
    {
        public static T Load<T>(string path) where T : Object { return null; }
        public static T GetBuiltinResource<T>(string path) where T : Object { return null; }
    }

    public enum CameraClearFlags { Skybox, SolidColor, Depth, Nothing }

    public class Camera : Behaviour
    {
        public static Camera main;
        public CameraClearFlags clearFlags;
        public Color backgroundColor;
        public float fieldOfView;
        public Ray ScreenPointToRay(Vector3 position) { return new Ray(); }
        public Vector3 WorldToScreenPoint(Vector3 position) { return position; }
    }

    public enum LightType { Spot, Directional, Point, Area }

    public class Light : Behaviour
    {
        public LightType type;
        public float intensity;
        public Color color;
    }

    public static class RenderSettings
    {
        public static Color ambientLight;
    }

    public struct Ray
    {
    }

    public struct RaycastHit
    {
        public Collider collider { get { return null; } }
    }

    public static class Physics
    {
        public static bool Raycast(Ray ray, out RaycastHit hit, float maxDistance) { hit = new RaycastHit(); return false; }
    }

    public enum TouchPhase { Began, Moved, Stationary, Ended, Canceled }

    public struct Touch
    {
        public int fingerId { get { return 0; } }
        public Vector2 position { get { return new Vector2(); } }
        public Vector2 deltaPosition { get { return new Vector2(); } }
        public TouchPhase phase { get { return TouchPhase.Began; } }
    }

    public static class Input
    {
        public static int touchCount { get { return 0; } }
        public static Touch GetTouch(int index) { return new Touch(); }
        public static Vector3 mousePosition { get { return new Vector3(); } }
        public static bool GetMouseButtonDown(int button) { return false; }
        public static bool GetMouseButton(int button) { return false; }
        public static bool GetMouseButtonUp(int button) { return false; }
        public static float GetAxis(string axisName) { return 0f; }
    }

    public static class Time
    {
        public static float time { get { return 0f; } }
        public static float deltaTime { get { return 0f; } }
        public static float unscaledDeltaTime { get { return 0f; } }
    }

    public static class Screen
    {
        public static float dpi { get { return 160f; } }
        public static int width { get { return 1080; } }
        public static int height { get { return 1920; } }
    }

    public enum SystemLanguage { Turkish, English, Unknown }

    public static class Application
    {
        public static SystemLanguage systemLanguage { get { return SystemLanguage.Unknown; } }
        public static int targetFrameRate;
    }

    public static class GUIUtility
    {
        public static string systemCopyBuffer;
    }

    public static class Debug
    {
        public static void Log(object message) { }
        public static void LogWarning(object message) { }
    }

    public enum RuntimeInitializeLoadType { AfterSceneLoad, BeforeSceneLoad, AfterAssembliesLoaded, BeforeSplashScreen, SubsystemRegistration }

    public sealed class RuntimeInitializeOnLoadMethodAttribute : Attribute
    {
        public RuntimeInitializeOnLoadMethodAttribute() { }
        public RuntimeInitializeOnLoadMethodAttribute(RuntimeInitializeLoadType loadType) { }
    }

    public enum RenderMode { ScreenSpaceOverlay, ScreenSpaceCamera, WorldSpace }

    public class Canvas : Behaviour
    {
        public RenderMode renderMode;
        public int sortingOrder;
    }

    public enum TextAnchor { UpperLeft, UpperCenter, UpperRight, MiddleLeft, MiddleCenter, MiddleRight, LowerLeft, LowerCenter, LowerRight }
    public enum FontStyle { Normal, Bold, Italic, BoldAndItalic }
}

namespace UnityEngine.Events
{
    public delegate void UnityAction();

    public class UnityEvent
    {
        public void AddListener(UnityAction call) { }
    }
}

namespace UnityEngine.EventSystems
{
    public class EventSystem : MonoBehaviour
    {
        public static EventSystem current;
        public bool IsPointerOverGameObject() { return false; }
        public bool IsPointerOverGameObject(int pointerId) { return false; }
    }

    public class StandaloneInputModule : MonoBehaviour
    {
    }
}

namespace UnityEngine.UI
{
    using UnityEngine.Events;

    public class Graphic : MonoBehaviour
    {
        public Color color;
        public bool raycastTarget;
    }

    public class CanvasScaler : MonoBehaviour
    {
        public enum ScaleMode { ConstantPixelSize, ScaleWithScreenSize, ConstantPhysicalSize }
        public ScaleMode uiScaleMode;
        public Vector2 referenceResolution;
        public float matchWidthOrHeight;
    }

    public class GraphicRaycaster : MonoBehaviour
    {
    }

    public class Text : Graphic
    {
        public bool resizeTextForBestFit;
        public int resizeTextMinSize;
        public int resizeTextMaxSize;
        public Font font;
        public string text;
        public int fontSize;
        public TextAnchor alignment;
        public FontStyle fontStyle;
        public bool supportRichText;
    }

    public class InputField : MonoBehaviour
    {
        public string text = "";
        public Text textComponent;
        public Graphic placeholder;
        public int characterLimit;
    }

    public class Image : Graphic
    {
    }

    public class Outline : MonoBehaviour
    {
        public Color effectColor;
        public Vector2 effectDistance;
    }

    public class Button : MonoBehaviour
    {
        public class ButtonClickedEvent : UnityEvent { }
        public ButtonClickedEvent onClick = new ButtonClickedEvent();
        public bool interactable;
        public Graphic targetGraphic;
    }
}
