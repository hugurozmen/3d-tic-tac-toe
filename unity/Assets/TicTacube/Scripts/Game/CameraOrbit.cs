using UnityEngine;
using UnityEngine.EventSystems;

namespace TicTacube.Game
{
    /// <summary>
    /// Mobile-first camera: one-finger drag orbits the board, pinch zooms,
    /// a short tap places a mark. A drag dead-zone keeps shaky fingers from
    /// nudging the camera while tapping. Mouse drag / scroll wheel cover the
    /// editor and desktop builds.
    /// </summary>
    public sealed class CameraOrbit : MonoBehaviour
    {
        private const float OrbitSpeed = 0.25f;
        private const float PinchSpeed = 0.012f;
        private const float MinPitch = -75f;
        private const float MaxPitch = 75f;
        private const float MinDistance = 4.5f;
        private const float MaxDistance = 13f;
        private const float TapMaxSeconds = 0.8f;

        private GameController controller;
        private Camera orbitCamera;
        private Vector3 target = Vector3.zero;

        private float yaw = 38f;
        private float pitch = 24f;
        private float distance = 7.5f;

        private bool trackingTouch;
        private bool touchStartedOverUi;
        private bool dragging;
        private float touchStartTime;
        private float touchTravel;

        private Vector3 shakeOffset = Vector3.zero;
        private float shakeStrength;

        public void Initialize(GameController gameController, Camera camera)
        {
            controller = gameController;
            orbitCamera = camera;
            Apply();
        }

        private float TapMaxTravel()
        {
            float dpi = Screen.dpi;

            if (dpi <= 0f)
            {
                dpi = 160f;
            }

            return dpi * 0.08f;
        }

        /// <summary>Brief decaying camera shake (gated by the Effects pref).</summary>
        public void Shake(float strength)
        {
            if (GamePrefs.Effects)
            {
                shakeStrength = Mathf.Max(shakeStrength, strength);
            }
        }

        private void Update()
        {
            if (orbitCamera == null)
            {
                return;
            }

            if (Input.touchCount > 0)
            {
                HandleTouch();
            }
            else
            {
                HandleMouse();
            }

            UpdateShake();
            Apply();
        }

        private void UpdateShake()
        {
            if (shakeStrength > 0.001f)
            {
                shakeOffset = new Vector3(
                    Random.Range(-1f, 1f) * shakeStrength,
                    Random.Range(-1f, 1f) * shakeStrength,
                    0f);
                shakeStrength = Mathf.Lerp(shakeStrength, 0f, Time.deltaTime * 9f);
            }
            else
            {
                shakeOffset = Vector3.zero;
                shakeStrength = 0f;
            }
        }

        private static bool PointerOverUi(int fingerId)
        {
            var eventSystem = EventSystem.current;

            if (eventSystem == null)
            {
                return false;
            }

            return fingerId >= 0
                ? eventSystem.IsPointerOverGameObject(fingerId)
                : eventSystem.IsPointerOverGameObject();
        }

        private void HandleTouch()
        {
            if (Input.touchCount == 1)
            {
                var touch = Input.GetTouch(0);

                if (touch.phase == TouchPhase.Began)
                {
                    trackingTouch = true;
                    dragging = false;
                    touchStartedOverUi = PointerOverUi(touch.fingerId);
                    touchStartTime = Time.time;
                    touchTravel = 0f;
                }
                else if (trackingTouch && touch.phase == TouchPhase.Moved)
                {
                    // The Began-frame query can run before the input module
                    // processed the touch; keep accumulating so a tap that
                    // started on a button never falls through to the board.
                    touchStartedOverUi = touchStartedOverUi || PointerOverUi(touch.fingerId);
                    touchTravel += touch.deltaPosition.magnitude;

                    // Dead zone: don't orbit until the finger clearly drags,
                    // so a slightly shaky tap stays a tap.
                    if (!dragging && touchTravel > TapMaxTravel())
                    {
                        dragging = true;
                    }

                    if (dragging && !touchStartedOverUi)
                    {
                        yaw += touch.deltaPosition.x * OrbitSpeed;
                        pitch -= touch.deltaPosition.y * OrbitSpeed;
                        pitch = Mathf.Clamp(pitch, MinPitch, MaxPitch);
                    }
                }
                else if (trackingTouch && touch.phase == TouchPhase.Ended)
                {
                    bool isTap = !dragging && Time.time - touchStartTime <= TapMaxSeconds;

                    if (isTap && !touchStartedOverUi && !PointerOverUi(touch.fingerId))
                    {
                        TryTap(touch.position);
                    }

                    trackingTouch = false;
                    dragging = false;
                }
                else if (touch.phase == TouchPhase.Canceled)
                {
                    trackingTouch = false;
                    dragging = false;
                }

                return;
            }

            if (Input.touchCount >= 2)
            {
                trackingTouch = false;
                dragging = false;
                var first = Input.GetTouch(0);
                var second = Input.GetTouch(1);
                float currentGap = (first.position - second.position).magnitude;
                float previousGap = ((first.position - first.deltaPosition)
                    - (second.position - second.deltaPosition)).magnitude;
                distance = Mathf.Clamp(distance - (currentGap - previousGap) * PinchSpeed, MinDistance, MaxDistance);
            }
        }

        private void HandleMouse()
        {
            if (Input.GetMouseButtonDown(0))
            {
                trackingTouch = true;
                dragging = false;
                touchStartedOverUi = PointerOverUi(-1);
                touchStartTime = Time.time;
                touchTravel = 0f;
            }
            else if (trackingTouch && Input.GetMouseButton(0))
            {
                float dx = Input.GetAxis("Mouse X");
                float dy = Input.GetAxis("Mouse Y");
                touchTravel += Mathf.Abs(dx) + Mathf.Abs(dy);

                if (!dragging && touchTravel > 0.6f)
                {
                    dragging = true;
                }

                if (dragging && !touchStartedOverUi)
                {
                    yaw += dx * 4f;
                    pitch -= dy * 4f;
                    pitch = Mathf.Clamp(pitch, MinPitch, MaxPitch);
                }
            }
            else if (trackingTouch && Input.GetMouseButtonUp(0))
            {
                bool isTap = !dragging && Time.time - touchStartTime <= TapMaxSeconds;

                if (isTap && !touchStartedOverUi && !PointerOverUi(-1))
                {
                    TryTap(Input.mousePosition);
                }

                trackingTouch = false;
                dragging = false;
            }

            float scroll = Input.GetAxis("Mouse ScrollWheel");

            if (Mathf.Abs(scroll) > 0.0001f)
            {
                distance = Mathf.Clamp(distance - scroll * 3.5f, MinDistance, MaxDistance);
            }
        }

        private void TryTap(Vector2 screenPosition)
        {
            if (controller == null)
            {
                return;
            }

            var ray = orbitCamera.ScreenPointToRay(new Vector3(screenPosition.x, screenPosition.y, 0f));
            RaycastHit hit;

            if (Physics.Raycast(ray, out hit, 100f))
            {
                var cell = hit.collider.GetComponent<CellView>();

                if (cell != null && cell.enabled)
                {
                    controller.OnCellTapped(cell.Index);
                }
            }
        }

        private void Apply()
        {
            var rotation = Quaternion.Euler(pitch, yaw, 0f);
            transform.position = target + rotation * (new Vector3(0f, 0f, -distance) + shakeOffset);
            transform.rotation = rotation;
        }
    }
}
