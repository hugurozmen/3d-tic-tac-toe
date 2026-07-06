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

const { runSelfPlaySuite } = require('../src/game/aiSelfPlay.ts');

const readNumberOption = (name, fallback) => {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  const value = Number(process.argv[index + 1]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const gamesPerScenario = readNumberOption('--games', 8);
const seed = readNumberOption('--seed', 9109);
const reports = runSelfPlaySuite({ gamesPerScenario, seed });
const format = (value) =>
  value === null ? 'n/a' : Number(value).toFixed(value >= 10 ? 1 : 2);

for (const report of reports) {
  const { metrics } = report;

  console.log(
    [
      report.label.padEnd(15),
      `score X ${format(metrics.averageFinalScore.X)}`,
      `O ${format(metrics.averageFinalScore.O)}`,
      `first ${format(metrics.firstPlayerAdvantage)}`,
      `center ${format(metrics.centerOpeningWinRate)}`,
      `diff ${format(metrics.averageLineDifferential)}`,
      `multi ${metrics.multiLineMoves}`,
      `time ${format(metrics.averageDecisionTimeMs)}ms`,
      `illegal ${metrics.illegalMoves}`,
    ].join(' | '),
  );
}
