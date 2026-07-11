export const CAMERA_FIT_EPSILON = 0.01;

export type CameraFitResolution = {
  distance: number;
  fittedDistance: number;
  shouldApplyFit: boolean;
  userAdjusted: boolean;
};

type ResolveCameraFitOptions = {
  currentDistance: number;
  nextFittedDistance: number;
  previousFittedDistance: number | null;
};

/**
 * Decides whether a responsive auto-fit may change the camera distance.
 *
 * The most recently calculated fit is the camera's default-distance contract.
 * A camera still at that distance follows future viewport/layout fits. A camera
 * away from it was dolly-zoomed by the player and keeps its distance instead.
 */
export function resolveCameraFit({
  currentDistance,
  nextFittedDistance,
  previousFittedDistance,
}: ResolveCameraFitOptions): CameraFitResolution {
  const userAdjusted =
    previousFittedDistance !== null &&
    Math.abs(currentDistance - previousFittedDistance) > CAMERA_FIT_EPSILON;
  const shouldApplyFit = !userAdjusted;

  return {
    distance: shouldApplyFit ? nextFittedDistance : currentDistance,
    fittedDistance: nextFittedDistance,
    shouldApplyFit,
    userAdjusted,
  };
}

export const orbitZoomSpeed = (coarsePointer: boolean) =>
  coarsePointer ? 1.1 : 0.7;
