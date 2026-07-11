import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CSV_FIELDS,
  PlaytestValidationError,
  analyzePlaytestRows,
  parseCsv,
  renderPlaytestReport,
  validatePlaytestRows,
} from './analyze-human-playtests.mjs';

const fixtureUrl = new URL('./fixtures/human-playtest-sample.csv', import.meta.url);
const templateUrl = new URL('../docs/human-playtest-responses.csv', import.meta.url);

async function loadFixture() {
  return parseCsv(await readFile(fixtureUrl, 'utf8'));
}

test('parses quoted CSV fields without dependencies', () => {
  const parsed = parseCsv('first,second\n1,"two, ""quoted"" words"\n');
  assert.deepEqual(parsed.headers, ['first', 'second']);
  assert.equal(parsed.rows[0].second, 'two, "quoted" words');
});

test('validates a complete deterministic playtest fixture', async () => {
  const parsed = await loadFixture();
  const rows = validatePlaytestRows(parsed.headers, parsed.rows);
  assert.equal(rows.length, 10);
});

test('keeps the fillable CSV template synchronized with the analyzer schema', async () => {
  const parsed = parseCsv(await readFile(templateUrl, 'utf8'));
  assert.deepEqual(parsed.headers, CSV_FIELDS);
  assert.equal(parsed.rows.length, 0);
});

test('reports all four protocol readouts by overall sample, cohort, and order', async () => {
  const parsed = await loadFixture();
  const analysis = analyzePlaytestRows(validatePlaytestRows(parsed.headers, parsed.rows));

  assert.deepEqual(analysis.sample, {
    participants: 1,
    games: 10,
    cohorts: { new_casual: 1, experienced: 0 },
    missingSessions: [],
  });

  const casual = analysis.casual.groups[0];
  assert.equal(casual.fairness, 3.5);
  assert.equal(casual.recoverability, 4);
  assert.equal(casual.rematchIntent, 4.5);
  assert.equal(casual.hintUseRate, 0.5);
  assert.equal(casual.confusionRate, 0.5);

  const center = analysis.center.groups[0];
  assert.equal(center.centerDifferential, 3);
  assert.equal(center.nonCenterDifferential, 0);
  assert.equal(center.pairedDelta, 3);
  assert.deepEqual(center.centerResults, [1, 0, 0]);
  assert.deepEqual(center.nonCenterResults, [0, 1, 0]);
  assert.equal(center.openingFreedom, 3);

  const finalSix = analysis.finalSix.groups[0];
  assert.equal(finalSix.outcomeChangeRate, 1);
  assert.equal(finalSix.leadChangeRate, 1);
  assert.equal(finalSix.differentialSwing, 2);
  assert.equal(finalSix.predictionConfidence, 65);
  assert.equal(finalSix.predictionAccuracy, 1);

  const blind = analysis.blind.groups[0];
  assert.equal(blind.identificationAccuracy, 1);
  assert.equal(blind.confidence, 75);
  assert.equal(blind.smartFunRate, 1);
  assert.equal(blind.hardDifficulty, 4.5);
  assert.equal(blind.smartDifficulty, 3);

  for (const readout of [analysis.casual, analysis.center, analysis.finalSix, analysis.blind]) {
    assert.ok(readout.groups.some((group) => group.label === 'Cohort: new_casual'));
    assert.ok(readout.groups.some((group) => group.label.startsWith('Order: ')));
  }

  const report = renderPlaytestReport(analysis);
  assert.match(report, /Casual approachability/);
  assert.match(report, /Center versus non-center paired openings/);
  assert.match(report, /Standard final-six relevance/);
  assert.match(report, /Blind Smart versus Hard identity/);
  assert.match(report, /Cohort: new_casual/);
  assert.match(report, /Order: ABBA/);
});

test('rejects contradictory results with actionable line errors', async () => {
  const parsed = await loadFixture();
  const rows = parsed.rows.map((row) => ({ ...row }));
  rows[0].result = 'loss';

  assert.throws(
    () => validatePlaytestRows(parsed.headers, rows),
    (error) => {
      assert.ok(error instanceof PlaytestValidationError);
      assert.ok(error.errors.some((issue) => issue.includes('conflicts with final score')));
      assert.ok(error.errors.some((issue) => issue.startsWith('Line 2:')));
      return true;
    },
  );
});

test('rejects incomplete blind counterbalancing', async () => {
  const parsed = await loadFixture();
  const rows = parsed.rows.map((row) => ({ ...row }));
  rows.find((row) => row.session === 'blind' && row.game_number === '4').player_mark = 'X';
  rows.find((row) => row.session === 'blind' && row.game_number === '4').opener = 'player';

  assert.throws(
    () => validatePlaytestRows(parsed.headers, rows),
    (error) => {
      assert.ok(error instanceof PlaytestValidationError);
      assert.ok(error.errors.some((issue) => issue.includes('opponent A once as X and once as O')));
      return true;
    },
  );
});

test('rejects ragged CSV rows before values can shift columns', () => {
  assert.throws(
    () => parseCsv('first,second\nonly-one\n'),
    (error) => {
      assert.ok(error instanceof PlaytestValidationError);
      assert.deepEqual(error.errors, ['Line 2: expected 2 columns but found 1.']);
      return true;
    },
  );
});
