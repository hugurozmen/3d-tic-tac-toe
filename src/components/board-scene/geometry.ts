import * as THREE from 'three';
import type { BoardLayout } from '../../game/boardView';
import { toCoordinate } from '../../game/rules';

export const CAMERA_HOME = new THREE.Vector3(4.2, 3.5, 5.2);
export const BOARD_TARGET = new THREE.Vector3(0, 0, 0);
export const MIN_DISTANCE = 3.7;
export const MAX_DISTANCE = 14;

const HOME_DISTANCE = CAMERA_HOME.length();
const HALF_FOV = THREE.MathUtils.degToRad(21);

export const fitCameraDistance = (aspect: number, layout: BoardLayout) => {
  const narrowComfort = aspect < 1.25 ? 1.2 : aspect < 1.5 ? 1.1 : 1;
  const extent = (layout === 'floors' ? 3.85 : 3.35) * narrowComfort;
  const fit = extent / (Math.tan(HALF_FOV) * Math.min(aspect, 1.5));

  return THREE.MathUtils.clamp(
    Math.max(HOME_DISTANCE, fit),
    MIN_DISTANCE,
    MAX_DISTANCE,
  );
};

export const SPACING = 1.08;
export const FLOOR_GAP = 1.8;

export const ringGeometry = new THREE.TorusGeometry(0.27, 0.055, 18, 48);
export const xBarGeometry = new THREE.BoxGeometry(0.58, 0.1, 0.1);
export const cellGeometry = new THREE.BoxGeometry(0.72, 0.72, 0.72);
export const railGeometry = new THREE.BoxGeometry(2.95, 0.035, 0.035);
export const boldRailGeometry = new THREE.BoxGeometry(3.1, 0.06, 0.06);
export const orbGeometry = new THREE.SphereGeometry(0.3, 32, 24);
export const gemGeometry = new THREE.IcosahedronGeometry(0.33, 0);
export const jointGeometry = new THREE.SphereGeometry(0.085, 16, 12);
export const dotGeometry = new THREE.SphereGeometry(0.05, 12, 10);
export const diamondGeometry = new THREE.OctahedronGeometry(0.3);
export const plateGeometry = new THREE.BoxGeometry(3.5, 0.05, 3.5);

export const plateGridGeometry = (() => {
  const points: number[] = [];
  const h = 1.62;
  const lines = [-h, -h / 3, h / 3, h];

  for (const c of lines) {
    points.push(-h, 0, c, h, 0, c);
    points.push(c, 0, -h, c, 0, h);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(points, 3),
  );

  return geometry;
})();

export const SHELL_HALF = 1.66;
export const shellBoxGeometry = new THREE.BoxGeometry(
  SHELL_HALF * 2,
  SHELL_HALF * 2,
  SHELL_HALF * 2,
);

export const shellGridGeometry = (() => {
  const points: number[] = [];
  const h = SHELL_HALF;
  const lines = [-h, -h / 3, h / 3, h];

  const addLine = (
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
  ) => {
    points.push(x1, y1, z1, x2, y2, z2);
  };

  for (const z of [-h, h]) {
    for (const c of lines) {
      addLine(-h, c, z, h, c, z);
      addLine(c, -h, z, c, h, z);
    }
  }

  for (const x of [-h, h]) {
    for (const c of lines) {
      addLine(x, c, -h, x, c, h);
      addLine(x, -h, c, x, h, c);
    }
  }

  for (const y of [-h, h]) {
    for (const c of lines) {
      addLine(-h, y, c, h, y, c);
      addLine(c, y, -h, c, y, h);
    }
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(points, 3),
  );

  return geometry;
})();

export const cellPosition = (
  index: number,
  layout: BoardLayout,
): [number, number, number] => {
  const { x, y, z } = toCoordinate(index);

  if (layout === 'floors') {
    return [(x - 1) * SPACING, (z - 1) * FLOOR_GAP, (y - 1) * SPACING];
  }

  return [(x - 1) * SPACING, (y - 1) * SPACING, (z - 1) * SPACING];
};
