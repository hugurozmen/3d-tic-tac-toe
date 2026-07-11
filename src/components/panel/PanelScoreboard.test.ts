import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createMatchState } from '../../game/match';
import type { GameResult } from '../../game/rules';
import { createI18n, I18nProvider } from '../../i18n';
import { PanelScoreboard } from './PanelScoreboard';
import type { PanelScoreboardProps } from './types';

const drawResult: GameResult = {
  completedLines: { O: [], X: [] },
  isComplete: true,
  isDraw: true,
  lineScores: { O: 6, X: 6 },
  remainingCells: 0,
  ruleset: 'lines',
  winner: null,
  winningLine: [],
};

const baseProps: PanelScoreboardProps = {
  animationEvents: [],
  baseLineScores: { O: 6, X: 6 },
  currentPlayer: 'O',
  isAiThinking: false,
  isPowerScoreMode: false,
  lastMove: 26,
  lifetimeScore: { O: 0, X: 0, draws: 0 },
  lineScores: { O: 6, X: 6 },
  linesBonusScores: { O: 0, X: 0 },
  linesEndgameText: null,
  match: createMatchState(),
  matchScoreText: 'X 1 · O 3',
  mode: 'duo',
  nextOpenerText: 'O',
  openerText: 'X',
  recentBlockCount: 0,
  recentLineCount: 0,
  recentLinePlayer: null,
  remainingCells: 0,
  result: drawResult,
  ruleset: 'lines',
  status: 'Draw by lines, 6–6',
  onOpenGuide: () => undefined,
};

const renderScoreboard = (props: PanelScoreboardProps) =>
  renderToStaticMarkup(
    createElement(I18nProvider, {
      children: createElement(PanelScoreboard, props),
      value: createI18n('en'),
    }),
  );

describe('PanelScoreboard terminal identity', () => {
  it('uses a neutral badge instead of the toggled player mark for a draw', () => {
    const markup = renderScoreboard(baseProps);

    expect(markup).toContain('turn-badge turn-draw');
    expect(markup).toContain('lucide-equal');
    expect(markup).not.toContain('turn-badge turn-o');
  });

  it('labels the full best-of-five score as Match after completion', () => {
    const match = {
      ...createMatchState(),
      isComplete: true,
      score: { O: 3, X: 1, draws: 0 },
      winner: 'O' as const,
    };
    const markup = renderScoreboard({ ...baseProps, match });

    expect(markup).toContain('<span>Match</span><strong>X 1 · O 3</strong>');
    expect(markup).not.toContain('<span>Winner</span>');
  });
});
