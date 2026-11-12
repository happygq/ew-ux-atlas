import assert from 'node:assert/strict';
import test from 'node:test';
import { createPracticeWorld, replayPractice } from './practice-world.mjs';

const add = level => ({ type: 'Add', x: 2, z: 2, level, color: 'PAPER' });
const remove = level => ({ type: 'Remove', x: 2, z: 2, level });
const unit = (world, level) => world.state.snapshot.occupancy.find(cell =>
  cell.x === 2 && cell.z === 2 && cell.level === level);
const admitted = (world, id, action) => assert.equal(world.submit(id, action).status, 'SEMANTICALLY_ADMITTED');

test('a supported Remove replaces the lower room with one derived pillar in the same transaction', () => {
  const world = createPracticeWorld({ levels: 2 });
  admitted(world, 'lower', add(0));
  admitted(world, 'upper', add(1));
  const old = unit(world, 0);
  const upper = unit(world, 1);
  const seq = world.state.nextEventSeq;
  admitted(world, 'carve', remove(0));
  const pillar = unit(world, 0);
  assert.equal(pillar.supportRole, 'COLUMN');
  assert.notEqual(pillar.unitId, old.unitId);
  assert.equal(pillar.generatedSupport.replacedUnitId, old.unitId);
  assert.equal(pillar.generatedSupport.initialDependentUnitId, upper.unitId);
  assert.deepEqual(unit(world, 1), upper);
  assert.deepEqual(world.journal().transactions.at(-1).map(e => [e.eventSeq, e.action.type]), [[seq, 'Remove']]);
  const { support, volumeFragments, boundaryPatches } = world.state.snapshot;
  const node = support.nodes.find(n => n.id === upper.unitId);
  const alternative = node.alternatives.find(a => a.id === node.selectedAlternativeId);
  assert.equal(alternative.patternId, 'DIRECT_GENERATED_COLUMN');
  assert.deepEqual(alternative.foundationPaths, [[upper.unitId, pillar.unitId, 'ground:2,2']]);
  assert.equal(alternative.physicalUseEligible, false);
  const fragments = volumeFragments.filter(f => f.unitId === pillar.unitId);
  assert.equal(fragments.filter(f => f.kind === 'SOLID').length, 1);
  assert.equal(fragments.filter(f => f.kind === 'EXTERIOR_AIR').length, 3);
  assert(!boundaryPatches.some(p => p.owner === old.unitId ||
    p.owner === pillar.unitId && ['WALL', 'SLAB', 'ROOF'].includes(p.kind)));
  assert.equal(replayPractice(world.journal()).bytes(), world.bytes());
});

test('three levels can retain a continuous chain, and required pillars cannot be removed', () => {
  const world = createPracticeWorld({ levels: 3 });
  for (let level = 0; level < 3; level++) admitted(world, `level-${level}`, add(level));
  const top = unit(world, 2);
  admitted(world, 'carve-ground', remove(0));
  admitted(world, 'carve-middle', remove(1));
  const bottom = unit(world, 0);
  const middle = unit(world, 1);
  const node = world.state.snapshot.support.nodes.find(n => n.id === top.unitId);
  assert.deepEqual(node.alternatives[0].foundationPaths, [[top.unitId, middle.unitId, bottom.unitId, 'ground:2,2']]);
  const before = world.bytes();
  assert.equal(world.submit('remove-required', remove(0)).code, 'REJECT_SUPPORT_UNRESOLVED');
  assert.equal(world.bytes(), before);
  admitted(world, 'remove-top', remove(2));
  assert.equal(unit(world, 2), undefined);
  admitted(world, 'remove-unused-middle-pillar', remove(1));
  admitted(world, 'remove-unused-ground-pillar', remove(0));
  assert.equal(world.state.snapshot.occupancy.length, 0);
});

test('unneeded supports are not generated, and Add does not author a pillar', () => {
  const world = createPracticeWorld();
  assert.equal(world.submit('manual-column', { ...add(0), supportRole: 'COLUMN' }).code, 'INVALID_REQUEST');
  assert.equal(world.submit('floating', add(1)).code, 'REJECT_SUPPORT_UNRESOLVED');
  admitted(world, 'single', add(0));
  admitted(world, 'remove-single', remove(0));
  assert.equal(unit(world, 0), undefined);
});

test('a failed Remove publication does not expose or consume the generated pillar identity', () => {
  let fail = false;
  let generated;
  const world = createPracticeWorld({}, { beforePublish(next) {
    if (!fail) return true;
    generated = next.snapshot.occupancy.find(c => c.generatedSupport);
    return false;
  } });
  admitted(world, 'lower', add(0));
  admitted(world, 'upper', add(1));
  const before = world.bytes();
  fail = true;
  assert.equal(world.submit('carve', remove(0)).code, 'PUBLICATION_FAILED');
  assert(generated?.generatedSupport);
  assert.equal(world.bytes(), before);
  fail = false;
  admitted(world, 'carve', remove(0));
  assert.equal(unit(world, 0).unitId, generated.unitId);
  assert.equal(world.submit('carve', remove(0)).idempotent, true);
});
