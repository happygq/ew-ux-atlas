import { BAY, COUNT, cell, xOf, zOf, DX, DZ, neighbors, opposite } from './world.mjs';

export const FLOOR = .065;
export const EAVE = 3.18;
export const RIDGE = 4.58;
export const WALL = .2;
export const PASSAGE = 1.68;
export const DOOR = 1.16;
export const ROOM_AREA = (BAY - WALL) ** 2;
const sides = [0, 1, 2, 3];
const doorOrder = [2, 1, 0, 3];
const diagonalCells = Array.from({ length: COUNT }, (_, id) => sides.map(d => {
  const next = (d + 1) % 4;
  return cell(xOf(id) + DX[d] + DX[next], zOf(id) + DZ[d] + DZ[next]);
}));
const edgeKey = (id, d) => {
  const next = neighbors[id][d];
  return next !== -1 && next < id ? next * 4 + opposite(d) : id * 4 + d;
};

function flood(seeds, accepts, mark) {
  const queue = [...seeds];
  for (const seed of seeds) mark(seed);
  for (let head = 0; head < queue.length; head++) {
    for (const next of neighbors[queue[head]]) {
      if (next < 0 || !accepts(next)) continue;
      mark(next);
      queue.push(next);
    }
  }
  return queue;
}

// Every enclosed pocket gets a shortest connection to the public outdoors.
// The distance field is shared by all pockets and accepts existing passages.
function passageField(outside, built) {
  const parent = new Int16Array(COUNT).fill(-2);
  const distance = new Int16Array(COUNT).fill(-1);
  const queue = [];
  for (let id = 0; id < COUNT; id++) {
    if (!outside[id] && !neighbors[id].includes(-1)) continue;
    parent[id] = -1;
    distance[id] = built[id] ? 1 : 0;
    queue.push(id);
  }
  // Exterior cells are all distance zero. Insert the world-edge building seeds after them.
  queue.sort((a, b) => distance[a] - distance[b] || b - a);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const d of doorOrder) {
      const n = neighbors[id][d];
      if (n < 0 || distance[n] >= 0) continue;
      distance[n] = distance[id] + 1;
      parent[n] = id;
      queue.push(n);
    }
  }
  return { parent, distance };
}

function roofAxes(id, built) {
  const joined = neighbors[id].map(next => !!built[next]);
  const count = joined.filter(Boolean).length;
  const gable = [false, false, false, false];
  if (count === 0) gable[1] = gable[3] = true;
  if (count === 1) gable[opposite(joined.indexOf(true))] = true;
  // The full degree of an occupied plot determines its ridge arms.
  return { joined, gable, ridge: joined.map((value, d) => value || gable[d]) };
}

function openCourtCandidates(ids, built, outdoor, compoundOf) {
  const courts = new Map();
  function sight(id, direction) {
    let probe = id;
    for (let depth = 1; depth <= 7; depth++) {
      probe = neighbors[probe][direction];
      if (probe < 0) break;
      if (built[probe]) return { group: compoundOf[probe], depth };
    }
    return null;
  }
  for (const id of ids) {
    if (!outdoor[id]) continue;
    const hits = sides.map(d => sight(id, d));
    for (const mouth of sides) {
      const back = hits[opposite(mouth)];
      const left = hits[(mouth + 3) % 4];
      const right = hits[(mouth + 1) % 4];
      if (!back || !left || !right || hits[mouth]?.group === back.group) continue;
      if (left.group !== back.group || right.group !== back.group || left.depth + right.depth > 10) continue;
      courts.set(id, { group: back.group, mouth });
      break;
    }
  }
  return courts;
}

export function derive(world) {
  const rooms = world.snapshot();
  const built = new Uint8Array(COUNT);
  const compoundOf = new Int16Array(COUNT).fill(-1);
  const outdoor = new Uint8Array(COUNT);
  const courtOf = new Int16Array(COUNT).fill(-1);
  const passages = new Uint8Array(COUNT);
  const openings = new Map();
  const plots = Array(COUNT);
  const compounds = [];
  const courts = [];
  for (const room of rooms) built[room.id] = 1;

  for (const { id } of rooms) {
    if (compoundOf[id] !== -1) continue;
    const group = flood([id], n => built[n] && compoundOf[n] === -1, n => { compoundOf[n] = id; });
    compounds.push({ id, rooms: group });
  }

  const rim = [];
  for (let id = 0; id < COUNT; id++) {
    if (!built[id] && neighbors[id].includes(-1)) rim.push(id);
  }
  const outside = flood(rim, n => !built[n] && !outdoor[n], n => { outdoor[n] = 1; });

  function addCourt(ids, kind, mouth = null) {
    const id = Math.min(...ids);
    for (const n of ids) courtOf[n] = id;
    const boundaries = ids.flatMap(n => neighbors[n].filter(next => next >= 0 && built[next]));
    courts.push({ id, kind, cells: ids, compounds: [...new Set(boundaries.map(n => compoundOf[n]))], mouth, gateway: [] });
  }

  for (let id = 0; id < COUNT; id++) {
    if (built[id] || outdoor[id] || courtOf[id] >= 0) continue;
    const ids = flood([id], n => !built[n] && !outdoor[n] && courtOf[n] === -1, n => { courtOf[n] = id; });
    addCourt(ids, 'enclosed');
  }

  const open = openCourtCandidates(outside, built, outdoor, compoundOf);
  for (const [id, candidate] of open) {
    if (courtOf[id] !== -1) continue;
    const ids = flood([id], n => courtOf[n] === -1 && open.get(n)?.group === candidate.group,
      n => { courtOf[n] = id; });
    addCourt(ids, 'open', candidate.mouth);
  }

  if (courts.some(court => court.kind === 'enclosed')) {
    const { parent, distance } = passageField(outdoor, built);
    for (const court of courts.filter(court => court.kind === 'enclosed')) {
      const start = court.cells.reduce((best, n) => distance[n] < distance[best]
        || (distance[n] === distance[best] && n > best) ? n : best);
      for (let id = start; id >= 0 && !outdoor[id]; id = parent[id]) {
        const next = parent[id];
        if (!built[id] && !built[next]) continue;
        const d = next < 0 ? doorOrder.find(side => neighbors[id][side] === -1) : neighbors[id].indexOf(next);
        openings.set(edgeKey(id, d), 'passage');
        if (built[id]) {
          passages[id] |= 1 << d;
          court.gateway.push(id);
        }
        if (built[next]) passages[next] |= 1 << opposite(d);
      }
    }
  }

  // Give rooms an exterior threshold where possible. Core rooms borrow access
  // through one shared partition, using a multi-source breadth-first traversal.
  const reachable = new Uint8Array(COUNT);
  const queue = [];
  for (const { id } of rooms) {
    if (!passages[id]) {
      const exterior = doorOrder.filter(d => !built[neighbors[id][d]]);
      const door = exterior.find(d => courtOf[neighbors[id][d]] >= 0) ?? exterior[0];
      if (door === undefined) continue;
      openings.set(edgeKey(id, door), 'door');
    }
    queue.push(id);
    reachable[id] = 1;
  }
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const d of doorOrder) {
      const next = neighbors[id][d];
      if (!built[next] || reachable[next]) continue;
      reachable[next] = 1;
      openings.set(edgeKey(id, d), 'door');
      if (passages[id]) passages[id] |= 1 << d;
      queue.push(next);
    }
  }

  for (const room of rooms) {
    const id = room.id;
    const roof = roofAxes(id, built);
    const walls = sides.map(d => {
      const neighbor = neighbors[id][d];
      const shared = !!built[neighbor];
      const opening = openings.get(edgeKey(id, d));
      return { neighbor, shared, opening, owner: !shared || id < neighbor };
    });
    // The high corner of a 2×2 filled block removes the isolated rain trap
    // that four interior roof quadrants would otherwise form.
    const diagonals = diagonalCells[id].map(n => !!built[n]);
    const corners = diagonals.map((on, d) => on && roof.joined[d] && roof.joined[(d + 1) % 4] ? RIDGE : EAVE);
    // A north–south wing can retain a raised masonry firebreak where it joins
    // a turned roof. The joined slopes tuck into the wall at the same seam.
    if (roof.joined[0] && roof.joined[2] && !roof.joined[1] && !roof.joined[3]) {
      const north = neighbors[id][0];
      const [n, e, , w] = neighbors[north].map(adjacent => !!built[adjacent]);
      roof.firewall = !n && e !== w;
    }
    plots[id] = { ...room, kind: 'room', walls, roof, passages: passages[id], corners, diagonals, compound: compoundOf[id] };
  }
  for (let id = 0; id < COUNT; id++) {
    if (built[id]) continue;
    const arms = neighbors[id].reduce((mask, n, d) => mask | (built[n] ? 1 << d : 0), 0);
    const corners = diagonalCells[id].reduce((mask, n, d) => mask | (built[n] ? 1 << d : 0), 0);
    if (courtOf[id] >= 0) plots[id] = { id, kind: 'court' };
    else if (arms || corners) plots[id] = { id, kind: 'lane', arms, corners };
  }
  return { rooms, plots, courts, compounds, outside: outdoor };
}

// Used to verify actual shared openings all the way from the public grounds.
export function reachablePlots(model) {
  const visited = new Set();
  function step(id, d) {
    const n = neighbors[id][d];
    const here = model.plots[id]?.walls?.[d];
    const there = model.plots[n]?.walls?.[opposite(d)];
    return (!here || here.opening) && (!there || there.opening);
  }
  const seeds = neighbors.flatMap((sides, id) => sides.some((n, d) => n < 0 && step(id, d)) ? [id] : []);
  const queue = [...seeds];
  for (const id of seeds) visited.add(id);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const d of sides) {
      const next = neighbors[id][d];
      if (next < 0 || visited.has(next) || !step(id, d)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited;
}

export function plotSignature(plot) {
  if (!plot) return '';
  if (plot.kind === 'court') return 'court';
  if (plot.kind === 'lane') return `lane/${plot.arms}/${plot.corners}`;
  return JSON.stringify([plot.palette, plot.passages, plot.walls, plot.roof, plot.corners, plot.diagonals]);
}
