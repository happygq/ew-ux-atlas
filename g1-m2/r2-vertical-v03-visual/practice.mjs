import { replay } from './practice-engine.mjs';
import { compactScene } from './scene-model.mjs';
import { guides } from './practice-guide.mjs';

const byId = id => document.getElementById(id);
const actions = { Add: '添加', Remove: '移除', Recolor: '改色' };
const roles = { BEARING_ASSEMBLY: '普通单元', COLUMN: '柱', MIXED_ROOM: '混合承托房间' };
const colors = { PAPER: '宣纸', MIST: '雾色', SILK: '丝色', MOUNTAIN: '山色' };
const spaces = { DOUBLE_HEIGHT: '通高空间', SEPARATE_FLOORS: '分层空间', OPEN_COURT: '庭院' };
const roofs = { COVERED_OPAQUE: '不透光屋盖', COVERED_TRANSLUCENT: '透光屋盖', OPEN_TO_SKY: '露天', PARTIAL_COVER: '部分覆盖' };
const reasons = {
  REJECT_SUPPORT_UNRESOLVED: '无法找到完整、合格的承托方案。',
  OCCUPIED: '该格已有单元。请选择空格添加，或按 Shift＋左键改色。',
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
  const host = byId('scene');
  let scene;
  try {
    const { createScene } = await import('./scene.mjs');
    scene = createScene(host, grid, {
      onEdit: submitEdit,
      onHover(at) {
        byId('cursor-readout').textContent = at
          ? `第 ${at.level} 层 · X ${at.x} · Z ${at.z}`
          : '指向网格查看位置';
      },
    });
    byId('reset-view').addEventListener('click', scene.reset);
    byId('reset-view').disabled = false;
    byId('view-message').hidden = true;
  } catch (error) {
    console.warn(error);
    byId('view-message').textContent = '三维建造需要 WebGL。请在支持 WebGL 的浏览器打开练习。';
  }

  const tools = byId('edit-tools');
  const levelField = byId('edit-level');
  const roleField = byId('edit-role');
  const colorButtons = [...byId('palette').querySelectorAll('button')];
  const locateTarget = byId('locate-target');
  const choicesPanel = byId('choices');
  const proposalsPanel = byId('proposals');
  let world, guide, guideId, taskIndex, requestIndex, knownCourts, rendered;
  let color = 'PAPER';
  const nextId = () => `practice-${++requestIndex}`;
  const task = () => guide.tasks[taskIndex];

  function selectColor(value) {
    color = value;
    for (const item of colorButtons) item.setAttribute('aria-pressed', String(item.dataset.color === value));
  }

  function selectLayer(value) {
    levelField.value = String(value);
    scene?.editor.setLayer(value);
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
    locateTarget.hidden = !action || !scene;
    scene?.editor.setTarget(action ?? null);
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
    tools.disabled = !scene;
  }

  function askRoof(draft, action) {
    tools.disabled = true;
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
    clearChoices();
    roleField.value = 'BEARING_ASSEMBLY';
    selectColor('PAPER');
    selectLayer(task()?.action?.level ?? 0);
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

  function submitEdit(type, { x, z, level }) {
    if (!world) return;
    if (!choicesPanel.hidden) {
      feedback('请先确认或取消已暂存的方案。');
      return;
    }
    const action = { type, x, z, level };
    if (type !== 'Remove') action.color = color;
    if (type === 'Add') Object.assign(action, { supportRole: roleField.value, buildingId: guide.buildingId });
    const result = world.submit(nextId(), action);
    if (result.status === 'PENDING_CHOICE') {
      feedback('建造已暂存。确认方案前，已提交场景保持不变。');
      askRoof(result, action);
      return;
    }
    if (result.status === 'SEMANTICALLY_ADMITTED') {
      if (matches(action) && !task().reject && !task().roofClosure) taskIndex++;
      const suffix = type === 'Recolor' ? `已改为${colors[color]}。` : `${actions[type]}已提交。`;
      feedback(`第 ${level} 层（${x}，${z}）${suffix}`);
    } else {
      if (matches(action) && task().reject === result.code) taskIndex++;
      feedback(`${reasons[result.code] ?? '当前操作未获准。'}场景保持不变。`, true);
    }
    updateScene();
    checkStairs();
  }
  levelField.addEventListener('change', () => selectLayer(Number(levelField.value)));
  for (const item of colorButtons) item.addEventListener('click', () => selectColor(item.dataset.color));
  locateTarget.addEventListener('click', () => {
    if (task()?.action) selectLayer(task().action.level);
  });
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
