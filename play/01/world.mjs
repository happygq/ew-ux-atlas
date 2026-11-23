export const SIZE = 36;
export const BAY = 5;
export const HALF = SIZE * BAY / 2;
export const COUNT = SIZE ** 2;
// N, E, S, W in world coordinates. One world unit is one metre.
export const DX = [0, 1, 0, -1];
export const DZ = [-1, 0, 1, 0];
export const opposite = direction => (direction + 2) % 4;
export const xOf = id => id % SIZE;
export const zOf = id => Math.floor(id / SIZE);

const bankStations = [
  [0, 8], [2, 3], [7, 1], [15, 0], [23, 1], [30, 4], [34, 5], [36, 11],
  [35, 18], [33, 20], [32, 24], [35, 28], [33, 32], [28, 36], [22, 34],
  [16, 35], [12, 32], [7, 35], [3, 32], [1, 25], [2, 19], [0, 15],
];
export const outline = bankStations.map(([x, z]) => [x * BAY - HALF, z * BAY - HALF]);
const bank = outline.map(([x, z], i) => {
  const [endX, endZ] = outline[(i + 1) % outline.length];
  const dx = endX - x, dz = endZ - z;
  return { x, z, dx, dz, endZ, lengthSquared: dx * dx + dz * dz };
});

// Signed distance in metres, negative on the dry side of the bank.
export function bankDistance(x, z) {
  let squared = Infinity;
  let dry = false;
  for (const edge of bank) {
    const ox = x - edge.x, oz = z - edge.z;
    const t = Math.min(1, Math.max(0, (ox * edge.dx + oz * edge.dz) / edge.lengthSquared));
    squared = Math.min(squared, (ox - t * edge.dx) ** 2 + (oz - t * edge.dz) ** 2);
    if ((edge.z > z) !== (edge.endZ > z) && ox < edge.dx * oz / edge.dz) dry = !dry;
  }
  return Math.sqrt(squared) * (dry ? -1 : 1);
}

export const center = id => [(xOf(id) + .5) * BAY - HALF, (zOf(id) + .5) * BAY - HALF];
export const buildable = Array.from({ length: COUNT }, (_, id) => {
  // Every point of a playable square lies on level, dry land.
  return bankDistance(...center(id)) <= -BAY * Math.SQRT1_2;
});
export const AREA = buildable.filter(Boolean).length * BAY ** 2;
export const inside = (x, z) => Number.isInteger(x) && Number.isInteger(z)
  && x >= 0 && z >= 0 && x < SIZE && z < SIZE && buildable[z * SIZE + x];
export const cell = (x, z) => inside(x, z) ? z * SIZE + x : -1;
export const atPoint = (x, z) => cell(Math.floor((x + HALF) / BAY), Math.floor((z + HALF) / BAY));
export const neighbors = Array.from({ length: COUNT }, (_, id) => DX.map((dx, d) => (
  buildable[id] ? cell(xOf(id) + dx, zOf(id) + DZ[d]) : -1
)));

export const PALETTES = [
  { name: 'Ink', plaster: '#ddd9d1', timber: '#725f55', tiles: '#4c555e', trim: '#7b766a', accent: '#6f464b', chip: '#c7a9ad' },
  { name: 'Tea', plaster: '#dcd8cd', timber: '#6e6458', tiles: '#4e545a', trim: '#7e786b', accent: '#6e764c', chip: '#b6bd96' },
  { name: 'Clay', plaster: '#ded8d0', timber: '#766157', tiles: '#50555b', trim: '#7f756b', accent: '#a15d43', chip: '#d1a48e' },
  { name: 'Mist', plaster: '#d9d9d3', timber: '#65655f', tiles: '#4d5660', trim: '#767b71', accent: '#4d6c7d', chip: '#a3b8c4' },
];

export function createWorld() {
  const rooms = new Map();
  const history = [];
  let revision = 0;
  let serial = 0;

  // This is also the command entry point used by scene interaction and replays.
  function edit({ type, x, z, palette = 0 }) {
    if (type === 'undo') {
      const change = history.pop();
      if (!change) return { ok: false, reason: 'Nothing to undo' };
      if (change.before) rooms.set(change.id, change.before);
      else rooms.delete(change.id);
      serial = change.serial;
      revision++;
      return { ok: true, id: change.id, type, restored: !!change.before };
    }

    const id = cell(x, z);
    if (id < 0) return { ok: false, reason: 'Choose a plot inside the valley' };
    const before = rooms.get(id);
    if (type !== 'add' && type !== 'remove') return { ok: false, reason: 'Unknown tool' };
    if (type === 'add' && before) return { ok: false, reason: 'This plot is already built' };
    if (type === 'remove' && !before) {
      return { ok: false, reason: 'Choose an existing building' };
    }
    if (type === 'add' && (!Number.isInteger(palette) || !PALETTES[palette])) {
      return { ok: false, reason: 'Choose an available palette' };
    }

    history.push({ id, before, serial });
    if (type === 'remove') rooms.delete(id);
    else rooms.set(id, Object.freeze({ id, identity: ++serial, palette }));
    revision++;
    return { ok: true, id, type };
  }

  return {
    edit,
    get revision() { return revision; },
    get canUndo() { return history.length > 0; },
    get size() { return rooms.size; },
    get: id => rooms.get(id),
    snapshot: () => Array.from(rooms.values()).sort((a, b) => a.id - b.id),
  };
}
