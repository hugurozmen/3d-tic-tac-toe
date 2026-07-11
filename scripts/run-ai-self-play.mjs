import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });

  module._compile(outputText, filename);
};

const {
  DEFAULT_PAIRED_DIFFICULTY_MATCHUPS,
  FULL_BOARD_OPENING_PROBES,
  runPairedDifficultySuite,
  runSelfPlaySuite,
} = require('../src/game/aiSelfPlay.ts');

const readNumberOption = (name, fallback) => {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  const value = Number(process.argv[index + 1]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const gamesPerScenario = readNumberOption('--games', 8);
const fullOpeningSweep = process.argv.includes('--full-openings');
const pairsPerMatchup = fullOpeningSweep
  ? FULL_BOARD_OPENING_PROBES.length
  : readNumberOption('--pairs', 8);
const seed = readNumberOption('--seed', 9109);
const reports = runSelfPlaySuite({ gamesPerScenario, seed });
const matchupReports = runPairedDifficultySuite(
  { pairsPerMatchup, seed },
  fullOpeningSweep
    ? DEFAULT_PAIRED_DIFFICULTY_MATCHUPS.map((matchup) => ({
        ...matchup,
        forcedOpenings: FULL_BOARD_OPENING_PROBES,
      }))
    : DEFAULT_PAIRED_DIFFICULTY_MATCHUPS,
);
const format = (value) =>
  value === null ? 'n/a' : Number(value).toFixed(value >= 10 ? 1 : 2);
const percent = (value) =>
  value === null ? 'n/a' : `${(Number(value) * 100).toFixed(0)}%`;
const signed = (value) => `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}`;
const record = (metrics) =>
  `${metrics.wins}-${metrics.draws}-${metrics.losses}`;

console.log(
  `Scenario mirrors (${gamesPerScenario} games each; fixed center/non-center opening probes)`,
);

for (const report of reports) {
  const { metrics } = report;

  console.log(
    [
      report.label.padEnd(15),
      `score X ${format(metrics.averageFinalScore.X)}`,
      `O ${format(metrics.averageFinalScore.O)}`,
      `first ${format(metrics.firstPlayerAdvantage)}`,
      `open C ${percent(metrics.centerOpeningWinRate)}`,
      `NC ${percent(metrics.nonCenterOpeningWinRate)}`,
      `diff ${format(metrics.averageLineDifferential)}`,
      `multi ${metrics.multiLineMoves}`,
      `final6 outcome ${percent(metrics.finalSix.outcomeChangeRate)}`,
      `lead ${percent(metrics.finalSix.leadChangeRate)}`,
      `time ${format(metrics.averageDecisionTimeMs)}ms`,
      `illegal ${metrics.illegalMoves}`,
    ].join(' | '),
  );
}

console.log(
  `\nPaired adjacent-difficulty ladder (${pairsPerMatchup} seed/opening pairs; both X/O seatings${
    fullOpeningSweep ? '; all 27 opening cells' : ''
  })`,
);

for (const report of matchupReports) {
  const { combined, finalSix, openingOutcomes, seatings } = report;

  console.log(
    [
      report.label.padEnd(22),
      `higher as X ${signed(seatings.higherAsX.averageLineDifferential)} (${record(
        seatings.higherAsX,
      )})`,
      `as O ${signed(seatings.higherAsO.averageLineDifferential)} (${record(
        seatings.higherAsO,
      )})`,
      `paired ${signed(report.pairedAverageLineDifferential)}`,
      `score ${percent(combined.scoreRate)}`,
      `open C ${percent(openingOutcomes.center.scoreRate)}`,
      `NC ${percent(openingOutcomes.nonCenter.scoreRate)}`,
      `final6 outcome ${percent(finalSix.outcomeChangeRate)}`,
      `lead ${percent(finalSix.leadChangeRate)}`,
      `illegal ${report.illegalMoves}`,
      report.strengthExpectationMet ? 'PASS' : 'FAIL',
    ].join(' | '),
  );
}
