export const POLICY_VERSION = 'ew-ux/r2-v3-a/1';
export const COLORS = Object.freeze(['PAPER', 'MIST', 'SILK', 'MOUNTAIN']);
export const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const cellKey = (x, z, level) => `${level}:${x},${z}`;
export const cellOrder = (a, b) => a.level - b.level || a.z - b.z || a.x - b.x;
const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export const CHOICES = Object.freeze([
  ['DOUBLE_HEIGHT', 'COVERED_OPAQUE'],
  ['DOUBLE_HEIGHT', 'COVERED_TRANSLUCENT'],
  ['OPEN_COURT', 'OPEN_TO_SKY'],
  ['OPEN_COURT', 'PARTIAL_COVER'],
  ['SEPARATE_FLOORS', 'COVERED_OPAQUE'],
].map(([spaceIntent, roofClosure]) => Object.freeze({ spaceIntent, roofClosure })));

// Stage A only: same-column, rooted bearing proxy. No lateral candidate is eligible.
export function supportFacts(cells) {
  const facts = new Map();
  for (const cell of [...cells.values()].sort(cellOrder)) {
    const below = cells.get(cellKey(cell.x, cell.z, cell.level - 1));
    const source = below && facts.get(below.unitId);
    if (cell.level > 0 && !source) return null;
    const mode = source ? 'DIRECT' : 'GROUND';
    facts.set(cell.unitId, {
      unitId: cell.unitId, mode,
      sourceRole: source ? 'BEARING_CELL_PROXY' : 'GROUND',
      sourceId: source ? below.unitId : `ground:${cell.x},${cell.z}`,
      rootId: source ? source.rootId : `ground:${cell.x},${cell.z}`,
      evidence: 'SEMANTIC_COMMIT_ELIGIBLE', verifiedGeometry: false,
    });
  }
  return [...facts.values()];
}

// This projection keeps its own construction edge facts. Air does not read them.
export function editEdges(edges, cells, action) {
  if (action.type === 'Recolor') return edges;
  const { x, z, level } = action;
  const key = cellKey(x, z, level);
  const result = new Map(edges.map(edge => [edge.cells.join('|'), edge]));
  for (const [dx, dz] of neighbors) {
    const otherKey = cellKey(x + dx, z + dz, level);
    const pair = [key, otherKey].sort(compare);
    const edgeKey = pair.join('|');
    if (action.type === 'Remove') result.delete(edgeKey);
    else if (cells.has(otherKey)) {
      result.set(edgeKey, {
        cells: pair,
        kind: cells.get(otherKey).color === action.color ? 'OPEN' : 'PARTITION',
      });
    }
  }
  return [...result.entries()].sort(([a], [b]) => compare(a, b)).map(([, edge]) => edge);
}

function enclosedFootprints({ width, depth }, cells, level) {
  const seen = new Set();
  const footprints = new Map();
  for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) {
    if (seen.has(z * width + x) || cells.has(cellKey(x, z, level))) continue;
    const queue = [{ x, z }];
    seen.add(z * width + x);
    let exterior = false;
    for (const p of queue) {
      for (const [dx, dz] of neighbors) {
        const nx = p.x + dx, nz = p.z + dz;
        if (nx < 0 || nz < 0 || nx >= width || nz >= depth) {
          exterior = true;
          continue;
        }
        const i = nz * width + nx;
        if (seen.has(i) || cells.has(cellKey(nx, nz, level))) continue;
        seen.add(i);
        queue.push({ x: nx, z: nz });
      }
    }
    if (!exterior) {
      queue.sort((a, b) => a.z - b.z || a.x - b.x);
      footprints.set(queue.map(p => `${p.x},${p.z}`).join(';'), queue);
    }
  }
  return footprints;
}

// v1 recognizes a bounded void with the same enclosed footprint on levels 0 and 1.
// No roof/space choice is inferred from color or written directly by a caller.
export function eligibleScopes(config, cells) {
  const lower = enclosedFootprints(config, cells, 0);
  const upper = enclosedFootprints(config, cells, 1);
  return [...lower].filter(([key]) => upper.has(key)).map(([key, footprint]) => ({
    scopeId: `void:0-1:${key}`, footprint, bottomLevel: 0, topLevel: 1,
  }));
}
