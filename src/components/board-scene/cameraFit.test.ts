import { describe, expect, it } from 'vitest';
import { orbitZoomSpeed, resolveCameraFit } from './cameraFit';

describe('resolveCameraFit', () => {
  it('applies the first fitted distance', () => {
    expect(
      resolveCameraFit({
        currentDistance: 6,
        nextFittedDistance: 8,
        previousFittedDistance: null,
      }),
    ).toEqual({
      distance: 8,
      fittedDistance: 8,
      shouldApplyFit: true,
      userAdjusted: false,
    });
  });

  it('updates the fit on resize when the camera is still at its default', () => {
    const resolution = resolveCameraFit({
      currentDistance: 8,
      nextFittedDistance: 9.5,
      previousFittedDistance: 8,
    });

    expect(resolution.distance).toBe(9.5);
    expect(resolution.shouldApplyFit).toBe(true);
    expect(resolution.userAdjusted).toBe(false);
  });

  it('preserves a player dolly distance across resize', () => {
    const resolution = resolveCameraFit({
      currentDistance: 6.72,
      nextFittedDistance: 9.5,
      previousFittedDistance: 8,
    });

    expect(resolution.distance).toBe(6.72);
    expect(resolution.fittedDistance).toBe(9.5);
    expect(resolution.shouldApplyFit).toBe(false);
    expect(resolution.userAdjusted).toBe(true);
  });

  it('preserves a player dolly distance across a layout fit change', () => {
    const resolution = resolveCameraFit({
      currentDistance: 7,
      nextFittedDistance: 11,
      previousFittedDistance: 8,
    });

    expect(resolution.distance).toBe(7);
    expect(resolution.fittedDistance).toBe(11);
  });

  it('allows future fits after reset returns to the current default', () => {
    const resolution = resolveCameraFit({
      currentDistance: 11,
      nextFittedDistance: 10,
      previousFittedDistance: 11,
    });

    expect(resolution.distance).toBe(10);
    expect(resolution.shouldApplyFit).toBe(true);
  });

  it('ignores harmless floating-point drift around the fitted distance', () => {
    const resolution = resolveCameraFit({
      currentDistance: 8.005,
      nextFittedDistance: 9,
      previousFittedDistance: 8,
    });

    expect(resolution.distance).toBe(9);
    expect(resolution.userAdjusted).toBe(false);
  });
});

describe('orbitZoomSpeed', () => {
  it('uses a more responsive pinch speed for coarse pointers', () => {
    expect(orbitZoomSpeed(true)).toBe(1.1);
    expect(orbitZoomSpeed(false)).toBe(0.7);
  });
});
