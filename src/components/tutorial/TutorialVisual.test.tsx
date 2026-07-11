import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createI18n, I18nProvider } from '../../i18n';
import { TutorialVisual } from './TutorialVisual';
import { TUTORIAL_STEPS } from './tutorial';

const renderVisual = (step: (typeof TUTORIAL_STEPS)[number]['id']) =>
  renderToStaticMarkup(
    createElement(I18nProvider, {
      children: createElement(TutorialVisual, { step }),
      value: createI18n('en'),
    }),
  );

describe('TutorialVisual', () => {
  it('renders a lightweight visual for every lesson', () => {
    for (const { id } of TUTORIAL_STEPS) {
      const markup = renderVisual(id);

      expect(markup).toContain(`tutorial-visual-${id}`);
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('<svg');
    }
  });

  it('localizes the visible two-tap instruction', () => {
    expect(renderVisual('touch')).toContain('Tap again to place');
  });
});
