import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { canonicalBytes } from '../r2-vertical-v03-a/src/world.js';
import { replay } from '../r2-vertical-v03-c/src/world.js';
import { runT12, WITNESS_VERSION } from './t12-witness.js';

const args = process.argv.slice(2);

function verifyReport(report) {
  assert.equal(report.witnessVersion, WITNESS_VERSION);
  const { journal } = report;
  assert.equal(report.steps.length, 49, 'T12 step count');
  assert.equal(journal.transactions.length, 39, 'T12 transaction count');
  assert.equal(journal.transactions.flat().length, 41, 'T12 event count');

  const { report: expected, states, world } = runT12();
  for (const field of ['policyVersion', 'initialStateSha256', 'finalStateSha256', 'journalSha256']) {
    assert.equal(report[field], expected[field], field);
  }
  assert.ok(canonicalBytes(journal) === canonicalBytes(expected.journal), 'T12 journal differs from witness rerun');
  for (const [index, entry] of report.steps.entries()) {
    const { snapshot, ...step } = entry;
    const expectedStep = expected.steps[index];
    const label = `T12 step ${index + 1} (${expectedStep.label})`;
    assert.deepEqual(step, expectedStep, `${label} differs from witness rerun`);
    if (Object.hasOwn(entry, 'snapshot')) {
      assert.ok(canonicalBytes(snapshot) === canonicalBytes(states.get(expectedStep.label).snapshot),
        `${label} snapshot differs from witness rerun`);
    }
  }
  assert.ok(replay(journal).bytes() === world.bytes(), 'T12 replay differs from witness rerun');
}

if (args.length === 2 && args[0] === '--verify') {
  const report = JSON.parse(readFileSync(args[1], 'utf8'));
  verifyReport(report);
  console.log(`T12 replay and ${report.steps.length} steps verified: ${report.finalStateSha256}`);
} else if (args.length === 0 || (args.length === 1 && args[0] === '--snapshots')) {
  const { report } = runT12({ includeSnapshots: args[0] === '--snapshots' });
  process.stdout.write(canonicalBytes(report) + '\n');
} else {
  console.error('Usage: node t12-evidence.js [--snapshots | --verify <report.json>]');
  process.exitCode = 2;
}
