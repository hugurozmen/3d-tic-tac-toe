import { describe, expect, it } from 'vitest';
import { THEME_ORDER, THEMES } from '../theme';

const hexToRgb = (hex: string) => {
  const value = hex.replace('#', '');

  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
};

const relativeLuminance = (hex: string) => {
  const [red, green, blue] = hexToRgb(hex).map((channel) => {
    const value = channel / 255;

    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrastRatio = (first: string, second: string) => {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((a, b) => b - a);

  return (lighter + 0.05) / (darker + 0.05);
};

describe('theme readability', () => {
  it('keeps UI text readable across every theme', () => {
    for (const themeId of THEME_ORDER) {
      const theme = THEMES[themeId];

      expect(
        contrastRatio(theme.ui.text, theme.ui.background),
        theme.label,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(theme.ui.activeText, theme.ui.active),
        `${theme.label} active control`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps board marks and win accents distinguishable from the scene', () => {
    for (const themeId of THEME_ORDER) {
      const theme = THEMES[themeId];

      expect(contrastRatio(theme.scene.x, theme.scene.background), theme.label)
        .toBeGreaterThanOrEqual(3);
      expect(contrastRatio(theme.scene.o, theme.scene.background), theme.label)
        .toBeGreaterThanOrEqual(3);
      expect(contrastRatio(theme.scene.win, theme.scene.background), theme.label)
        .toBeGreaterThanOrEqual(3);
    }
  });
});
