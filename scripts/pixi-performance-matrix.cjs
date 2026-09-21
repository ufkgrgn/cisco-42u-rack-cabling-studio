const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const testsDir = path.join(root, 'tests');
const scenarios = [
  { name: 'active-rack-200', visibleAll: false, report: 'performance-results-200.json' },
  { name: 'multi-rack-2000', visibleAll: true, report: 'performance-results-2000.json' }
];

const results = [];
for (const scenario of scenarios) {
  const env = {
    ...process.env,
    BENCH_REPORT_FILE: scenario.report,
    BENCH_VISIBLE_ALL: scenario.visibleAll ? '1' : '0'
  };
  const run = spawnSync(process.execPath, [path.join(testsDir, 'performance.test.cjs')], {
    cwd: root,
    env,
    stdio: 'inherit'
  });
  if (run.status !== 0) process.exit(run.status || 1);
  results.push({ scenario: scenario.name, ...JSON.parse(fs.readFileSync(path.join(testsDir, scenario.report), 'utf8')) });
}

const matrix = {
  timestamp: new Date().toISOString(),
  scenarios: results
};
fs.writeFileSync(path.join(testsDir, 'performance-matrix-results.json'), `${JSON.stringify(matrix, null, 2)}\n`);
console.log(JSON.stringify(matrix, null, 2));
