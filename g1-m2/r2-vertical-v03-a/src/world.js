import { createHash } from 'node:crypto';
import { cellKey, cellOrder, CHOICES, COLORS, compare, editEdges, eligibleScopes,
  POLICY_VERSION, supportFacts } from './policy.js';
import { projectSpatial } from './spatial.js';

export { POLICY_VERSION, cellKey } from './policy.js';
export { OUTSIDE_WORLD, SKY_EXTERIOR, probeSlabOpening } from './spatial.js';

// Canonical UTF-8 JSON: sort object keys, retain array order, omit no fields.
export function canonicalBytes(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string' ||
      Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalBytes).join(',') + ']';
  if (isRecord(value)) return '{' + Object.keys(value).sort(compare).map(key =>
    JSON.stringify(key) + ':' + canonicalBytes(value[key])).join(',') + '}';
  throw new TypeError('Noncanonical JSON value');
}

const isRecord = value => value !== null && typeof value === 'object' &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const digest = bytes => createHash('sha256').update(bytes, 'utf8').digest('hex');
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const admitted = (transactionId, idempotent = false) =>
  freeze({ status: 'SEMANTICALLY_ADMITTED', transactionId, idempotent });
const rejected = (code, details = {}) => freeze({ status: 'REJECTED', code, ...details });
const validRequestId = id => typeof id === 'string' && /^[a-zA-Z0-9._-]{1,96}$/.test(id);
const validAuthorizer = id => typeof id === 'string' && id.length <= 160 && id.trim().length > 0;
const same = (a, b) => canonicalBytes(a) === canonicalBytes(b);

export function normalizedConstructionBytes(constructionLog) {
  // Index is the construction order, not the shared eventSeq.
  return canonicalBytes(constructionLog.map((event, order) => ({ order, ...event.action })));
}

function grid(config) {
  if (!isRecord(config)) throw new TypeError('INVALID_GRID');
  const { width = 6, depth = 6, levels = 3, operatorId = 'local-operator' } = config;
  if (![width, depth, levels].every(Number.isSafeInteger) ||
      width < 3 || width > 12 || depth < 3 || depth > 12 || levels < 2 || levels > 3) {
    throw new TypeError('INVALID_GRID');
  }
  if (!validAuthorizer(operatorId)) throw new TypeError('INVALID_OPERATOR');
  return { width, depth, levels, operatorId };
}

const stageASupport = Object.freeze({
  version: POLICY_VERSION,
  project: cells => ({ support: supportFacts(cells) }),
});

function normalizeAction(config, action, supportPolicy, intentPolicy) {
  if (!isRecord(action)) return null;
  const { type, x, z, level, color } = action;
  const typedAdd = type === 'Add' && supportPolicy.roles;
  const fields = ['type', 'x', 'z', 'level'];
  if (type !== 'Remove') fields.push('color');
  if (typedAdd) fields.push('supportRole');
  if (type === 'Add' && intentPolicy) fields.push(...intentPolicy.addFields);
  if (!['Add', 'Recolor', 'Remove'].includes(type) ||
      ![x, z, level].every(Number.isSafeInteger) ||
      x < 0 || x >= config.width || z < 0 || z >= config.depth || level < 0 || level >= config.levels ||
      !Object.keys(action).every(key => fields.includes(key))) return null;
  if (type === 'Remove') return { type, x, z, level };
  if (!COLORS.includes(color)) return null;
  if (!typedAdd) return { type, x, z, level, color };
  const supportRole = action.supportRole === undefined ? supportPolicy.defaultRole : action.supportRole;
  if (!supportPolicy.roles.includes(supportRole)) return null;
  const metadata = intentPolicy ? intentPolicy.normalizeAdd(action) : {};
  return metadata && { type, x, z, level, color, supportRole, ...metadata };
}

function plan(state, action, supportPolicy, intentPolicy) {
  const prev = state.snapshot;
  const cells = new Map(prev.occupancy.map(c => [cellKey(c.x, c.z, c.level), c]));
  const { x, z, level, color } = action;
  const key = cellKey(x, z, level);
  const cell = cells.get(key);
  const actionIndex = state.constructionLog.length;
  let nextUnit = prev.nextIds.unit;
  if (action.type === 'Add') {
    if (cell) return rejected('OCCUPIED');
    const added = { x, z, level, color, unitId: `unit:${nextUnit++}`, createdByActionIndex: actionIndex };
    if (action.supportRole !== undefined) added.supportRole = action.supportRole;
    if (intentPolicy) for (const field of intentPolicy.addFields) added[field] = action[field];
    cells.set(key, added);
  } else {
    if (!cell) return rejected('NOT_OCCUPIED');
    if (action.type === 'Recolor') cells.set(key, { ...cell, color });
    else cells.delete(key);
  }
  // Rebuild support from committed cells plus this single edit. Other staging
  // requests never enter the candidate sent to the support policy.
  const { support, details } = supportPolicy.project(cells, prev.support, action);
  if (!support) return rejected('REJECT_SUPPORT_UNRESOLVED', details);
  const retained = new Map(prev.spaceIntents.map(intent => [intent.scopeId, intent]));
  const scopes = eligibleScopes(state.initial, cells);
  return {
    cells, support, nextUnit,
    scopes: scopes.filter(scope => !retained.has(scope.scopeId)),
    retained: scopes.flatMap(scope => retained.has(scope.scopeId) ? [retained.get(scope.scopeId)] : []),
  };
}

function proposalFor(state, bytes, requestId, action, scopes) {
  const inputPrefixDigest = digest(bytes);
  const proposalId = `proposal:${digest(canonicalBytes({
    policyVersion: state.policyVersion, inputPrefixDigest, requestId, action, scopes, options: CHOICES,
  }))}`;
  return freeze({
    status: 'PENDING_CHOICE', proposalId, requestId, inputPrefixDigest, policyVersion: state.policyVersion,
    ghost: action,
    scopes: scopes.map(scope => ({ ...scope, options: CHOICES })),
  });
}

function normalizeApproval(approval, scopes, operatorId) {
  if (!isRecord(approval) || Object.keys(approval).length !== 2 ||
      approval.authorizer !== operatorId || !Array.isArray(approval.choices) ||
      approval.choices.length !== scopes.length) return null;
  const byScope = new Map();
  for (const choice of approval.choices) {
    if (!isRecord(choice) || Object.keys(choice).length !== 3 ||
        typeof choice.scopeId !== 'string' || byScope.has(choice.scopeId) ||
        !CHOICES.some(c => c.spaceIntent === choice.spaceIntent && c.roofClosure === choice.roofClosure)) return null;
    const { scopeId, spaceIntent, roofClosure } = choice;
    byScope.set(scopeId, { scopeId, spaceIntent, roofClosure });
  }
  const choices = scopes.map(s => byScope.get(s.scopeId));
  return choices.every(Boolean) ? { authorizer: approval.authorizer, choices } : null;
}

function deriveInterfaceChanges(previous, spatial, constructionEvent) {
  const retained = new Set(spatial.boundaryPatches.map(p => p.id));
  // Future F2 can use these identity changes to project suspension/invalidation
  // in this transaction. This is derived data, never a second authority event.
  return {
    cause: {
      constructionEventId: constructionEvent.eventId, transactionId: constructionEvent.transactionId,
      policyVersion: constructionEvent.policyVersion,
    },
    retiredPatchIds: previous.boundaryPatches.filter(p => !retained.has(p.id)).map(p => p.id),
    retiredRegions: spatial.retiredRegions,
  };
}

function candidate(state, bytes, requestId, action, planned, proposal, approval, intentPolicy) {
  const transactionId = `tx:${requestId}`;
  const envelope = {
    transactionId, policyVersion: state.policyVersion,
    inputPrefixDigest: proposal?.inputPrefixDigest ?? digest(bytes),
  };
  const construction = {
    ...envelope, eventId: `construction:${requestId}`, eventSeq: state.nextEventSeq,
    stream: 'ConstructionLog', requestId, action,
  };
  const decisions = planned.scopes.map((scope, i) => {
    const decisionId = `decision:${requestId}:${i + 1}`;
    return {
      ...envelope, eventId: decisionId, eventSeq: construction.eventSeq + i + 1,
      stream: 'DecisionLog', decisionId, proposalId: proposal.proposalId,
      authorizer: approval.authorizer, scope, choice: approval.choices[i],
    };
  });
  const prev = state.snapshot;
  const spaceIntents = [
    ...planned.retained,
    ...decisions.map(e => ({ ...e.scope, ...e.choice, decisionId: e.decisionId })),
  ].sort((a, b) => compare(a.scopeId, b.scopeId));
  const { retiredRegions, ...spatial } = projectSpatial(state.initial, planned.cells, spaceIntents, prev);
  const transaction = [construction, ...decisions];
  const snapshot = {
    occupancy: [...planned.cells.values()].sort(cellOrder),
    constructionEdges: editEdges(prev.constructionEdges, planned.cells, action),
    spaceIntents, support: planned.support, passages: [],
    ...spatial, nextIds: { ...spatial.nextIds, unit: planned.nextUnit },
    interfaceChanges: deriveInterfaceChanges(prev, { ...spatial, retiredRegions }, construction),
  };
  if (intentPolicy) Object.assign(snapshot, intentPolicy.afterConstruction(prev, snapshot));
  return {
    transaction,
    state: {
      ...state,
      constructionLog: [...state.constructionLog, construction],
      decisionLog: [...state.decisionLog, ...decisions],
      nextEventSeq: state.nextEventSeq + transaction.length,
      snapshot,
    },
  };
}

function initialState(config, supportPolicy, intentPolicy) {
  const initial = grid(config);
  const seed = { boundaryPatches: [], voidRegions: [], spaceRegions: [], nextIds: { patch: 1, unit: 1, void: 1, space: 1 } };
  const { retiredRegions, ...spatial } = projectSpatial(initial, new Map(), [], seed);
  return freeze({
    policyVersion: intentPolicy?.version ?? supportPolicy.version,
    initial, constructionLog: [], decisionLog: [], nextEventSeq: 1,
    snapshot: {
      occupancy: [], constructionEdges: [], spaceIntents: [], support: supportPolicy.project(new Map()).support,
      passages: [], ...(intentPolicy ? { openingIntents: [] } : {}),
      ...spatial, interfaceChanges: null,
    },
  });
}

function makeWorld(config, hooks, supportPolicy, intentPolicy) {
  let state = initialState(config, supportPolicy, intentPolicy);
  let bytes = canonicalBytes(state);
  let busy = false;
  const pending = new Map();
  const cancelled = new Set();
  const packets = new Map();
  let openingPrefix;

  function normalizeDecision(input) {
    if (!isRecord(input) || Object.keys(input).length !== 4 ||
        typeof input.type !== 'string' || typeof input.targetId !== 'string' ||
        typeof input.inputPrefixDigest !== 'string' || input.authorizer !== state.initial.operatorId) return null;
    const { type, targetId, authorizer, inputPrefixDigest } = input;
    return { type, targetId, authorizer, inputPrefixDigest };
  }

  function decisionCandidate(requestId, decision) {
    if (decision.inputPrefixDigest !== digest(bytes)) return rejected('STALE_PREFIX');
    const event = {
      requestId, transactionId: `tx:${requestId}`, policyVersion: state.policyVersion,
      eventId: `opening-decision:${requestId}`, eventSeq: state.nextEventSeq,
      inputPrefixDigest: decision.inputPrefixDigest, stream: 'DecisionLog', decision,
    };
    const result = intentPolicy.decide(state.snapshot, event);
    if (result.code) return rejected(result.code);
    const record = { ...event, ...result.evidence };
    return {
      transaction: [record],
      state: {
        ...state, nextEventSeq: state.nextEventSeq + 1,
        decisionLog: [...state.decisionLog, record],
        snapshot: { ...state.snapshot, ...result.projection },
      },
    };
  }

  function publish(staged, checkHooks) {
    // All reads still see the old committed state until these checks finish.
    const next = freeze(staged.state);
    const transaction = freeze(staged.transaction);
    const nextBytes = canonicalBytes(next);
    if (checkHooks) {
      busy = true;
      try {
        for (const [name, code] of [['validateProjection', 'VALIDATION_FAILED'], ['beforePublish', 'PUBLICATION_FAILED']]) {
          try {
            if (hooks[name] !== undefined && hooks[name](next, transaction) !== true) return rejected(code);
          } catch {
            return rejected(code);
          }
        }
      } finally {
        busy = false;
      }
    }
    // No user code runs between publishing these private synchronous references.
    packets.set(transaction[0].requestId, transaction);
    state = next;
    bytes = nextBytes;
    return admitted(transaction[0].transactionId);
  }

  const api = {
    get state() { return state; },
    bytes: () => bytes,
    journal: () => freeze({
      policyVersion: state.policyVersion, initial: state.initial, transactions: [...packets.values()],
    }),
    submit(requestId, input) {
      if (busy) return rejected('REENTRANT_MUTATION');
      const action = normalizeAction(state.initial, input, supportPolicy, intentPolicy);
      if (!validRequestId(requestId) || !action) return rejected('INVALID_REQUEST');
      const old = packets.get(requestId)?.[0];
      if (old) return old.stream === 'ConstructionLog' && same(old.action, action)
        ? admitted(old.transactionId, true) : rejected('EVENT_ID_CONFLICT');
      const planned = plan(state, action, supportPolicy, intentPolicy);
      if (planned.code) return planned;
      if (!planned.scopes.length) {
        return publish(candidate(state, bytes, requestId, action, planned, null, null, intentPolicy), true);
      }
      const proposal = proposalFor(state, bytes, requestId, action, planned.scopes);
      if (cancelled.has(proposal.proposalId)) return rejected('CANCELLED_PROPOSAL');
      pending.set(proposal.proposalId, { prefix: state, proposal });
      return proposal;
    },
    approve(proposalId, input) {
      if (busy) return rejected('REENTRANT_MUTATION');
      const draft = pending.get(proposalId);
      if (!draft) {
        const decisions = state.decisionLog.filter(e => e.proposalId === proposalId);
        if (!decisions.length) return rejected('UNKNOWN_PROPOSAL');
        const approval = normalizeApproval(input, decisions.map(e => e.scope), state.initial.operatorId);
        return approval && same(approval.choices, decisions.map(e => e.choice)) &&
          decisions.every(e => e.authorizer === approval.authorizer)
          ? admitted(decisions[0].transactionId, true) : rejected('EVENT_ID_CONFLICT');
      }
      // Reference equality here is equality with the exact immutable committed
      // prefix, not merely a comparison of digest labels.
      if (draft.prefix !== state) return rejected('STALE_PREFIX');
      const { requestId, ghost: action } = draft.proposal;
      if (packets.has(requestId)) return rejected('EVENT_ID_CONFLICT');
      const planned = plan(state, action, supportPolicy, intentPolicy);
      if (planned.code) return planned;
      const proposal = proposalFor(state, bytes, requestId, action, planned.scopes);
      if (proposal.proposalId !== proposalId) return rejected('STALE_PROPOSAL');
      const approval = normalizeApproval(input, planned.scopes, state.initial.operatorId);
      if (!approval) return rejected('INVALID_APPROVAL');
      const result = publish(candidate(state, bytes, requestId, action, planned, proposal, approval, intentPolicy), true);
      if (result.status === 'SEMANTICALLY_ADMITTED') pending.delete(proposalId);
      return result;
    },
    cancel(proposalId) {
      if (busy) return rejected('REENTRANT_MUTATION');
      if (!pending.delete(proposalId)) return rejected('UNKNOWN_PROPOSAL');
      cancelled.add(proposalId);
      return freeze({ status: 'CANCELLED' });
    },
  };

  if (intentPolicy) Object.assign(api, {
    openingContext() {
      const inputPrefixDigest = digest(bytes);
      openingPrefix = state;
      return freeze({ inputPrefixDigest, proposals: intentPolicy.proposals(state.snapshot, inputPrefixDigest) });
    },
    decideOpening(requestId, input) {
      if (busy) return rejected('REENTRANT_MUTATION');
      const decision = normalizeDecision(input);
      if (!validRequestId(requestId) || !decision) return rejected('INVALID_OPENING_DECISION');
      const old = packets.get(requestId)?.[0];
      if (old) return old.stream === 'DecisionLog' && same(old.decision, decision)
        ? admitted(old.transactionId, true) : rejected('EVENT_ID_CONFLICT');
      if (openingPrefix !== state) return rejected('STALE_PREFIX');
      const staged = decisionCandidate(requestId, decision);
      return staged.code ? staged : publish(staged, true);
    },
  });

  function applyPacket(packet) {
    const construction = Array.isArray(packet) ? packet[0] : null;
    if (!isRecord(construction) || !validRequestId(construction.requestId)) throw new Error('INVALID_TRANSACTION');
    const { requestId } = construction;
    const old = packets.get(requestId);
    if (old) {
      if (!same(old, packet)) throw new Error('EVENT_ID_CONFLICT');
      return;
    }
    if (construction.stream === 'DecisionLog' && intentPolicy) {
      if (packet.length !== 1) throw new Error('INCOMPLETE_TRANSACTION');
      const decision = normalizeDecision(construction.decision);
      if (!decision) throw new Error('INVALID_OPENING_DECISION');
      const staged = decisionCandidate(requestId, decision);
      if (staged.code) throw new Error(staged.code);
      if (!same(staged.transaction, packet)) throw new Error('TRANSACTION_MISMATCH');
      publish(staged, false);
      return;
    }
    const action = normalizeAction(state.initial, construction.action, supportPolicy, intentPolicy);
    if (!action) throw new Error('INVALID_REQUEST');
    const planned = plan(state, action, supportPolicy, intentPolicy);
    if (planned.code) throw new Error(planned.code);
    if (packet.length !== 1 + planned.scopes.length) throw new Error('INCOMPLETE_TRANSACTION');
    const proposal = planned.scopes.length ? proposalFor(state, bytes, requestId, action, planned.scopes) : null;
    let approval = null;
    if (proposal) {
      const records = packet.slice(1);
      approval = normalizeApproval({
        authorizer: records[0]?.authorizer, choices: records.map(e => e?.choice),
      }, planned.scopes, state.initial.operatorId);
      if (!approval) throw new Error('INVALID_APPROVAL');
    }
    const staged = candidate(state, bytes, requestId, action, planned, proposal, approval, intentPolicy);
    // Compare complete canonical event bytes against a projection rebuilt from
    // the preceding verified packets, including prefix, order, and policy.
    if (!same(staged.transaction, packet)) throw new Error('TRANSACTION_MISMATCH');
    publish(staged, false);
  }

  return { api: Object.freeze(api), applyPacket };
}

export function createWorld(config = {}, hooks = {}) {
  return createWorldWithSupport(stageASupport, config, hooks);
}

export function replay(journal) {
  return replayWithSupport(stageASupport, journal);
}

// Internal seam for a fixed, versioned research policy. No policy configuration
// or caller-supplied support evidence is taken from the journal.
export function createWorldWithSupport(supportPolicy, config = {}, hooks = {}, intentPolicy) {
  return makeWorld(config, hooks, supportPolicy, intentPolicy).api;
}

export function replayWithSupport(supportPolicy, journal, intentPolicy) {
  if (!isRecord(journal) || journal.policyVersion !== (intentPolicy?.version ?? supportPolicy.version) ||
      !Array.isArray(journal.transactions) || !same(grid(journal.initial), journal.initial)) {
    throw new Error('INVALID_JOURNAL');
  }
  const { api, applyPacket } = makeWorld(journal.initial, {}, supportPolicy, intentPolicy);
  for (const packet of journal.transactions) applyPacket(packet);
  return api;
}
