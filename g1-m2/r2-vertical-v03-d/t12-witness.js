import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalBytes } from '../r2-vertical-v03-a/src/world.js';
import { createWorld, POLICY_VERSION } from '../r2-vertical-v03-c/src/world.js';

export const WITNESS_VERSION = 'ew-ux/r2-v3-d/t12/1';
export const hashBytes = bytes => createHash('sha256').update(bytes, 'utf8').digest('hex');
export const config = Object.freeze({ width: 10, depth: 7, levels: 2, operatorId: 't12-operator' });
export const add = (x, z, level, metadata = {}) => ({ type: 'Add', x, z, level, color: 'PAPER', ...metadata });
const remove = (x, z, level) => ({ type: 'Remove', x, z, level });

// Every edit and approval below goes through the published Stage C API.
// The sole fault injection is the existing synchronous pre-publication hook.
export function runT12({ includeSnapshots = false } = {}) {
  const steps = [];
  const states = new Map();
  let failPublication = false;
  let attemptedReplacement;
  const world = createWorld(config, {
    beforePublish(next, packet) {
      if (!failPublication || packet[0].requestId !== 'replace-support') return true;
      attemptedReplacement = next.snapshot.support.selectionChanges[0];
      return false;
    },
  });
  const initialStateHash = hashBytes(world.bytes());

  function record(label, expected, invoke) {
    const before = world.bytes();
    const prior = world.state;
    const result = invoke();
    const after = world.bytes();
    const state = world.state;
    assert.equal(result.code ?? result.status, expected, label);
    const published = result.status === 'SEMANTICALLY_ADMITTED' && !result.idempotent;
    assert.equal(after !== before, published, label);
    if (published) {
      const packet = world.journal().transactions.at(-1);
      assert.deepEqual(packet.map(e => e.eventSeq),
        Array.from({ length: packet.length }, (_, i) => prior.nextEventSeq + i), label);
      assert(packet.every(e => e.inputPrefixDigest === hashBytes(before)), label);
      assert.equal(state.nextEventSeq, prior.nextEventSeq + packet.length, label);
    } else {
      assert.equal(state, prior, label);
    }
    states.set(label, state);
    steps.push({
      label, result, beforeSha256: hashBytes(before), afterSha256: hashBytes(after),
      nextEventSeq: state.nextEventSeq,
      ...(includeSnapshots ? { snapshot: state.snapshot } : {}),
    });
    return result;
  }

  const admitted = 'SEMANTICALLY_ADMITTED';
  const build = (id, action) => record(id, admitted, () => world.submit(id, action));
  function authorizeStair(buildingId, requestId) {
    const context = world.openingContext();
    const [offered, ...others] = context.proposals.filter(p =>
      p.binding.kind === 'STAIR' && p.binding.endpoints.every(e => e.buildingId === buildingId));
    assert(offered && !others.length, buildingId);
    const decision = {
      type: 'APPROVE_USER', targetId: offered.proposalId,
      authorizer: config.operatorId, inputPrefixDigest: context.inputPrefixDigest,
    };
    record(requestId, admitted, () => world.decideOpening(requestId, decision));
    return { offered, decision, intentId: world.state.decisionLog.at(-1).intentId };
  }

  function stack(buildingId, z0) {
    for (let level = 0; level < 2; level++) for (let z = z0; z <= z0 + 1; z++) {
      for (let x = 5; x <= 6; x++) build(`${buildingId}-${x}-${z}-${level}`, add(x, z, level, { buildingId }));
    }
  }
  stack('east', 1);
  const east = authorizeStair('east', 'approve-east');
  stack('south', 4);
  const south = authorizeStair('south', 'approve-south');

  const column = { buildingId: 'support', supportRole: 'COLUMN' };
  build('center-bearing', add(8, 4, 0, { buildingId: 'support' }));
  build('south-column', add(8, 3, 0, column));
  build('north-column', add(8, 5, 0, column));
  build('mixed-room', add(8, 4, 1, { buildingId: 'support', supportRole: 'MIXED_ROOM' }));
  build('west-column', add(7, 4, 0, column));
  build('east-column', add(9, 4, 0, column));

  const wall = [[1, 2], [3, 2], [2, 1], [2, 3]];
  const courtCell = (x, z, level) => add(x, z, level, { buildingId: 'court' });
  wall.forEach(([x, z], i) => build(`court-base-${i}`, courtCell(x, z, 0)));
  wall.slice(0, -1).forEach(([x, z], i) => build(`court-upper-${i}`, courtCell(x, z, 1)));
  function closeCourt(id) {
    const draft = record(`${id}-pending`, 'PENDING_CHOICE', () => world.submit(id, courtCell(2, 3, 1)));
    assert.equal(draft.scopes.length, 1);
    record(id, admitted, () => world.approve(draft.proposalId, {
      authorizer: config.operatorId,
      choices: [{ scopeId: draft.scopes[0].scopeId, spaceIntent: 'DOUBLE_HEIGHT', roofClosure: 'COVERED_OPAQUE' }],
    }));
  }
  closeCourt('seal-court');

  const previous = world.openingContext();
  build('recolor-south-landing', { type: 'Recolor', x: 5, z: 4, level: 1, color: 'MIST' });
  world.openingContext();
  record('stale-withdrawal', 'STALE_PREFIX', () => world.decideOpening('stale-withdrawal', {
    type: 'WITHDRAW', targetId: south.intentId, authorizer: config.operatorId,
    inputPrefixDigest: previous.inputPrefixDigest,
  }));

  failPublication = true;
  record('support-publication-failure', 'PUBLICATION_FAILED', () => world.submit('replace-support', remove(8, 3, 0)));
  failPublication = false;
  build('replace-support', remove(8, 3, 0));
  record('reject-last-column', 'REJECT_SUPPORT_UNRESOLVED', () => world.submit('reject-last-column', remove(7, 4, 0)));
  record('reject-adjacent-room-on-column', 'REJECT_SUPPORT_UNRESOLVED',
    () => world.submit('reject-adjacent-room-on-column', add(7, 4, 1, { buildingId: 'support' })));
  build('unseal-court', remove(2, 3, 1));
  closeCourt('reseal-court');
  build('remove-south-landing', remove(5, 4, 1));
  const restored = add(5, 4, 1, { buildingId: 'south' });
  build('restore-south-landing', restored);
  record('repeat-restore', admitted, () => world.submit('restore-south-landing', restored));
  record('conflict-restore', 'EVENT_ID_CONFLICT', () => world.submit('restore-south-landing', add(0, 0, 0)));
  record('repeat-original-approval', admitted, () => world.decideOpening('approve-south', south.decision));
  record('conflict-original-approval', 'EVENT_ID_CONFLICT',
    () => world.decideOpening('approve-south', { ...south.decision, type: 'DECLINE' }));
  const replacement = authorizeStair('south', 'approve-restored-south');

  const journal = world.journal();
  const report = {
    witnessVersion: WITNESS_VERSION, policyVersion: POLICY_VERSION,
    initialStateSha256: initialStateHash,
    finalStateSha256: hashBytes(world.bytes()), journalSha256: hashBytes(canonicalBytes(journal)),
    journal, steps,
  };
  return { world, states, east, south, replacement, attemptedReplacement, report };
}
