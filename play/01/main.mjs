import { BAY, HALF, PALETTES, SIZE, center, createWorld, xOf, zOf } from './world.mjs';
import { derive } from './spatial.mjs';
import { createView } from './view.mjs';

const element = id => document.getElementById(id);
const status = element('notice');
const canvas = element('valley');
const map = element('map');
const mapContext = map.getContext('2d');
const holdMeter = element('hold-meter');
const HOLD_MS = 550;
const DRAG_PIXELS = 7;
const world = createWorld();
let model = derive(world);
let palette = 0;
let hover = null;
let holdTarget = null;
let view;
holdMeter.style.setProperty('--hold-time', `${HOLD_MS}ms`);
const mapBounds = { left: 40, top: 16, width: 184, height: 184 };
const swatches = PALETTES.map(({ name, chip }, i) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'swatch';
  button.title = name;
  button.setAttribute('aria-label', `${name} palette`);
  button.setAttribute('aria-pressed', String(i === 0));
  button.style.setProperty('--chip', chip);
  button.addEventListener('click', () => {
    palette = i;
    swatches.forEach((swatch, index) => swatch.setAttribute('aria-pressed', String(index === i)));
    status.textContent = `${name} selected for new bays. Different colors stay separate.`;
  });
  element('palettes').append(button);
  return button;
});

function drawMap(camera) {
  const ctx = mapContext;
  const { left, top, width, height } = mapBounds;
  ctx.fillStyle = '#678d86';
  ctx.fillRect(0, 0, map.width, map.height);
  ctx.fillStyle = '#9fa573';
  ctx.beginPath();
  ctx.roundRect(left - 9, top - 7, width + 17, height + 14, 10);
  ctx.fill();
  ctx.fillStyle = '#b0b683';
  ctx.fillRect(left, top, width, height);
  ctx.strokeStyle = '#e7e0b647';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    ctx.beginPath();
    ctx.moveTo(left + width * t, top);
    ctx.lineTo(left + width * t, top + height);
    ctx.moveTo(left, top + height * t);
    ctx.lineTo(left + width, top + height * t);
    ctx.stroke();
  }
  const px = width / SIZE, py = height / SIZE;
  for (const room of model.rooms) {
    const x = left + xOf(room.id) * px, y = top + zOf(room.id) * py;
    ctx.fillStyle = '#48665a';
    ctx.fillRect(x, y, px, py);
    ctx.fillStyle = PALETTES[room.palette].chip;
    ctx.fillRect(x + 1, y + 1, px - 2, py - 2);
  }
  const cx = left + (camera.x + HALF) / (HALF * 2) * width;
  const cy = top + (camera.z + HALF) / (HALF * 2) * height;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-camera.orbit);
  ctx.fillStyle = '#dd8a52';
  ctx.strokeStyle = '#fff1d3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(6, 6);
  ctx.lineTo(0, 3.5);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#f7ebcc';
  ctx.font = 'bold 16px Georgia';
  ctx.fillText('N', 10, 27);
}

function frame(camera) {
  drawMap(camera);
  const target = holdTarget ?? (hover && view.locate(...hover));
  const selectable = target && target.id >= 0 && (target.building || !target.occupied);
  if (selectable) canvas.dataset.target = target.building ? 'room' : 'ground';
  else delete canvas.dataset.target;
  view.mark(selectable ? target : null, target?.building ? 'remove' : 'add');
}

function updateLedger() {
  element('rooms').textContent = world.size;
  element('room-label').textContent = world.size === 1 ? 'bay' : 'bays';
  element('homes').textContent = model.compounds.length;
  element('home-label').textContent = model.compounds.length === 1 ? 'household' : 'households';
  element('courts').textContent = model.courts.length;
  element('court-label').textContent = model.courts.length === 1 ? 'courtyard' : 'courtyards';
  element('undo').disabled = !world.canUndo;
}

function edit(command) {
  const result = world.edit(command);
  if (!result.ok) {
    status.textContent = result.reason;
    return result;
  }
  const previous = model;
  model = derive(world);
  view.sync(model, result);
  updateLedger();
  const enclosed = model.courts.find(court => court.kind === 'enclosed'
    && !previous.courts.some(old => old.kind === 'enclosed' && old.id === court.id));
  if (command.type === 'undo') status.textContent = 'Last change undone.';
  else if (command.type === 'remove') status.textContent = 'Bay removed. Its neighbors have adapted.';
  else if (enclosed) status.textContent = 'Skywell enclosed. Follow the covered entry into the house.';
  else if (model.courts.length > previous.courts.length) status.textContent = 'Courtyard formed. Continue around the open center.';
  else if (model.plots[result.id].walls.some(wall => wall.shared)) status.textContent = 'Bay added to the same household.';
  else status.textContent = 'Independent household started.';
  return result;
}

function place(target, elapsed) {
  if (target.id < 0) {
    status.textContent = 'Choose a plot inside the valley.';
    return;
  }
  if (target.occupied && !target.building) {
    status.textContent = 'Tap an open plot, or hold a roof to remove a bay.';
    return;
  }
  if (target.building && elapsed < HOLD_MS) {
    status.textContent = 'Hold the roof until the ring fills, then release to remove it.';
    return;
  }
  edit({ type: target.building ? 'remove' : 'add', x: xOf(target.id), z: zOf(target.id), palette });
}

function bindSceneControls() {
  const pointers = new Map();
  let gesture = false;
  const point = event => [event.clientX, event.clientY];
  const moved = ([x, y], [startX, startY]) => Math.hypot(x - startX, y - startY) > DRAG_PIXELS;
  function clearHold() {
    holdTarget = null;
    holdMeter.hidden = true;
  }
  function showHold(target, [x, y]) {
    holdTarget = target;
    holdMeter.style.left = `${Math.max(20, Math.min(innerWidth - 20, x))}px`;
    holdMeter.style.top = `${y < 64 ? y + 39 : y - 39}px`;
    holdMeter.hidden = false;
  }
  function metrics() {
    const [{ at: a }, { at: b }] = pointers.values();
    return { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, gap: Math.hypot(a[0] - b[0], a[1] - b[1]) };
  }
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button > 2) return;
    if (!pointers.size) gesture = false;
    const at = point(event);
    const pan = event.button !== 0 || event.shiftKey;
    gesture ||= pointers.size > 0 || pan;
    const target = gesture ? null : view.locate(...at);
    pointers.set(event.pointerId, { at, start: at, pan, target, pressedAt: event.timeStamp });
    canvas.setPointerCapture(event.pointerId);
    hover = gesture ? null : at;
    if (gesture) {
      clearHold();
      canvas.classList.add('dragging');
    } else if (target?.building) {
      showHold(target, at);
    }
    view.requestDraw();
  });
  canvas.addEventListener('pointermove', event => {
    const at = point(event);
    const pointer = pointers.get(event.pointerId);
    if (!pointer) {
      if (event.pointerType !== 'touch') hover = at;
      view.requestDraw();
      return;
    }
    const [x, y] = pointer.at;
    const before = pointers.size > 1 ? metrics() : null;
    pointer.at = at;
    if (before) {
      const after = metrics();
      view.pan(after.x - before.x, after.y - before.y);
      if (after.gap > 5 && before.gap > 5) view.zoom(before.gap / after.gap, after.x, after.y);
    } else {
      gesture ||= moved(at, pointer.start);
      if (gesture) {
        if (pointer.pan || event.shiftKey) view.pan(at[0] - x, at[1] - y);
        else view.orbit(at[0] - x, at[1] - y);
      }
    }
    if (gesture) {
      clearHold();
      canvas.classList.add('dragging');
    }
    hover = gesture ? null : at;
    view.requestDraw();
  });
  function end(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const at = point(event);
    if (event.type === 'pointerup' && !gesture && pointers.size === 1 && !moved(at, pointer.start)) {
      const current = view.locate(...at);
      if (current.id === pointer.target.id && current.building === pointer.target.building
        && current.occupied === pointer.target.occupied) {
        place(current, event.timeStamp - pointer.pressedAt);
      }
    }
    pointers.delete(event.pointerId);
    clearHold();
    if (pointers.size) return;
    canvas.classList.remove('dragging');
    hover = event.pointerType === 'mouse' && event.type === 'pointerup' ? at : null;
    view.requestDraw();
  }
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, end);
  canvas.addEventListener('pointerleave', () => {
    hover = null;
    view.requestDraw();
  });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    if (pointers.size) {
      gesture = true;
      clearHold();
    }
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 320 : 1;
    view.zoom(Math.exp(Math.max(-450, Math.min(450, event.deltaY * unit)) * .0015), ...point(event));
  }, { passive: false });
  window.addEventListener('blur', () => {
    gesture = true;
    const captured = Array.from(pointers.keys());
    pointers.clear();
    for (const id of captured) {
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    }
    canvas.classList.remove('dragging');
    clearHold();
    hover = null;
    view.requestDraw();
  });
}

function bindButtons() {
  const undo = () => edit({ type: 'undo' });
  element('undo').addEventListener('click', undo);
  element('overview').addEventListener('click', view.overview);
  element('zoom-in').addEventListener('click', () => view.zoom(.76));
  element('zoom-out').addEventListener('click', () => view.zoom(1.32));
  element('map-button').addEventListener('click', event => {
    if (event.detail === 0) {
      view.overview();
      return;
    }
    const rect = map.getBoundingClientRect();
    const { left, top, width, height } = mapBounds;
    const u = ((event.clientX - rect.left) / rect.width * map.width - left) / width;
    const v = ((event.clientY - rect.top) / rect.height * map.height - top) / height;
    view.focus((u * 2 - 1) * HALF, (v * 2 - 1) * HALF, Math.min(view.camera().span, 45));
  });
  const help = element('help');
  const toggle = element('help-toggle');
  function showHelp(visible) {
    toggle.setAttribute('aria-expanded', String(visible));
    help.hidden = !visible;
  }
  toggle.addEventListener('click', () => showHelp(help.hidden));
  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      undo();
    } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      const swatch = swatches[Number(key) - 1];
      if (swatch) swatch.click();
      else if (key === 'v') view.overview();
      else if (key === 'escape' && !help.hidden) {
        showHelp(false);
        toggle.focus();
      }
    }
  });
}

function start() {
  try {
    view = createView(canvas, frame);
  } catch (error) {
    element('error').hidden = false;
    element('error').textContent = 'The valley could not open. Try a browser with WebGL 2 and hardware acceleration enabled.';
    for (const button of document.querySelectorAll('button')) button.disabled = true;
    console.error(error);
    return;
  }
  canvas.addEventListener('webglcontextlost', () => {
    element('error').hidden = false;
    element('error').textContent = 'The 3D connection was lost. Reload to return to the valley.';
  });
  view.sync(model);
  bindSceneControls();
  bindButtons();
  updateLedger();
}

start();

export const game = {
  edit,
  inspect: () => ({ model, rooms: world.snapshot(), camera: view?.camera(), rendering: view?.stats() }),
  project: (x, z, y) => view.project(...center(z * SIZE + x), y),
  focus: (x, z, span = 32) => view.focus(...center(z * SIZE + x), Math.max(2 * BAY, span)),
};
