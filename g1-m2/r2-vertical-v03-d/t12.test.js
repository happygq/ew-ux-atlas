import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { canonicalBytes } from '../r2-vertical-v03-a/src/world.js';
import { openingPolicy } from '../r2-vertical-v03-c/src/opening-intents.js';
import { replay } from '../r2-vertical-v03-c/src/world.js';
import { hashBytes, runT12 } from './t12-witness.js';

const witness = runT12();
const snapshot = label => witness.states.get(label).snapshot;
const intent = (label, id) => snapshot(label).openingIntents.find(i => i.intentId === id);
const mixed = label => snapshot(label).support.nodes.find(n => n.role === 'MIXED_ROOM');
const selected = node => node.alternatives.find(a => a.id === node.selectedAlternativeId);

function assertVerifierRejects(report, reason) {
  const directory = mkdtempSync(join(tmpdir(), 'ew-ux-t12-verify-'));
  const path = join(directory, 'report.json');
  writeFileSync(path, canonicalBytes(report), 'utf8');
  try {
    const cli = fileURLToPath(new URL('./t12-evidence.js', import.meta.url));
    const result = spawnSync(process.execPath, [cli, '--verify', path], { encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, reason);
  } finally {
    unlinkSync(path);
    rmdirSync(directory);
  }
}

test('E-D1: verifier rejects a committed-only report with the ten nonpublishing steps deleted', () => {
  const { report } = witness;
  const steps = report.steps.filter(step =>
    step.result.status === 'SEMANTICALLY_ADMITTED' && !step.result.idempotent);
  assert.equal(steps.length, 39);
  assertVerifierRejects({ ...report, steps }, /T12 step count/);
});

test('E-D1: verifier rejects a changed rejection code with the original journal and hashes', () => {
  const report = structuredClone(witness.report);
  const step = report.steps.find(s => s.label === 'reject-last-column');
  assert.equal(step.result.code, 'REJECT_SUPPORT_UNRESOLVED');
  step.result.code = 'EVENT_ID_CONFLICT';
  assertVerifierRejects(report, /T12 step \d+ \(reject-last-column\) differs from witness rerun/);
});

function buildingFacts(s, buildingId, intentId) {
  const occupancy = s.occupancy.filter(c => c.buildingId === buildingId);
  const unitIds = new Set(occupancy.map(c => c.unitId));
  const cells = new Set(occupancy.map(c => `${c.level}:${c.x},${c.z}`));
  const fragments = s.volumeFragments.filter(f => unitIds.has(f.unitId));
  const volumes = new Set(fragments.map(f => f.id));
  const touches = ids => ids.some(id => volumes.has(id));
  const nodes = s.support.nodes.filter(n => unitIds.has(n.unitId));
  const roots = new Set(nodes.flatMap(n => selected(n).foundationPaths.map(p => p.at(-1))));
  return {
    occupancy, fragments,
    constructionEdges: s.constructionEdges.filter(e => e.cells.every(k => cells.has(k))),
    patches: s.boundaryPatches.filter(p => touches(p.sides)),
    spaceRegions: s.spaceRegions.filter(r => touches(r.members)),
    voidRegions: s.voidRegions.filter(r => touches(r.members)),
    support: [...nodes, ...s.support.nodes.filter(n => roots.has(n.id))],
    contacts: s.support.verticalContacts.filter(c => unitIds.has(c.lowerUnitId) && unitIds.has(c.upperUnitId)),
    intent: s.openingIntents.find(i => i.intentId === intentId),
    passages: s.passages.filter(p => p.intentId === intentId),
  };
}

test('T12: a single public history preserves unrelated building, region, boundary, support and stair facts', () => {
  const { east, south, replacement } = witness;
  const unchanged = buildingFacts(snapshot('approve-east'), 'east', east.intentId);
  assert.equal(unchanged.occupancy.length, 8);
  assert.equal(unchanged.passages.length, 1);
  const start = witness.report.steps.findIndex(s => s.label === 'approve-east');
  for (const step of witness.report.steps.slice(start)) {
    assert.deepEqual(buildingFacts(snapshot(step.label), 'east', east.intentId), unchanged, step.label);
  }
  const before = snapshot('seal-court');
  const after = snapshot('recolor-south-landing');
  const landing = s => s.occupancy.find(c => c.x === 5 && c.z === 4 && c.level === 1);
  assert.equal(landing(before).unitId, landing(after).unitId);
  assert.equal(landing(after).color, 'MIST');
  assert.deepEqual(after.constructionEdges, before.constructionEdges);
  assert.deepEqual(after.openingIntents, before.openingIntents);

  const retired = intent('remove-south-landing', south.intentId);
  assert.equal(retired.status, 'INVALIDATED');
  assert.equal(retired.derivedCause.constructionEventId, 'construction:remove-south-landing');
  assert.equal(retired.derivedCause.transactionId, 'tx:remove-south-landing');
  assert.equal(retired.abstractRouteAuthorized, false);
  const { world } = witness;
  const removePacket = world.journal().transactions.find(p => p[0].requestId === 'remove-south-landing');
  assert.equal(removePacket.length, 1);
  assert.equal(removePacket[0].stream, 'ConstructionLog');
  assert.deepEqual(intent('approve-restored-south', south.intentId), retired);
  assert.deepEqual(world.state.decisionLog.find(e => e.requestId === 'approve-south').proposal, south.offered);
  const oldBinding = south.offered.binding;
  const newBinding = replacement.offered.binding;
  assert.notEqual(replacement.intentId, south.intentId);
  assert.notEqual(newBinding.hostPatchId, oldBinding.hostPatchId);
  assert.notEqual(newBinding.endpoints[1].unitId, oldBinding.endpoints[1].unitId);
  assert.notEqual(newBinding.endpoints[1].spaceRegionId, oldBinding.endpoints[1].spaceRegionId);
  assert.equal(newBinding.endpoints[0].spaceRegionId, oldBinding.endpoints[0].spaceRegionId);
  assert(!world.state.snapshot.boundaryPatches.some(p => p.id === oldBinding.hostPatchId));
  assert(world.state.snapshot.passages.every(p => p.abstractRouteAuthorized && !p.physicalPassable));
});

test('T12: court split, merge and re-split preserve the anchored region without reviving retired IDs', () => {
  const region = s => {
    const fragments = s.volumeFragments.filter(f => f.gridKey === '0:2,2');
    return s.voidRegions.find(r => fragments.every(f => r.members.includes(f.id)));
  };
  const stages = ['seal-court-pending', 'seal-court', 'unseal-court', 'reseal-court-pending', 'reseal-court'];
  const [outside, split, merged, pending, resplit] = stages.map(label => region(snapshot(label)));
  assert(outside.airConnectedSky);
  assert.equal(split.airConnectedSky, false);
  assert.equal(split.splitFrom, outside.id);
  assert.deepEqual(snapshot('unseal-court').interfaceChanges.retiredRegions.find(r => r.id === split.id),
    { id: split.id, mergedInto: outside.id });
  assert.equal(merged.id, outside.id);
  assert.deepEqual(pending, merged);
  assert.notEqual(resplit.id, split.id);
  assert.equal(resplit.splitFrom, outside.id);
  assert.equal(resplit.airConnectedSky, false);
  assert.equal(snapshot('reseal-court').spaceIntents.length, 1);
  assert.notEqual(snapshot('reseal-court').spaceIntents[0].decisionId,
    snapshot('seal-court').spaceIntents[0].decisionId);
  const decisions = witness.world.state.decisionLog.filter(e => e.choice?.spaceIntent === 'DOUBLE_HEIGHT');
  assert.equal(decisions.length, 2);
  for (const id of ['seal-court', 'reseal-court']) {
    const [edit, decision] = witness.report.journal.transactions.find(p => p[0].requestId === id);
    assert.equal(decision.transactionId, edit.transactionId);
    assert.equal(decision.eventSeq, edit.eventSeq + 1);
    assert(decision.proposalId);
  }
});

test('T12: legal OR replacement commits once, while invalid edits, publication failure and retries preserve bytes', () => {
  const before = mixed('recolor-south-landing');
  const after = mixed('replace-support');
  assert.equal(mixed('east-column').alternatives.length, 2);
  assert.equal(selected(before).orientation, 'NS');
  assert.equal(selected(after).orientation, 'EW');
  assert.equal(after.id, before.id);
  assert.equal(witness.attemptedReplacement.before.alternativeId, before.selectedAlternativeId);
  assert.equal(witness.attemptedReplacement.after.alternativeId, after.selectedAlternativeId);
  assert.deepEqual(snapshot('replace-support').support.selectionChanges, [witness.attemptedReplacement]);
  assert.deepEqual(snapshot('replace-support').passages, snapshot('recolor-south-landing').passages);
  const noPublication = witness.report.steps.filter(s => s.result.status !== 'SEMANTICALLY_ADMITTED' || s.result.idempotent);
  assert.equal(noPublication.length, 10);
  assert(noPublication.every(s => s.beforeSha256 === s.afterSha256));
  const approvals = witness.report.journal.transactions.filter(p => p[0].requestId === 'approve-south');
  assert.equal(approvals.length, 1);
});

test('T12: one versioned journal replays byte for byte and rejects reordered, conflicting, stale or partial packets', t => {
  const { world, report } = witness;
  const bytes = canonicalBytes(report.journal);
  const events = report.journal.transactions.flat();
  assert.deepEqual(events.map(e => e.eventSeq), events.map((_, i) => i + 1));
  assert(events.some(e => e.stream === 'ConstructionLog') && events.some(e => e.stream === 'DecisionLog'));
  const duplicate = JSON.parse(bytes);
  duplicate.transactions.push(duplicate.transactions.find(p => p[0].requestId === 'approve-south'));
  assert.equal(replay(duplicate).bytes(), world.bytes());
  const changed = JSON.parse(bytes);
  const approval = changed.transactions.find(p => p[0].requestId === 'approve-south')[0];
  changed.transactions.push([{ ...approval, decision: { ...approval.decision, type: 'DECLINE' } }]);
  assert.throws(() => replay(changed), /EVENT_ID_CONFLICT/);
  const stale = JSON.parse(bytes);
  stale.transactions.find(p => p[0].requestId === 'approve-south')[0].decision.inputPrefixDigest = 'old';
  assert.throws(() => replay(stale), /STALE_PREFIX/);
  const reordered = JSON.parse(bytes);
  const packets = reordered.transactions;
  [packets[0], packets[1]] = [packets[1], packets[0]];
  assert.throws(() => replay(reordered), /TRANSACTION_MISMATCH/);
  const partial = JSON.parse(bytes);
  partial.transactions.find(p => p[0].requestId === 'seal-court').pop();
  assert.throws(() => replay(partial), /INCOMPLETE_TRANSACTION/);
  assert.equal(replay(JSON.parse(bytes)).bytes(), world.bytes());
  assert.equal(hashBytes(world.bytes()), report.finalStateSha256);
  t.diagnostic(`T12 journal SHA-256 ${report.journalSha256}, final state SHA-256 ${report.finalStateSha256}`);
});

test('D1 model-level fixture: stable passage binding uses current eligible support without rewriting approval evidence', () => {
  const s = snapshot('approve-east');
  const { intentId, offered } = witness.east;
  const unitId = offered.binding.endpoints[0].unitId;
  const cause = { constructionEventId: 'model-fixture', transactionId: 'model-fixture',
    policyVersion: witness.report.policyVersion };
  // Only the support-to-opening interface is varied here. No public construction
  // sequence in the existing policy is asserted for these substituted facts.
  function withSelection(id, semanticCommitEligible) {
    const nodes = s.support.nodes.map(node => node.id === unitId ? {
      ...node, selectedAlternativeId: id,
      alternatives: [...node.alternatives, { ...selected(node), id, semanticCommitEligible }],
    } : node);
    return { ...s, support: { ...s.support, nodes }, interfaceChanges: { cause } };
  }
  const before = offered.support.find(e => e.unitId === unitId).alternativeId;
  const nextId = 'model-fixture:other-eligible-alternative';
  const eligible = withSelection(nextId, true);
  const currentOffer = openingPolicy.proposals({ ...eligible, openingIntents: [] }, 'model-prefix')
    .find(p => p.binding.hostPatchId === offered.binding.hostPatchId);
  assert.deepEqual(currentOffer.binding, offered.binding);
  assert.equal(currentOffer.support.find(e => e.unitId === unitId).alternativeId, nextId);
  const retained = openingPolicy.afterConstruction(s, eligible);
  assert.deepEqual(retained, { openingIntents: s.openingIntents, passages: s.passages });
  const original = retained.openingIntents.find(i => i.intentId === intentId);
  assert.equal(original.proposal.support.find(e => e.unitId === unitId).alternativeId, before);
  const lost = openingPolicy.afterConstruction(s, withSelection(nextId, false));
  assert.equal(lost.openingIntents[0].status, 'SUSPENDED');
  assert.equal(lost.openingIntents[0].derivedCause.reason, 'ROUTE_PRECONDITION_LOST');
  assert.deepEqual(lost.passages, []);
});
