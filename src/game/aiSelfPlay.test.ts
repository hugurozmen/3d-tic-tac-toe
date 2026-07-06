import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SELF_PLAY_SCENARIOS,
  runSelfPlayScenario,
  runSelfPlaySuite,
} from './aiSelfPlay';

describe('AI self-play evaluation harness', () => {
  it('runs the required Phase 4 scenario matrix and records balance metrics', () => {
    const reports = runSelfPlaySuite({ gamesPerScenario: 1, seed: 4403 });

    expect(reports.map((report) => report.label)).toEqual(
      DEFAULT_SELF_PLAY_SCENARIOS.map((scenario) => scenario.label),
    );

    for (const report of reports) {
      expect(report.metrics.games).toBe(1);
      expect(report.metrics.illegalMoves).toBe(0);
      expect(report.metrics.averageDecisionTimeMs).toBeGreaterThanOrEqual(0);
      expect(report.metrics.averageFinalScore.X).toBeGreaterThanOrEqual(0);
      expect(report.metrics.averageFinalScore.O).toBeGreaterThanOrEqual(0);
      expect(report.metrics.averageLineDifferential).toBeGreaterThanOrEqual(0);
      expect(report.metrics.firstPlayerAdvantage).toBeGreaterThanOrEqual(-1);
      expect(report.metrics.firstPlayerAdvantage).toBeLessThanOrEqual(1);
      expect(report.metrics.multiLineMoves).toBeGreaterThanOrEqual(0);
    }
  }, 30000);

  it('keeps Master stronger than Hard in a direct Lines benchmark', () => {
    const masterAsX = runSelfPlayScenario({
      centerOpeningEvery: 3,
      games: 3,
      label: 'Lines/Master-vs-Hard',
      oDifficulty: 'hard',
      ruleset: 'lines',
      seed: 1201,
      xDifficulty: 'master',
    });
    const hardAsX = runSelfPlayScenario({
      centerOpeningEvery: 3,
      games: 3,
      label: 'Lines/Hard-vs-Master',
      oDifficulty: 'master',
      ruleset: 'lines',
      seed: 1201,
      xDifficulty: 'hard',
    });
    const masterLineEdge =
      masterAsX.metrics.averageFinalScore.X -
      masterAsX.metrics.averageFinalScore.O +
      (hardAsX.metrics.averageFinalScore.O -
        hardAsX.metrics.averageFinalScore.X);

    expect(masterLineEdge).toBeGreaterThan(0);
  });
});
