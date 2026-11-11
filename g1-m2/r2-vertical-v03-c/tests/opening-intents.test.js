import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { canonicalBytes } from '../../r2-vertical-v03-a/src/world.js';
import { createWorld, POLICY_VERSION, replay } from '../src/world.js';

const config = { width: 5, depth: 5, levels: 3 };
const add = (x, z, level, options = {}) => ({ type: 'Add', x, z, level, color: 'PAPER', ...options });
const remove = (x, z, level) => ({ type: 'Remove', x, z, level });
const admit = (w, id, action) => assert.equal(w.submit(id, action).status, 'SEMANTICALLY_ADMITTED', id);
const decide = (w, id, type, targetId, context = w.openingContext()) =>
  w.decideOpening(id, { type, targetId, authorizer: 'local-operator', inputPrefixDigest: context.inputPrefixDigest });
const stairs = context => context.proposals.filter(p => p.binding.kind === 'STAIR');
const firstIntent = w => w.state.snapshot.openingIntents[0];
const hash = value => createHash('sha256').update(value, 'utf8').digest('hex');

function stack(w, optionsAt = () => ({}), width = 2) {
  for (let level = 0; level < 2; level++) for (let z = 1; z < 3; z++) for (let x = 1; x <= width; x++) {
    admit(w, `cell-${x}-${z}-${level}`, add(x, z, level, optionsAt(x, z, level)));
  }
}

function approveStair(w, id = 'approve-stair') {
  const context = w.openingContext();
  const [proposal] = stairs(context);
  assert(proposal);
  assert.equal(decide(w, id, 'APPROVE_USER', proposal.proposalId, context).status, 'SEMANTICALLY_ADMITTED');
  return proposal;
}

test('T07: a single 2×2 proposal stays read-only until explicit approval of the bounded opening', () => {
  const w = createWorld(config);
  stack(w);
  const before = w.bytes();
  const context = w.openingContext();
  assert.deepEqual(w.openingContext(), context);
  const [stair] = stairs(context);
  assert.equal(stairs(context).length, 1);
  assert.equal(stair.binding.footprint.length, 8);
  assert.equal(stair.support.length, 8);
  assert.equal(stair.abstractRouteAuthorized, false);
  assert.equal(stair.physicalPassable, false);
  assert.equal(decide(w, 'auto', 'APPROVE_POLICY', stair.proposalId, context).code, 'INVALID_OPENING_DECISION');
  assert.equal(w.bytes(), before);
  assert.deepEqual(w.state.snapshot.passages, []);
  assert.deepEqual(w.state.decisionLog, []);
  const { hostPatchId, endpoints, rectangle } = stair.binding;
  const host = w.state.snapshot.boundaryPatches.find(p => p.id === hostPatchId);
  assert.equal(host.kind, 'SLAB');
  assert.equal(host.airOpen, false);
  assert(endpoints.every(e => e.unitId && e.spaceRegionId && e.buildingId));
  assert.deepEqual(endpoints.map(e => e.volumeId), host.sides);
  assert(rectangle.u0 >= host.bounds.u0 && rectangle.u1 < host.bounds.u1 &&
    rectangle.v0 >= host.bounds.v0 && rectangle.v1 < host.bounds.v1);
  const nextSeq = w.state.nextEventSeq;
  assert.equal(decide(w, 'accept', 'APPROVE_USER', stair.proposalId, context).status, 'SEMANTICALLY_ADMITTED');
  assert.equal(firstIntent(w).status, 'ACTIVE');
  assert.equal(firstIntent(w).realizationEvidence, 'UNREALIZED');
  assert.deepEqual(w.state.snapshot.passages, [{
    intentId: firstIntent(w).intentId, kind: 'STAIR', endpoints, hostPatchId,
    abstractRouteAuthorized: true, physicalPassable: false,
  }]);
  assert.deepEqual(w.state.snapshot.boundaryPatches.find(p => p.id === hostPatchId), host);
  const [approval] = w.journal().transactions.at(-1);
  assert.equal(approval.eventSeq, nextSeq);
  assert.equal(approval.policyVersion, POLICY_VERSION);
  assert.deepEqual(approval.proposal, stair);
  const committed = w.bytes();
  assert.equal(decide(w, 'accept', 'APPROVE_USER', stair.proposalId, context).idempotent, true);
  assert.equal(decide(w, 'accept', 'DECLINE', stair.proposalId, context).code, 'EVENT_ID_CONFLICT');
  assert.equal(w.submit('accept', add(0, 0, 0)).code, 'EVENT_ID_CONFLICT');
  assert.equal(w.bytes(), committed);
});

test('T07: missing, private, cross-building, unknown, and partitioned stair footprints fail closed', () => {
  for (const metadata of [{ access: 'PRIVATE' }, { buildingId: 'different' }, { spaceUse: 'UNKNOWN' },
    { color: 'MIST' }, { supportRole: 'COLUMN' }]) {
    const w = createWorld(config);
    stack(w, (x, z, level) => x === 2 && z === 2 && level === 1 ? metadata : {});
    const before = w.bytes();
    const context = w.openingContext();
    assert.deepEqual(stairs(context), [], JSON.stringify(metadata));
    assert.equal(decide(w, 'fabricated', 'APPROVE_USER', 'missing-proposal', context).code, 'PROPOSAL_NOT_OFFERED');
    assert.equal(w.bytes(), before);
  }
  const w = createWorld(config);
  assert.equal(w.submit('floating', add(1, 1, 1)).code, 'REJECT_SUPPORT_UNRESOLVED');
  assert.deepEqual(w.openingContext().proposals, []);
});

test('T07: declined and stale proposals grant no passage and an overlapping stair remains unavailable', () => {
  const w = createWorld(config);
  stack(w, undefined, 3);
  const original = w.openingContext();
  const candidates = stairs(original);
  assert.equal(candidates.length, 2);
  const [first, second] = candidates;
  assert.equal(decide(w, 'decline', 'DECLINE', first.proposalId, original).status, 'SEMANTICALLY_ADMITTED');
  assert.deepEqual(w.state.snapshot.openingIntents, []);
  assert.equal(w.state.decisionLog[0].decision.type, 'DECLINE');
  assert.equal(decide(w, 'stale', 'APPROVE_USER', second.proposalId, original).code, 'STALE_PREFIX');
  const next = w.openingContext();
  assert.notEqual(stairs(next)[0].proposalId, first.proposalId);
  const denied = w.decideOpening('other-operator', {
    type: 'APPROVE_USER', targetId: stairs(next)[0].proposalId,
    authorizer: 'different-operator', inputPrefixDigest: next.inputPrefixDigest,
  });
  assert.equal(denied.code, 'INVALID_OPENING_DECISION');
  approveStair(w);
  assert.deepEqual(stairs(w.openingContext()), []);
  assert.equal(w.state.snapshot.passages.length, 1);
});

test('F2-01/F2-04: Remove retires the bound stair atomically without a second event or revival', t => {
  let fail = false;
  let attempted;
  const w = createWorld(config, {
    beforePublish(next) {
      if (!fail) return true;
      attempted = [next.snapshot.openingIntents[0].status, next.snapshot.passages];
      return false;
    },
  });
  stack(w);
  const proposal = approveStair(w);
  const { intentId } = firstIntent(w);
  const before = w.bytes();
  assert.equal(w.submit('invalid-root-remove', remove(1, 1, 0)).code, 'REJECT_SUPPORT_UNRESOLVED');
  assert.equal(w.bytes(), before);
  fail = true;
  assert.equal(w.submit('remove-landing', remove(1, 1, 1)).code, 'PUBLICATION_FAILED');
  assert.deepEqual(attempted, ['INVALIDATED', []]);
  assert.equal(w.bytes(), before);
  fail = false;
  const seq = w.state.nextEventSeq;
  admit(w, 'remove-landing', remove(1, 1, 1));
  const packet = w.journal().transactions.at(-1);
  assert.deepEqual(packet.map(e => e.eventSeq), [seq]);
  assert.equal(w.state.decisionLog.length, 1);
  const invalidated = firstIntent(w);
  assert.equal(invalidated.status, 'INVALIDATED');
  assert.equal(invalidated.abstractRouteAuthorized, false);
  assert.equal(invalidated.derivedCause.constructionEventId, packet[0].eventId);
  assert.equal(invalidated.derivedCause.transactionId, packet[0].transactionId);
  assert.deepEqual(w.state.snapshot.passages, []);
  admit(w, 'new-landing', add(1, 1, 1));
  assert.equal(firstIntent(w).status, 'INVALIDATED');
  assert.equal(decide(w, 'cannot-restore', 'REAPPROVE', intentId).code, 'INTENT_NOT_RETAINED');
  const newProposal = approveStair(w, 'new-stair');
  assert.notEqual(newProposal.binding.hostPatchId, proposal.binding.hostPatchId);
  assert.notEqual(w.state.snapshot.passages[0].intentId, intentId);
  const journal = canonicalBytes(w.journal());
  assert.equal(replay(JSON.parse(journal)).bytes(), w.bytes());
  t.diagnostic(`F2 journal SHA-256 ${hash(journal)}, state SHA-256 ${hash(w.bytes())}`);
  const damaged = JSON.parse(journal);
  damaged.transactions.splice(8, 1);
  assert.throws(() => replay(damaged), /TRANSACTION_MISMATCH/);
  const conflicting = JSON.parse(journal);
  const approval = conflicting.transactions[8][0];
  conflicting.transactions.push([{ ...approval, decision: { ...approval.decision, type: 'DECLINE' } }]);
  assert.throws(() => replay(conflicting), /EVENT_ID_CONFLICT/);
  const duplicate = JSON.parse(journal);
  duplicate.transactions.push(duplicate.transactions[8]);
  assert.equal(replay(duplicate).bytes(), w.bytes());
});

test('F2-04: failed approval publication keeps the opening provisional and preserves the event sequence', () => {
  let fail = true;
  let attempted;
  const w = createWorld(config, {
    beforePublish(next, packet) {
      if (packet[0].decision?.type !== 'APPROVE_USER' || !fail) return true;
      attempted = [next.snapshot.passages.length, next.decisionLog.length, packet[0].eventSeq];
      return false;
    },
  });
  stack(w);
  const before = w.bytes();
  const journal = canonicalBytes(w.journal());
  const seq = w.state.nextEventSeq;
  const context = w.openingContext();
  const [stair] = stairs(context);
  assert.equal(decide(w, 'retry', 'APPROVE_USER', stair.proposalId, context).code, 'PUBLICATION_FAILED');
  assert.deepEqual(attempted, [1, 1, seq]);
  assert.equal(w.bytes(), before);
  assert.equal(canonicalBytes(w.journal()), journal);
  fail = false;
  assert.equal(decide(w, 'retry', 'APPROVE_USER', stair.proposalId, context).status, 'SEMANTICALLY_ADMITTED');
  assert.equal(w.state.decisionLog[0].eventSeq, seq);
  assert.equal(replay(w.journal()).bytes(), w.bytes());
});

test('F2-02/F2-03: a retained stair stays suspended through restoration until reapproval, and withdrawal is terminal', () => {
  const w = createWorld(config);
  stack(w);
  approveStair(w);
  const { intentId, proposal } = firstIntent(w);
  admit(w, 'remove-footprint-corner', remove(2, 2, 1));
  assert.equal(firstIntent(w).status, 'SUSPENDED');
  assert.equal(firstIntent(w).derivedCause.reason, 'ROUTE_PRECONDITION_LOST');
  assert.equal(w.state.decisionLog.length, 1);
  assert.equal(w.journal().transactions.at(-1).length, 1);
  assert.equal(decide(w, 'too-soon', 'REAPPROVE', intentId).code, 'ROUTE_PRECONDITION_LOST');
  admit(w, 'restore-footprint', add(2, 2, 1));
  assert.equal(firstIntent(w).status, 'SUSPENDED');
  assert.deepEqual(w.state.snapshot.passages, []);
  assert.deepEqual(stairs(w.openingContext()), []);
  assert.equal(decide(w, 'reapprove', 'REAPPROVE', intentId).status, 'SEMANTICALLY_ADMITTED');
  assert.equal(firstIntent(w).intentId, intentId);
  assert.equal(firstIntent(w).status, 'ACTIVE');
  assert.deepEqual(firstIntent(w).proposal, proposal);
  assert.equal(w.state.snapshot.passages[0].abstractRouteAuthorized, true);
  assert.equal(w.state.decisionLog.at(-1).decision.type, 'REAPPROVE');
  assert.equal(decide(w, 'withdraw', 'WITHDRAW', intentId).status, 'SEMANTICALLY_ADMITTED');
  assert.equal(firstIntent(w).status, 'WITHDRAWN');
  assert.deepEqual(w.state.snapshot.passages, []);
  assert.equal(decide(w, 'after-withdrawal', 'REAPPROVE', intentId).code, 'INTENT_NOT_RETAINED');
  assert.equal(replay(w.journal()).bytes(), w.bytes());
});

test('T01/T08: persisted horizontal partition and unapproved bridge confer no route', () => {
  const w = createWorld(config);
  admit(w, 'left', add(1, 1, 0));
  admit(w, 'right', add(2, 1, 0, { color: 'MIST' }));
  const facts = w.state.snapshot.constructionEdges;
  assert.equal(facts[0].kind, 'PARTITION');
  admit(w, 'paint', { type: 'Recolor', x: 2, z: 1, level: 0, color: 'PAPER' });
  assert.deepEqual(w.state.snapshot.constructionEdges, facts);
  const context = w.openingContext();
  const door = context.proposals.find(p => p.binding.kind === 'DOOR');
  assert(door);
  assert.deepEqual(w.state.snapshot.passages, []);
  assert.equal(decide(w, 'door', 'APPROVE_USER', door.proposalId, context).status, 'SEMANTICALLY_ADMITTED');
  const [route] = w.state.snapshot.passages;
  assert.equal(route.kind, 'DOOR');
  assert.equal(route.physicalPassable, false);
  assert.equal(w.state.snapshot.boundaryPatches.find(p => p.id === route.hostPatchId).airOpen, false);
  assert.deepEqual(w.state.snapshot.constructionEdges, facts);
  const bridge = createWorld(config);
  admit(bridge, 'left-bank', add(1, 2, 0));
  admit(bridge, 'right-bank', add(3, 2, 0));
  const rejected = bridge.submit('bridge', add(2, 2, 1));
  assert.equal(rejected.code, 'REJECT_SUPPORT_UNRESOLVED');
  assert.equal(rejected.candidates[0].policyApproval, 'UNAPPROVED');
  assert(bridge.state.snapshot.volumeFragments.filter(f => f.gridKey === '0:2,2')
    .every(f => f.kind === 'EXTERIOR_AIR'));
  assert.deepEqual(bridge.openingContext().proposals, []);
  assert.deepEqual(bridge.state.snapshot.passages, []);
});
