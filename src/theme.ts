import type { CSSProperties } from 'react';

export type ThemeId = 'glass' | 'holo' | 'frosted' | 'crystal' | 'cage';

export type CellStyle = 'glass' | 'wire' | 'ghost';
export type MarkStyle = 'classic' | 'orb' | 'shape';
export type RailStyle = 'thin' | 'bold' | 'none';

export type SceneTheme = {
  ambient: number;
  background: string;
  cell: string;
  cellOpacity: number;
  cellStyle: CellStyle;
  coreGlow: boolean;
  cubeShell: boolean;
  directional: number;
  edge: string;
  fog: string;
  hover: string;
  labelBackground: string;
  labelBorder: string;
  labelText: string;
  markStyle: MarkStyle;
  o: string;
  point: string;
  rail: string;
  railStyle: RailStyle;
  scanFloor: boolean;
  title: string;
  win: string;
  winBeam: boolean;
  x: string;
};

type UiTheme = {
  active: string;
  activeText: string;
  background: string;
  border: string;
  focus: string;
  muted: string;
  panel: string;
  panelStrong: string;
  primary: string;
  primaryText: string;
  scheme: 'dark' | 'light';
  secondary: string;
  stageLine: string;
  text: string;
  tile: string;
};

export type Theme = {
  id: ThemeId;
  label: string;
  scene: SceneTheme;
  ui: UiTheme;
};

export type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

export const THEMES: Record<ThemeId, Theme> = {
  glass: {
    id: 'glass',
    label: 'Glass',
    scene: {
      ambient: 1.0,
      background: '#0a1124',
      cell: '#9db8ff',
      cellOpacity: 0.07,
      cellStyle: 'ghost',
      coreGlow: false,
      cubeShell: true,
      directional: 1.8,
      edge: '#7aa2ff',
      fog: '#0a1124',
      hover: '#ff8a7a',
      labelBackground: 'rgba(10, 17, 36, 0.68)',
      labelBorder: 'rgba(122, 162, 255, 0.4)',
      labelText: '#eaf1ff',
      markStyle: 'shape',
      o: '#3fe3cb',
      point: '#5d6fff',
      rail: '#27355c',
      railStyle: 'none',
      scanFloor: false,
      title: '#9db8ff',
      win: '#f4c542',
      winBeam: true,
      x: '#ff635d',
    },
    ui: {
      active: '#9db8ff',
      activeText: '#0b1228',
      background: '#0a1124',
      border: 'rgba(122, 162, 255, 0.2)',
      focus: '#f4c542',
      muted: '#8fa3cc',
      panel: 'rgba(12, 20, 40, 0.88)',
      panelStrong: '#15203d',
      primary: '#f4c542',
      primaryText: '#1a1304',
      scheme: 'dark',
      secondary: '#1c2a4d',
      stageLine: 'rgba(122, 162, 255, 0.45)',
      text: '#eaf1ff',
      tile: '#101a33',
    },
  },
  holo: {
    id: 'holo',
    label: 'Hologram',
    scene: {
      ambient: 0.95,
      background: '#04070d',
      cell: '#22d3ee',
      cellOpacity: 0.05,
      cellStyle: 'ghost',
      coreGlow: false,
      cubeShell: true,
      directional: 1.6,
      edge: '#22d3ee',
      fog: '#04070d',
      hover: '#f471b5',
      labelBackground: 'rgba(4, 7, 13, 0.7)',
      labelBorder: 'rgba(34, 211, 238, 0.4)',
      labelText: '#d9fbff',
      markStyle: 'shape',
      o: '#22d3ee',
      point: '#f471b5',
      rail: '#155e6b',
      railStyle: 'none',
      scanFloor: true,
      title: '#22d3ee',
      win: '#f4f07a',
      winBeam: false,
      x: '#f471b5',
    },
    ui: {
      active: '#22d3ee',
      activeText: '#04121a',
      background: '#04070d',
      border: 'rgba(34, 211, 238, 0.22)',
      focus: '#f471b5',
      muted: '#7fa6b8',
      panel: 'rgba(6, 12, 20, 0.88)',
      panelStrong: '#0b1722',
      primary: '#22d3ee',
      primaryText: '#04121a',
      scheme: 'dark',
      secondary: '#0e2230',
      stageLine: 'rgba(34, 211, 238, 0.5)',
      text: '#e6fbff',
      tile: '#081119',
    },
  },
  frosted: {
    id: 'frosted',
    label: 'Frosted',
    scene: {
      ambient: 1.4,
      background: '#e9eef7',
      cell: '#ffffff',
      cellOpacity: 0.24,
      cellStyle: 'ghost',
      coreGlow: false,
      cubeShell: true,
      directional: 1.7,
      edge: '#8295b8',
      fog: '#e9eef7',
      hover: '#ff635d',
      labelBackground: 'rgba(255, 255, 255, 0.72)',
      labelBorder: 'rgba(71, 94, 138, 0.3)',
      labelText: '#2c3a55',
      markStyle: 'orb',
      o: '#2fc4ae',
      point: '#ffffff',
      rail: '#c3cede',
      railStyle: 'none',
      scanFloor: false,
      title: '#5a6f96',
      win: '#e8a23d',
      winBeam: false,
      x: '#ff635d',
    },
    ui: {
      active: '#33415e',
      activeText: '#f5f8ff',
      background: '#e9eef7',
      border: 'rgba(51, 65, 94, 0.16)',
      focus: '#e4632e',
      muted: '#54627c',
      panel: 'rgba(255, 255, 255, 0.72)',
      panelStrong: '#ffffff',
      primary: '#e4632e',
      primaryText: '#fff6ef',
      scheme: 'light',
      secondary: '#dde4f0',
      stageLine: 'rgba(51, 65, 94, 0.35)',
      text: '#1f2940',
      tile: '#f4f7fc',
    },
  },
  crystal: {
    id: 'crystal',
    label: 'Crystal',
    scene: {
      ambient: 0.88,
      background: '#0a0714',
      cell: '#b496ff',
      cellOpacity: 0.1,
      cellStyle: 'ghost',
      coreGlow: true,
      cubeShell: true,
      directional: 1.7,
      edge: '#8f7bd8',
      fog: '#0a0714',
      hover: '#ff8d7a',
      labelBackground: 'rgba(10, 7, 20, 0.66)',
      labelBorder: 'rgba(180, 150, 255, 0.4)',
      labelText: '#efe9ff',
      markStyle: 'orb',
      o: '#4fe0cc',
      point: '#9d6eff',
      rail: '#3a2f63',
      railStyle: 'none',
      scanFloor: false,
      title: '#b8a3ff',
      win: '#ffd166',
      winBeam: true,
      x: '#ff635d',
    },
    ui: {
      active: '#b8a3ff',
      activeText: '#140d2b',
      background: '#0a0714',
      border: 'rgba(184, 163, 255, 0.2)',
      focus: '#ffd166',
      muted: '#9b8fc0',
      panel: 'rgba(15, 10, 30, 0.88)',
      panelStrong: '#1a1232',
      primary: '#9d6eff',
      primaryText: '#0d081c',
      scheme: 'dark',
      secondary: '#221741',
      stageLine: 'rgba(157, 110, 255, 0.45)',
      text: '#efe9ff',
      tile: '#150e29',
    },
  },
  cage: {
    id: 'cage',
    label: 'Cage',
    scene: {
      ambient: 1.05,
      background: '#0b0f18',
      cell: '#aab6c8',
      cellOpacity: 0.08,
      cellStyle: 'ghost',
      coreGlow: false,
      cubeShell: false,
      directional: 1.9,
      edge: '#94a3b8',
      fog: '#0b0f18',
      hover: '#ff635d',
      labelBackground: 'rgba(11, 15, 24, 0.66)',
      labelBorder: 'rgba(148, 163, 184, 0.35)',
      labelText: '#e8edf5',
      markStyle: 'orb',
      o: '#2fc4ae',
      point: '#5a8dff',
      rail: '#8b98ab',
      railStyle: 'bold',
      scanFloor: false,
      title: '#aab6c8',
      win: '#ffd166',
      winBeam: false,
      x: '#ff635d',
    },
    ui: {
      active: '#cbd5e1',
      activeText: '#0f1622',
      background: '#0b0f18',
      border: 'rgba(148, 163, 184, 0.18)',
      focus: '#ffd166',
      muted: '#8d9bb0',
      panel: 'rgba(13, 18, 28, 0.9)',
      panelStrong: '#161e2e',
      primary: '#5a8dff',
      primaryText: '#0a1020',
      scheme: 'dark',
      secondary: '#1d2738',
      stageLine: 'rgba(148, 163, 184, 0.4)',
      text: '#e8edf5',
      tile: '#111827',
    },
  },
};

export const THEME_ORDER: ThemeId[] = [
  'glass',
  'holo',
  'frosted',
  'crystal',
  'cage',
];

export const themeToCssVariables = (theme: Theme): ThemeStyle => ({
  '--app-active': theme.ui.active,
  '--app-active-text': theme.ui.activeText,
  '--app-bg': theme.ui.background,
  '--app-border': theme.ui.border,
  '--app-focus': theme.ui.focus,
  '--app-muted': theme.ui.muted,
  '--app-panel': theme.ui.panel,
  '--app-panel-strong': theme.ui.panelStrong,
  '--app-primary': theme.ui.primary,
  '--app-primary-text': theme.ui.primaryText,
  '--app-secondary': theme.ui.secondary,
  '--app-stage-line': theme.ui.stageLine,
  '--app-text': theme.ui.text,
  '--app-tile': theme.ui.tile,
  '--app-glow': theme.scene.point,
  '--app-win': theme.scene.win,
  '--mark-o': theme.scene.o,
  '--mark-x': theme.scene.x,
});
