const byId = id => document.getElementById(id);
const host = byId('scene');
const seek = byId('seek');
const play = byId('play');
const prev = byId('prev');
const next = byId('next');
const reset = byId('reset-view');
const milestoneList = byId('milestones');
const technicalToggle = byId('technical');
const titles = {
  'approve-east': '批准东侧楼梯',
  'approve-south': '批准南侧楼梯',
  'center-bearing': '建造中央承载体',
  'south-column': '建造南柱',
  'north-column': '建造北柱',
  'west-column': '建造西柱',
  'east-column': '建造东柱',
  'mixed-room': '建造混合承托房间',
  'seal-court-pending': '庭院封闭待确认',
  'seal-court': '封闭庭院',
  'recolor-south-landing': '调整南侧楼梯平台颜色',
  'stale-withdrawal': '尝试撤回楼梯意图',
  'support-publication-failure': '承托替代发布失败',
  'replace-support': '切换承托',
  'reject-last-column': '尝试移除必需柱',
  'reject-adjacent-room-on-column': '尝试在柱上建造相邻房间',
  'unseal-court': '重新打开庭院',
  'reseal-court-pending': '庭院再次封闭待确认',
  'reseal-court': '再次封闭庭院',
  'remove-south-landing': '南侧楼梯失效',
  'restore-south-landing': '重建南侧楼梯平台',
  'repeat-restore': '重试平台重建',
  'conflict-restore': '平台重建请求冲突',
  'repeat-original-approval': '重试原楼梯审批',
  'conflict-original-approval': '原楼梯审批请求冲突',
  'approve-restored-south': '批准新楼梯',
};
const descriptions = {
  'seal-court': '屋盖方案获批，庭院与天空的空气连通被切断。',
  'replace-support': '承托从南北向切换到东西向，受承托单元的 ID 保持不变。',
  'unseal-court': '移除上层围墙后，原屋盖决策失效，庭院重新与天空连通。',
  'reseal-court': '新的屋盖方案获批，庭院再次封闭。',
  'remove-south-landing': '南侧楼梯平台被移除，原抽象通行随即失效。',
  'approve-restored-south': '平台重建后，新的南侧楼梯通行意图获批。',
};
const actions = { Add: '建造', Recolor: '改色', Remove: '移除' };
const rejectedReasons = {
  STALE_PREFIX: '请求依据的世界状态已过期。',
  REJECT_SUPPORT_UNRESOLVED: '未找到符合规则的承托方案。',
  EVENT_ID_CONFLICT: '相同请求 ID 对应的操作内容不一致。',
};

function titleFor(frame) {
  if (!frame) return '空场景';
  if (titles[frame.label]) return titles[frame.label];
  if (frame.label.startsWith('east-')) return '建造东侧建筑';
  if (frame.label.startsWith('south-')) return '建造南侧建筑';
  if (frame.label.startsWith('court-base-')) return '建造庭院下层围墙';
  if (frame.label.startsWith('court-upper-')) return '建造庭院上层围墙';
  return actions[frame.action?.type] ?? '记录操作';
}

function planView(grid) {
  const palette = { court: '#638679', east: '#586d8e', south: '#ae715a', support: '#9b8050' };
  const wrap = document.createElement('div');
  wrap.className = 'fallback';
  const note = document.createElement('p');
  note.textContent = '当前浏览器无法使用 WebGL，改用分层平面图显示同一场景。';
  wrap.append(note);
  host.replaceChildren(wrap);
  const cells = Array.from({ length: grid.levels }, (_, level) => {
    const floor = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = `第 ${level} 层`;
    const plan = document.createElement('div');
    plan.className = 'plan';
    plan.style.setProperty('--cols', grid.width);
    const tiles = Array.from({ length: grid.width * grid.depth }, () => document.createElement('span'));
    plan.append(...tiles);
    floor.append(title, plan);
    wrap.append(floor);
    return tiles;
  });
  byId('gesture').textContent = '分层平面图';
  return {
    render(model) {
      for (const tile of cells.flat()) tile.style.backgroundColor = '';
      for (const unit of model.units) {
        cells[unit.level][(grid.depth - unit.z - 1) * grid.width + unit.x].style.backgroundColor =
          palette[unit.buildingId] ?? '#65726b';
      }
    },
  };
}

function setFact(id, text, key = '') {
  const element = byId(id);
  element.textContent = text;
  if (!key) return;
  const identity = document.createElement('code');
  identity.textContent = key;
  element.append(identity);
}

function updateFacts(model) {
  const [court] = model.courts;
  if (court) {
    const state = court.skyConnected ? '已重开 · 与天空连通' : '已封闭 · 与天空隔绝';
    setFact('court-fact', state, [court.voidRegionId, court.tiles[0]?.id].filter(Boolean).join(' · '));
  } else setFact('court-fact', '尚无庭院决策');

  const [support] = model.supports;
  if (support) {
    const axis = support.orientation === 'EW' ? '东西向' : '南北向';
    setFact('support-fact', `${axis} · ${support.unitId}`, support.sources.map(s => s.unitId).join(' + '));
  } else setFact('support-fact', '尚无已准入的混合承托房间');

  const south = model.openings.findLast(o => o.endpoints[0].buildingId === 'south');
  const n = model.passageIds.length;
  const state = `${n} 条已批准路线`;
  const routeStatus = { INVALIDATED: '已失效', SUSPENDED: '已暂停', WITHDRAWN: '已撤回' };
  const status = south && routeStatus[south.status] ? `南侧楼梯${routeStatus[south.status]} · ${state}` : state;
  setFact('stair-fact', status, south?.intentId ?? model.passageIds[0]);
}

function resultFor(frame) {
  if (!frame) return ['初始状态', 'unchanged', '已提交网格为空。'];
  if (frame.status === 'PENDING_CHOICE') return ['待确认', 'pending', '请求已暂存，已提交世界保持不变。'];
  if (frame.code === 'PUBLICATION_FAILED') return ['发布失败', 'failed', '本次事务发布失败，已提交世界保持不变。'];
  if (frame.status === 'REJECTED') {
    const reason = rejectedReasons[frame.code] ?? '请求未获准入。';
    return ['已拒绝', 'rejected', `${reason}已提交世界保持不变。`];
  }
  if (!frame.changed) return ['重复请求', 'unchanged', '原请求已记录，本次重试未改变已提交世界。'];
  if (descriptions[frame.label]) return ['已提交', 'committed', descriptions[frame.label]];
  if (frame.action) {
    const { type, x, z, level } = frame.action;
    return ['已提交', 'committed', `在第 ${level} 层网格（${x}，${z}）执行${actions[type] ?? '操作'}。`];
  }
  return ['已提交', 'committed', '用户决策已写入 T12 日志。'];
}

async function start() {
  const response = await fetch('./frames.json');
  if (!response.ok) throw new Error(`frames.json: HTTP ${response.status}`);
  const data = await response.json();
  if (data.frames.length !== 49 || data.frames.some((f, i) => f.step !== i + 1 || !data.scenes[f.scene])) {
    throw new Error('Expected a complete 49-step T12 payload');
  }
  const { frames, scenes, milestones, grid } = data;
  let view;
  try {
    const { createScene } = await import('./scene.mjs');
    view = createScene(host, grid);
    reset.disabled = false;
    reset.addEventListener('click', view.reset);
    host.dataset.renderer = 'three';
  } catch (error) {
    console.warn('Using floor plans instead of WebGL', error);
    view = planView(grid);
    host.dataset.renderer = 'plan';
  }
  byId('view-message').hidden = true;
  byId('grid-label').textContent = `${grid.width} × ${grid.depth} 网格 · ${grid.levels} 层`;
  byId('provenance').textContent = `D 阶段验证记录 · ${data.source.base.slice(0, 7)}`;
  let current = 0;
  let sceneId = -1;
  let timer = null;
  let technical = false;
  const allSteps = [0, ...frames.map(f => f.step)];
  const userSteps = [0, ...frames.filter(f => !f.idempotent &&
    !['EVENT_ID_CONFLICT', 'PUBLICATION_FAILED', 'STALE_PREFIX'].includes(f.code)).map(f => f.step)];
  const steps = () => technical ? allSteps : userSteps;
  const adjacent = offset => steps()[steps().indexOf(current) + offset];

  function setTechnical(value) {
    technical = value;
    technicalToggle.textContent = value ? '仅显示用户流程' : '显示全部 49 步';
    technicalToggle.setAttribute('aria-pressed', String(value));
  }

  function pause() {
    clearInterval(timer);
    timer = null;
    play.textContent = '▶ 播放';
    play.setAttribute('aria-pressed', 'false');
  }

  function show(step) {
    current = step;
    const frame = frames[step - 1];
    const committed = frame?.scene ?? 0;
    const model = scenes[committed];
    if (committed !== sceneId) {
      view.render(model);
      sceneId = committed;
      host.dataset.scene = String(committed);
    }
    const [status, kind, detail] = resultFor(frame);
    byId('step-count').textContent = `第 ${step} 步 / 共 ${frames.length} 步`;
    byId('step-title').textContent = titleFor(frame);
    byId('step-detail').textContent = detail;
    const pill = byId('status');
    pill.textContent = status;
    pill.dataset.kind = kind;
    const code = byId('step-code');
    code.textContent = frame?.code ?? '';
    code.hidden = !frame?.code;
    updateFacts(model);
    seek.max = steps().length - 1;
    seek.value = steps().indexOf(step);
    seek.setAttribute('aria-valuetext', `第 ${step} 步，共 ${frames.length} 步`);
    prev.disabled = step === 0;
    next.disabled = step === frames.length;
    for (const button of milestoneList.children) {
      if (Number(button.dataset.step) === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    history.replaceState(null, '', `#step=${step}`);
  }

  function jump(step) {
    pause();
    show(step);
  }

  for (const { step } of milestones) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'milestone';
    button.dataset.step = step;
    const number = document.createElement('span');
    number.textContent = String(step).padStart(2, '0');
    button.append(number, document.createTextNode(titleFor(frames[step - 1])));
    button.addEventListener('click', () => jump(step));
    milestoneList.append(button);
  }

  seek.addEventListener('input', () => jump(steps()[Number(seek.value)]));
  prev.addEventListener('click', () => jump(adjacent(-1)));
  next.addEventListener('click', () => jump(adjacent(1)));
  technicalToggle.addEventListener('click', () => {
    setTechnical(!technical);
    jump(steps().includes(current) ? current : steps().findLast(step => step < current));
  });
  play.addEventListener('click', () => {
    if (timer !== null) return pause();
    if (current === frames.length) show(0);
    play.textContent = '⏸ 暂停';
    play.setAttribute('aria-pressed', 'true');
    timer = setInterval(() => {
      show(adjacent(1));
      if (current === frames.length) pause();
    }, 720);
  });
  const fromHash = () => {
    const match = /^#step=(\d+)$/.exec(location.hash);
    return match && Number(match[1]) <= frames.length ? Number(match[1]) : milestones[0].step;
  };
  function openHash() {
    const step = fromHash();
    if (!steps().includes(step)) setTechnical(true);
    jump(step);
  }
  window.addEventListener('hashchange', openHash);
  seek.disabled = false;
  play.disabled = false;
  technicalToggle.disabled = false;
  openHash();
}

start().catch(error => {
  console.error(error);
  byId('view-message').textContent = '无法加载 T12 数据。请通过本地 HTTP 预览地址打开此页。';
  byId('status').textContent = '无法加载';
});
