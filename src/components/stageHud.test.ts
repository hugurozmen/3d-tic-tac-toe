import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createI18n, I18nProvider } from '../i18n';
import { StageHud, type StageHudProps } from './StageHud';

const renderHud = (props: StageHudProps, locale: 'en' | 'tr' = 'en') =>
  renderToStaticMarkup(
    createElement(
      I18nProvider,
      {
        children: createElement(StageHud, props),
        value: createI18n(locale),
      },
    ),
  );

const baseProps: StageHudProps = {
  currentPlayer: 'X',
  isAiThinking: false,
  isComplete: false,
  isDraw: false,
  lineScores: { X: 4, O: 3 },
  matchScoreText: 'You 2 · AI 1',
  remainingCells: 5,
  ruleset: 'lines',
  status: 'X turn',
};

describe('StageHud', () => {
  it('renders all live Lines context in one compact status group', () => {
    const markup = renderHud(baseProps);

    expect(markup).toContain('aria-label="Live game status"');
    expect(markup).toContain('stage-hud-lines');
    expect(markup).toContain('stage-hud-turn turn-x');
    expect(markup).toContain('X turn');
    expect(markup).toContain('4–3');
    expect(markup).toContain('You 2 · AI 1');
    expect(markup).toContain('stage-hud-remaining tense');
    expect(markup).toContain('>5<');
  });

  it('keeps Classic concise and localizes the status labels', () => {
    const markup = renderHud(
      {
        ...baseProps,
        matchScoreText: 'X 1 · O 2',
        ruleset: 'classic',
        status: 'Sıra O',
      },
      'tr',
    );

    expect(markup).toContain('aria-label="Canlı oyun durumu"');
    expect(markup).toContain('stage-hud stage-hud-ruleset-classic');
    expect(markup).toContain('Sıra O');
    expect(markup).toContain('X 1 · O 2');
    expect(markup).not.toContain('stage-hud-lines');
    expect(markup).not.toContain('stage-hud-remaining');
  });

  it('labels a terminal state as a result instead of the next turn', () => {
    const markup = renderHud({
      ...baseProps,
      currentPlayer: 'O',
      isComplete: true,
      status: 'You win by lines, 8–6',
    });

    expect(markup).toContain('stage-hud-terminal');
    expect(markup).toContain('>Result<');
    expect(markup).toContain('You win by lines, 8–6');
  });

  it('uses a neutral result state for draws', () => {
    const markup = renderHud({
      ...baseProps,
      isComplete: true,
      isDraw: true,
      status: 'Draw by lines, 6–6',
    });

    expect(markup).toContain('stage-hud-draw');
    expect(markup).toContain('lucide-equal');
    expect(markup).not.toContain('lucide-trophy');
  });
});
