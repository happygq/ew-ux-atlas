import { createHash } from 'node:crypto';
import { canonicalBytes, cellKey } from '../r2-vertical-v03-a/src/world.js';
import { openingPolicy } from '../r2-vertical-v03-c/src/opening-intents.js';

const algorithmVersion = 'ew-ux/three-cell-stair/1';
const isAlternate = item => item.algorithmVersion === algorithmVersion;
const square = (x, z, level) => [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]]
  .map(([xx, zz]) => cellKey(xx, zz, level));

function connected(keys, openEdges) {
  const reached = new Set([keys[0]]);
  for (const a of reached) for (const b of keys) {
    if (openEdges.has([a, b].sort().join('|'))) reached.add(b);
  }
  return reached.size === keys.length;
}

function alternateBindings(snapshot) {
  const cells = new Map(snapshot.occupancy.map(c => [cellKey(c.x, c.z, c.level), c]));
  const support = new Map(snapshot.support.nodes.flatMap(node => {
    const selected = node.alternatives?.find(a => a.id === node.selectedAlternativeId);
    return selected?.semanticCommitEligible ? [[node.unitId, selected.id]] : [];
  }));
  const edges = new Set(snapshot.constructionEdges.filter(edge => edge.kind === 'OPEN').map(edge => edge.cells.join('|')));
  const regions = new Map(snapshot.spaceRegions.flatMap(r => r.members.map(id => [id, r.id])));
  const volumes = new Map(snapshot.volumeFragments.filter(v => v.kind === 'INTERIOR_AIR').map(v => [v.id, v]));
  const slabs = new Map();
  for (const patch of snapshot.boundaryPatches) {
    if (patch.kind !== 'SLAB' || patch.airOpen) continue;
    const sides = patch.sides.map(id => volumes.get(id));
    if (!sides.every(v => v?.unitId && regions.has(v.id))) continue;
    const pair = sides.map(v => v.unitId).join('/');
    if (!slabs.has(pair)) slabs.set(pair, { patch, sides });
  }

  const result = new Map();
  for (const origin of cells.values()) {
    const { x, z, level, buildingId } = origin;
    const low = square(x, z, level);
    const high = square(x, z, level + 1).filter(key => cells.has(key));
    if (high.length !== 3) continue;
    // Every occupied cell in the footprint must be usable. Only a genuinely
    // empty corner can be omitted.
    const available = key => {
      const cell = cells.get(key);
      return cell?.buildingId === buildingId && cell.access === 'LOCAL' &&
        cell.spaceUse !== 'UNKNOWN' && cell.supportRole !== 'COLUMN' && support.has(cell.unitId);
    };
    const footprint = [...low, ...high];
    if (!footprint.every(available) || !connected(low, edges) || !connected(high, edges)) continue;
    for (const key of high) {
      const to = cells.get(key);
      const from = cells.get(cellKey(to.x, to.z, level));
      const host = slabs.get(`${from.unitId}/${to.unitId}`);
      if (!host) continue;
      const { patch, sides } = host;
      const { u0, v0 } = patch.bounds;
      if (!result.has(patch.id)) result.set(patch.id, {
        binding: {
          kind: 'STAIR', hostPatchId: patch.id, footprint,
          endpoints: sides.map((v, i) => ({
            volumeId: v.id, spaceRegionId: regions.get(v.id), unitId: v.unitId,
            buildingId, spaceUse: [from, to][i].spaceUse,
          })),
          rectangle: { u0, u1: u0 + 1, v0, v1: v0 + 1 },
        },
        support: footprint.map(k => {
          const { unitId } = cells.get(k);
          return { unitId, alternativeId: support.get(unitId) };
        }),
      });
      break;
    }
  }
  return [...result.values()];
}

function occupiedByIntent(binding, intents, except) {
  return intents.some(intent => intent.intentId !== except && ['ACTIVE', 'SUSPENDED'].includes(intent.status) &&
    (intent.proposal.binding.hostPatchId === binding.hostPatchId ||
      intent.proposal.binding.kind === 'STAIR' && binding.footprint.some(key => intent.proposal.binding.footprint.includes(key))));
}

const bindingBytes = item => canonicalBytes(item.binding);

// Stage C owns existing proposals, identity retirement and ordinary decisions.
// This policy adds one opt-in proposal type for the isolated browser practice.
export function createPracticeOpeningPolicy(version) {
  function proposal(candidate, inputPrefixDigest) {
    const payload = {
      ...candidate, inputPrefixDigest, policyVersion: version, algorithmVersion,
      source: 'DETERMINISTIC_SYSTEM_PROPOSAL', status: 'PROPOSED',
      abstractRouteAuthorized: false, physicalPassable: false,
    };
    const digest = createHash('sha256').update(canonicalBytes(payload), 'utf8').digest('hex');
    return { proposalId: `opening-proposal:${digest}`, ...payload };
  }

  function alternatives(snapshot, prefix, except) {
    return alternateBindings(snapshot)
      .filter(item => !occupiedByIntent(item.binding, snapshot.openingIntents, except))
      .map(item => proposal(item, prefix));
  }

  // Use Stage C's existing projection for ordinary intents. Only the newly
  // admitted or retained alternate needs an additional abstract route.
  function addRoute(projection, intent) {
    const { intentId, proposal: { binding } } = intent;
    const openingIntents = projection.openingIntents.some(i => i.intentId === intentId)
      ? projection.openingIntents.map(i => i.intentId === intentId ? intent : i)
      : [...projection.openingIntents, intent];
    const routes = new Map(projection.passages.map(route => [route.intentId, route]));
    routes.set(intentId, {
      intentId, kind: binding.kind, endpoints: binding.endpoints, hostPatchId: binding.hostPatchId,
      abstractRouteAuthorized: true, physicalPassable: false,
    });
    return {
      openingIntents,
      passages: openingIntents.flatMap(i => routes.has(i.intentId) ? [routes.get(i.intentId)] : []),
    };
  }

  return Object.freeze({
    ...openingPolicy,
    version,
    proposals(snapshot, prefix) {
      return [...openingPolicy.proposals(snapshot, prefix), ...alternatives(snapshot, prefix)];
    },
    afterConstruction(previous, next) {
      let projection = openingPolicy.afterConstruction(previous, next);
      const active = previous.openingIntents.filter(i => i.status === 'ACTIVE' && isAlternate(i.proposal));
      if (!active.length) return projection;
      const valid = new Set(alternateBindings(next).map(bindingBytes));
      for (const intent of active) {
        const projected = projection.openingIntents.find(i => i.intentId === intent.intentId);
        // The base policy checks identity retirement before eligibility. Only
        // its full-square eligibility check is extended for alternate routes.
        if (projected.status === 'SUSPENDED' && valid.has(bindingBytes(intent.proposal))) {
          projection = addRoute(projection, intent);
        }
      }
      return projection;
    },
    decide(snapshot, event) {
      const base = openingPolicy.decide(snapshot, event);
      if (!base.code) return base;
      const { type, targetId, inputPrefixDigest } = event.decision;
      const unchanged = { openingIntents: snapshot.openingIntents, passages: snapshot.passages };
      if (base.code === 'PROPOSAL_NOT_OFFERED' && ['APPROVE_USER', 'DECLINE'].includes(type)) {
        const offered = alternatives(snapshot, inputPrefixDigest).find(item => item.proposalId === targetId);
        if (!offered) return base;
        if (type === 'DECLINE') return { evidence: { proposal: offered }, projection: unchanged };
        const intentId = `opening-intent:${event.requestId}`;
        const intent = {
          intentId, proposal: offered, status: 'ACTIVE', realizationEvidence: 'UNREALIZED',
          lastApprovalEventId: event.eventId, derivedCause: null, abstractRouteAuthorized: true, physicalPassable: false,
        };
        return { evidence: { proposal: offered, intentId }, projection: addRoute(unchanged, intent) };
      }
      if (base.code === 'ROUTE_PRECONDITION_LOST' && type === 'REAPPROVE') {
        const intent = snapshot.openingIntents.find(i => i.intentId === targetId);
        if (!intent || intent.status !== 'SUSPENDED' || !isAlternate(intent.proposal)) return base;
        const offered = alternatives(snapshot, inputPrefixDigest, targetId)
          .find(item => bindingBytes(item) === bindingBytes(intent.proposal));
        if (!offered) return base;
        return {
          evidence: { intentId: targetId, proposal: offered },
          projection: addRoute(unchanged, {
            ...intent, status: 'ACTIVE', lastApprovalEventId: event.eventId, derivedCause: null,
            abstractRouteAuthorized: true,
          }),
        };
      }
      return base;
    },
  });
}
