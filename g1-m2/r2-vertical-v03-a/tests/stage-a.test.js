import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { canonicalBytes, createWorld, normalizedConstructionBytes, OUTSIDE_WORLD, POLICY_VERSION,
  probeSlabOpening, replay, SKY_EXTERIOR } from '../src/world.js';

const CONFIG = { width: 6, depth: 5, levels: 3, operatorId: 'witness-owner' };
const ADD = (x, z, level = 0, color = 'PAPER') => ({ type: 'Add', x, z, level, color });
const REMOVE = (x, z, level = 0) => ({ type: 'Remove', x, z, level });
const admit = (w, id, op) => assert.equal(w.submit(id, op).status, 'SEMANTICALLY_ADMITTED');
const PENDING = 'PENDING_CHOICE';
const COVERED = ['DOUBLE_HEIGHT', 'COVERED_OPAQUE'];
const OPEN = ['OPEN_COURT', 'OPEN_TO_SKY'];
const TRANSLUCENT = ['DOUBLE_HEIGHT', 'COVERED_TRANSLUCENT'];
const PARTIAL = ['OPEN_COURT', 'PARTIAL_COVER'];
const SEPARATE = ['SEPARATE_FLOORS', 'COVERED_OPAQUE'];
const approval = (proposal, [spaceIntent, roofClosure]) => ({
  authorizer: 'witness-owner',
  choices: proposal.scopes.map(({ scopeId }) => ({ scopeId, spaceIntent, roofClosure })),
});
const prefix = (hooks = {}, blockCourt = false) => {
  const w = createWorld(CONFIG, hooks);
  const wall = [[1, 2], [4, 2], [2, 1], [3, 1], [2, 3], [3, 3]];
  wall.forEach(([x, z], i) => admit(w, `wall0-${i}`, ADD(x, z)));
  if (blockCourt) admit(w, 'fill-lower-void', ADD(2, 2));
  wall.slice(0, blockCourt ? wall.length : -1).forEach(([x, z], i) => admit(w, `wall1-${i}`, ADD(x, z, 1)));
  return w;
};
const closure = ADD(3, 3, 1);
const court = snapshot => snapshot.volumeFragments.filter(f => /^[01]:[23],2$/.test(f.gridKey));
const coreRoof = snapshot => snapshot.boundaryPatches.filter(p => p.bounds.axis === 'y' &&
  p.bounds.plane === 2 && p.bounds.u0 >= 8 && p.bounds.u1 <= 16 && p.bounds.v0 >= 8 && p.bounds.v1 <= 12);
const project = (choice, id = 'close') => {
  const w = prefix();
  const draft = w.submit(id, closure);
  assert.equal(draft.status, PENDING);
  assert.equal(w.approve(draft.proposalId, approval(draft, choice)).status, 'SEMANTICALLY_ADMITTED');
  return w;
};
const sha = data => createHash('sha256').update(data, 'utf8').digest('hex');

test('T03/T06 + F1-02: same semantic construction bytes, two admitted choices, third stays staged', t => {
  const covered = project(COVERED, 'cover-request');
  const open = project(OPEN, 'open-request');
  const staged = prefix();
  const before = staged.bytes();
  const draft = staged.submit('without-choice', closure);
  assert.equal(draft.status, PENDING);
  assert.equal(staged.bytes(), before);
  assert.equal(staged.state.constructionLog.length, covered.state.constructionLog.length - 1);
  assert.equal(staged.state.decisionLog.length, 0);
  assert.equal(staged.state.snapshot.occupancy.some(c => c.x === 3 && c.z === 3 && c.level === 1), false);
  assert.equal(draft.scopes.length, 1);
  assert.equal('unitId' in draft.ghost, false);
  assert.equal('snapshot' in draft, false);

  const normalized = normalizedConstructionBytes(covered.state.constructionLog);
  assert.equal(normalized, normalizedConstructionBytes(open.state.constructionLog));
  // Deliberately use independent request IDs; raw envelopes are not compared for equality.
  assert.notDeepEqual(covered.state.constructionLog.at(-1), open.state.constructionLog.at(-1));
  assert.notDeepEqual(covered.state.decisionLog, open.state.decisionLog);
  assert.deepEqual(covered.state.snapshot.occupancy, open.state.snapshot.occupancy);
  assert.deepEqual(covered.state.snapshot.spaceIntents.map(s => s.spaceIntent), ['DOUBLE_HEIGHT']);
  assert.deepEqual(open.state.snapshot.spaceIntents.map(s => s.spaceIntent), ['OPEN_COURT']);
  const enclosed = court(covered.state.snapshot);
  assert.equal(enclosed.length, 16);
  assert(enclosed.every(f => f.kind === 'INTERIOR_AIR' && !f.airConnectedSky && !f.directSky));
  assert(court(open.state.snapshot).every(f => f.kind === 'EXTERIOR_AIR' && f.airConnectedSky && f.directSky));
  const indoor = covered.state.snapshot.spaceRegions.find(r => r.scopeId === draft.scopes[0].scopeId);
  assert.deepEqual(indoor.members, enclosed.map(f => f.id));
  assert.equal(open.state.snapshot.spaceRegions.some(r => r.scopeId === draft.scopes[0].scopeId), false);
  for (const w of [covered, open]) {
    const packet = w.journal().transactions.at(-1);
    assert.deepEqual(packet.map(e => e.stream), ['ConstructionLog', 'DecisionLog']);
    assert.deepEqual(packet.map(e => e.eventSeq), [12, 13]);
    assert.equal(packet[0].transactionId, packet[1].transactionId);
    assert.equal(packet[0].inputPrefixDigest, packet[1].inputPrefixDigest);
    assert.equal(packet[1].policyVersion, POLICY_VERSION);
    assert.equal(packet[1].authorizer, 'witness-owner');
    const serialized = canonicalBytes(w.journal());
    assert.equal(replay(JSON.parse(serialized)).bytes(), w.bytes());
    assert.equal(replay(JSON.parse(serialized)).bytes(), w.bytes());
    t.diagnostic(`${packet[1].choice.roofClosure}: journal SHA-256 ${sha(serialized)}, state SHA-256 ${sha(w.bytes())}`);
  }
  t.diagnostic(`normalized construction SHA-256 ${sha(normalized)}; no-choice canonical bytes unchanged`);
});

test('T04/T06: bounded roof aperture, adjacent air, closed slab, and translucent daylight are independent', () => {
  const baseline = prefix();
  const roofBefore = coreRoof(baseline.state.snapshot);
  const draft = baseline.submit('partial', closure);
  baseline.approve(draft.proposalId, approval(draft, PARTIAL));
  const partial = baseline.state.snapshot;
  const patches = coreRoof(partial);
  const open = patches.filter(p => p.airOpen);
  assert.equal(patches.length, 8);
  assert.equal(open.length, 1);
  assert.equal(open[0].kind, 'OPEN_INTERFACE');
  assert.equal(open[0].id, roofBefore.find(p => p.faceKey === open[0].faceKey).id);
  assert(patches.filter(p => !p.airOpen).every(p => p.kind === 'ROOF'));
  const voids = court(partial);
  assert.equal(voids.filter(f => f.directSky).length, 2);
  assert(voids.every(f => f.airConnectedSky));
  assert(partial.voidRegions.some(r => r.directSky === 'SOME' && voids.every(f => r.members.includes(f.id))));
  assert.deepEqual(partial.passages, []);
  assert(patches.every(p => !p.physicalPassable));

  const glass = project(TRANSLUCENT).state.snapshot;
  assert(coreRoof(glass).every(p => p.kind === 'ROOF' && !p.airOpen && p.daylightProxy === 'POTENTIAL'));
  assert(court(glass).every(f => !f.directSky && !f.airConnectedSky && f.daylightProxy === 'POTENTIAL'));
  // There is air, and no occupied voxel, immediately above the sealed roof.
  assert(glass.volumeFragments.filter(f => /^2:[23],2$/.test(f.gridKey))
    .every(f => f.kind === 'EXTERIOR_AIR' && f.directSky && !f.unitId));
  const sealedTop = project(COVERED).state.snapshot;
  assert(court(sealedTop).every(f => f.daylightProxy === 'NONE' && !f.directSky));
  const separated = project(SEPARATE).state.snapshot;
  const ids = new Set(court(separated).map(f => f.id));
  const slab = separated.boundaryPatches.filter(p => p.sides.every(id => ids.has(id)) &&
    p.bounds.axis === 'y' && p.bounds.plane === 1);
  assert.equal(slab.length, 8);
  assert(slab.every(p => p.kind === 'SLAB' && !p.airOpen));
  assert.equal(separated.spaceRegions.filter(r => r.scopeId).length, 2);
  assert.equal(separated.voidRegions.filter(r => r.members.some(id => ids.has(id))).length, 2);
});

test('F1-01: staged wall cannot support a later Add, and a bridge candidate cannot replace it', () => {
  const w = prefix();
  const before = w.bytes();
  const draft = w.submit('draft', closure);
  assert.equal(draft.status, PENDING);
  assert.deepEqual(w.submit('dependent', ADD(3, 3, 2)),
    { status: 'REJECTED', code: 'REJECT_SUPPORT_UNRESOLVED' });
  assert.equal(w.bytes(), before);
  assert.equal(w.approve(draft.proposalId, approval(draft, COVERED)).status, 'SEMANTICALLY_ADMITTED');
  admit(w, 'dependent', ADD(3, 3, 2));
  // Use an independent prefix to verify a Stage2-shaped lateral-only negative.
  const bridge = createWorld();
  admit(bridge, 'left', ADD(0, 1));
  admit(bridge, 'right', ADD(2, 1));
  const bridgeBefore = bridge.bytes();
  assert.equal(bridge.submit('span', ADD(1, 1, 1)).code, 'REJECT_SUPPORT_UNRESOLVED');
  assert.equal(bridge.bytes(), bridgeBefore);
  const source = w.state.snapshot.occupancy.find(c => c.x === 3 && c.z === 3 && c.level === 1);
  assert.equal(w.state.snapshot.support.at(-1).sourceId, source.unitId);
  assert(w.state.snapshot.support.every(s => s.verifiedGeometry === false));
});

test('F1-03: other edits stale the exact prefix, cancellation is staging only, resubmit is explicit', () => {
  const w = prefix();
  const before = w.bytes();
  const cancelled = w.submit('cancel-first', closure);
  assert.equal(w.cancel(cancelled.proposalId).status, 'CANCELLED');
  assert.equal(w.submit('cancel-first', closure).code, 'CANCELLED_PROPOSAL');
  assert.equal(w.approve(cancelled.proposalId, approval(cancelled, COVERED)).code, 'UNKNOWN_PROPOSAL');
  assert.equal(w.bytes(), before);
  const draft = w.submit('old', closure);
  admit(w, 'unrelated', ADD(0, 0));
  const advanced = w.bytes();
  const { nextEventSeq, snapshot } = w.state;
  assert.equal(w.approve(draft.proposalId, approval(draft, COVERED)).code, 'STALE_PREFIX');
  assert.deepEqual(w.cancel(draft.proposalId), { status: 'CANCELLED' });
  assert.equal(w.bytes(), advanced);
  assert.equal(w.approve(draft.proposalId, approval(draft, COVERED)).code, 'UNKNOWN_PROPOSAL');
  const fresh = w.submit('old', closure);
  assert.notEqual(fresh.proposalId, draft.proposalId);
  const choice = approval(fresh, COVERED);
  assert.equal(w.approve(fresh.proposalId, choice).status, 'SEMANTICALLY_ADMITTED');
  assert.equal(w.state.constructionLog.at(-1).eventSeq, nextEventSeq);
  assert(w.state.snapshot.occupancy.some(c => c.unitId === `unit:${snapshot.nextIds.unit}`));
  const committed = w.bytes();
  assert.equal(w.approve(fresh.proposalId, choice).idempotent, true);
  assert.equal(w.submit('old', closure).idempotent, true);
  assert.equal(w.approve(fresh.proposalId, approval(fresh, OPEN)).code, 'EVENT_ID_CONFLICT');
  assert.equal(w.submit('old', ADD(0, 1)).code, 'EVENT_ID_CONFLICT');
  assert.equal(w.bytes(), committed);
});

test('F1-04: invalid choice, validation failure, and publication failure publish nothing', () => {
  let failure = null;
  let observations = [];
  const w = prefix({
    validateProjection(next, packet) {
      if (failure) observations.push([w.bytes(), Object.isFrozen(next.snapshot), packet.length]);
      return failure !== 'validation';
    },
    beforePublish(next, packet) {
      if (failure) {
        observations.push([w.bytes(), Object.isFrozen(next.snapshot), packet.length]);
        throw new Error('publication fault');
      }
      return true;
    },
  });
  const before = w.bytes();
  const journal = canonicalBytes(w.journal());
  const draft = w.submit('atomic', closure);
  const choice = approval(draft, COVERED);
  assert.equal(w.approve(draft.proposalId, approval(draft, ['DOUBLE_HEIGHT', 'OPEN_TO_SKY'])).code, 'INVALID_APPROVAL');
  assert.equal(w.approve(draft.proposalId, { ...choice, authorizer: ' ' }).code, 'INVALID_APPROVAL');
  assert.equal(w.approve(draft.proposalId, { ...choice, authorizer: 'other-operator' }).code, 'INVALID_APPROVAL');
  for (const [fault, code, hookCount] of [
    ['validation', 'VALIDATION_FAILED', 1], ['publication', 'PUBLICATION_FAILED', 2],
  ]) {
    observations = [];
    failure = fault;
    assert.equal(w.approve(draft.proposalId, choice).code, code);
    assert.deepEqual(observations, Array.from({ length: hookCount }, () => [before, true, 2]));
    assert.equal(w.bytes(), before);
    assert.equal(canonicalBytes(w.journal()), journal);
  }
  failure = null;
  assert.equal(w.approve(draft.proposalId, choice).status, 'SEMANTICALLY_ADMITTED');
  assert.equal(w.state.constructionLog.at(-1).eventSeq, 12);
  assert.equal(w.state.decisionLog.at(-1).eventSeq, 13);
  assert.equal(w.state.snapshot.occupancy.find(c => c.x === 3 && c.z === 3 && c.level === 1).unitId, 'unit:12');
  assert.equal(replay(w.journal()).bytes(), w.bytes());
});

test('T04/F1: Remove can reveal ambiguity; an opened enclosure retires its approval and must be chosen again', () => {
  const w = prefix({}, true);
  const before = w.bytes();
  const draft = w.submit('expose-void', REMOVE(2, 2));
  assert.equal(draft.status, PENDING);
  assert.equal(w.bytes(), before);
  assert.equal(w.approve(draft.proposalId, approval(draft, COVERED)).status, 'SEMANTICALLY_ADMITTED');
  const retiredIntent = w.state.snapshot.spaceIntents[0].decisionId;
  const voidAnchor = court(w.state.snapshot)[0].id;
  const firstVoid = w.state.snapshot.voidRegions.find(r => r.members.includes(voidAnchor));
  assert(firstVoid.splitFrom);
  const roofIds = coreRoof(w.state.snapshot).map(p => p.id);
  admit(w, 'remove-wall', REMOVE(3, 3, 1));
  assert(w.state.snapshot.interfaceChanges.retiredPatchIds.some(id => roofIds.includes(id)));
  assert.equal(w.state.snapshot.spaceIntents.length, 0);
  assert.deepEqual(w.state.snapshot.interfaceChanges.retiredRegions.find(r => r.id === firstVoid.id),
    { id: firstVoid.id, mergedInto: firstVoid.splitFrom });
  assert.equal(w.state.decisionLog.length, 1);
  assert.equal(w.state.decisionLog[0].decisionId, retiredIntent);
  const again = w.submit('replace-wall', closure);
  assert.equal(again.status, PENDING);
  assert.equal(w.approve(again.proposalId, approval(again, COVERED)).status, 'SEMANTICALLY_ADMITTED');
  assert.notEqual(w.state.snapshot.spaceIntents[0].decisionId, retiredIntent);
  const resplit = w.state.snapshot.voidRegions.find(r => r.members.includes(voidAnchor));
  assert.notEqual(resplit.id, firstVoid.id);
  assert.equal(resplit.splitFrom, firstVoid.splitFrom);
  assert.equal(replay(w.journal()).bytes(), w.bytes());
});

test('one edit introducing two scopes must publish both decisions in canonical scope order', () => {
  const w = createWorld(CONFIG);
  const wall = [[0, 2], [4, 2], [1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]];
  wall.forEach(([x, z], i) => admit(w, `left-right-base-${i}`, ADD(x, z)));
  admit(w, 'divider-base', ADD(2, 2));
  wall.forEach(([x, z], i) => admit(w, `left-right-upper-${i}`, ADD(x, z, 1)));
  const before = w.bytes();
  const proposal = w.submit('divider-upper', ADD(2, 2, 1));
  assert.equal(proposal.status, PENDING);
  assert.deepEqual(proposal.scopes.map(s => s.footprint), [[{ x: 1, z: 2 }], [{ x: 3, z: 2 }]]);
  const [left, right] = approval(proposal, COVERED).choices;
  right.spaceIntent = OPEN[0];
  right.roofClosure = OPEN[1];
  assert.equal(w.approve(proposal.proposalId, { authorizer: 'witness-owner', choices: [left] }).code, 'INVALID_APPROVAL');
  assert.equal(w.bytes(), before);
  assert.equal(w.approve(proposal.proposalId,
    { authorizer: 'witness-owner', choices: [right, left] }).status, 'SEMANTICALLY_ADMITTED');
  const packet = w.journal().transactions.at(-1);
  assert.deepEqual(packet.map(e => e.eventSeq), [18, 19, 20]);
  assert.equal(new Set(packet.map(e => e.transactionId)).size, 1);
  assert.deepEqual(packet.slice(1).map(e => e.choice), [left, right]);
  assert.equal(replay(w.journal()).bytes(), w.bytes());
});

test('unique face ownership and bounded non-overlapping volumes; local identity and unopened slab', () => {
  const w = createWorld();
  admit(w, 'base', ADD(1, 1));
  admit(w, 'far', ADD(4, 4));
  admit(w, 'edge', ADD(2, 1));
  const before = w.state.snapshot;
  const edge = before.constructionEdges.find(e => e.cells.includes('0:1,1'));
  assert.equal(edge.kind, 'OPEN');
  admit(w, 'upper', ADD(1, 1, 1));
  admit(w, 'color', { ...ADD(1, 1, 0, 'MIST'), type: 'Recolor' });
  const s = w.state.snapshot;
  assert.deepEqual(s.constructionEdges, before.constructionEdges);
  const farIds = new Set(s.volumeFragments.filter(f => f.gridKey === '0:4,4').map(f => f.id));
  const farPatches = snapshot => snapshot.boundaryPatches.filter(p => p.sides.some(id => farIds.has(id)));
  const farRegions = snapshot => snapshot.spaceRegions.filter(r => r.members.some(id => farIds.has(id)));
  assert(farPatches(before).length > 0 && farRegions(before).length > 0);
  assert.deepEqual(farPatches(before), farPatches(s));
  assert.deepEqual(farRegions(before), farRegions(s));
  const fragments = new Map(s.volumeFragments.map(f => [f.id, f]));
  const built = s.volumeFragments.filter(f => f.gridKey === '0:1,1');
  const recolored = s.occupancy.find(c => c.x === 1 && c.z === 1 && c.level === 0);
  assert.equal(recolored.color, 'MIST');
  assert.equal(recolored.createdByActionIndex, 0);
  assert.equal(recolored.unitId, before.occupancy[0].unitId);
  assert.deepEqual(new Set(built.map(f => f.kind)), new Set(['SOLID', 'INTERIOR_AIR', 'RESERVED_VOID']));
  assert.equal(new Set(built.map(f => f.unitId)).size, 1);
  const voxels = new Set(), faces = new Set();
  for (const { bounds: b } of s.volumeFragments) {
    assert(b.x1 > b.x0 && b.y1 > b.y0 && b.z1 > b.z0);
    for (let x = b.x0; x < b.x1; x++) for (let y = b.y0; y < b.y1; y++) for (let z = b.z0; z < b.z1; z++) {
      const key = `${x},${y},${z}`;
      assert(!voxels.has(key), key);
      voxels.add(key);
    }
  }
  assert.equal(voxels.size, 6 * 6 * 3 * 4 * 4);
  const axes = ['x', 'y', 'z'];
  for (const p of s.boundaryPatches) {
    assert(p.owner);
    const { axis, plane, u0, u1, v0, v1 } = p.bounds;
    assert(u0 < u1 && v0 < v1);
    if (p.airOpen) assert(p.sides.every(id => fragments.get(id)?.kind.endsWith('_AIR') ||
      id === OUTSIDE_WORLD || id === SKY_EXTERIOR));
    const [uAxis, vAxis] = axes.filter(a => a !== axis);
    p.sides.forEach((id, side) => {
      const f = fragments.get(id);
      if (!f) return assert([SKY_EXTERIOR, OUTSIDE_WORLD, 'GROUND'].includes(id));
      assert.equal(f.bounds[axis + (side === 0 ? '1' : '0')], plane);
      assert.deepEqual([f.bounds[uAxis + '0'], f.bounds[uAxis + '1'], f.bounds[vAxis + '0'],
        f.bounds[vAxis + '1']], [u0, u1, v0, v1]);
    });
    for (let u = u0; u < u1; u++) for (let v = v0; v < v1; v++) {
      const key = `${axis}:${plane}:${u}:${v}`;
      assert(!faces.has(key), key);
      faces.add(key);
    }
  }
  assert(s.boundaryPatches.some(p => p.sides.includes(SKY_EXTERIOR)));
  assert(s.boundaryPatches.some(p => p.sides.includes(OUTSIDE_WORLD)));
  const slab = s.boundaryPatches.find(p => p.kind === 'SLAB' && p.sides.every(id =>
    fragments.get(id)?.kind === 'INTERIOR_AIR'));
  const { u0, v0 } = slab.bounds;
  const rectangle = { u0, u1: u0 + 1, v0, v1: v0 + 1 };
  assert.equal(probeSlabOpening(s, slab.id, { ...rectangle, u0: u0 - 1 }), null);
  const opening = probeSlabOpening(s, slab.id, rectangle);
  assert.equal(opening.status, 'UNREALIZED');
  assert.equal(opening.physicalPassable, false);
  assert.equal(opening.abstractRouteAuthorized, false);
  assert.equal(slab.airOpen, false);
  assert.deepEqual(s.passages, []);
  const preRemove = w.bytes();
  assert.equal(w.submit('orphan-upper', REMOVE(1, 1)).code, 'REJECT_SUPPORT_UNRESOLVED');
  assert.equal(w.bytes(), preRemove);
  admit(w, 'remove-upper', REMOVE(1, 1, 1));
  const after = w.state.snapshot;
  assert.equal(probeSlabOpening(after, opening.hostPatchId, rectangle), null);
  assert.equal(after.boundaryPatches.find(p => p.faceKey === slab.faceKey).kind, 'ROOF');
  assert(after.interfaceChanges.retiredPatchIds.includes(slab.id));
  assert.equal(after.interfaceChanges.cause.constructionEventId, w.state.constructionLog.at(-1).eventId);
  assert.equal(w.state.decisionLog.length, 0);
  admit(w, 'replace-upper', ADD(1, 1, 1));
  assert.notEqual(w.state.snapshot.boundaryPatches.find(p => p.faceKey === slab.faceKey).id, slab.id);
  assert.equal(replay(w.journal()).bytes(), w.bytes());
});

test('canonical replay rejects partial, reordered, stale, altered, and conflicting transaction packets', () => {
  const w = project(COVERED);
  const journal = w.journal();
  const last = journal.transactions.at(-1);
  const identical = { ...journal, transactions: [...journal.transactions, last] };
  assert.equal(replay(identical).bytes(), w.bytes());
  const altered = edit => {
    const clone = structuredClone(journal);
    edit(clone.transactions, clone.transactions.at(-1));
    return clone;
  };
  assert.throws(() => replay(altered((_, packet) => packet.pop())), /INCOMPLETE_TRANSACTION/);
  assert.throws(() => replay(altered((_, packet) => { packet[1].eventSeq++; })), /TRANSACTION_MISMATCH/);
  assert.throws(() => replay(altered((_, packet) => { packet[0].inputPrefixDigest = 'old'; })), /TRANSACTION_MISMATCH/);
  assert.throws(() => replay(altered((_, packet) => { packet[1].proposalId = 'stale'; })), /TRANSACTION_MISMATCH/);
  assert.throws(() => replay(altered((packets) => { [packets[0], packets[1]] = [packets[1], packets[0]]; })), /TRANSACTION_MISMATCH/);
  assert.throws(() => replay(altered((packets, packet) => {
    packets.push([{ ...packet[0], action: ADD(0, 0) }, packet[1]]);
  })), /EVENT_ID_CONFLICT/);
});
