import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createWorld, replay } from '../r2-vertical-v03-c/src/world.js';
import { hashBytes, runT12 } from '../r2-vertical-v03-d/t12-witness.js';

const BASE = '80478c802ffd3cf6c37fda2f1d3cd6c2cb956990';
const LATTICE = 4;
const milestones = [
  { label: 'seal-court', title: 'Seal courtyard' },
  { label: 'replace-support', title: 'Switch support' },
  { label: 'unseal-court', title: 'Reopen courtyard' },
  { label: 'remove-south-landing', title: 'Invalidate stair' },
  { label: 'approve-restored-south', title: 'Approve new stair' },
];

function compactScene(snapshot, knownCourts) {
  const volume = new Map(snapshot.volumeFragments.map(f => [f.id, f]));
  const currentCourts = new Map(snapshot.spaceIntents.map(intent => [intent.scopeId, intent]));
  for (const scope of currentCourts.values()) knownCourts.set(scope.scopeId, scope);
  return {
    units: snapshot.occupancy.map(({ unitId, x, z, level, buildingId, supportRole, color }) =>
      ({ unitId, x, z, level, buildingId, supportRole, color })),
    courts: [...knownCourts.values()].map(({ scopeId, footprint, bottomLevel, topLevel }) => {
      const intent = currentCourts.get(scopeId);
      const plane = topLevel + 1;
      const roof = snapshot.boundaryPatches.filter(({ bounds: b }) => b.axis === 'y' && b.plane === plane &&
        footprint.some(({ x, z }) => b.u0 >= x * LATTICE && b.u1 <= (x + 1) * LATTICE &&
          b.v0 >= z * LATTICE && b.v1 <= (z + 1) * LATTICE));
      const air = snapshot.volumeFragments.filter(f =>
        f.kind.endsWith('_AIR') && footprint.some(({ x, z }) => f.gridKey === `${bottomLevel}:${x},${z}`));
      const region = snapshot.voidRegions.find(r => air.length && r.members.includes(air[0].id));
      return {
        scopeId, footprint, bottomLevel, topLevel, decisionId: intent?.decisionId ?? null,
        spaceIntent: intent?.spaceIntent ?? null, roofClosure: intent?.roofClosure ?? null,
        voidRegionId: region?.id ?? null, skyConnected: region?.airConnectedSky ?? false,
        tiles: roof.map(({ id, bounds, kind, airOpen }) => ({ id, bounds, kind, airOpen })),
      };
    }),
    supports: snapshot.support.nodes.filter(node => node.role === 'MIXED_ROOM').map(node => {
      const alternative = node.alternatives.find(a => a.id === node.selectedAlternativeId);
      return {
        unitId: node.unitId, alternativeId: alternative.id, orientation: alternative.orientation,
        patternId: alternative.patternId, sources: alternative.requiredSources,
      };
    }),
    supportChanges: snapshot.support.selectionChanges,
    openings: snapshot.openingIntents.map(intent => {
      const { kind, hostPatchId, endpoints } = intent.proposal.binding;
      return {
        intentId: intent.intentId, kind, hostPatchId, status: intent.status,
        abstractRouteAuthorized: intent.abstractRouteAuthorized, physicalPassable: intent.physicalPassable,
        endpoints: endpoints.map(endpoint => ({ ...endpoint, bounds: volume.get(endpoint.volumeId)?.bounds ?? null })),
      };
    }),
    passageIds: snapshot.passages.map(p => p.intentId),
  };
}

const { report, states } = runT12();
const { journal, steps, journalSha256, finalStateSha256, initialStateSha256, witnessVersion } = report;
assert.equal(steps.length, 49);
assert.equal(journal.transactions.length, 39);
assert.equal(journal.transactions.flat().length, 41);
assert.equal(hashBytes(replay(journal).bytes()), finalStateSha256);
const initial = createWorld(journal.initial);
assert.equal(hashBytes(initial.bytes()), initialStateSha256);
const knownCourts = new Map();
const scenes = [compactScene(initial.state.snapshot, knownCourts)];
const sceneByDigest = new Map([[initialStateSha256, 0]]);
const packets = new Map(journal.transactions.map(p => [p[0].transactionId, p]));
const frames = steps.map((step, index) => {
  const { label, afterSha256, beforeSha256, result } = step;
  if (!sceneByDigest.has(afterSha256)) {
    sceneByDigest.set(afterSha256, scenes.length);
    scenes.push(compactScene(states.get(label).snapshot, knownCourts));
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
