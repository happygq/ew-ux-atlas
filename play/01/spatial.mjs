import { BAY, COUNT, SIZE, DX, DZ, neighbors, opposite, xOf, zOf } from './world.mjs';

export const FLOOR = .12;
export const WALL = .26;
export const PASSAGE = 1.60;
export const DOOR = 1.12;
export const SETBACK = .76;
export const ROOM_AREA = (BAY - WALL * 2) ** 2;
const sides = [0, 1, 2, 3];
const doorOrder = [2, 1, 0, 3];
const order = d => doorOrder.indexOf(d);
const gableDirections = axis => axis === 0 ? [0, 2] : [1, 3];
const sections = {
  hall: { eave: 3.35, peak: 4.53 },
  room: { eave: 3.06, peak: 4.10 },
  wing: { eave: 2.75, peak: 3.70 },
  gate: { eave: 2.88, peak: 3.91 },
};

function flood(seeds, adjacent, accepts, mark) {
  const queue = [...seeds];
  for (const seed of seeds) mark(seed);
  for (let head = 0; head < queue.length; head++) {
    for (const next of adjacent(queue[head])) {
      if (next < 0 || !accepts(next)) continue;
      mark(next);
      queue.push(next);
    }
  }
  return queue;
}

function laneEnd(id, d) {
  const x = xOf(id), z = zOf(id), row = SIZE + 1;
  if (d === 0) return [z * row + x, z * row + x + 1];
  if (d === 1) return [z * row + x + 1, (z + 1) * row + x + 1];
  if (d === 2) return [(z + 1) * row + x, (z + 1) * row + x + 1];
  return [z * row + x, (z + 1) * row + x];
}

// A household edge is either a shared partition or an alley between two walls.
// Alley endpoints connect only where there is ground or another real alley.
function circulation(finish) {
  const edges = Array.from({ length: COUNT }, () => []);
  const rims = new Map();
  const seams = Array.from({ length: COUNT }, () => [false, false, false, false]);
  const vertices = new Map();
  const active = id => id < COUNT && finish[id] >= 0;
  function link(a, b, d = -1, e = -1) {
    edges[a].push({ to: b, d });
    edges[b].push({ to: a, d: e });
  }
  for (let id = 0; id < COUNT; id++) {
    for (const d of doorOrder) {
      const n = neighbors[id][d];
      if (n < 0) {
        if (!rims.has(id)) rims.set(id, d);
        continue;
      }
      if (n < id) continue;
      if (active(id) && active(n) && finish[id] !== finish[n]) {
        const lane = edges.push([]) - 1;
        seams[id][d] = seams[n][opposite(d)] = true;
        link(id, lane, d);
        link(n, lane, opposite(d));
        for (const end of laneEnd(id, d)) {
          if (!vertices.has(end)) vertices.set(end, []);
          vertices.get(end).push(lane);
        }
      } else link(id, n, d, opposite(d));
    }
  }
  for (const [vertex, lanes] of vertices) {
    const x = vertex % (SIZE + 1), z = Math.floor(vertex / (SIZE + 1));
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      if (x === 0 || z === 0 || x === SIZE || z === SIZE) rims.set(lane, -1);
      for (const dx of [-1, 0]) {
        for (const dz of [-1, 0]) {
          if (x + dx < 0 || z + dz < 0 || x + dx >= SIZE || z + dz >= SIZE) continue;
          const around = (z + dz) * SIZE + x + dx;
          if (!active(around)) link(lane, around);
        }
      }
      for (let j = i + 1; j < lanes.length; j++) link(lane, lanes[j]);
    }
  }
  return { edges, rims, seams };
}

function passageField(graph, outside, built) {
  const length = graph.edges.length;
  const parent = new Int32Array(length).fill(-2);
  const distance = new Int16Array(length).fill(-1);
  const queue = [];
  for (let id = 0; id < length; id++) {
    if (!outside[id] && !graph.rims.has(id)) continue;
    parent[id] = -1;
    distance[id] = built(id) ? 1 : 0;
    queue.push(id);
  }
  queue.sort((a, b) => distance[a] - distance[b] || Number(a >= COUNT) - Number(b >= COUNT) || b - a);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const { to } of graph.edges[id]) {
      if (distance[to] >= 0) continue;
      distance[to] = distance[id] + 1;
      parent[to] = id;
      queue.push(to);
    }
  }
  return { parent, distance };
}

function openCourtCandidates(outside, built, compoundOf) {
  const candidates = new Map();
  function sight(id, d) {
    let probe = id;
    for (let depth = 1; depth <= 6; depth++) {
      probe = neighbors[probe][d];
      if (probe < 0) break;
      if (built(probe)) return { group: compoundOf[probe], depth };
    }
    return null;
  }
  for (const id of outside) {
    if (id >= COUNT) continue;
    const hits = sides.map(d => sight(id, d));
    for (const mouth of doorOrder) {
      const back = hits[opposite(mouth)], left = hits[(mouth + 3) % 4], right = hits[(mouth + 1) % 4];
      if (!back || !left || !right || hits[mouth]?.group === back.group) continue;
      if (left.group !== back.group || right.group !== back.group || left.depth + right.depth > 8) continue;
      candidates.set(id, { group: back.group, mouth });
      break;
    }
  }
  return candidates;
}

const distances = (id, x, z) => Math.abs(xOf(id) - x) + Math.abs(zOf(id) - z);
function mean(ids) {
  const x = ids.reduce((sum, id) => sum + xOf(id), 0) / ids.length;
  const z = ids.reduce((sum, id) => sum + zOf(id), 0) / ids.length;
  return [x, z];
}

export function derive(world) {
  const rooms = world.snapshot();
  const finish = new Int8Array(COUNT).fill(-1);
  for (const room of rooms) finish[room.id] = room.palette;
  const built = id => id >= 0 && id < COUNT && finish[id] >= 0;
  const graph = circulation(finish);
  const compoundOf = new Int16Array(COUNT).fill(-1);
  const outdoor = new Uint8Array(graph.edges.length);
  const courtOf = new Int16Array(COUNT).fill(-1);
  const passages = new Uint8Array(COUNT);
  const openings = new Map();
  const courts = [], compounds = [];
  const courtById = new Map();
  const plots = Array(COUNT);
  const roomPlans = [];
  const accessNeighbors = id => graph.edges[id].map(edge => edge.to);
  const wallKey = (id, d) => {
    const n = neighbors[id][d];
    return built(n) && !graph.seams[id][d] && n < id ? n * 4 + opposite(d) : id * 4 + d;
  };
  const open = (id, d, kind) => openings.set(wallKey(id, d), kind);
  const has = (id, d) => openings.has(wallKey(id, d));

  for (const { id } of rooms) {
    if (compoundOf[id] >= 0) continue;
    const group = flood([id], n => neighbors[n], n => finish[n] === finish[id] && compoundOf[n] < 0,
      n => { compoundOf[n] = id; });
    compounds.push({ id, rooms: group, palette: finish[id] });
  }
  const allOutside = flood([...graph.rims.keys()].filter(id => !built(id)), accessNeighbors,
    n => !built(n) && !outdoor[n], n => { outdoor[n] = 1; });

  function addCourt(ids, kind, mouth) {
    const id = Math.min(...ids);
    const boundary = [];
    for (const n of ids) {
      courtOf[n] = id;
      for (const dir of sides) {
        const neighbor = neighbors[n][dir];
        if (built(neighbor)) boundary.push({ id: neighbor, ground: n, dir, face: opposite(dir) });
      }
    }
    const groups = [...new Set(boundary.map(edge => compoundOf[edge.id]))];
    const court = { id, kind, cells: ids, compounds: groups, mouth, gateway: [], boundary };
    if (groups.length === 1) {
      courts.push(court);
      courtById.set(id, court);
    }
    return court;
  }

  // Plan passages into sealed outdoor pockets and any isolated alleys.
  // One route can supply the next patio in a chain of inward-facing halls.
  const claimed = outdoor.slice();
  const unreachableGround = [];
  for (let id = 0; id < graph.edges.length; id++) {
    if (built(id) || claimed[id]) continue;
    unreachableGround.push(flood([id], accessNeighbors, n => !built(n) && !claimed[n], n => { claimed[n] = 1; }));
  }
  const sealed = unreachableGround.map(ground => {
    const cells = ground.filter(id => id < COUNT);
    return { ground, cells, court: cells.length ? addCourt(cells, 'enclosed', 2) : null };
  });
  const chainedHalls = new Map();
  for (const court of courts) {
    const [x, z] = mean(court.cells);
    const links = court.boundary
      .filter(edge => (edge.dir === 1 || edge.dir === 2) && !chainedHalls.has(edge.id))
      .map(edge => ({ edge, front: courtById.get(courtOf[neighbors[edge.id][edge.dir]]) }))
      .filter(({ front }) => front && front.id > court.id && front.compounds[0] === court.compounds[0]);
    links.sort((a, b) => order(a.edge.dir) - order(b.edge.dir)
      || distances(a.edge.id, x, z) - distances(b.edge.id, x, z));
    const link = links[0];
    if (!link) continue;
    const { edge, front } = link;
    court.mouth = edge.dir;
    court.fromCourt = front.id;
    court.linkHall = edge.id;
    chainedHalls.set(edge.id, edge.dir);
    open(edge.id, edge.dir, 'hall');
    open(edge.id, edge.face, 'hall');
  }
  if (unreachableGround.length) {
    const { parent, distance } = passageField(graph, outdoor, built);
    for (const { ground, cells, court } of sealed) {
      if (court?.fromCourt !== undefined) continue;
      const [x, z] = cells.length ? mean(cells) : [0, 0];
      const start = [...(cells.length ? cells : ground)].sort((a, b) => distance[a] - distance[b]
        || distances(a, x, z) - distances(b, x, z) || b - a)[0];
      const gateRooms = new Set();
      for (let id = start; id >= 0 && !outdoor[id]; id = parent[id]) {
        const next = parent[id];
        if (!built(id) && !built(next)) continue;
        if (built(id)) {
          const d = next < 0 ? graph.rims.get(id) : graph.edges[id].find(edge => edge.to === next).d;
          passages[id] |= 1 << d;
          open(id, d, 'passage');
          gateRooms.add(id);
        }
        if (built(next)) {
          const d = graph.edges[next].find(edge => edge.to === id).d;
          passages[next] |= 1 << d;
          open(next, d, 'passage');
          if (court && id === start) court.mouth = opposite(d);
          gateRooms.add(next);
        }
      }
      if (court) court.gateway = [...gateRooms];
    }
  }

  const candidates = openCourtCandidates(allOutside, built, compoundOf);
  for (const [id, choice] of candidates) {
    if (courtOf[id] >= 0) continue;
    const group = flood([id], n => neighbors[n], n => courtOf[n] < 0 && candidates.get(n)?.group === choice.group
      && candidates.get(n).mouth === choice.mouth, n => { courtOf[n] = id; });
    addCourt(group, 'open', choice.mouth);
  }

  const hallOf = new Map(chainedHalls);
  const wingOf = new Map();
  const towardCourt = new Set();
  for (const court of courts) {
    const front = court.mouth, back = opposite(front);
    const [x, z] = mean(court.cells);
    const transverse = edge => front % 2 === 0 ? Math.abs(xOf(edge.id) - x) : Math.abs(zOf(edge.id) - z);
    const boundary = court.boundary.filter(edge => !passages[edge.id]);
    const hall = boundary.filter(edge => edge.dir === back).sort((a, b) => transverse(a) - transverse(b) || a.id - b.id)[0];
    if (hall) {
      court.hall = hall.id;
      hallOf.set(hall.id, hall.face);
      open(hall.id, hall.face, 'hall');
    }
    for (const edge of court.boundary) {
      towardCourt.add(edge.id * 4 + edge.face);
      if (passages[edge.id] || edge === hall || edge.dir % 2 === front % 2) continue;
      if (!wingOf.has(edge.id)) wingOf.set(edge.id, edge.face);
      open(edge.id, edge.face, 'wing');
    }
  }

  // Prefer one public threshold and inward-facing openings per house. Reach
  // the rear and flank rooms through real doors in common partitions.
  const accessible = new Uint8Array(COUNT);
  for (const group of compounds) {
    const [x, z] = mean(group.rooms);
    const entries = group.rooms.flatMap(id => graph.edges[id]
      .filter(edge => !built(edge.to) && edge.d >= 0)
      .map(edge => ({ id, d: edge.d })));
    for (const id of group.rooms) {
      if (graph.rims.has(id)) entries.push({ id, d: graph.rims.get(id) });
    }
    const seed = group.rooms.filter(id => passages[id] || hallOf.has(id) || wingOf.has(id));
    if (!seed.length && entries.length) {
      const flanked = entry => gableDirections(1 - entry.d % 2)
        .every(dir => compoundOf[neighbors[entry.id][dir]] === group.id);
      const entry = entries.sort((a, b) => Number(flanked(b)) - Number(flanked(a))
        || order(a.d) - order(b.d) || distances(a.id, x, z) - distances(b.id, x, z) || a.id - b.id)[0];
      if (flanked(entry)) hallOf.set(entry.id, entry.d);
      open(entry.id, entry.d, 'door');
      seed.push(entry.id);
    }
    for (const id of seed) accessible[id] = 1;
    for (let i = 0; i < seed.length; i++) {
      const id = seed[i];
      for (const d of doorOrder) {
        const n = neighbors[id][d];
        if (!built(n) || compoundOf[n] !== group.id || accessible[n]) continue;
        if (!has(id, d)) open(id, d, 'door');
        if (passages[id]) passages[id] |= 1 << d;
        accessible[n] = 1;
        seed.push(n);
      }
    }
  }

  // A route can promote a preplanned hall into a passage bay. Its remaining
  // traversable faces still need clear arms through the interior shoulders.
  for (const { id } of rooms) {
    if (!passages[id]) continue;
    for (const d of sides) {
      if (!has(id, d)) continue;
      passages[id] |= 1 << d;
      if (openings.get(wallKey(id, d)) === 'hall') open(id, d, 'door');
    }
  }

  const axisOf = d => 1 - d % 2;
  for (const room of rooms) {
    const { id } = room;
    const joins = neighbors[id].map(n => built(n) && compoundOf[n] === compoundOf[id]);
    const gateFace = doorOrder.find(d => (passages[id] & (1 << d)) && !joins[d])
      ?? doorOrder.find(d => passages[id] & (1 << d));
    const entry = gateFace ?? hallOf.get(id) ?? wingOf.get(id);
    const role = passages[id] ? 'gate' : hallOf.has(id) ? 'hall' : wingOf.has(id) ? 'wing' : 'room';
    const axis = entry !== undefined ? axisOf(entry) : Number(Number(joins[1]) + Number(joins[3])
      >= Number(joins[0]) + Number(joins[2]));
    const insets = graph.seams[id].map(separated => separated ? SETBACK : 0);
    roomPlans[id] = { ...room, role, axis, insets, joins, section: sections[role], face: entry };
  }

  // The flanking bedrooms can share the raised main hall roof. Roof runs stop
  // at the next courtyard pavilion or at an independently owned property.
  for (const { id } of rooms) {
    const plan = roomPlans[id];
    if (plan.role !== 'room') continue;
    for (const d of doorOrder) {
      const next = roomPlans[neighbors[id][d]];
      if (!plan.joins[d] || next.role !== 'hall' || d % 2 !== next.axis) continue;
      plan.axis = next.axis;
      plan.section = next.section;
      break;
    }
  }
  for (const { id } of rooms) {
    const plan = roomPlans[id];
    const across = gableDirections(1 - plan.axis);
    const width = BAY - plan.insets[across[0]] - plan.insets[across[1]];
    const { eave, peak } = plan.section;
    plan.peak = eave + (peak - eave) * width / BAY;
  }
  for (const room of rooms) {
    const id = room.id;
    const { role, axis, joins, insets, section, peak, face } = roomPlans[id];
    const roofJoined = sides.map(d => {
      const next = roomPlans[neighbors[id][d]];
      return d % 2 === axis && joins[d] && next.axis === axis && next.section === section
        && insets.every((value, side) => side % 2 === axis || value === next.insets[side]);
    });
    const walls = sides.map(d => {
      const neighbor = neighbors[id][d];
      const prev = (d + 3) % 4, next = (d + 1) % 4;
      const across = roomPlans[neighbor]?.insets;
      return {
        neighbor,
        shared: joins[d],
        separated: graph.seams[id][d],
        owner: !joins[d] || id < neighbor,
        sharedSpan: joins[d] ? [
          -BAY / 2 + Math.max(insets[prev], across[prev]),
          BAY / 2 - Math.max(insets[next], across[next]),
        ] : undefined,
        opening: openings.get(wallKey(id, d)),
        court: towardCourt.has(id * 4 + d),
        lane: graph.seams[id][d],
      };
    });
    const ridge = sides.map(d => d % 2 === axis);
    const breaks = sides.map(d => {
      if (!joins[d] || roofJoined[d] || !ridge[d]) return false;
      const next = roomPlans[neighbors[id][d]];
      return next.axis !== axis || peak > next.peak || peak === next.peak && walls[d].owner;
    });
    plots[id] = {
      ...room, kind: 'room', role, axis, insets, face, walls,
      roof: { eave: section.eave, peak, joined: roofJoined, ridge, gable: ridge.map((on, d) => on && !joins[d]), break: breaks },
      passages: passages[id], compound: compoundOf[id],
    };
  }
  for (let id = 0; id < COUNT; id++) {
    if (built(id)) continue;
    const arms = neighbors[id].reduce((mask, n, d) => mask | (built(n) ? 1 << d : 0), 0);
    const court = courtById.get(courtOf[id]);
    if (court) {
      const galleryArms = neighbors[id].reduce((mask, n, d) =>
        mask | (plots[n]?.walls?.[opposite(d)].opening === 'wing' ? 1 << d : 0), 0);
      plots[id] = { id, kind: 'court', enclosed: court.kind === 'enclosed', axis: court.mouth % 2, arms, galleryArms, outlet: id === court.id };
    }
    else if (arms) plots[id] = { id, kind: 'lane', arms, corners: 0 };
  }
  return { rooms, plots, courts, compounds, outside: outdoor, circulation: graph };
}

export function reachablePlots(model) {
  const { edges, rims } = model.circulation;
  const allowed = (id, d) => !model.plots[id]?.walls || !!model.plots[id].walls[d]?.opening;
  const seeds = [...rims].filter(([id, d]) => allowed(id, d)).map(([id]) => id);
  const visited = new Set(seeds);
  for (let head = 0; head < seeds.length; head++) {
    const id = seeds[head];
    for (const { to, d } of edges[id]) {
      if (visited.has(to) || !allowed(id, d)) continue;
      if (!edges[to].some(back => back.to === id && allowed(to, back.d))) continue;
      visited.add(to);
      seeds.push(to);
    }
  }
  return visited;
}

export function plotSignature(plot) {
  if (!plot) return '';
  if (plot.kind === 'court') return `court/${plot.enclosed}/${plot.axis}/${plot.arms}/${plot.galleryArms}/${plot.outlet}`;
  if (plot.kind === 'lane') return `lane/${plot.arms}`;
  return JSON.stringify([plot.palette, plot.passages, plot.role, plot.face, plot.walls, plot.roof, plot.insets]);
}
