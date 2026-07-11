import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createI18n, I18nProvider } from '../i18n';
import { GameDialogs, type PendingConfirm } from './GameDialogs';

const noop = () => undefined;

const renderDialogs = ({
  guideOpen = false,
  pendingConfirm = null,
  piePromptOpen = false,
}: {
  guideOpen?: boolean;
  pendingConfirm?: PendingConfirm | null;
  piePromptOpen?: boolean;
}) =>
  renderToStaticMarkup(
    createElement(I18nProvider, {
      children: createElement(GameDialogs, {
        guideOpen,
        pendingConfirm,
        piePromptOpen,
        onCancelConfirm: noop,
        onCloseGuide: noop,
        onConfirmPending: noop,
        onKeepPie: noop,
        onSwapPie: noop,
      }),
      value: createI18n('en'),
    }),
  );

describe('GameDialogs tutorial', () => {
  it('opens on the first lesson with stable progress and action hooks', () => {
    const markup = renderDialogs({ guideOpen: true });

    expect(markup).toContain('data-step="1"');
    expect(markup).toContain('One cube, three floors');
    expect(markup).toContain('tutorial-step');
    expect(markup.match(/tutorial-progress-dot/g)).toHaveLength(5);
    expect(markup).toContain('>Back</button>');
    expect(markup).toContain('>Next</button>');
    expect(markup).toContain('>Skip</button>');
  });

  it('renders only the highest-priority active dialog', () => {
    const markup = renderDialogs({
      guideOpen: true,
      pendingConfirm: {
        message: 'Confirm this change',
        run: noop,
        title: 'Confirm',
      },
      piePromptOpen: true,
    });

    expect(markup).toContain('Confirm this change');
    expect(markup).not.toContain('tutorial-card');
    expect(markup).not.toContain('Pie Rule decision');
  });
});
