import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createWorld, replay } from '../r2-vertical-v03-c/src/world.js';
import { hashBytes, runT12 } from '../r2-vertical-v03-d/t12-witness.js';
import { compactScene } from './scene-model.mjs';

const BASE = '80478c802ffd3cf6c37fda2f1d3cd6c2cb956990';
const LATTICE = 4;
const milestones = [
  { label: 'seal-court', title: 'Seal courtyard' },
  { label: 'replace-support', title: 'Switch support' },
  { label: 'unseal-court', title: 'Reopen courtyard' },
  { label: 'remove-south-landing', title: 'Invalidate stair' },
  { label: 'approve-restored-south', title: 'Approve new stair' },
];

const { report, states } = runT12();
const { journal, steps, journalSha256, finalStateSha256, initialStateSha256, witnessVersion } = report;
assert.equal(steps.length, 49);
assert.equal(journal.transactions.length, 39);
assert.equal(journal.transactions.flat().length, 41);
assert.equal(hashBytes(replay(journal).bytes()), finalStateSha256);
const initial = createWorld(journal.initial);
assert.equal(hashBytes(initial.bytes()), initialStateSha256);
const knownCourts = new Map();
const scenes = [compactScene(initial.state.snapshot, knownCourts, LATTICE)];
const sceneByDigest = new Map([[initialStateSha256, 0]]);
const packets = new Map(journal.transactions.map(p => [p[0].transactionId, p]));
const frames = steps.map((step, index) => {
  const { label, afterSha256, beforeSha256, result } = step;
  if (!sceneByDigest.has(afterSha256)) {
    sceneByDigest.set(afterSha256, scenes.length);
    scenes.push(compactScene(states.get(label).snapshot, knownCourts, LATTICE));
  }
  const changed = beforeSha256 !== afterSha256;
  assert.equal(changed, result.status === 'SEMANTICALLY_ADMITTED' && !result.idempotent);
  const scene = sceneByDigest.get(afterSha256);
  if (!changed) assert.equal(scene, sceneByDigest.get(beforeSha256));
  const packet = packets.get(result.transactionId);
  return {
    step: index + 1, label, scene, digest: afterSha256, changed,
    status: result.status, code: result.code ?? null, idempotent: result.idempotent ?? false,
    action: packet?.[0].action ?? result.ghost ?? null,
    decision: packet?.find(e => e.decision)?.decision.type ?? packet?.find(e => e.choice)?.choice.roofClosure ?? null,
    eventSeq: changed ? packet.map(e => e.eventSeq) : [],
  };
});

assert.equal(scenes.length, 40);
assert.equal(frames.at(-1).digest, finalStateSha256);
const keys = new Map(frames.map(f => [f.label, f]));
assert.equal(keys.size, 49);
assert.equal(frames.filter(f => !f.changed).length, 10);
const at = label => scenes[keys.get(label).scene];
assert(at('seal-court').courts.some(c => c.roofClosure === 'COVERED_OPAQUE' && !c.skyConnected));
assert(at('unseal-court').courts.some(c => !c.roofClosure && c.skyConnected));
assert.equal(at('support-publication-failure').supports[0].orientation, 'NS');
assert.equal(at('replace-support').supports[0].orientation, 'EW');
assert.equal(at('replace-support').supports[0].unitId, at('support-publication-failure').supports[0].unitId);
assert(at('remove-south-landing').openings.some(o => o.status === 'INVALIDATED' && !o.abstractRouteAuthorized));
assert(at('approve-restored-south').openings.some(o => o.intentId === 'opening-intent:approve-restored-south' &&
  o.abstractRouteAuthorized && !o.physicalPassable));
assert(scenes.every(scene => scene.openings.every(o => !o.physicalPassable)));

const payload = {
  exporterVersion: 'ew-ux/r2-v3-visual/m0/1',
  source: {
    base: BASE, witnessVersion, policyVersion: report.policyVersion, initialStateSha256, journalSha256,
    finalStateSha256, transactions: journal.transactions.length, events: journal.transactions.flat().length,
  },
  grid: { width: journal.initial.width, depth: journal.initial.depth, levels: journal.initial.levels, lattice: LATTICE },
  milestones: milestones.map(m => ({ ...m, step: keys.get(m.label).step })),
  scenes, frames,
};
const bytes = JSON.stringify(payload) + '\n';
const file = new URL('./frames.json', import.meta.url);
if (process.argv.includes('--check')) {
  assert.equal(hashBytes(readFileSync(file, 'utf8')), hashBytes(bytes), 'frames.json differs; run npm run export');
} else {
  writeFileSync(file, bytes);
}
console.log(`49 T12 frames, 40 committed scenes, 39 transactions, 41 events | ${Buffer.byteLength(bytes)} bytes`);
console.log(`Payload SHA-256 ${hashBytes(bytes)} | final replay ${finalStateSha256}`);
