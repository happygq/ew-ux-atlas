import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../g1-m2/r2-vertical-v03-visual/vendor/three.module.min.js';
import { AREA, BAY, COUNT, DX, DZ, HALF, SIZE, atPoint, bankDistance, buildable, cell, center, createWorld, neighbors, opposite } from './world.mjs';
import { PASSAGE, ROOM_AREA, SETBACK, derive, plotSignature, reachablePlots } from './spatial.mjs';
import { buildArchitecture, gableProfile, noise, roofProfile } from './architecture.mjs';
import { WOOD } from './finishes.mjs';
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

test('975 connected five-metre plots cover 24,375 square metres within the irregular bank', () => {
  assert.equal(AREA, 24375);
  const valid = buildable.flatMap((allowed, id) => allowed ? [id] : []);
  assert.equal(valid.length * BAY ** 2, AREA);
  for (const id of valid) {
    const [x, z] = center(id);
    assert.equal(atPoint(x, z), id);
    for (const a of [-BAY / 2, BAY / 2]) {
      for (const b of [-BAY / 2, BAY / 2]) assert.ok(bankDistance(x + a, z + b) <= 0);
    }
  }
  const visit = new Set([valid[0]]);
  for (const id of visit) for (const n of neighbors[id]) if (n >= 0) visit.add(n);
  assert.equal(visit.size, valid.length);
  assert.equal(atPoint(-HALF, -HALF), -1);
  assert.equal(atPoint(HALF, 0), -1);
  assert.ok(ROOM_AREA >= 12 && ROOM_AREA <= 30);
  const world = createWorld();
  assert.equal(world.edit({ type: 'add', x: 0, z: 0 }).ok, false);
  const all = add(world, [[3, 3], [27, 25], [6, 30], [30, 8]]);
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
  assert.equal(opened.courts[0].form, 'ao');
  assert.ok(opened.courts[0].cells.includes(cell(10, 10)));
  assert.equal(opened.plots[cell(10, 9)].role, 'hall');
  assert.equal(opened.plots[cell(10, 9)].walls[2].opening, 'hall');
  assert.equal(opened.plots[cell(9, 10)].role, 'wing');
  assert.equal(opened.plots[cell(9, 10)].walls[1].opening, 'wing');
  consistent(opened);
  const closed = add(world, [gate]);
  assert.equal(closed.courts[0].kind, 'enclosed');
  assert.equal(closed.courts[0].form, 'hui');
  assert.equal(closed.courts[0].lowerHall, cell(...gate));
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
  assert.ok(model.courts.every(court => court.form === 'ri'));
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
  assert.equal(hall.splitHall.through, true);
  assert.equal(model.plots[rear.hall].upper.deck, 2.72, 'The rear hall can rise above the narrow two-entry sequence');
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
    .filter(([x, z]) => buildable[z * SIZE + x] && (x !== 15 || z !== 15));
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

function meshRay(plots) {
  const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
  const mesh = buildArchitecture(plots, { solid: material, roof: material });
  mesh.updateMatrixWorld(true);
  return (origin, direction, length) => new T.Raycaster(
    new T.Vector3(...origin), new T.Vector3(...direction), 0, length,
  ).intersectObject(mesh, true);
}

test('open courts have a physical fourth screen and back-to-back halls retain two separate entries', () => {
  const model = add(createWorld(), u);
  const frontage = model.plots[cell(...gate)];
  assert.deepEqual(frontage.screen, [{ side: 2, opening: true }]);
  assert.ok(model.plots[cell(10, 12)].forecourt, 'An open-court screen gate also leads to a public frontage');
  const cast = meshRay([frontage]);
  const [x, z] = center(frontage.id);
  assert.equal(cast([x, 1.3, z + 2.7], [0, 0, -1], .9).length, 0);
  assert.ok(cast([x + 1.3, 1.3, z + 2.7], [0, 0, -1], .9).length);
  const h = add(createWorld(), [[9, 9], [11, 9], [9, 10], [10, 10], [11, 10], [9, 11], [11, 11]]);
  assert.deepEqual(h.courts.map(court => court.form), ['h', 'h']);
  const hall = h.plots[cell(10, 10)];
  assert.equal(hall.splitHall.through, false);
  const [hx, hz] = center(hall.id);
  const inside = meshRay([hall]);
  assert.ok(inside([hx, 1.35, hz - 1], [0, 0, 1], 2).length, 'Timber backs divide the two hall fronts');
  assert.equal(inside([hx, 1.35, hz - 2.8], [0, 0, 1], .85).length, 0);
  assert.equal(inside([hx, 1.35, hz + 2.8], [0, 0, -1], .85).length, 0);
  consistent(h);
});

test('missing diagonal court corners close with masonry but leave the gateway usable', () => {
  const model = add(createWorld(), [...u.slice(1), gate]);
  const court = model.plots[cell(10, 10)];
  assert.equal(court.enclosed, true);
  assert.ok(court.cornerSeals.includes(3));
  const [x, z] = center(court.id);
  const cast = meshRay([court]);
  assert.ok(cast([x - 2.7, 1.3, z - 2.7], [Math.SQRT1_2, 0, Math.SQRT1_2], 1).length);
  consistent(model);
});

test('wide courts connect gallery canopies, drain downhill and have a stair-served upper hall', () => {
  const model = add(createWorld(), compound);
  const court = model.courts[0];
  const wings = [model.plots[cell(18, 19)], model.plots[cell(18, 20)]];
  const cast = meshRay(wings);
  const [wx, wz] = center(wings[0].id);
  for (const offset of [2.42, 2.5, 2.58]) {
    assert.ok(cast([wx + 3.20, 5, wz + offset], [0, -1, 0], 3).length, 'The cover spans the wing seam');
  }
  assert.equal(cast([wx + 4.6, 5, wz + 2.5], [0, -1, 0], 3).length, 0);
  const north = model.plots[cell(19, 18)];
  assert.ok(north.galleryCorners[2].some(Boolean) && wings[0].galleryCorners[1].some(Boolean));
  const turn = meshRay([north, wings[0]]);
  for (const offset of [.26, .35, .60]) {
    assert.ok(turn([wx + 2.85, 5, wz - 2.5 + offset], [0, -1, 0], 3).length, 'Miter shelters the corner');
  }
  assert.equal(turn([wx + 2.85, 1.6, wz - 2.1], [1, 0, 0], .70).length, 0);
  assert.equal(model.plots[court.drain].outlet, true);
  for (const id of court.cells) {
    const info = model.plots[id].drain;
    assert.ok(info.falls[info.direction] < 0);
    if (id !== court.drain) assert.ok(model.plots[neighbors[id][info.direction]].drain.level < info.level);
  }
  const outlet = model.plots[court.drain];
  const [ox, oz] = center(outlet.id);
  const outletMesh = meshRay([outlet]);
  const heightAt = dx => outletMesh([ox + dx, .12, oz + .67], [0, -1, 0], .18)[0]?.point.y;
  assert.ok(heightAt(.93) > heightAt(.21), 'The courtyard paving falls towards the open groove');
  const hall = model.plots[court.hall];
  assert.equal(hall.upper.deck, 2.72);
  const face = hall.upper.face;
  const [x, z] = center(hall.id);
  const at = (u, y, v) => [x - DZ[face] * u + DX[face] * v, y, z + DX[face] * u + DZ[face] * v];
  const loft = meshRay([hall]);
  assert.ok(loft(at(-1, 2.9, 0), [0, -1, 0], .30).length, 'Upper floor beside the stair opening');
  assert.equal(loft(at(1.38, 2.9, 0), [0, -1, 0], .30).length, 0, 'Stair void is open');
  const stair = loft(at(1.38, 2.54, 0), [0, -1, 0], 1.6);
  assert.ok(stair[0]?.point.y > 1.3 && stair[0]?.point.y < 1.8, 'There are physical treads under the opening');
  assert.equal(gableProfile(hall, 1).length, 7);
  assert.equal(gableProfile(wings[0], 0).length, 3);
  consistent(model);
});

test('a lower roof meets solid high-side masonry and no wall openings depend on global coordinates', () => {
  const block = [[9, 9], [10, 9], [11, 9], [9, 10], [10, 10], [11, 10]];
  const model = add(createWorld(), block);
  const hall = model.plots[cell(10, 10)];
  const low = model.plots[cell(10, 9)];
  assert.notEqual(hall.roof.eave, low.roof.eave);
  const [x, z] = center(low.id);
  const cast = meshRay([low, hall]);
  for (const [offset, direction] of [[2.14, 1], [2.86, -1]]) {
    assert.ok(cast([x, 3.20, z + offset], [0, 0, direction], .64).length, 'Shared closure is solid from either side');
  }
  assert.equal(gableProfile(hall, 1).length, 5);
  const first = [...u, gate];
  const moved = first.map(([x, z]) => [x + 1, z + 1]);
  const roles = (map, points) => points.map(([x, z]) => map.plots[cell(x, z)].walls
    .map(wall => [wall.opening, wall.window, wall.portal]));
  const windowPlan = roles(add(createWorld(), first), first);
  assert.deepEqual(roles(add(createWorld(), moved), moved), windowPlan);
  assert.ok(windowPlan.flat().every(([opening, window]) => !opening || !window));
});

test('swept entrance hood and projecting eaves preserve the gateway and joined roof', () => {
  const yard = add(createWorld(), [...u, gate]);
  const house = yard.plots[cell(...gate)];
  const [gx, gz] = center(house.id);
  const entrance = meshRay([house]);
  const hoodAt = offset => entrance([gx + offset, 4, gz + 2.84], [0, -1, 0], 1.3)[0]?.point.y;
  assert.ok(hoodAt(1.25) - hoodAt(0) > .10, 'The principal door hood has a real raised end');
  assert.equal(entrance([gx + .62, 1.74, gz - 2.8], [0, 0, 1], 5.6).length, 0);
  const row = add(createWorld(), [[7, 7], [8, 7], [9, 7]]);
  const [first, second] = row.rooms.map(room => row.plots[room.id]);
  const [x, z] = center(first.id);
  const roof = meshRay([first, second]);
  for (const off of [0, 2.67]) {
    const height = shift => roof([x + BAY / 2 + shift, 6, z + off], [0, -1, 0], 4)[0]?.point.y;
    const h = height(0);
    assert.ok(Number.isFinite(h) && Math.abs(height(-.001) - h) < .006 && Math.abs(height(.001) - h) < .006,
      'The ridge and projecting eave are continuous across room boundaries');
  }
  for (const off of [-.04, 0, .04]) {
    const face = roof([x + BAY / 2 + off, 1.55, z + 2.8], [0, 0, -1], .34);
    assert.ok(face.length > 0);
    assert.ok(face.every(hit => hit.object.geometry.getAttribute('finishKind').getX(hit.face.a) !== WOOD),
      'Interior timber stays behind the continuous external plaster skin');
  }
});

test('independent homes link their forecourts and retain measurable compact annex space', () => {
  const world = createWorld();
  add(world, [[8, 8]]);
  const village = add(world, [[11, 8]], 1);
  assert.equal(village.compounds.length, 2);
  assert.ok(village.plots[cell(8, 9)].forecourt);
  assert.ok(village.plots[cell(11, 9)].forecourt);
  for (const x of [9, 10]) assert.equal(village.plots[cell(x, 9)].road, 10);
  const courts = createWorld();
  add(courts, u);
  const street = add(courts, u.map(([x, z]) => [x + 6, z]), 2);
  assert.equal(street.compounds.length, 2);
  assert.ok(street.plots[cell(10, 12)].forecourt && street.plots[cell(16, 12)].forecourt);
  for (let x = 11; x <= 15; x++) assert.equal(street.plots[cell(x, 12)].road, 10);
  const dense = createWorld();
  add(dense, [[10, 10]]);
  const plan = add(dense, [[10, 9], [9, 10], [11, 10], [10, 11]], 1);
  assert.equal(plan.compounds.length, 5);
  const { width, depth, area, use } = plan.plots[cell(10, 10)].clearSpace;
  assert.ok(Math.abs(width - 2.96) < .001 && Math.abs(depth - 2.96) < .001);
  assert.ok(Math.abs(area - 8.7616) < .001);
  assert.equal(use, 'annex');
  consistent(plan);
});
