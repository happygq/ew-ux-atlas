import { canonicalBytes, cellKey, createWorldWithSupport, replayWithSupport } from '../r2-vertical-v03-a/src/world.js';
import { supportPolicy } from '../r2-vertical-v03-b/src/support-graph.js';
import { openingPolicy } from '../r2-vertical-v03-c/src/opening-intents.js';
export { replay as replayT12 } from '../r2-vertical-v03-c/src/world.js';

export const POLICY_VERSION = 'ew-ux/r2-v3-visual/automatic-column/1';
const intentPolicy = Object.freeze({ ...openingPolicy, version: POLICY_VERSION });
const bearing = supportPolicy.defaultRole;
const autoSupport = Object.freeze({
  ...supportPolicy,
  replaceRemovedUnit(removed, remaining, identity) {
    if (removed.supportRole !== bearing) return null;
    const above = remaining.get(cellKey(removed.x, removed.z, removed.level + 1));
    if (!above || ![bearing, 'COLUMN'].includes(above.supportRole)) return null;
    return {
      ...removed, ...identity, supportRole: 'COLUMN', spaceUse: 'UNKNOWN',
      generatedSupport: {
        policyVersion: POLICY_VERSION,
        replacedUnitId: removed.unitId,
        initialDependentUnitId: above.unitId,
      },
    };
  },
});

const makeWorld = (config, hooks) => createWorldWithSupport(autoSupport, config, hooks, intentPolicy);

function editor(world) {
  return Object.freeze({
    ...world,
    get state() { return world.state; },
    submit(id, action) {
      if (action?.type === 'Add' && action.supportRole !== undefined && action.supportRole !== bearing) {
        return Object.freeze({ status: 'REJECTED', code: 'INVALID_REQUEST' });
      }
      return world.submit(id, action);
    },
  });
}

export function createPracticeWorld(config, hooks) {
  return editor(makeWorld(config, hooks));
}

export function replayPractice(journal) {
  return editor(replayWithSupport(autoSupport, journal, intentPolicy));
}

// Re-author a committed T12 checkpoint under this practice policy. The accepted
// journal keeps its old version; only the scenario's new local history uses this one.
export function openPracticeCheckpoint({ initial, transactions }) {
  const world = makeWorld(initial);
  for (const packet of transactions) {
    const [first, ...decisions] = packet;
    let result;
    if (first.stream === 'ConstructionLog') {
      result = world.submit(first.requestId, first.action);
      if (result.status === 'PENDING_CHOICE' && decisions.length) {
        result = world.approve(result.proposalId, {
          authorizer: decisions[0].authorizer, choices: decisions.map(event => event.choice),
        });
      }
    } else if (first.decision.type === 'APPROVE_USER') {
      const context = world.openingContext();
      const binding = canonicalBytes(first.proposal.binding);
      const proposal = context.proposals.find(item => canonicalBytes(item.binding) === binding);
      if (!proposal) throw new Error(`Unavailable practice binding: ${first.requestId}`);
      result = world.decideOpening(first.requestId, {
        ...first.decision, targetId: proposal.proposalId, inputPrefixDigest: context.inputPrefixDigest,
      });
    }
    if (result?.status !== 'SEMANTICALLY_ADMITTED') throw new Error(`Cannot open practice checkpoint: ${first.requestId}`);
  }
  return editor(world);
}
