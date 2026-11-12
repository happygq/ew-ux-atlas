import assert from 'node:assert/strict';
import test from 'node:test';
import { createPracticeWorld, replayPractice } from './practice-world.mjs';

const square = [[1, 1], [2, 1], [1, 2], [2, 2]];
const stairs = context => context.proposals.filter(proposal => proposal.binding.kind === 'STAIR');
const admitted = result => assert.equal(result.status, 'SEMANTICALLY_ADMITTED');

function stack(upperCells = square, upperMetadata = () => ({})) {
  const world = createPracticeWorld({ width: 4, depth: 4, levels: 2 });
  for (const [level, cells] of [square, upperCells].entries()) {
    for (const [x, z] of cells) {
      admitted(world.submit(`unit-${level}-${x}-${z}`, {
        type: 'Add', level, x, z, color: 'PAPER', ...(level ? upperMetadata(x, z) : {}),
      }));
    }
  }
  return world;
}

function approve(world, id, context, proposal) {
  admitted(world.decideOpening(id, {
    type: 'APPROVE_USER', targetId: proposal.proposalId,
    authorizer: world.state.initial.operatorId, inputPrefixDigest: context.inputPrefixDigest,
  }));
}

test('after removing an approved landing, three connected upper cells can host a new explicit stair approval', () => {
  const world = stack();
  const initial = world.openingContext();
  const [original] = stairs(initial);
  assert.equal(original.binding.footprint.length, 8);
  approve(world, 'original', initial, original);
  admitted(world.submit('remove-landing', { type: 'Remove', x: 1, z: 1, level: 1 }));
  assert.equal(world.state.snapshot.openingIntents[0].status, 'INVALIDATED');
  assert.deepEqual(world.state.snapshot.passages, []);

  const next = world.openingContext();
  const candidates = stairs(next);
  assert.equal(candidates.length, 1);
  const [replacement] = candidates;
  assert.equal(replacement.binding.footprint.length, 7);
  assert.equal(replacement.abstractRouteAuthorized, false);
  assert.notEqual(replacement.binding.hostPatchId, original.binding.hostPatchId);
  const upper = world.state.snapshot.occupancy.find(u => u.unitId === replacement.binding.endpoints[1].unitId);
  assert.deepEqual([upper.x, upper.z, upper.level], [2, 1, 1]);
  approve(world, 'new-location', next, replacement);
  const { occupancy, openingIntents, passages, boundaryPatches } = world.state.snapshot;
  assert.equal(occupancy.filter(u => u.level === 1).length, 3);
  assert.deepEqual(openingIntents.map(i => i.status), ['INVALIDATED', 'ACTIVE']);
  assert.equal(passages[0].intentId, 'opening-intent:new-location');
  assert.equal(passages[0].physicalPassable, false);
  assert.equal(boundaryPatches.find(p => p.id === replacement.binding.hostPatchId).airOpen, false);
  admitted(world.submit('unrelated-edit', { type: 'Add', x: 0, z: 0, level: 0, color: 'MIST' }));
  assert.deepEqual(world.state.snapshot.passages, passages);
  admitted(world.submit('remove-new-landing', { type: 'Remove', x: 2, z: 1, level: 1 }));
  assert.deepEqual(world.state.snapshot.openingIntents.map(i => i.status), ['INVALIDATED', 'INVALIDATED']);
  assert.deepEqual(world.state.snapshot.passages, []);
  assert.equal(replayPractice(world.journal()).bytes(), world.bytes());
});

test('the alternate rule excludes two cells, inaccessible cells and disconnected upper layouts', () => {
  const three = square.slice(1);
  const worlds = [
    stack(three.slice(0, 2)),
    stack(three, (x, z) => x === 2 && z === 2 ? { access: 'PRIVATE' } : {}),
    stack(three, (x, z) => x === 2 && z === 2 ? { color: 'MIST' } : {}),
    stack(square, (x, z) => x === 1 && z === 1 ? { access: 'PRIVATE' } : {}),
  ];
  for (const world of worlds) assert.deepEqual(stairs(world.openingContext()), []);
});
