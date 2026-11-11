import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { canonicalBytes } from '../r2-vertical-v03-a/src/world.js';
import { createWorld, replay } from '../r2-vertical-v03-c/src/world.js';
import { hashBytes, runT12, WITNESS_VERSION } from './t12-witness.js';

const args = process.argv.slice(2);

function verifySteps(report) {
  const { journal } = report;
  const constructionLog = [];
  const decisionLog = [];
  let packetIndex = 0;
  let nextEventSeq = 1;
  let previous = report.initialStateSha256;
  for (const step of report.steps) {
    assert.equal(step.beforeSha256, previous, step.label);
    if (step.result.status === 'SEMANTICALLY_ADMITTED' && !step.result.idempotent) {
      const packet = journal.transactions[packetIndex++];
      assert.equal(packet[0].inputPrefixDigest, previous, step.label);
      assert.equal(packet[0].transactionId, step.result.transactionId, step.label);
      for (const event of packet) {
        (event.stream === 'ConstructionLog' ? constructionLog : decisionLog).push(event);
      }
      nextEventSeq += packet.length;
      // Replay has independently checked the next packet's pre-state digest.
      previous = journal.transactions[packetIndex]?.[0].inputPrefixDigest ?? report.finalStateSha256;
    }
    assert.equal(step.afterSha256, previous, step.label);
    assert.equal(step.nextEventSeq, nextEventSeq, step.label);
    if ('snapshot' in step) {
      const state = {
        initial: journal.initial, policyVersion: journal.policyVersion, constructionLog, decisionLog,
        nextEventSeq, snapshot: step.snapshot,
      };
      assert.equal(hashBytes(canonicalBytes(state)), previous, step.label);
    }
  }
  assert.equal(packetIndex, journal.transactions.length);
}

if (args.length === 2 && args[0] === '--verify') {
  const report = JSON.parse(readFileSync(args[1], 'utf8'));
  assert.equal(report.witnessVersion, WITNESS_VERSION);
  assert.equal(report.policyVersion, report.journal.policyVersion);
  assert.equal(hashBytes(canonicalBytes(report.journal)), report.journalSha256);
  assert.equal(hashBytes(createWorld(report.journal.initial).bytes()), report.initialStateSha256);
  const restored = replay(report.journal);
  assert.equal(hashBytes(restored.bytes()), report.finalStateSha256);
  verifySteps(report);
  console.log(`T12 replay and ${report.steps.length} steps verified: ${report.finalStateSha256}`);
} else if (args.length === 0 || (args.length === 1 && args[0] === '--snapshots')) {
  const { report } = runT12({ includeSnapshots: args[0] === '--snapshots' });
  process.stdout.write(canonicalBytes(report) + '\n');
} else {
  console.error('Usage: node t12-evidence.js [--snapshots | --verify <report.json>]');
  process.exitCode = 2;
}
