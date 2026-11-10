import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { canonicalBytes, createWorld as createStageA, replay as replayStageA } from '../../r2-vertical-v03-a/src/world.js';
import { createWorld, POLICY_VERSION, replay } from '../src/world.js';

const CONFIG = { width: 5, depth: 5, levels: 3 };
const COLUMN = 'COLUMN';
const ROOM = 'MIXED_ROOM';
const add = (x, z, level = 0, supportRole) => ({
  type: 'Add', x, z, level, color: 'PAPER', ...(supportRole === undefined ? {} : { supportRole }),
});
const remove = (x, z, level = 0) => ({ type: 'Remove', x, z, level });
const admit = (world, id, action) => assert.equal(world.submit(id, action).status, 'SEMANTICALLY_ADMITTED', id);
const graph = w => w.state.snapshot.support;
const at = (w, x, z, level) => graph(w).nodes.find(n =>
  n.position.x === x && n.position.z === z && n.position.level === level);
const selected = node => node.alternatives.find(a => a.id === node.selectedAlternativeId);
const rejectSupport = (world, id, op) => {
  const before = world.bytes();
  const journal = canonicalBytes(world.journal());
  const result = world.submit(id, op);
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.code, 'REJECT_SUPPORT_UNRESOLVED');
  assert.equal(result.fantasyGranted, false);
  assert.equal(world.bytes(), before);
  assert.equal(canonicalBytes(world.journal()), journal);
  return result;
};
const axisPair = (w, axis, level, role) => {
  const coordinates = axis === 'EW' ? [[1, 2], [3, 2]] : [[2, 1], [2, 3]];
  coordinates.forEach(([x, z], i) => admit(w, `${axis}-${level}-${i}`, add(x, z, level, role)));
};

function verifyRootedGraph(w) {
  const nodes = new Map(graph(w).nodes.map(n => [n.id, n]));
  assert.equal(nodes.size, graph(w).nodes.length);
  for (const node of nodes.values()) {
    if (node.role === 'GROUND') continue;
    const alternatives = node.alternatives;
    assert(selected(node));
    for (const a of alternatives) {
      assert.equal(a.policyVersion, POLICY_VERSION);
      assert.equal(a.semanticallyAdmissible, true);
      assert.equal(a.semanticCommitEligible, true);
      assert.equal(a.geometryEvidence, 'UNVERIFIED');
      assert.equal(a.physicalUseEligible, false);
      assert.deepEqual(a.requiredSources.map(s => s.nodeId), [...new Set(a.foundationPaths.map(p => p[1]))]);
      for (const path of a.foundationPaths) {
        assert.equal(path[0], node.id);
        assert.equal(new Set(path).size, path.length);
        assert.equal(nodes.get(path.at(-1)).role, 'GROUND');
        for (let i = 1; i < path.length; i++) {
          assert.equal(nodes.get(path[i - 1]).position.level - 1, nodes.get(path[i]).position.level);
        }
      }
    }
  }
}

test('T02: grounded direct stacks admit through typed sources, with contact separate from passage', () => {
  const w = createWorld(CONFIG);
  rejectSupport(w, 'floating', add(1, 1, 1));
  admit(w, 'base', add(2, 2));
  admit(w, 'neighbor-base', add(3, 2));
  admit(w, 'middle', add(2, 2, 1));
  admit(w, 'neighbor-middle', add(3, 2, 1));
  admit(w, 'setback-top', add(2, 2, 2));
  const top = at(w, 2, 2, 2);
  assert.deepEqual(selected(top).foundationPaths, [[top.id, at(w, 2, 2, 1).id, at(w, 2, 2, 0).id, 'ground:2,2']]);
  assert(graph(w).verticalContacts.some(c => c.upperUnitId === top.id &&
    c.state === 'CONTACT_ONLY' && !c.physicalPassable));
  assert.deepEqual(w.state.snapshot.passages, []);
  const ground = at(w, 2, 2, 0);
  const before = selected(top).id;
  admit(w, 'recolor', { ...add(2, 2), type: 'Recolor', color: 'MIST' });
  assert.equal(at(w, 2, 2, 0).id, ground.id);
  assert.equal(selected(at(w, 2, 2, 2)).id, before);
  assert.deepEqual(graph(w).selectionChanges, []);
  rejectSupport(w, 'remove-root', remove(2, 2));
  verifyRootedGraph(w);
  assert.equal(replay(w.journal()).bytes(), w.bytes());
});

test('T10: S04, S05 and S06 have distinct rooted footing chains and all three mandatory sources', () => {
  for (const [footing, patternId, level, footRole] of [
    ['GROUND', 'S04_GROUND_COLUMNS_AND_BEARING', 1, COLUMN],
    ['CONTINUOUS_TO_GROUND', 'S05_CONTINUOUS_COLUMNS_AND_BEARING', 2, COLUMN],
    ['BEARING_ASSEMBLY', 'S06_BEARING_FOOTED_COLUMNS_AND_BEARING', 2, undefined],
  ]) {
    const w = createWorld(CONFIG);
    admit(w, 'center-base', add(2, 2));
    axisPair(w, 'EW', 0, footRole);
    if (level === 2) {
      admit(w, 'center-middle', add(2, 2, 1));
      axisPair(w, 'EW', 1, COLUMN);
    }
    admit(w, 'room', add(2, 2, level, ROOM));
    const target = at(w, 2, 2, level);
    const left = at(w, 1, 2, level - 1);
    const base = at(w, 1, 2, 0);
    assert.equal(left.columnFooting.kind, footing);
    assert.equal(left.columnFooting.baseSourceId, footing === 'BEARING_ASSEMBLY' ? base.id : 'ground:1,2');
    const a = selected(target);
    assert.equal(a.patternId, patternId);
    assert.deepEqual(new Set(a.requiredSources.map(s => s.requirement)),
      new Set(['CENTRAL_BEARING', 'COLUMN_WEST', 'COLUMN_EAST']));
    assert.deepEqual(a.foundationPaths.find(p => p[1] === left.id),
      level === 1 ? [target.id, left.id, 'ground:1,2'] : [target.id, left.id, base.id, 'ground:1,2']);
    assert.equal(base.role, footRole ?? 'BEARING_ASSEMBLY');
    assert.equal(target.alternatives.length, 1);
    rejectSupport(w, 'remove-required-column', remove(1, 2, level - 1));
    rejectSupport(w, 'remove-central-bearing', remove(2, 2, level - 1));
    verifyRootedGraph(w);
    assert.equal(replay(w.journal()).bytes(), w.bytes());
  }
});

test('T10: alternatives require a complete pair with the right roles and a common footing pattern', () => {
  const w = createWorld(CONFIG);
  admit(w, 'center', add(2, 2));
  admit(w, 'left-column', add(1, 2, 0, COLUMN));
  rejectSupport(w, 'one-column', add(2, 2, 1, ROOM));
  admit(w, 'right-bearing', add(3, 2));
  rejectSupport(w, 'wrong-role', add(2, 2, 1, ROOM));
  admit(w, 'upper-center', add(2, 2, 1));
  admit(w, 'upper-left', add(1, 2, 1, COLUMN));
  admit(w, 'upper-right', add(3, 2, 1, COLUMN));
  assert.equal(at(w, 1, 2, 1).columnFooting.kind, 'CONTINUOUS_TO_GROUND');
  assert.equal(at(w, 3, 2, 1).columnFooting.kind, 'BEARING_ASSEMBLY');
  rejectSupport(w, 'unapproved-mixed-footings', add(2, 2, 2, ROOM));
});

test('T10: keep an eligible source set, then choose an approved replacement in the same Remove', t => {
  let injectFailure = false;
  let attemptedReplacement;
  const w = createWorld(CONFIG, {
    beforePublish(next) {
      if (!injectFailure) return true;
      attemptedReplacement = next.snapshot.support.selectionChanges[0];
      return false;
    },
  });
  admit(w, 'center', add(2, 2));
  axisPair(w, 'NS', 0, COLUMN);
  admit(w, 'mixed', add(2, 2, 1, ROOM));
  const initial = at(w, 2, 2, 1);
  assert.equal(selected(initial).orientation, 'NS');
  const deleted = at(w, 2, 1, 0).id;
  axisPair(w, 'EW', 0, COLUMN);
  const withBoth = at(w, 2, 2, 1);
  assert.deepEqual(withBoth.alternatives.map(a => a.orientation), ['EW', 'NS']);
  assert.equal(withBoth.selectedAlternativeId, initial.selectedAlternativeId);
  assert.deepEqual(graph(w).selectionChanges, []);

  const before = w.bytes();
  const journalBefore = canonicalBytes(w.journal());
  const nextSeq = w.state.nextEventSeq;
  injectFailure = true;
  assert.equal(w.submit('remove-ns', remove(2, 1)).code, 'PUBLICATION_FAILED');
  assert.equal(attemptedReplacement.unitId, initial.id);
  assert.equal(w.bytes(), before);
  assert.equal(canonicalBytes(w.journal()), journalBefore);
  injectFailure = false;
  admit(w, 'remove-ns', remove(2, 1));
  const after = at(w, 2, 2, 1);
  assert.equal(after.id, initial.id);
  assert.equal(selected(after).orientation, 'EW');
  assert.equal(after.alternatives.length, 1);
  assert.deepEqual(graph(w).selectionChanges, [attemptedReplacement]);
  assert.equal(attemptedReplacement.reason, 'PREVIOUS_ALTERNATIVE_NO_LONGER_ELIGIBLE');
  assert.equal(attemptedReplacement.policyVersion, POLICY_VERSION);
  assert(attemptedReplacement.before.sourceIds.includes(deleted));
  assert(!attemptedReplacement.after.sourceIds.includes(deleted));
  const packet = w.journal().transactions.at(-1);
  assert.deepEqual(packet.map(e => [e.stream, e.eventSeq]), [['ConstructionLog', nextSeq]]);
  rejectSupport(w, 'remove-ew', remove(1, 2));
  admit(w, 'replace-column', add(2, 1, 0, COLUMN));
  const replacementColumn = at(w, 2, 1, 0);
  assert.notEqual(replacementColumn.id, deleted);
  assert.equal(at(w, 2, 2, 1).selectedAlternativeId, after.selectedAlternativeId);
  admit(w, 'remove-ew', remove(1, 2));
  assert.equal(at(w, 2, 2, 1).id, initial.id);
  assert.equal(selected(at(w, 2, 2, 1)).orientation, 'NS');
  assert(graph(w).selectionChanges[0].after.sourceIds.includes(replacementColumn.id));
  assert(!graph(w).selectionChanges[0].after.sourceIds.includes(deleted));
  verifyRootedGraph(w);
  const journal = canonicalBytes(w.journal());
  assert.equal(replay(JSON.parse(journal)).bytes(), w.bytes());
  t.diagnostic(`T10 replacement journal SHA-256 ${sha256(journal)}, state SHA-256 ${sha256(w.bytes())}`);
});

test('T08/T11: a legacy lateral candidate and a floating request confer no support or passage', () => {
  const w = createWorld(CONFIG);
  axisPair(w, 'EW', 0, COLUMN);
  const unapproved = rejectSupport(w, 'span', add(2, 2, 1, ROOM));
  assert.deepEqual(unapproved.candidates.map(c => c.patternId), ['ONE_BAY_BRIDGE_EW']);
  const [bridge] = unapproved.candidates;
  assert.equal(bridge.evidence, 'CANDIDATE');
  assert.equal(bridge.policyApproval, 'UNAPPROVED');
  assert.equal(bridge.semanticallyAdmissible, false);
  assert.equal(bridge.semanticCommitEligible, false);
  assert.equal(bridge.geometryEvidence, 'UNVERIFIED');
  assert.equal(bridge.physicalUseEligible, false);
  assert.equal(at(w, 2, 2, 1), undefined);
  assert(w.state.snapshot.volumeFragments.filter(f => f.gridKey === '0:2,2')
    .every(f => f.kind === 'EXTERIOR_AIR'));
  assert.deepEqual(w.state.snapshot.passages, []);
  assert.deepEqual(rejectSupport(w, 'no-source', add(4, 4, 2)).candidates, []);
  assert.equal(w.submit('forged-sources', { ...add(4, 4, 2), sourceIds: ['ground:4,4'] }).code, 'INVALID_REQUEST');
});

const COURT_CONFIG = { width: 6, depth: 5, levels: 3, operatorId: 'witness-owner' };
const sha256 = bytes => createHash('sha256').update(bytes, 'utf8').digest('hex');
function courtPrefix(world) {
  const wall = [[1, 2], [4, 2], [2, 1], [3, 1], [2, 3], [3, 3]];
  wall.forEach(([x, z], i) => admit(world, `wall0-${i}`, add(x, z)));
  wall.slice(0, -1).forEach(([x, z], i) => admit(world, `wall1-${i}`, add(x, z, 1)));
}
const approveCourt = (world, proposal) => world.approve(proposal.proposalId, {
  authorizer: 'witness-owner',
  choices: proposal.scopes.map(({ scopeId }) => ({
    scopeId, spaceIntent: 'DOUBLE_HEIGHT', roofClosure: 'COVERED_OPAQUE',
  })),
});

test('Stage A/B seam: pending typed occupancy cannot become a source before the spatial approval commits', () => {
  const w = createWorld(COURT_CONFIG);
  courtPrefix(w);
  const before = w.bytes();
  const staged = w.submit('close-with-column', add(3, 3, 1, COLUMN));
  assert.equal(staged.status, 'PENDING_CHOICE');
  assert.equal(w.bytes(), before);
  assert.equal(at(w, 3, 3, 1), undefined);
  rejectSupport(w, 'dependent', add(3, 3, 2, COLUMN));
  assert.equal(approveCourt(w, staged).status, 'SEMANTICALLY_ADMITTED');
  assert.deepEqual(w.journal().transactions.at(-1).map(e => e.stream), ['ConstructionLog', 'DecisionLog']);
  assert.equal(w.state.snapshot.spaceIntents[0].roofClosure, 'COVERED_OPAQUE');
  admit(w, 'dependent', add(3, 3, 2, COLUMN));
  assert.equal(selected(at(w, 3, 3, 2)).requiredSources[0].nodeId, at(w, 3, 3, 1).id);
  assert.equal(replay(w.journal()).bytes(), w.bytes());
});

test('Stage A/B seam: the reviewed Stage A witness keeps its journal and state bytes under its old version', () => {
  const w = createStageA(COURT_CONFIG);
  courtPrefix(w);
  assert.equal(approveCourt(w, w.submit('cover-request', add(3, 3, 1))).status, 'SEMANTICALLY_ADMITTED');
  assert.equal(sha256(w.bytes()), '23769301d08479a502cdc1f9cf48543191affdead550711cd0d354518c24b273');
  const journalBytes = canonicalBytes(w.journal());
  assert.equal(sha256(journalBytes), 'eb41af974cd51ea3b782feefb44d429eb758bd7f73e2621cad2e5c1b2fed1b5a');
  assert.equal(replayStageA(JSON.parse(journalBytes)).bytes(), w.bytes());
  assert.throws(() => replay(w.journal()), /INVALID_JOURNAL/);
});
