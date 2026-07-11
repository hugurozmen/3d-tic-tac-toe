import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAIRED_DIFFICULTY_MATCHUPS,
  DEFAULT_SELF_PLAY_SCENARIOS,
  FULL_BOARD_OPENING_PROBES,
  runPairedDifficultyMatchup,
  runPairedDifficultySuite,
  runSelfPlaySuite,
} from './aiSelfPlay';
import { chooseAiMove } from './ai';
import {
  createBoard,
  getAvailableMoves,
  getLineScores,
  getOtherPlayer,
} from './rules';

describe('AI self-play evaluation harness', () => {
  it('runs the required Phase 4 scenario matrix and records balance metrics', () => {
    const reports = runSelfPlaySuite({ gamesPerScenario: 2, seed: 4403 });

    expect(reports.map((report) => report.label)).toEqual(
      DEFAULT_SELF_PLAY_SCENARIOS.map((scenario) => scenario.label),
    );

    for (const report of reports) {
      expect(report.metrics.games).toBe(2);
      expect(report.metrics.illegalMoves).toBe(0);
      expect(report.metrics.averageDecisionTimeMs).toBeGreaterThanOrEqual(0);
      expect(report.metrics.averageFinalScore.X).toBeGreaterThanOrEqual(0);
      expect(report.metrics.averageFinalScore.O).toBeGreaterThanOrEqual(0);
      expect(report.metrics.averageLineDifferential).toBeGreaterThanOrEqual(0);
      expect(report.metrics.firstPlayerAdvantage).toBeGreaterThanOrEqual(-1);
      expect(report.metrics.firstPlayerAdvantage).toBeLessThanOrEqual(1);
      expect(report.metrics.multiLineMoves).toBeGreaterThanOrEqual(0);
      expect(report.metrics.openingOutcomes.center.games).toBe(1);
      expect(report.metrics.openingOutcomes.nonCenter.games).toBe(1);
      expect(report.metrics.seatOutcomes.X.games).toBe(2);
      expect(report.metrics.seatOutcomes.O.games).toBe(2);

      if (report.ruleset === 'lines') {
        expect(report.metrics.finalSix.games).toBe(2);
        expect(report.metrics.finalSix.outcomeChangeRate).not.toBeNull();
        expect(report.metrics.finalSix.leadChangeRate).not.toBeNull();
      } else {
        expect(report.metrics.finalSix.games).toBe(0);
        expect(report.metrics.finalSix.outcomeChangeRate).toBeNull();
        expect(report.metrics.finalSix.leadChangeRate).toBeNull();
      }
    }
  }, 30000);

  it('pairs seeds and opening cells while comparing every adjacent difficulty in both seats', () => {
    const reports = runPairedDifficultySuite({
      pairsPerMatchup: 4,
      seed: 4403,
    });

    expect(reports.map((report) => report.label)).toEqual(
      DEFAULT_PAIRED_DIFFICULTY_MATCHUPS.map((matchup) => matchup.label),
    );

    for (const report of reports) {
      expect(report.pairs).toBe(4);
      expect(report.games).toBe(8);
      expect(report.illegalMoves).toBe(0);
      expect(report.seatings.higherAsX.games).toBe(4);
      expect(report.seatings.higherAsO.games).toBe(4);
      expect(report.combined.games).toBe(8);
      expect(report.finalSix.games).toBe(8);
      expect(
        report.openingOutcomes.center.games +
          report.openingOutcomes.nonCenter.games,
      ).toBe(8);

      for (const fixture of report.fixtures) {
        expect(fixture.higherAsX.seed).toBe(fixture.seed);
        expect(fixture.higherAsO.seed).toBe(fixture.seed);
        expect(fixture.higherAsX.forcedOpening).toBe(fixture.forcedOpening);
        expect(fixture.higherAsO.forcedOpening).toBe(fixture.forcedOpening);
        expect(fixture.higherAsX.firstMove).toBe(fixture.forcedOpening);
        expect(fixture.higherAsO.firstMove).toBe(fixture.forcedOpening);
        expect(fixture.higherAsX.xDifficulty).toBe(report.higherDifficulty);
        expect(fixture.higherAsX.oDifficulty).toBe(report.lowerDifficulty);
        expect(fixture.higherAsO.xDifficulty).toBe(report.lowerDifficulty);
        expect(fixture.higherAsO.oDifficulty).toBe(report.higherDifficulty);
      }
    }
  }, 30000);

  it('keeps Master stronger than Hard across every forced opening and both seats', () => {
    const report = runPairedDifficultyMatchup({
      forcedOpenings: FULL_BOARD_OPENING_PROBES,
      higherDifficulty: 'master',
      label: 'Lines/Master vs Hard/full-board',
      lowerDifficulty: 'hard',
      pairs: FULL_BOARD_OPENING_PROBES.length,
      ruleset: 'lines',
      seed: 1201,
    });

    expect(report.fixtures.map((fixture) => fixture.forcedOpening)).toEqual(
      FULL_BOARD_OPENING_PROBES,
    );
    expect(report.seatings.higherAsX.averageLineDifferential).toBeGreaterThan(0);
    expect(report.seatings.higherAsO.averageLineDifferential).toBeGreaterThan(0);
    expect(report.pairedAverageLineDifferential).toBeGreaterThan(0.25);
    expect(report.combined.scoreRate).toBeGreaterThan(0.6);
    expect(report.combined.wins).toBeGreaterThan(report.combined.losses);
    expect(report.strengthExpectationMet).toBe(true);
  }, 30000);

  it('uses Master search depth to improve the final line differential', () => {
    const board = createBoard();

    for (const [move, player] of [
      [1, 'X'],
      [3, 'O'],
      [4, 'O'],
      [5, 'O'],
      [6, 'X'],
      [10, 'X'],
      [16, 'O'],
      [22, 'X'],
      [25, 'X'],
      [26, 'O'],
    ] as const) {
      board[move] = player;
    }

    const hardMove = chooseAiMove(board, 'X', 'hard', 'lines');
    const masterMove = chooseAiMove(board, 'X', 'master', 'lines');

    expect(hardMove).toBe(19);
    expect(masterMove).toBe(13);

    const finishWithMasterPlay = (firstMove: number) => {
      const continuation = [...board];
      continuation[firstMove] = 'X';
      let player = getOtherPlayer('X');

      while (getAvailableMoves(continuation).length > 0) {
        const move = chooseAiMove(continuation, player, 'master', 'lines');

        if (move === null) {
          throw new Error('Master must return a legal move before the board fills.');
        }

        continuation[move] = player;
        player = getOtherPlayer(player);
      }

      const score = getLineScores(continuation);
      return score.X - score.O;
    };

    expect(finishWithMasterPlay(masterMove as number)).toBeGreaterThan(
      finishWithMasterPlay(hardMove as number),
    );
  });
});
