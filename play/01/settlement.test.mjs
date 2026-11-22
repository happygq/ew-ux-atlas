import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../g1-m2/r2-vertical-v03-visual/vendor/three.module.min.js';
import { AREA, BAY, COUNT, HALF, SIZE, atPoint, cell, center, createWorld, neighbors, opposite } from './world.mjs';
import { DOOR, PASSAGE, ROOM_AREA, derive, plotSignature, reachablePlots } from './spatial.mjs';
import { buildArchitecture, noise, roofProfile } from './architecture.mjs';
import { apply, compound, gate, u } from './test-fixtures.mjs';

function add(world, points, palette = 0) {
  assert.ok(apply(world.edit, points, 'add', palette).every(result => result.ok));
  return derive(world);
}

function consistent(model) {
  const reachable = reachablePlots(model);
  for (const { id } of model.rooms) {
    const room = model.plots[id];
    assert.ok(reachable.has(id), `Room ${id} needs a continuous pedestrian route`);
    for (let d = 0; d < 4; d++) {
      const side = room.walls[d];
      if (side.opening && room.passages) assert.ok(room.passages & (1 << d));
      if (!side.shared) continue;
      const other = model.plots[side.neighbor];
      const back = other.walls[opposite(d)];
      assert.equal(back.opening, side.opening);
      assert.notEqual(back.owner, side.owner);
      const a = roofProfile(room), b = roofProfile(other), oppositeSide = opposite(d);
      assert.deepEqual(a.edge[d], b.edge[oppositeSide], `Ridge seam ${id}/${side.neighbor}`);
      assert.deepEqual(a.corner[d], b.corner[(oppositeSide + 3) % 4], `First corner of seam ${id}/${side.neighbor}`);
      assert.deepEqual(a.corner[(d + 3) % 4], b.corner[oppositeSide], `Second corner of seam ${id}/${side.neighbor}`);
    }
  }
  for (const court of model.courts) {
    assert.ok(court.cells.every(id => reachable.has(id)));
    if (court.kind === 'enclosed') assert.ok(court.gateway.length > 0);
  }
}

test('900 free plots cover 14,400 square metres and can be used shore to shore', () => {
  assert.equal(AREA, 14400);
  const valid = new Set(Array.from({ length: COUNT }, (_, id) => atPoint(...center(id))));
  assert.equal(valid.size * BAY ** 2, AREA);
  assert.ok(!valid.has(-1));
  assert.equal(atPoint(-HALF, -HALF), 0);
  assert.equal(atPoint(HALF, 0), -1);
  assert.ok(ROOM_AREA >= 12 && ROOM_AREA <= 30);
  const world = createWorld();
  const all = add(world, [[0, 0], [SIZE - 1, SIZE - 1], [0, SIZE - 1], [SIZE - 1, 0]]);
  assert.equal(all.compounds.length, 4);
  consistent(all);
});

test('invalid operations preserve revision and undo restores palette, identity and occupancy', () => {
  const world = createWorld();
  assert.equal(world.edit({ type: 'undo' }).ok, false);
  add(world, [[7, 7]]);
  const initial = world.snapshot();
  const bad = [
    { type: 'add', x: 7, z: 7 }, { type: 'add', x: .8, z: 3 },
    { type: 'add', x: 14, z: SIZE }, { type: 'remove', x: 6, z: 7 },
    { type: 'recolor', x: 7, z: 7, palette: 99 },
    { type: 'recolor', x: 7, z: 7, palette: 0 }, { type: 'other', x: 7, z: 7 },
  ];
  assert.ok(bad.every(command => !world.edit(command).ok));
  assert.equal(world.revision, 1);
  assert.ok(world.edit({ type: 'recolor', x: 7, z: 7, palette: 3 }).ok);
  assert.equal(world.snapshot()[0].identity, initial[0].identity);
  assert.ok(world.edit({ type: 'remove', x: 7, z: 7 }).ok);
  assert.equal(world.size, 0);
  world.edit({ type: 'undo' });
  assert.equal(world.snapshot()[0].palette, 3);
  world.edit({ type: 'undo' });
  assert.deepEqual(world.snapshot(), initial);
  world.edit({ type: 'undo' });
  assert.equal(world.size, 0);
  assert.equal(world.canUndo, false);
});

test('the same public commands shape, close, recolor and reopen a courtyard', () => {
  const world = createWorld();
  const opened = add(world, u);
  assert.equal(opened.courts.length, 1);
  assert.equal(opened.courts[0].kind, 'open');
  assert.ok(opened.courts[0].cells.includes(cell(10, 10)));
  consistent(opened);
  const closed = add(world, [gate]);
  assert.equal(closed.courts[0].kind, 'enclosed');
  assert.equal(closed.courts[0].gateway.length, 1);
  assert.equal(closed.plots[cell(10, 10)].kind, 'court');
  consistent(closed);
  const before = closed.plots[cell(9, 9)];
  apply(world.edit, [[9, 9]], 'recolor', 2);
  const painted = derive(world);
  assert.equal(painted.plots[before.id].palette, 2);
  assert.deepEqual({ ...painted.plots[before.id], palette: before.palette }, before);
  assert.deepEqual(painted.courts, closed.courts);
  apply(world.edit, [gate], 'remove');
  const openedAgain = derive(world);
  assert.equal(openedAgain.courts[0].kind, 'open');
  assert.ok(!openedAgain.plots.some(plot => plot?.passages));
  assert.notEqual(plotSignature(openedAgain.plots[cell(11, 11)]), plotSignature(closed.plots[cell(11, 11)]));
  world.edit({ type: 'undo' });
  assert.deepEqual(derive(world).courts, painted.courts);
});

test('separate compounds coexist and remain deterministic when expanded, joined and separated', () => {
  function replay(reverse = false) {
    const world = createWorld();
    const first = [...u, gate];
    const distant = reverse ? [...compound].reverse() : compound;
    add(world, reverse ? [...distant, ...first.reverse()] : [...first, ...distant]);
    const separate = derive(world);
    assert.equal(separate.compounds.length, 2);
    assert.deepEqual(separate.courts.map(court => court.kind), ['enclosed', 'enclosed']);
    consistent(separate);
    const link = [];
    for (let x = 12; x <= 23; x++) link.push([x, 11]);
    for (let z = 12; z < 22; z++) link.push([23, z]);
    const connected = add(world, link, 1);
    assert.equal(connected.compounds.length, 1);
    consistent(connected);
    apply(world.edit, [[23, 15]], 'remove');
    assert.equal(derive(world).compounds.length, 2);
    return derive(world);
  }
  const first = replay(), repeated = replay(), reversed = replay(true);
  assert.deepEqual(first, repeated);
  assert.deepEqual(first.courts, reversed.courts);
  assert.deepEqual(first.plots.map(plotSignature), reversed.plots.map(plotSignature));
});

test('dense and irregular construction keeps rooms and enclosed outdoor space accessible', () => {
  const world = createWorld();
  const block = [];
  for (let z = 3; z < 19; z++) {
    for (let x = 5; x < 22; x++) {
      if ((x === 12 || x === 13) && z >= 9 && z <= 10) continue;
      if (x === 16 && z === 13) continue;
      block.push([x, z]);
    }
  }
  const dense = add(world, block);
  assert.equal(dense.courts.length, 2);
  assert.ok(dense.courts.every(court => court.gateway.length >= 4));
  consistent(dense);
  for (let attempt = 0; attempt < 38; attempt++) {
    const id = Math.floor(noise(attempt, 312) * COUNT);
    const x = id % SIZE, z = Math.floor(id / SIZE);
    world.edit({ type: world.get(id) ? 'remove' : 'add', x, z });
    consistent(derive(world));
  }
  const border = createWorld();
  const allButHole = Array.from({ length: COUNT }, (_, id) => [id % SIZE, Math.floor(id / SIZE)])
    .filter(([x, z]) => x !== 15 || z !== 15);
  consistent(add(border, allButHole));
});

test('gate and shared-wall openings survive actual mesh ray checks', () => {
  const world = createWorld();
  const model = add(world, [...u, gate]);
  const id = model.courts[0].gateway[0];
  const plot = model.plots[id];
  const cap = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const batch = buildArchitecture([plot], { solid: cap, roof: cap });
  batch.updateMatrixWorld(true);
  function fire(at, direction, length) {
    const ray = new T.Raycaster(new T.Vector3(...at), new T.Vector3(...direction), 0, length);
    return ray.intersectObject(batch, true);
  }
  const [x, z] = center(id);
  assert.equal(fire([x, 1.25, z - 2.3], [0, 0, 1], 4.6).length, 0, 'A person-sized route through both façades');
  assert.equal(fire([x + PASSAGE * .39, 1.7, z - 2.3], [0, 0, 1], 4.6).length, 0);
  assert.ok(fire([x + PASSAGE * .65, 1.25, z - 2.3], [0, 0, 1], 4.6).length > 0);
  assert.ok(fire([x, 2.76, z - 2.3], [0, 0, 1], 4.6).length > 0, 'Lintels remain over the actual openings');
  const main = model.plots[cell(10, 9)];
  const near = neighbors[main.id][1];
  assert.ok(main.walls[1].shared && !main.walls[1].opening && main.walls[1].neighbor === near);
  assert.equal(main.walls[2].opening, 'door');
  const house = buildArchitecture([main], { solid: cap, roof: cap });
  house.updateMatrixWorld(true);
  const [hx, hz] = center(main.id);
  const door = new T.Raycaster(new T.Vector3(hx + DOOR * .39, 1.3, hz + 2.4), new T.Vector3(0, 0, -1), 0, 1);
  assert.equal(door.intersectObject(house, true).length, 0);
  const partition = new T.Raycaster(new T.Vector3(hx + 1.5, 1.3, hz), new T.Vector3(1, 0, 0), 0, 1);
  assert.ok(partition.intersectObject(house, true).length > 0);
});
