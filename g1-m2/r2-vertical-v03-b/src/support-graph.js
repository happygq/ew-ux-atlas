import { cellKey, cellOrder, compare } from '../../r2-vertical-v03-a/src/policy.js';

export const POLICY_VERSION = 'ew-ux/r2-v3-b/1';
const BEARING = 'BEARING_ASSEMBLY';
const COLUMN = 'COLUMN';
const MIXED_ROOM = 'MIXED_ROOM';
const orientations = [
  { axis: 'EW', dx: 1, dz: 0, priority: 10, negative: 'WEST', positive: 'EAST' },
  { axis: 'NS', dx: 0, dz: 1, priority: 20, negative: 'SOUTH', positive: 'NORTH' },
];
const mixedPatterns = {
  GROUND: 'S04_GROUND_COLUMNS_AND_BEARING',
  CONTINUOUS_TO_GROUND: 'S05_CONTINUOUS_COLUMNS_AND_BEARING',
  BEARING_ASSEMBLY: 'S06_BEARING_FOOTED_COLUMNS_AND_BEARING',
};
const eligible = Object.freeze({
  policyApproval: 'APPROVED_BY_STAGE_B_V1',
  semanticallyAdmissible: true,
  semanticCommitEligible: true,
  geometryEvidence: 'UNVERIFIED',
  physicalUseEligible: false,
});

function source(node, requirement) {
  return { nodeId: node.id, unitId: node.unitId, role: node.role, requirement };
}

function alternative(patternId, unitId, sources, orientation = null) {
  // Source order is independent of authoring order and directional enumeration.
  const ordered = [...sources].sort((a, b) => compare(a.node.id, b.node.id));
  const requiredSources = ordered.map(({ node, requirement }) => source(node, requirement));
  const axis = orientation?.axis ?? null;
  return {
    id: [unitId, patternId, axis, ...requiredSources.map(s => s.nodeId)].join('/'),
    patternId, orientation: axis, priority: orientation?.priority ?? 0,
    policyVersion: POLICY_VERSION, requiredSources,
    foundationPaths: ordered.flatMap(({ node }) => node.paths.map(path => [unitId, ...path])),
    ...eligible,
  };
}

function compareAlternatives(a, b) {
  return a.priority - b.priority || compare(a.patternId, b.patternId) || compare(a.id, b.id);
}

const positionOf = ({ x, z, level }) => ({ x, z, level });

function footingFor(below) {
  if (below.role === 'GROUND') return { kind: 'GROUND', baseSourceId: below.id };
  if (below.role === BEARING) return { kind: BEARING, baseSourceId: below.id };
  return {
    kind: below.columnFooting.kind === BEARING ? BEARING : 'CONTINUOUS_TO_GROUND',
    baseSourceId: below.columnFooting.baseSourceId,
  };
}

function supportsFor(cell, nodesAt, ground) {
  const { x, z, level, supportRole } = cell;
  const at = (dx, dz) => nodesAt.get(cellKey(x + dx, z + dz, level - 1));
  const below = ground ?? at(0, 0);
  const bothColumns = direction => [at(-direction.dx, -direction.dz), at(direction.dx, direction.dz)];
  const alternatives = [];
  let columnFooting = null;

  if (supportRole === MIXED_ROOM) {
    if (below?.role === BEARING) {
      for (const direction of orientations) {
        const [negative, positive] = bothColumns(direction);
        if (negative?.role !== COLUMN || positive?.role !== COLUMN) continue;
        const footing = negative.columnFooting.kind;
        if (footing !== positive.columnFooting.kind) continue;
        alternatives.push(alternative(mixedPatterns[footing], cell.unitId, [
          { node: below, requirement: 'CENTRAL_BEARING' },
          { node: negative, requirement: `COLUMN_${direction.negative}` },
          { node: positive, requirement: `COLUMN_${direction.positive}` },
        ], direction));
      }
    }
  } else if (below?.role === 'GROUND' || below?.role === BEARING ||
             (supportRole === COLUMN && below?.role === COLUMN)) {
    const patternId = below.role === 'GROUND' ? 'GROUND' : 'DIRECT';
    alternatives.push(alternative(patternId, cell.unitId, [{ node: below, requirement: patternId }]));
    if (supportRole === COLUMN) columnFooting = footingFor(below);
  }

  return { alternatives: alternatives.sort(compareAlternatives), columnFooting };
}

function rejectedSupport(cell, nodesAt) {
  const { x, z, level } = cell;
  const lateralOnly = !nodesAt.has(cellKey(x, z, level - 1));
  const candidates = (lateralOnly ? orientations : []).flatMap(({ axis, dx, dz, negative, positive }) => {
    const a = nodesAt.get(cellKey(x - dx, z - dz, level - 1));
    const b = nodesAt.get(cellKey(x + dx, z + dz, level - 1));
    if (!a || !b) return [];
    return [{
      patternId: `ONE_BAY_BRIDGE_${axis}`, policyVersion: POLICY_VERSION,
      requiredSources: [source(a, negative), source(b, positive)],
      evidence: 'CANDIDATE', policyApproval: 'UNAPPROVED',
      semanticallyAdmissible: false, semanticCommitEligible: false,
      geometryEvidence: 'UNVERIFIED', physicalUseEligible: false,
    }];
  });
  return { details: { blockedAt: positionOf(cell), candidates, fantasyGranted: false } };
}

function selectionChange(unitId, before, after) {
  const describe = ({ id, patternId, requiredSources }) => ({
    alternativeId: id, patternId, sourceIds: requiredSources.map(s => s.nodeId),
  });
  return {
    unitId, before: describe(before), after: describe(after),
    reason: 'PREVIOUS_ALTERNATIVE_NO_LONGER_ELIGIBLE', policyVersion: POLICY_VERSION,
  };
}

function project(cells, previous) {
  const nodes = [];
  const verticalContacts = [];
  const selectionChanges = [];
  const nodesAt = new Map();
  const previousNodes = new Map(previous?.nodes.map(node => [node.id, node]));
  // Every dependency is either a foundation or a node on a strictly lower
  // level whose full selected AND set has already resolved to foundations.
  for (const cell of [...cells.values()].sort(cellOrder)) {
    const { x, z, level, unitId, supportRole } = cell;
    let ground = null;
    if (level === 0) {
      const id = `ground:${x},${z}`;
      ground = { id, unitId: null, role: 'GROUND', position: { x, z, level: -1 } };
      nodes.push(ground);
      ground = { ...ground, paths: [[id]] };
    }
    const { alternatives, columnFooting } = supportsFor(cell, nodesAt, ground);
    if (!alternatives.length) return rejectedSupport(cell, nodesAt);
    const old = previousNodes.get(unitId);
    const retained = alternatives.find(a => a.id === old?.selectedAlternativeId);
    const selected = retained ?? alternatives[0];
    if (old && !retained) {
      const before = old.alternatives.find(a => a.id === old.selectedAlternativeId);
      selectionChanges.push(selectionChange(unitId, before, selected));
    }
    const node = {
      id: unitId, unitId, role: supportRole, position: positionOf(cell), columnFooting,
      alternatives, selectedAlternativeId: selected.id,
    };
    nodes.push(node);
    nodesAt.set(cellKey(x, z, level), { ...node, paths: selected.foundationPaths });
    const contact = nodesAt.get(cellKey(x, z, level - 1));
    if (contact) verticalContacts.push({
      lowerUnitId: contact.unitId, upperUnitId: unitId,
      state: 'CONTACT_ONLY', physicalPassable: false,
    });
  }
  return { support: { policyVersion: POLICY_VERSION, nodes, verticalContacts, selectionChanges } };
}

export const supportPolicy = Object.freeze({
  version: POLICY_VERSION,
  roles: Object.freeze([BEARING, COLUMN, MIXED_ROOM]),
  defaultRole: BEARING,
  project,
});
