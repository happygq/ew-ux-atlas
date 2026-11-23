import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../g1-m2/r2-vertical-v03-visual/vendor/three.module.min.js';
import { AREA, BAY, COUNT, HALF, SIZE, atPoint, cell, center, createWorld, neighbors, opposite } from './world.mjs';
import { PASSAGE, ROOM_AREA, SETBACK, derive, plotSignature, reachablePlots } from './spatial.mjs';
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
      if (side.separated) {
        assert.ok(side.owner && !side.shared && !room.roof.joined[d]);
        assert.equal(room.insets[d], SETBACK);
        assert.notEqual(room.compound, model.plots[side.neighbor].compound);
      }
      if (!side.shared) continue;
      const other = model.plots[side.neighbor];
      const back = other.walls[opposite(d)];
      assert.equal(back.opening, side.opening);
      assert.notEqual(back.owner, side.owner);
      assert.equal(room.roof.joined[d], other.roof.joined[opposite(d)]);
      if (!room.roof.joined[d]) continue;
      const a = roofProfile(room), b = roofProfile(other), oppositeSide = opposite(d);
      assert.deepEqual(a.edge[d], b.edge[oppositeSide], `Ridge seam ${id}/${side.neighbor}`);
      assert.deepEqual(a.corner[d], b.corner[(oppositeSide + 3) % 4], `First corner of seam ${id}/${side.neighbor}`);
      assert.deepEqual(a.corner[(d + 3) % 4], b.corner[oppositeSide], `Second corner of seam ${id}/${side.neighbor}`);
    }
  }
  for (const court of model.courts) {
    assert.ok(court.cells.every(id => reachable.has(id)));
    if (court.kind === 'enclosed') assert.ok(court.gateway.length > 0 || court.fromCourt !== undefined);
  }
}

test('576 five-metre plots cover 14,400 square metres and can be used shore to shore', () => {
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
    { type: 'add', x: 8, z: 7, palette: 99 }, { type: 'other', x: 7, z: 7 },
  ];
  assert.ok(bad.every(command => !world.edit(command).ok));
  assert.equal(world.revision, 1);
  assert.ok(world.edit({ type: 'add', x: 8, z: 7, palette: 3 }).ok);
  assert.ok(world.edit({ type: 'remove', x: 7, z: 7 }).ok);
  assert.equal(world.size, 1);
  world.edit({ type: 'undo' });
  assert.deepEqual(world.snapshot()[0], initial[0]);
  assert.equal(world.snapshot()[1].palette, 3);
  world.edit({ type: 'undo' });
  assert.deepEqual(world.snapshot(), initial);
  world.edit({ type: 'undo' });
  assert.equal(world.size, 0);
  assert.equal(world.canUndo, false);
});

test('ordinary Add forms inward-facing halls and galleries, then an axial gate', () => {
  const world = createWorld();
  const opened = add(world, u);
  assert.equal(opened.courts.length, 1);
  assert.equal(opened.courts[0].kind, 'open');
  assert.ok(opened.courts[0].cells.includes(cell(10, 10)));
  assert.equal(opened.plots[cell(10, 9)].role, 'hall');
  assert.equal(opened.plots[cell(10, 9)].walls[2].opening, 'hall');
  assert.equal(opened.plots[cell(9, 10)].role, 'wing');
  assert.equal(opened.plots[cell(9, 10)].walls[1].opening, 'wing');
  consistent(opened);
  const closed = add(world, [gate]);
  assert.equal(closed.courts[0].kind, 'enclosed');
  assert.equal(closed.courts[0].gateway.length, 1);
  assert.equal(closed.plots[cell(10, 10)].kind, 'court');
  consistent(closed);
  assert.equal(closed.plots[cell(...gate)].role, 'gate');
  assert.equal(closed.plots[cell(...gate)].walls[2].opening, 'passage');
  assert.equal(closed.plots[cell(...gate)].walls[0].opening, 'passage');
  apply(world.edit, [gate], 'remove');
  const openedAgain = derive(world);
  assert.equal(openedAgain.courts[0].kind, 'open');
  assert.ok(!openedAgain.plots.some(plot => plot?.passages));
  assert.equal(openedAgain.plots[cell(...gate)].kind, 'court');
  assert.equal(openedAgain.plots[cell(...gate)].enclosed, false);
  world.edit({ type: 'undo' });
  assert.deepEqual(derive(world).courts, closed.courts);
});

test('a three-bay row can have a raised central hall on either axis', () => {
  for (const [points, axis] of [
    [[[7, 7], [8, 7], [9, 7]], 1],
    [[[7, 7], [7, 8], [7, 9]], 0],
  ]) {
    const model = add(createWorld(), points);
    const center = model.plots[cell(...points[1])];
    assert.equal(center.role, 'hall');
    assert.equal(center.axis, axis);
    assert.equal(center.roof.joined.filter(Boolean).length, 2);
    consistent(model);
  }
});

test('two aligned skywells share an interior hall and enter from the front court', () => {
  const world = createWorld();
  const rooms = [];
  for (let z = 12; z <= 16; z++) {
    for (let x = 16; x <= 18; x++) {
      if (x !== 17 || z !== 13 && z !== 15) rooms.push([x, z]);
    }
  }
  const model = add(world, rooms);
  assert.equal(model.courts.length, 2);
  const rear = model.courts.find(court => court.id === cell(17, 13));
  const front = model.courts.find(court => court.id === cell(17, 15));
  const hall = model.plots[cell(17, 14)];
  assert.equal(rear.fromCourt, front.id);
  assert.deepEqual(front.gateway, [cell(17, 16)]);
  assert.equal(rear.linkHall, hall.id);
  assert.equal(hall.role, 'hall');
  assert.equal(hall.walls[0].opening, 'hall');
  assert.equal(hall.walls[2].opening, 'hall');
  assert.equal(hall.roof.joined[0], false);
  consistent(model);
});

test('different selected finishes create independent households with a clear alley', () => {
  const world = createWorld();
  add(world, [[8, 9], [9, 9]]);
  const huts = add(world, [[10, 9], [10, 10]], 2);
  const a = huts.plots[cell(9, 9)], b = huts.plots[cell(10, 9)];
  assert.equal(huts.compounds.length, 2);
  assert.ok(a.walls[1].separated && b.walls[3].separated);
  assert.ok(a.walls[1].owner && b.walls[3].owner);
  assert.equal(a.roof.joined[1], false);
  assert.equal(b.roof.joined[3], false);
  assert.ok(a.insets[1] + b.insets[3] >= 1.5);
  consistent(huts);
  world.edit({ type: 'undo' });
  world.edit({ type: 'undo' });
  assert.equal(derive(world).compounds.length, 1);
  const extension = add(world, [[10, 9]]);
  assert.equal(extension.compounds.length, 1);
  assert.ok(extension.plots[cell(9, 9)].walls[1].shared);
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
    for (let x = 12; x <= 18; x++) link.push([x, 11]);
    for (let z = 12; z < 18; z++) link.push([18, z]);
    const connected = add(world, link, 0);
    assert.equal(connected.compounds.length, 1);
    consistent(connected);
    apply(world.edit, [[18, 15]], 'remove');
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
    world.edit({ type: world.get(id) ? 'remove' : 'add', x, z, palette: attempt % 4 });
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
  const outside = z - BAY / 2 - .3;
  assert.equal(fire([x, 1.25, outside], [0, 0, 1], BAY + .6).length, 0, 'A person-sized route through both façades');
  assert.equal(fire([x + PASSAGE * .39, 1.7, outside], [0, 0, 1], BAY + .6).length, 0);
  assert.ok(fire([x + PASSAGE * .65, 1.25, outside], [0, 0, 1], BAY + .6).length > 0);
  assert.ok(fire([x, 2.76, outside], [0, 0, 1], BAY + .6).length > 0, 'Lintels remain over the actual openings');
  const main = model.plots[cell(10, 9)];
  const near = neighbors[main.id][1];
  assert.ok(main.walls[1].shared && main.walls[1].neighbor === near);
  assert.equal(main.walls[2].opening, 'hall');
  const house = buildArchitecture([main], { solid: cap, roof: cap });
  house.updateMatrixWorld(true);
  const [hx, hz] = center(main.id);
  const door = new T.Raycaster(new T.Vector3(hx + .44, 1.3, hz + BAY / 2 + .4), new T.Vector3(0, 0, -1), 0, 1.2);
  assert.equal(door.intersectObject(house, true).length, 0);
  const partition = new T.Raycaster(new T.Vector3(hx + BAY / 2 - .5, 1.3, hz + 1.1), new T.Vector3(1, 0, 0), 0, 1);
  assert.ok(partition.intersectObject(house, true).length > 0);
});

test('different-color footprints leave an actual clear alley between house walls', () => {
  const world = createWorld();
  add(world, [[7, 7]], 0);
  const model = add(world, [[8, 7]], 1);
  const first = model.plots[cell(7, 7)], second = model.plots[cell(8, 7)];
  const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const buildings = buildArchitecture([first, second], { solid: material, roof: material });
  buildings.updateMatrixWorld(true);
  const [x, z] = center(first.id);
  for (const offset of [-.71, 0, .71]) {
    const line = new T.Raycaster(new T.Vector3(x + BAY / 2 + offset, 1.4, z - BAY / 2 - .12),
      new T.Vector3(0, 0, 1), 0, BAY + .24);
    assert.equal(line.intersectObject(buildings, true).length, 0, 'Walking height is clear along the alley');
  }
  assert.ok(Math.abs(roofProfile(second).edge[3][0] - roofProfile(first).edge[1][0] - SETBACK * 2) < .001);
});

test('a routed hall keeps every opening connected to its passage interior', () => {
  const world = createWorld();
  const model = add(world, [
    [11, 10], [12, 10], [13, 10], [11, 11], [13, 11], [14, 11], [15, 11], [11, 12],
    [13, 12], [15, 12], [11, 13], [12, 13], [14, 13], [15, 13], [14, 14],
  ]);
  consistent(model);
  const gate = model.plots[cell(13, 12)];
  assert.ok(gate.passages & (1 << 3));
  const mat = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const mesh = buildArchitecture([gate], { solid: mat, roof: mat });
  mesh.updateMatrixWorld(true);
  const [x, z] = center(gate.id);
  const ray = new T.Raycaster(new T.Vector3(x - BAY / 2 - .3, 1.3, z), new T.Vector3(1, 0, 0), 0, BAY / 2 + .35);
  assert.equal(ray.intersectObject(mesh, true).length, 0);
});

test('a wider same-house bay closes its wall where the neighbor steps back', () => {
  const world = createWorld();
  add(world, [[10, 10], [10, 11]]);
  const model = add(world, [[9, 10]], 2);
  const a = model.plots[cell(10, 10)], b = model.plots[cell(10, 11)];
  const mat = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const mesh = buildArchitecture([a, b], { solid: mat, roof: mat });
  mesh.updateMatrixWorld(true);
  const [x, z] = center(a.id);
  const point = new T.Vector3(x - BAY / 2 + .34, 1.3, z + BAY / 2 - .42);
  const ray = new T.Raycaster(point, new T.Vector3(0, 0, 1), 0, 1.15);
  assert.ok(ray.intersectObject(mesh, true).length > 0);
});

test('the wings roof their galleries while leaving the center of the skywell open', () => {
  const model = add(createWorld(), [...u, gate]);
  const mat = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const mesh = buildArchitecture(model.plots.filter(Boolean), { solid: mat, roof: mat });
  mesh.updateMatrixWorld(true);
  const [x, z] = center(model.courts[0].cells[0]);
  function down(offset) {
    return new T.Raycaster(new T.Vector3(x + offset, 6, z), new T.Vector3(0, -1, 0), 0, 4)
      .intersectObject(mesh, true);
  }
  assert.equal(down(0).length, 0);
  assert.ok(down(-BAY / 2 + .6).length > 0);
  assert.ok(down(BAY / 2 - .6).length > 0);
});
