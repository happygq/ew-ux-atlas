import { replay } from './practice-engine.mjs';
import { compactScene } from './scene-model.mjs';
import { guides } from './practice-guide.mjs';

const byId = id => document.getElementById(id);
const actions = { Add: '添加', Remove: '移除', Recolor: '改色' };
const roles = { BEARING_ASSEMBLY: '普通单元', COLUMN: '柱', MIXED_ROOM: '混合承托房间' };
const spaces = { DOUBLE_HEIGHT: '通高空间', SEPARATE_FLOORS: '分层空间', OPEN_COURT: '庭院' };
const roofs = { COVERED_OPAQUE: '不透光屋盖', COVERED_TRANSLUCENT: '透光屋盖', OPEN_TO_SKY: '露天', PARTIAL_COVER: '部分覆盖' };
const reasons = {
  REJECT_SUPPORT_UNRESOLVED: '无法找到完整、合格的承托方案。',
  OCCUPIED: '该网格已占用。请选择空格添加。',
  NOT_OCCUPIED: '该网格为空。请选择已有单元。',
  INVALID_REQUEST: '请检查操作和网格坐标。',
};

function button(text, onClick, className = 'quiet') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = text;
  element.addEventListener('click', onClick);
  return element;
}

function feedback(text, rejected = false) {
  const element = byId('feedback');
  element.textContent = text;
  element.dataset.kind = rejected ? 'rejected' : '';
}

function fillFacts(scene, buildingId) {
  const [court] = scene.courts;
  byId('court-fact').textContent = !court ? '尚无庭院决策'
    : `${court.skyConnected ? '与天空连通' : '与天空隔绝'} · ${court.voidRegionId}`;
  const [support] = scene.supports;
  byId('support-fact').textContent = support
    ? `${support.orientation === 'EW' ? '东西向' : '南北向'} · ${support.unitId} ← ${support.sources.map(s => s.unitId).join(' + ')}`
    : '尚无混合承托房间';
  const local = scene.openings.findLast(o => o.endpoints[0].buildingId === buildingId && o.kind === 'STAIR');
  const status = { ACTIVE: '已批准', INVALIDATED: '已失效', SUSPENDED: '已暂停' };
  byId('stair-fact').textContent = `${local ? `本组${status[local.status] ?? '未生效'} · ` : ''}${scene.passageIds.length} 条有效路线`;
}

async function start() {
  const response = await fetch('./practice-data.json');
  if (!response.ok) throw new Error('Practice data failed to load');
  const { journal, prefixes } = await response.json();
  const { width, depth, levels, operatorId } = journal.initial;
  const grid = { width, depth, levels, lattice: 4 };
  byId('edit-x').max = width - 1;
  byId('edit-z').max = depth - 1;
  const host = byId('scene');
  let scene;
  try {
    const { createScene } = await import('./scene.mjs');
    scene = createScene(host, grid);
    byId('reset-view').addEventListener('click', scene.reset);
    byId('reset-view').disabled = false;
    byId('view-message').hidden = true;
  } catch (error) {
    console.warn(error);
    byId('view-message').textContent = '当前浏览器无法显示三维场景，仍可通过状态文字查看练习结果。';
  }

  const fieldset = byId('edit-fields');
  const typeField = byId('edit-type');
  const choicesPanel = byId('choices');
  const proposalsPanel = byId('proposals');
  let world, guide, guideId, taskIndex, requestIndex, knownCourts, rendered;
  const nextId = () => `practice-${++requestIndex}`;
  const task = () => guide.tasks[taskIndex];

  function updateFields() {
    byId('role-field').hidden = typeField.value !== 'Add';
    byId('color-field').hidden = typeField.value === 'Remove';
  }

  function updateTask() {
    const current = task();
    byId('task-index').textContent = current ? `练习 ${taskIndex + 1} / ${guide.tasks.length}` : '练习完成';
    byId('task-title').textContent = current?.title ?? '已完成本组操作';
    byId('task-details').textContent = current?.details ?? '可以重新开始，或选择另一组练习。';
    const { action, role } = current ?? {};
    byId('task-target').textContent = action
      ? `${actions[action.type]}${role ? ` · ${roles[role]}` : ''} · 第 ${action.level} 层 · X ${action.x} · Z ${action.z}`
      : '';
  }

  function matches(action) {
    const current = task();
    return current?.action && Object.entries(current.action).every(([k, value]) => action[k] === value) &&
      (!current.role || action.supportRole === current.role);
  }

  function updateScene() {
    if (rendered !== world.state) {
      const model = compactScene(world.state.snapshot, knownCourts, grid.lattice);
      scene?.render(model);
      fillFacts(model, guide.buildingId);
      rendered = world.state;
    }
    updateTask();
  }

  function checkStairs() {
    proposalsPanel.replaceChildren();
    const context = world.openingContext();
    const proposals = context.proposals.filter(p => p.binding.kind === 'STAIR' &&
      p.binding.endpoints.every(e => e.buildingId === guide.buildingId));
    proposalsPanel.hidden = proposals.length === 0;
    for (const proposal of proposals) {
      proposalsPanel.append(button('批准楼梯提案', () => {
        const result = world.decideOpening(nextId(), {
          type: 'APPROVE_USER', targetId: proposal.proposalId, authorizer: operatorId,
          inputPrefixDigest: context.inputPrefixDigest,
        });
        if (result.status === 'SEMANTICALLY_ADMITTED') {
          if (task()?.decision === 'STAIR') taskIndex++;
          feedback('已批准新的抽象楼梯通行。');
        } else feedback('无法批准当前提案。请根据最新场景重试。', true);
        updateScene();
        checkStairs();
      }, 'primary'));
    }
  }

  function clearChoices() {
    choicesPanel.replaceChildren();
    choicesPanel.hidden = true;
    fieldset.disabled = false;
  }

  function askRoof(draft, action) {
    fieldset.disabled = true;
    proposalsPanel.hidden = true;
    choicesPanel.hidden = false;
    const selects = draft.scopes.map(scope => {
      const label = document.createElement('label');
      label.append('选择空间与屋盖方案');
      const select = document.createElement('select');
      scope.options.forEach(({ spaceIntent, roofClosure }, i) => {
        select.add(new Option(`${spaces[spaceIntent]} · ${roofs[roofClosure]}`, String(i)));
      });
      label.append(select);
      choicesPanel.append(label);
      return { scope, select };
    });
    choicesPanel.append(button('确认方案', () => {
      const choices = selects.map(({ scope, select }) =>
        ({ scopeId: scope.scopeId, ...scope.options[Number(select.value)] }));
      const result = world.approve(draft.proposalId, { authorizer: operatorId, choices });
      if (result.status !== 'SEMANTICALLY_ADMITTED') {
        feedback('当前方案未能提交，请重新选择或取消。', true);
        return;
      }
      if (matches(action) && choices.some(c => c.spaceIntent === task().spaceIntent &&
          c.roofClosure === task().roofClosure)) taskIndex++;
      feedback('空间和屋盖方案已随建造操作一同提交。');
      clearChoices();
      updateScene();
      checkStairs();
    }, 'primary'));
    choicesPanel.append(button('取消暂存', () => {
      world.cancel(draft.proposalId);
      clearChoices();
      feedback('已取消，已提交场景保持不变。');
      checkStairs();
    }));
  }

  function openGuide(id) {
    guideId = id;
    guide = guides[id];
    const prefix = prefixes[id];
    world = replay({ ...journal, transactions: journal.transactions.slice(0, prefix.transactions) });
    taskIndex = 0;
    requestIndex = 0;
    knownCourts = new Map();
    rendered = null;
    byId('edit').reset();
    clearChoices();
    updateFields();
    byId('practice-source').textContent = `T12 第 ${prefix.sourceStep} 步 · ${guide.buildingName}`;
    byId('guide-title').textContent = guide.title;
    byId('guide-summary').textContent = guide.summary;
    feedback('');
    for (const tab of byId('guide-tabs').children) {
      if (tab.dataset.guide === id) tab.setAttribute('aria-current', 'step');
      else tab.removeAttribute('aria-current');
    }
    updateScene();
    checkStairs();
    history.replaceState(null, '', `#${id}`);
  }

  byId('edit').addEventListener('submit', event => {
    event.preventDefault();
    const type = typeField.value;
    const action = { type, x: byId('edit-x').valueAsNumber, z: byId('edit-z').valueAsNumber,
      level: Number(byId('edit-level').value) };
    if (type !== 'Remove') action.color = byId('edit-color').value;
    if (type === 'Add') Object.assign(action, { supportRole: byId('edit-role').value, buildingId: guide.buildingId });
    const result = world.submit(nextId(), action);
    if (result.status === 'PENDING_CHOICE') {
      feedback('建造已暂存。确认方案前，已提交场景保持不变。');
      askRoof(result, action);
      return;
    }
    if (result.status === 'SEMANTICALLY_ADMITTED') {
      if (matches(action) && !task().reject && !task().roofClosure) taskIndex++;
      feedback(`${actions[type]}已提交。`);
    } else {
      if (matches(action) && task().reject === result.code) taskIndex++;
      feedback(`${reasons[result.code] ?? '当前操作未获准。'}场景保持不变。`, true);
    }
    updateScene();
    checkStairs();
  });
  typeField.addEventListener('change', updateFields);
  for (const [id, { title }] of Object.entries(guides)) {
    const tab = button(title, () => openGuide(id), 'milestone');
    tab.dataset.guide = id;
    byId('guide-tabs').append(tab);
  }
  byId('reset-guide').addEventListener('click', () => openGuide(guideId));
  byId('reset-guide').disabled = false;
  const initial = location.hash.slice(1);
  openGuide(Object.hasOwn(guides, initial) ? initial : 'stair');
}

start().catch(error => {
  console.error(error);
  byId('view-message').textContent = '无法加载练习，请从本地 HTTP 预览打开此页。';
  byId('view-message').hidden = false;
});
