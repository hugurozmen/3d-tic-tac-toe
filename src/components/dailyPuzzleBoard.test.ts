import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getDailyPuzzle } from '../game/puzzles';
import { createI18n, I18nProvider } from '../i18n';
import { DailyPuzzleBoard } from './panel/PanelDailyProgress';

describe('DailyPuzzleBoard', () => {
  it('renders three localized 3x3 floors with spatial cell labels', () => {
    const puzzle = getDailyPuzzle(new Date(2026, 0, 2));
    const markup = renderToStaticMarkup(
      createElement(
        I18nProvider,
        {
          children: createElement(DailyPuzzleBoard, {
            dailyPuzzle: puzzle,
            dailyPuzzleResult: null,
            onMove: () => undefined,
          }),
          value: createI18n('tr'),
        },
      ),
    );

    expect(markup.match(/class="daily-puzzle-floor"/g)).toHaveLength(3);
    expect(markup.match(/daily-cell/g)).toHaveLength(27);
    expect(markup).toContain('aria-label="Bulmaca katı 1"');
    expect(markup).toContain('>Kat 1<');
    expect(markup).toContain(
      'aria-label="Hücre 27, kat 3, satır 3, sütun 3,',
    );
  });
});
