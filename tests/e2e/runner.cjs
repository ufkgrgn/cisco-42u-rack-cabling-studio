// Unified E2E Test Suite Runner for Digital Rack Cabin Studio
// Executes all tiers (Tier 1, Tier 2, Tier 3, Tier 4) via node:test, aggregates results,
// outputs a formatted summary table, and exits with code 0 on success.
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const TIERS = [
  {
    id: 'tier1',
    name: 'Tier 1 — Feature Coverage',
    description: 'Features F1.1 - F5.4 (Nominal Primary Behaviors)',
    file: 'tier1-feature-coverage.test.cjs',
    expectedMinTests: 120
  },
  {
    id: 'tier2',
    name: 'Tier 2 — Boundary & Corner Cases',
    description: 'Boundary limits, stress, and corner conditions',
    file: 'tier2-boundary-corner.test.cjs',
    expectedMinTests: 120
  },
  {
    id: 'tier3',
    name: 'Tier 3 — Cross-Feature Combinations',
    description: 'Pairwise multi-module subsystem workflows',
    file: 'tier3-cross-feature.test.cjs',
    expectedMinTests: 24
  },
  {
    id: 'tier4',
    name: 'Tier 4 — Real-World Application Scenarios',
    description: 'Realistic enterprise data center topologies',
    file: 'tier4-real-world.test.cjs',
    expectedMinTests: 12
  }
];

function runTier(tierConfig) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const filePath = path.resolve(__dirname, tierConfig.file);
    const nodeExecutable = process.execPath;

    console.log(`\n▶ Running ${tierConfig.name} (${tierConfig.file})...`);

    const child = spawn(nodeExecutable, ['--test', filePath], {
      cwd: path.resolve(__dirname, '../..'),
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - startTime;

      // Extract test statistics
      const testsMatch = stdout.match(/ℹ tests\s+(\d+)/);
      const passMatch = stdout.match(/ℹ pass\s+(\d+)/);
      const failMatch = stdout.match(/ℹ fail\s+(\d+)/);
      const durationMatch = stdout.match(/ℹ duration_ms\s+([\d.]+)/);

      const tests = testsMatch ? parseInt(testsMatch[1], 10) : 0;
      const pass = passMatch ? parseInt(passMatch[1], 10) : 0;
      const fail = failMatch ? parseInt(failMatch[1], 10) : (code === 0 ? 0 : 1);
      const execDuration = durationMatch ? parseFloat(durationMatch[1]) : durationMs;

      resolve({
        id: tierConfig.id,
        name: tierConfig.name,
        description: tierConfig.description,
        file: tierConfig.file,
        exitCode: code,
        tests,
        pass,
        fail,
        durationMs: execDuration,
        stdout,
        stderr
      });
    });
  });
}

function renderSummaryTable(results) {
  const line = '─'.repeat(96);
  const doubleLine = '═'.repeat(96);

  console.log('\n' + doubleLine);
  console.log('           DIGITAL RACK CABIN STUDIO — END-TO-END (E2E) TEST SUITE RESULTS');
  console.log(doubleLine);
  console.log(` Runtime: Node.js ${process.version} | Platform: ${process.platform} | Engine: PixiJS v8 / WebGL2`);
  console.log(` Specification: TEST_INFRA.md & PROJECT.md | Total Tiers: ${results.length}`);
  console.log(line);
  console.log(
    ' Tier'.padEnd(10) +
    ' Name'.padEnd(38) +
    ' Tests'.padStart(8) +
    ' Pass'.padStart(8) +
    ' Fail'.padStart(8) +
    ' Duration'.padStart(12) +
    '   Status'
  );
  console.log(line);

  let totalTests = 0;
  let totalPass = 0;
  let totalFail = 0;
  let totalDuration = 0;
  let allPassed = true;

  for (const r of results) {
    totalTests += r.tests;
    totalPass += r.pass;
    totalFail += r.fail;
    totalDuration += r.durationMs;

    const status = (r.exitCode === 0 && r.fail === 0) ? '✔ PASS' : '✖ FAIL';
    if (r.exitCode !== 0 || r.fail > 0) allPassed = false;

    const durationStr = (r.durationMs / 1000).toFixed(2) + 's';
    const tierNum = r.name.split('—')[0].trim();
    const tierTitle = r.name.split('—')[1]?.trim() || r.name;

    console.log(
      ` ${tierNum.padEnd(8)} ` +
      `${tierTitle.padEnd(36)} ` +
      `${String(r.tests).padStart(6)} ` +
      `${String(r.pass).padStart(7)} ` +
      `${String(r.fail).padStart(7)} ` +
      `${durationStr.padStart(11)}   ` +
      `${status}`
    );
  }

  console.log(line);
  const totalDurationStr = (totalDuration / 1000).toFixed(2) + 's';
  console.log(
    ` ${'TOTAL'.padEnd(46)} ` +
    `${String(totalTests).padStart(6)} ` +
    `${String(totalPass).padStart(7)} ` +
    `${String(totalFail).padStart(7)} ` +
    `${totalDurationStr.padStart(11)}   ` +
    `${allPassed ? '✔ ALL PASS' : '✖ FAILURE'}`
  );
  console.log(doubleLine);

  const passRate = totalTests > 0 ? ((totalPass / totalTests) * 100).toFixed(1) : '0';
  console.log(` Overall Result: ${passRate}% PASS (${totalPass}/${totalTests} tests passed, ${totalFail} failed)`);
  console.log(` Exit Code: ${allPassed ? 0 : 1} (${allPassed ? 'SUCCESS' : 'FAILURE'})`);
  console.log(doubleLine + '\n');

  return allPassed;
}

async function main() {
  const args = process.argv.slice(2);
  let selectedTiers = TIERS;

  // Filter by CLI argument if provided (e.g. --tier=1, --tier 3)
  const tierArgIndex = args.findIndex(a => a === '--tier' || a.startsWith('--tier='));
  if (tierArgIndex !== -1) {
    const rawVal = args[tierArgIndex].includes('=')
      ? args[tierArgIndex].split('=')[1]
      : args[tierArgIndex + 1];
    const tierNum = rawVal ? rawVal.replace('tier', '') : null;
    if (tierNum) {
      selectedTiers = TIERS.filter(t => t.id === `tier${tierNum}`);
    }
  }

  const results = [];
  for (const tier of selectedTiers) {
    const result = await runTier(tier);
    results.push(result);
  }

  const allPassed = renderSummaryTable(results);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error in test runner:', err);
  process.exit(1);
});
