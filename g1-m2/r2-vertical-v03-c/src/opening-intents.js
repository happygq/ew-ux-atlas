import { createHash } from 'node:crypto';
import { canonicalBytes } from '../../r2-vertical-v03-a/src/world.js';
import { cellKey } from '../../r2-vertical-v03-a/src/policy.js';

export const POLICY_VERSION = 'ew-ux/r2-v3-c/1';
const ALGORITHM = 'ew-ux/orthogonal-openings/1';
const retainsReservation = intent => ['ACTIVE', 'SUSPENDED'].includes(intent.status);

function normalizeAdd({
  buildingId = 'local-building', spaceUse = 'ROOM', access = 'LOCAL',
}) {
  if (typeof buildingId !== 'string' || !/^[a-zA-Z0-9._-]{1,64}$/.test(buildingId) ||
      !['ROOM', 'CIRCULATION', 'UNKNOWN'].includes(spaceUse) || !['LOCAL', 'PRIVATE'].includes(access)) return null;
  return { buildingId, spaceUse, access };
}

function spatialIndex(snapshot) {
  return {
    cells: new Map(snapshot.occupancy.map(c => [cellKey(c.x, c.z, c.level), c])),
    byUnit: new Map(snapshot.occupancy.map(c => [c.unitId, c])),
    volumes: new Map(snapshot.volumeFragments.map(f => [f.id, f])),
    regions: new Map(snapshot.spaceRegions.flatMap(r => r.members.map(id => [id, r.id]))),
    patches: new Map(snapshot.boundaryPatches.map(p => [p.id, p])),
    support: new Map(snapshot.support.nodes.flatMap(node => {
      const selected = node.alternatives?.find(a => a.id === node.selectedAlternativeId);
      return selected?.semanticCommitEligible ? [[node.unitId, selected.id]] : [];
    })),
    openEdges: new Set(snapshot.constructionEdges.filter(e => e.kind === 'OPEN').map(e => e.cells.join('|'))),
  };
}

function available(cell, buildingId, index) {
  return cell?.buildingId === buildingId && cell.access === 'LOCAL' &&
    cell.spaceUse !== 'UNKNOWN' && cell.supportRole !== 'COLUMN' && index.support.has(cell.unitId);
}

function connectedSquare(keys, openEdges) {
  const reachable = new Set([keys[0]]);
  for (const a of reachable) for (const b of keys) {
    if (openEdges.has([a, b].sort().join('|'))) reachable.add(b);
  }
  return reachable.size === 4;
}

function stairFootprint(lower, index) {
  const { x, z, level, buildingId } = lower;
  const footprint = [];
  for (const floor of [level, level + 1]) {
    const keys = [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]]
      .map(([xx, zz]) => cellKey(xx, zz, floor));
    if (!keys.every(key => available(index.cells.get(key), buildingId, index)) ||
        !connectedSquare(keys, index.openEdges)) return null;
    footprint.push(...keys);
  }
  return footprint;
}

function endpoint(volumeId, index) {
  const fragment = index.volumes.get(volumeId);
  const cell = index.byUnit.get(fragment?.unitId);
  const spaceRegionId = index.regions.get(volumeId);
  if (!cell || fragment.kind !== 'INTERIOR_AIR' || !spaceRegionId) return null;
  return { volumeId, spaceRegionId, unitId: cell.unitId, buildingId: cell.buildingId, spaceUse: cell.spaceUse };
}

function bindings(index) {
  const found = new Map();
  for (const host of index.patches.values()) {
    if (host.airOpen || !['SLAB', 'WALL'].includes(host.kind)) continue;
    const [from, to] = host.sides.map(id => endpoint(id, index));
    if (!from || !to || from.unitId === to.unitId) continue;
    const a = index.byUnit.get(from.unitId);
    const b = index.byUnit.get(to.unitId);
    if (!available(a, a.buildingId, index) || !available(b, a.buildingId, index)) continue;
    const kind = host.kind === 'SLAB' ? 'STAIR' : 'DOOR';
    const key = [kind, from.unitId, to.unitId].join('/');
    if (found.has(key)) continue;
    const footprint = kind === 'STAIR' ? stairFootprint(a, index) : [cellKey(a.x, a.z, a.level), cellKey(b.x, b.z, b.level)];
    if (!footprint) continue;
    const { u0, v0 } = host.bounds;
    const support = footprint.map(gridKey => {
      const { unitId } = index.cells.get(gridKey);
      return { unitId, alternativeId: index.support.get(unitId) };
    });
    found.set(key, {
      binding: {
        kind, hostPatchId: host.id, endpoints: [from, to], footprint,
        rectangle: { u0, u1: u0 + 1, v0, v1: v0 + 1 },
      },
      support,
    });
  }
  return [...found.values()];
}

function proposal(candidate, inputPrefixDigest) {
  const payload = {
    ...candidate, inputPrefixDigest, policyVersion: POLICY_VERSION, algorithmVersion: ALGORITHM,
    source: 'DETERMINISTIC_SYSTEM_PROPOSAL', status: 'PROPOSED',
    abstractRouteAuthorized: false, physicalPassable: false,
  };
  const id = createHash('sha256').update(canonicalBytes(payload), 'utf8').digest('hex');
  return { proposalId: `opening-proposal:${id}`, ...payload };
}

function conflicts(binding, intents, except = null) {
  return intents.some(intent => {
    if (intent.intentId === except || !retainsReservation(intent)) return false;
    const other = intent.proposal.binding;
    if (binding.hostPatchId === other.hostPatchId) return true;
    return binding.kind === 'STAIR' && other.kind === 'STAIR' &&
      binding.footprint.some(key => other.footprint.includes(key));
  });
}

function proposals(snapshot, prefix) {
  return bindings(spatialIndex(snapshot))
    .filter(c => !conflicts(c.binding, snapshot.openingIntents))
    .map(c => proposal(c, prefix));
}

function projection(openingIntents) {
  return {
    openingIntents: openingIntents.map(intent => ({
      ...intent, abstractRouteAuthorized: intent.status === 'ACTIVE', physicalPassable: false,
    })),
    passages: openingIntents.filter(i => i.status === 'ACTIVE').map(({ intentId, proposal: { binding } }) => ({
      intentId, kind: binding.kind, endpoints: binding.endpoints, hostPatchId: binding.hostPatchId,
      abstractRouteAuthorized: true, physicalPassable: false,
    })),
  };
}

function identitiesRetained(binding, index) {
  const host = index.patches.get(binding.hostPatchId);
  return host && binding.endpoints.every((old, i) => {
    const current = endpoint(host.sides[i], index);
    return current?.unitId === old.unitId && current.volumeId === old.volumeId &&
      current.spaceRegionId === old.spaceRegionId && current.buildingId === old.buildingId;
  });
}

const bindingBytes = ({ binding }) => canonicalBytes(binding);

function afterConstruction(previous, next) {
  const intents = previous.openingIntents;
  if (!intents.some(retainsReservation)) return projection(intents);
  const index = spatialIndex(next);
  const availableBindings = new Set(bindings(index).map(bindingBytes));
  return projection(intents.map(intent => {
    if (!retainsReservation(intent)) return intent;
    const { binding } = intent.proposal;
    let status = intent.status;
    let reason;
    if (!identitiesRetained(binding, index)) {
      status = 'INVALIDATED';
      reason = 'BOUND_IDENTITY_RETIRED';
    } else if (status === 'ACTIVE' && !availableBindings.has(bindingBytes(intent.proposal))) {
      status = 'SUSPENDED';
      reason = 'ROUTE_PRECONDITION_LOST';
    }
    if (status === intent.status) return intent;
    return { ...intent, status, derivedCause: { ...next.interfaceChanges.cause, reason } };
  }));
}

function decide(snapshot, event) {
  const { type, targetId, inputPrefixDigest } = event.decision;
  const intents = snapshot.openingIntents;
  if (type === 'APPROVE_USER' || type === 'DECLINE') {
    const offered = proposals(snapshot, inputPrefixDigest).find(p => p.proposalId === targetId);
    if (!offered) return { code: 'PROPOSAL_NOT_OFFERED' };
    if (type === 'DECLINE') return { evidence: { proposal: offered }, projection: projection(intents) };
    const intentId = `opening-intent:${event.requestId}`;
    const intent = {
      intentId, proposal: offered, status: 'ACTIVE', realizationEvidence: 'UNREALIZED',
      lastApprovalEventId: event.eventId, derivedCause: null,
    };
    return { evidence: { proposal: offered, intentId }, projection: projection([...intents, intent]) };
  }
  if (type !== 'WITHDRAW' && type !== 'REAPPROVE') return { code: 'INVALID_OPENING_DECISION' };
  const intent = intents.find(i => i.intentId === targetId);
  if (!intent || !retainsReservation(intent)) return { code: 'INTENT_NOT_RETAINED' };
  const replace = updated => projection(intents.map(i => i === intent ? updated : i));
  if (type === 'WITHDRAW') {
    return {
      evidence: { intentId: targetId },
      projection: replace({ ...intent, status: 'WITHDRAWN', derivedCause: null }),
    };
  }
  if (intent.status !== 'SUSPENDED') return { code: 'INTENT_NOT_SUSPENDED' };
  const candidate = bindings(spatialIndex(snapshot)).find(c => bindingBytes(c) === bindingBytes(intent.proposal));
  if (!candidate || conflicts(candidate.binding, intents, targetId)) return { code: 'ROUTE_PRECONDITION_LOST' };
  return {
    evidence: { intentId: targetId, proposal: proposal(candidate, inputPrefixDigest) },
    projection: replace({ ...intent, status: 'ACTIVE', lastApprovalEventId: event.eventId, derivedCause: null }),
  };
}

export const openingPolicy = Object.freeze({
  version: POLICY_VERSION,
  addFields: Object.freeze(['buildingId', 'spaceUse', 'access']),
  normalizeAdd, proposals, decide, afterConstruction,
});
