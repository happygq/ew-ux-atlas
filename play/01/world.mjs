export const SIZE = 24;
export const BAY = 5;
export const HALF = SIZE * BAY / 2;
export const AREA = SIZE ** 2 * BAY ** 2;
export const COUNT = SIZE ** 2;
// N, E, S, W in world coordinates. One world unit is one metre.
export const DX = [0, 1, 0, -1];
export const DZ = [-1, 0, 1, 0];
export const opposite = direction => (direction + 2) % 4;
export const xOf = id => id % SIZE;
export const zOf = id => Math.floor(id / SIZE);
export const inside = (x, z) => Number.isInteger(x) && Number.isInteger(z)
  && x >= 0 && z >= 0 && x < SIZE && z < SIZE;
export const cell = (x, z) => inside(x, z) ? z * SIZE + x : -1;
export const center = id => [(xOf(id) + .5) * BAY - HALF, (zOf(id) + .5) * BAY - HALF];
export const atPoint = (x, z) => cell(Math.floor((x + HALF) / BAY), Math.floor((z + HALF) / BAY));
export const neighbors = Array.from({ length: COUNT }, (_, id) => DX.map((dx, d) => (
  cell(xOf(id) + dx, zOf(id) + DZ[d])
)));

export const PALETTES = [
  { name: 'Ink', plaster: '#f7edda', timber: '#714739', tiles: '#505c66', trim: '#887563', chip: '#ebe0c8' },
  { name: 'Tea', plaster: '#e8e4cb', timber: '#655743', tiles: '#52625c', trim: '#8b816a', chip: '#bdc0a0' },
  { name: 'Clay', plaster: '#f1dfcc', timber: '#884b3f', tiles: '#67595b', trim: '#937865', chip: '#cf9b88' },
  { name: 'Mist', plaster: '#e5eaea', timber: '#4b5d61', tiles: '#4b6073', trim: '#778987', chip: '#a8bcc1' },
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
