const byId = id => document.getElementById(id);
const host = byId('scene');
const seek = byId('seek');
const play = byId('play');
const prev = byId('prev');
const next = byId('next');
const reset = byId('reset-view');
const milestoneList = byId('milestones');
const descriptions = {
  'seal-court': 'The accepted roof decision seals the courtyard from the sky.',
  'replace-support': 'The approved support switches from north–south to east–west. The supported unit keeps its ID.',
  'unseal-court': 'Removing the upper wall retires the roof decision and reconnects the courtyard to the sky.',
  'remove-south-landing': 'The south stair loses its landing and its abstract passage disappears.',
  'approve-restored-south': 'The rebuilt landing receives a new abstract stair approval.',
};

function planView(grid) {
  const palette = { court: '#638679', east: '#586d8e', south: '#ae715a', support: '#9b8050' };
  const wrap = document.createElement('div');
  wrap.className = 'fallback';
  const note = document.createElement('p');
  note.textContent = 'WebGL is unavailable. Showing the same occupied cells as floor plans.';
  wrap.append(note);
  host.replaceChildren(wrap);
  const cells = Array.from({ length: grid.levels }, (_, level) => {
    const floor = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = `Level ${level}`;
    const plan = document.createElement('div');
    plan.className = 'plan';
    plan.style.setProperty('--cols', grid.width);
    const tiles = Array.from({ length: grid.width * grid.depth }, () => document.createElement('span'));
    plan.append(...tiles);
    floor.append(title, plan);
    wrap.append(floor);
    return tiles;
  });
  byId('gesture').textContent = 'Floor plan fallback';
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
    const state = court.skyConnected ? 'Reopened · connected to sky' : 'Sealed · sky blocked';
    setFact('court-fact', state, [court.voidRegionId, court.tiles[0]?.id].filter(Boolean).join(' · '));
  } else setFact('court-fact', 'No recorded courtyard decision yet');

  const [support] = model.supports;
  if (support) {
    const axis = support.orientation === 'EW' ? 'East–west' : 'North–south';
    setFact('support-fact', `${axis} · ${support.unitId}`, support.sources.map(s => s.unitId).join(' + '));
  } else setFact('support-fact', 'No mixed room admitted yet');

  const south = model.openings.findLast(o => o.endpoints[0].buildingId === 'south');
  const n = model.passageIds.length;
  const state = `${n} approved ${n === 1 ? 'route' : 'routes'}`;
  const status = south && !model.passageIds.includes(south.intentId) ? `South ${south.status.toLowerCase()} · ${state}` : state;
  setFact('stair-fact', status, south?.intentId ?? model.passageIds[0]);
}

function resultFor(frame) {
  if (!frame) return ['Initial state', 'unchanged', 'The committed grid is empty.'];
  if (frame.status === 'PENDING_CHOICE') return ['Pending choice', 'pending', 'The request is staged. The committed world is unchanged.'];
  if (frame.code === 'PUBLICATION_FAILED') return ['Publish failed', 'failed', 'Publication failed. The committed world is unchanged.'];
  if (frame.status === 'REJECTED') return ['Rejected', 'rejected', 'The request was rejected. The committed world is unchanged.'];
  if (!frame.changed) return ['Idempotent retry', 'unchanged', 'This request was already recorded. The committed world is unchanged.'];
  if (descriptions[frame.label]) return ['Committed', 'committed', descriptions[frame.label]];
  if (frame.action) {
    const { type, x, z, level } = frame.action;
    return ['Committed', 'committed', `${type} at grid (${x}, ${z}), level ${level}.`];
  }
  return ['Committed', 'committed', 'An explicit decision was recorded in the T12 journal.'];
}

async function start() {
  const response = await fetch('./frames.json');
  if (!response.ok) throw new Error(`frames.json: HTTP ${response.status}`);
  const data = await response.json();
  if (data.frames.length !== 49 || data.frames.some((f, i) => f.step !== i + 1 || !data.scenes[f.scene])) {
    throw new Error('Expected a complete 49-step T12 payload');
  }
  const { frames, scenes, milestones, grid } = data;
  const titles = new Map(milestones.map(m => [m.label, m.title]));
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
  byId('grid-label').textContent = `${grid.width} × ${grid.depth} grid · ${grid.levels} levels`;
  byId('provenance').textContent = `Stage D witness · ${data.source.base.slice(0, 7)}`;
  let current = 0;
  let sceneId = -1;
  let timer = null;

  function pause() {
    clearInterval(timer);
    timer = null;
    play.textContent = '▶ Play';
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
    byId('step-count').textContent = `Step ${step} / ${frames.length}`;
    byId('step-title').textContent = frame ? titles.get(frame.label) ?? frame.label.replaceAll('-', ' ') : 'Empty world';
    byId('step-detail').textContent = detail;
    const pill = byId('status');
    pill.textContent = status;
    pill.dataset.kind = kind;
    const code = byId('step-code');
    code.textContent = frame?.code ?? '';
    code.hidden = !frame?.code;
    updateFacts(model);
    seek.value = step;
    seek.setAttribute('aria-valuetext', `Step ${step} of ${frames.length}`);
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

  for (const { step, title } of milestones) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'milestone';
    button.dataset.step = step;
    const number = document.createElement('span');
    number.textContent = String(step).padStart(2, '0');
    button.append(number, document.createTextNode(title));
    button.addEventListener('click', () => jump(step));
    milestoneList.append(button);
  }

  seek.addEventListener('input', () => jump(Number(seek.value)));
  prev.addEventListener('click', () => jump(current - 1));
  next.addEventListener('click', () => jump(current + 1));
  play.addEventListener('click', () => {
    if (timer !== null) return pause();
    if (current === frames.length) show(0);
    play.textContent = '⏸ Pause';
    play.setAttribute('aria-pressed', 'true');
    timer = setInterval(() => {
      show(current + 1);
      if (current === frames.length) pause();
    }, 720);
  });
  const fromHash = () => {
    const match = /^#step=(\d+)$/.exec(location.hash);
    return match && Number(match[1]) <= frames.length ? Number(match[1]) : milestones[0].step;
  };
  window.addEventListener('hashchange', () => jump(fromHash()));
  seek.disabled = false;
  play.disabled = false;
  jump(fromHash());
}

start().catch(error => {
  console.error(error);
  byId('view-message').textContent = 'The T12 data could not load. Open this page from the local HTTP server.';
  byId('status').textContent = 'Unavailable';
});
