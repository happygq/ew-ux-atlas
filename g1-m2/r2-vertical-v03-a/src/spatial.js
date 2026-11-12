import { cellKey, compare } from './policy.js';

export const SKY_EXTERIOR = 'SKY_EXTERIOR';
export const OUTSIDE_WORLD = 'OUTSIDE_WORLD';
const GROUND = 'GROUND';
// Each cell is four 2×2 prisms in integer lattice units; y is an integer level.
const TILE = 2;
const SUBDIVISIONS = 2;
const point = (x, z, y) => `${y}:${z}:${x}`;
const axes = ['x', 'y', 'z'];
const step = { x: TILE, y: 1, z: TILE };

function atomsFor(config, cells, spaces) {
  const scopes = new Map(spaces.flatMap(s => s.footprint.map(p => [cellKey(p.x, p.z, 0), s])));
  const atoms = new Map();
  for (let y = 0; y < config.levels; y++) {
    for (let z = 0; z < config.depth * SUBDIVISIONS; z++) {
      for (let x = 0; x < config.width * SUBDIVISIONS; x++) {
        const cx = Math.floor(x / SUBDIVISIONS), cz = Math.floor(z / SUBDIVISIONS);
        const gridKey = cellKey(cx, cz, y);
        const cell = cells.get(gridKey);
        const scope = scopes.get(cellKey(cx, cz, 0));
        const lane = z % SUBDIVISIONS * SUBDIVISIONS + x % SUBDIVISIONS;
        const unitId = cell?.unitId ?? null;
        const enclosureId = cell?.generatedSupport ? null : unitId;
        atoms.set(point(x, z, y), {
          x, y, z, cx, cz, lane, gridKey, unitId, enclosureId,
          id: `volume:${point(x, z, y)}:${unitId ?? 'vacant'}`,
          material: cell && lane === 0 ? 'SOLID' : enclosureId && lane === 1 ? 'RESERVED_VOID' : 'AIR',
          scope: scope && y >= scope.bottomLevel && y <= scope.topLevel ? scope : null,
        });
      }
    }
  }
  return atoms;
}

function face(axis, negative, positive) {
  const anchor = negative ?? positive;
  const [u, v] = axes.filter(a => a !== axis);
  return {
    axis, plane: (anchor[axis] + Number(Boolean(negative))) * step[axis],
    u0: anchor[u] * step[u], u1: (anchor[u] + 1) * step[u],
    v0: anchor[v] * step[v], v1: (anchor[v] + 1) * step[v],
  };
}

function interfaceRule(axis, low, high) {
  const inside = low ?? high;
  const blocksAir = (low && low.material !== 'AIR') || (high && high.material !== 'AIR');
  const openOrSolid = [blocksAir ? 'SPECIAL' : 'OPEN_INTERFACE', inside.id];
  if (axis === 'y') {
    if (!low) return ['GROUND', GROUND];
    const scope = low.scope;
    if (scope && high?.scope === scope && scope.spaceIntent === 'SEPARATE_FLOORS') {
      return ['SLAB', scope.decisionId];
    }
    if (scope && low.y === scope.topLevel) {
      const first = scope.footprint[0];
      const aperture = low.cx === first.x && low.cz === first.z && low.lane === 0;
      if (scope.roofClosure === 'COVERED_TRANSLUCENT') return ['ROOF', scope.decisionId, 'POTENTIAL'];
      if (scope.roofClosure === 'COVERED_OPAQUE' ||
          (scope.roofClosure === 'PARTIAL_COVER' && !aperture)) return ['ROOF', scope.decisionId];
      return openOrSolid;
    }
    if (high?.enclosureId) return ['SLAB', high.enclosureId];
    if (low.enclosureId) return ['ROOF', low.enclosureId];
    return openOrSolid;
  }
  if (low?.enclosureId !== high?.enclosureId && (low?.enclosureId || high?.enclosureId)) {
    return ['WALL', low?.enclosureId ?? high.enclosureId];
  }
  return openOrSolid;
}

function boundaryProjection(atoms, previous) {
  const prior = new Map(previous.boundaryPatches.map(p => [p.faceKey, p]));
  let next = previous.nextIds.patch;
  const patches = [];
  const links = new Map();
  const above = new Map();
  const daylight = new Set();
  const atmospheres = new Map();
  const add = (axis, low, high) => {
    const bounds = face(axis, low, high);
    const { plane, u0, u1, v0, v1 } = bounds;
    const faceKey = `${axis}:${plane}:${u0}:${u1}:${v0}:${v1}`;
    const [kind, owner, daylightProxy = 'NONE'] = interfaceRule(axis, low, high);
    const airOpen = kind === 'OPEN_INTERFACE';
    const sides = [
      low?.id ?? (axis === 'y' ? GROUND : OUTSIDE_WORLD),
      high?.id ?? (axis === 'y' ? SKY_EXTERIOR : OUTSIDE_WORLD),
    ];
    const old = prior.get(faceKey);
    const unchanged = old && old.sides.every((id, i) => id === sides[i]) &&
      old.kind === kind && old.owner === owner && old.daylightProxy === daylightProxy;
    patches.push({
      id: unchanged ? old.id : `patch:${next++}`, faceKey, bounds, sides, owner, kind,
      airOpen, daylightProxy, humanOpeningIntent: null,
      realizationEvidence: 'UNREALIZED', physicalPassable: false,
    });
    if (daylightProxy === 'POTENTIAL') daylight.add(low.id);
    if (!airOpen) return;
    if (low && high) {
      for (const [a, b] of [[low.id, high.id], [high.id, low.id]]) {
        if (!links.has(a)) links.set(a, []);
        links.get(a).push(b);
      }
    } else {
      const id = (low ?? high).id;
      atmospheres.set(id, (atmospheres.get(id) ?? 0) | (axis === 'y' ? 1 : 2));
    }
    if (axis === 'y') above.set(low.id, sides[1]);
  };
  for (const atom of atoms.values()) for (const axis of axes) {
    const { x, z, y } = atom;
    if (atom[axis] === 0) add(axis, null, atom);
    add(axis, atom, atoms.get(point(x + Number(axis === 'x'), z + Number(axis === 'z'),
      y + Number(axis === 'y'))));
  }
  return { patches, next, links, above, daylight, atmospheres };
}

function components(ids, links, allows = () => true) {
  const order = new Map(ids.map((id, index) => [id, index]));
  const seen = new Set();
  const result = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const members = [id];
    seen.add(id);
    for (const a of members) for (const b of links.get(a) ?? []) {
      if (!order.has(b) || seen.has(b) || !allows(a, b)) continue;
      members.push(b);
      seen.add(b);
    }
    members.sort((a, b) => order.get(a) - order.get(b));
    result.push(members);
  }
  return result;
}

// Each old region nominates one successor. The earliest-created nominee wins a
// merge; a new child records its source without ever reusing a retired ID.
function reconcile(groups, prior, prefix, next) {
  const overlap = groups.map(() => []);
  const nominations = groups.map(() => []);
  const membership = new Map(groups.flatMap((group, i) => group.map(id => [id, i])));
  const retired = [];
  for (const old of [...prior].sort((a, b) => a.ordinal - b.ordinal)) {
    const counts = new Map();
    for (const id of old.members) if (membership.has(id)) {
      const i = membership.get(id);
      counts.set(i, (counts.get(i) ?? 0) + 1);
    }
    if (!counts.size) {
      retired.push({ id: old.id, mergedInto: null });
      continue;
    }
    for (const i of counts.keys()) overlap[i].push(old);
    const i = membership.get(old.originAnchor) ??
      [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a - b)[0];
    nominations[i].push(old);
  }
  const regions = groups.map((members, i) => {
    const [winner, ...merged] = nominations[i];
    const ordinal = winner?.ordinal ?? next++;
    const id = `${prefix}:${ordinal}`;
    for (const loser of merged) retired.push({ id: loser.id, mergedInto: id });
    return {
      id, ordinal, members,
      originAnchor: winner && membership.get(winner.originAnchor) === i ? winner.originAnchor : members[0],
      splitFrom: winner ? winner.splitFrom : overlap[i][0]?.id ?? null,
    };
  });
  return { regions, next, retired: retired.sort((a, b) => compare(a.id, b.id)) };
}

export function projectSpatial(config, cells, spaces, previous) {
  const atoms = atomsFor(config, cells, spaces);
  const { patches, next, links, above, daylight, atmospheres } = boundaryProjection(atoms, previous);
  const byId = new Map([...atoms.values()].map(atom => [atom.id, atom]));
  const airIds = [...byId.values()].filter(a => a.material === 'AIR').map(a => a.id);
  const airGroups = components(airIds, links);
  const airFacts = new Map();
  const direct = new Set();
  for (const id of [...airIds].reverse()) {
    const upper = above.get(id);
    if (upper === SKY_EXTERIOR || direct.has(upper)) direct.add(id);
    if (daylight.has(upper)) daylight.add(id);
  }
  const atmos = airGroups.map(group => {
    const mask = group.reduce((acc, id) => acc | (atmospheres.get(id) ?? 0), 0);
    const atmosphere = { airConnectedSky: Boolean(mask & 1), outsideConnected: Boolean(mask & 2) };
    for (const id of group) airFacts.set(id, atmosphere);
    return atmosphere;
  });
  const indoor = airIds.filter(id => !airFacts.get(id).airConnectedSky && !airFacts.get(id).outsideConnected);
  const spaceKey = id => {
    const { scope, unitId, y } = byId.get(id);
    return scope ? `${scope.decisionId}:${scope.spaceIntent === 'SEPARATE_FLOORS' ? y : 'all'}` : unitId;
  };
  const spaceGroups = components(indoor, links, (a, b) => spaceKey(a) === spaceKey(b));
  const voids = reconcile(airGroups, previous.voidRegions, 'void-region', previous.nextIds.void);
  const rooms = reconcile(spaceGroups, previous.spaceRegions, 'space-region', previous.nextIds.space);
  return {
    volumeFragments: [...atoms.values()].map(a => {
      const air = airFacts.get(a.id);
      return {
        id: a.id, gridKey: a.gridKey, unitId: a.unitId,
        bounds: { x0: a.x * TILE, x1: (a.x + 1) * TILE, z0: a.z * TILE, z1: (a.z + 1) * TILE,
          y0: a.y, y1: a.y + 1 },
        kind: air ? air.airConnectedSky || air.outsideConnected ? 'EXTERIOR_AIR' : 'INTERIOR_AIR' : a.material,
        directSky: direct.has(a.id), airConnectedSky: air?.airConnectedSky ?? false,
        outsideConnected: air?.outsideConnected ?? false, daylightProxy: daylight.has(a.id) ? 'POTENTIAL' : 'NONE',
      };
    }),
    boundaryPatches: patches,
    voidRegions: voids.regions.map((r, i) => ({
      ...r, ...atmos[i], directSky: r.members.every(id => direct.has(id)) ? 'ALL' :
        r.members.some(id => direct.has(id)) ? 'SOME' : 'NONE',
    })),
    spaceRegions: rooms.regions.map(r => {
      const scope = byId.get(r.originAnchor).scope;
      return {
        ...r, scopeId: scope?.scopeId ?? null,
        spaceIntent: scope?.spaceIntent ?? null,
        spaceUse: scope ? 'ROOM' : 'UNKNOWN',
      };
    }),
    nextIds: { ...previous.nextIds, patch: next, void: voids.next, space: rooms.next },
    retiredRegions: [...voids.retired, ...rooms.retired],
  };
}

// A bounded human opening is a read-only probe on a closed host. It cannot
// change that patch, open air, or add a Passage edge.
export function probeSlabOpening(snapshot, hostPatchId, rectangle) {
  const host = snapshot.boundaryPatches.find(p => p.id === hostPatchId);
  if (host?.kind !== 'SLAB' || !rectangle) return null;
  const air = new Set(snapshot.volumeFragments.filter(f => f.kind.endsWith('_AIR')).map(f => f.id));
  if (!host.sides.every(id => air.has(id))) return null;
  const { u0, u1, v0, v1 } = rectangle;
  const b = host.bounds;
  if (![u0, u1, v0, v1].every(Number.isSafeInteger) ||
      !(b.u0 <= u0 && u0 < u1 && u1 <= b.u1 && b.v0 <= v0 && v0 < v1 && v1 <= b.v1) ||
      (u0 === b.u0 && u1 === b.u1 && v0 === b.v0 && v1 === b.v1)) return null;
  return {
    hostPatchId, sides: [...host.sides], bounds: { u0, u1, v0, v1 },
    status: 'UNREALIZED', abstractRouteAuthorized: false, physicalPassable: false,
  };
}
