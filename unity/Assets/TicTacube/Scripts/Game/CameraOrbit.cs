using UnityEngine;
using UnityEngine.EventSystems;

namespace TicTacube.Game
{
    /// <summary>
    /// Mobile-first camera: one-finger drag orbits the board, pinch zooms,
    /// a short tap places a mark. Mouse drag / scroll wheel cover the editor
    /// and desktop builds.
    /// </summary>
    public sealed class CameraOrbit : MonoBehaviour
    {
        private const float OrbitSpeed = 0.25f;
        private const float PinchSpeed = 0.012f;
        private const float MinPitch = -75f;
        private const float MaxPitch = 75f;
        private const float MinDistance = 4.5f;
        private const float MaxDistance = 13f;
        private const float TapMaxSeconds = 0.4f;

        private GameController controller;
        private Camera orbitCamera;
        private Vector3 target = Vector3.zero;

        private float yaw = 38f;
        private float pitch = 24f;
        private float distance = 7.5f;

        private bool trackingTouch;
        private bool touchStartedOverUi;
        private float touchStartTime;
        private float touchTravel;

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

            Apply();
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
                    touchStartedOverUi = PointerOverUi(touch.fingerId);
                    touchStartTime = Time.time;
                    touchTravel = 0f;
                }
                else if (trackingTouch && touch.phase == TouchPhase.Moved)
                {
                    touchTravel += touch.deltaPosition.magnitude;

                    if (!touchStartedOverUi)
                    {
                        yaw += touch.deltaPosition.x * OrbitSpeed;
                        pitch -= touch.deltaPosition.y * OrbitSpeed;
                        pitch = Mathf.Clamp(pitch, MinPitch, MaxPitch);
                    }
                }
                else if (trackingTouch && touch.phase == TouchPhase.Ended)
                {
                    bool isTap = touchTravel <= TapMaxTravel()
                        && Time.time - touchStartTime <= TapMaxSeconds;

                    if (isTap && !touchStartedOverUi)
                    {
                        TryTap(touch.position);
                    }

                    trackingTouch = false;
                }
                else if (touch.phase == TouchPhase.Canceled)
                {
                    trackingTouch = false;
                }

                return;
            }

            if (Input.touchCount >= 2)
            {
                trackingTouch = false;
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
                touchStartedOverUi = PointerOverUi(-1);
                touchStartTime = Time.time;
                touchTravel = 0f;
            }
            else if (trackingTouch && Input.GetMouseButton(0))
            {
                float dx = Input.GetAxis("Mouse X");
                float dy = Input.GetAxis("Mouse Y");
                touchTravel += Mathf.Abs(dx) + Mathf.Abs(dy);

                if (!touchStartedOverUi)
                {
                    yaw += dx * 4f;
                    pitch -= dy * 4f;
                    pitch = Mathf.Clamp(pitch, MinPitch, MaxPitch);
                }
            }
            else if (trackingTouch && Input.GetMouseButtonUp(0))
            {
                bool isTap = touchTravel <= 0.6f && Time.time - touchStartTime <= TapMaxSeconds;

                if (isTap && !touchStartedOverUi)
                {
                    TryTap(Input.mousePosition);
                }

                trackingTouch = false;
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

                if (cell != null)
                {
                    controller.OnCellTapped(cell.Index);
                }
            }
        }

        private void Apply()
        {
            var rotation = Quaternion.Euler(pitch, yaw, 0f);
            transform.position = target + rotation * new Vector3(0f, 0f, -distance);
            transform.rotation = rotation;
        }
    }
}
