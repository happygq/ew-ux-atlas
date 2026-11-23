import * as T from '../../g1-m2/r2-vertical-v03-visual/vendor/three.module.min.js';
import { atPoint, HALF, SIZE, center, xOf, zOf } from './world.mjs';
import { buildArchitecture, createArchitectureMaterials } from './architecture.mjs';
import { makeLandscape } from './landscape.mjs';
import { plotSignature } from './spatial.mjs';

const SNAP = 5;
const START = { x: -19, z: -24, pitch: .74, orbit: .61, span: 59 };
const OVERVIEW = { x: 0, z: 0, pitch: 1.29, orbit: .08, span: 144 };
const clamp = T.MathUtils.clamp;
const ease = value => 1 - (1 - value) ** 3;

function free(group) {
  group.removeFromParent();
  for (const mesh of group.children) mesh.geometry.dispose();
}

export function createView(canvas, onFrame) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new T.Scene();
  scene.background = new T.Color('#dce3ce');
  scene.fog = new T.Fog('#dce3ce', 115, 440);
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 620);
  const target = { ...START };
  const current = { ...START };
  const sun = new T.DirectionalLight('#ffedd1', 2.46);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = .026;
  sun.shadow.bias = -.00013;
  sun.shadow.camera.near = 3;
  sun.shadow.camera.far = 240;
  scene.add(sun, sun.target, new T.HemisphereLight('#e1ecf2', '#82755c', 2.03));
  const skyFill = new T.DirectionalLight('#c3d3da', .36);
  skyFill.position.set(24, 12, -32);
  scene.add(skyFill);

  const { grid, faceCamera } = makeLandscape(scene);
  const materials = createArchitectureMaterials();
  const chunks = new Map();
  const active = new Map();
  const effects = [];
  const board = new T.Group();
  scene.add(board);
  const line = new T.LineLoop(
    new T.BufferGeometry().setFromPoints([
      new T.Vector3(-1, 0, -1), new T.Vector3(1, 0, -1),
      new T.Vector3(1, 0, 1), new T.Vector3(-1, 0, 1),
    ]),
    new T.LineBasicMaterial({ color: '#fff0c8', depthTest: true, transparent: true, opacity: .95 }),
  );
  const highlight = new T.Mesh(new T.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({ color: '#fff0c8', transparent: true, opacity: .22, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1 }));
  const cursor = new T.Group();
  cursor.add(highlight, line);
  cursor.scale.setScalar(1.955);
  cursor.visible = false;
  line.position.y = .015;
  scene.add(cursor);
  const ray = new T.Raycaster();
  const ndc = new T.Vector2();
  const hit = new T.Vector3();
  const plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  const hits = [];
  let previous = [];
  let latest;
  let width = 1, height = 1, aspect = 1;
  let draw = 0;
  let needsShadows = true;
  let shadowX = Infinity, shadowZ = Infinity, shadowSpan = Infinity;
  let lastFrame = 0;

  const chunkColumns = Math.ceil(SIZE / SNAP);
  const chunkId = id => Math.floor(xOf(id) / SNAP) + chunkColumns * Math.floor(zOf(id) / SNAP);
  function rebuild(id) {
    if (chunks.has(id)) {
      free(chunks.get(id));
      chunks.delete(id);
    }
    const plots = latest.plots.filter(p => p && chunkId(p.id) === id && !active.has(p.id));
    if (!plots.length) return;
    const group = buildArchitecture(plots, materials);
    board.add(group);
    chunks.set(id, group);
  }

  function sync(model, change) {
    latest = model;
    const edited = new Set();
    // If another operation changes an active room, commit its current geometry immediately.
    for (const [id, effect] of active) {
      if (plotSignature(model.plots[id]) === previous[id]) continue;
      free(effect.group);
      active.delete(id);
      edited.add(chunkId(id));
    }
    if (change?.type === 'add') {
      const id = change.id;
      const group = buildArchitecture([model.plots[id]], materials);
      group.position.y = -.68;
      active.set(id, { group, start: performance.now() });
      board.add(group);
    }
    for (let id = 0; id < model.plots.length; id++) {
      const signature = plotSignature(model.plots[id]);
      if (signature !== (previous[id] ?? '')) edited.add(chunkId(id));
      previous[id] = signature;
    }
    for (const id of edited) rebuild(id);
    if (change) pulse(change.id, change.type);
    needsShadows = true;
    requestDraw();
  }

  function pulse(id, type) {
    const [x, z] = center(id);
    const mesh = new T.Mesh(new T.RingGeometry(.93, 1, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2),
      new T.MeshBasicMaterial({ color: type === 'remove' ? '#e8a68a' : '#fae8b3', transparent: true,
        opacity: .78, depthWrite: false, side: T.DoubleSide }));
    mesh.position.set(x, .1, z);
    scene.add(mesh);
    effects.push({ mesh, start: performance.now() });
  }

  function resize() {
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    aspect = width / height;
    renderer.setSize(width, height, false);
    requestDraw();
  }

  function cameraPose() {
    const range = 124;
    const reach = Math.cos(current.pitch) * range;
    camera.position.set(current.x + Math.sin(current.orbit) * reach, Math.sin(current.pitch) * range,
      current.z + Math.cos(current.orbit) * reach);
    camera.lookAt(current.x, 0, current.z);
    camera.matrixWorldNeedsUpdate = true;
    const span = current.span / Math.min(1, aspect * 1.38);
    camera.left = -span * aspect / 2;
    camera.right = span * aspect / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    faceCamera(current.pitch, current.orbit);
    if (Math.abs(shadowX - current.x) > 5 || Math.abs(shadowZ - current.z) > 5
      || Math.abs(shadowSpan - span) > 8) {
      shadowX = current.x;
      shadowZ = current.z;
      shadowSpan = span;
      const reach = Math.max(27, Math.min(120, span * Math.max(.79, .57 * aspect)));
      Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach });
      sun.shadow.camera.updateProjectionMatrix();
      sun.target.position.set(current.x, 0, current.z);
      sun.position.set(current.x - 58, 101, current.z - 39);
      needsShadows = true;
    }
  }

  function frame(now) {
    draw = 0;
    const smoothing = 1 - .75 ** clamp((now - lastFrame) / (1000 / 60), .65, 5);
    lastFrame = now;
    let moving = false;
    for (const name of Object.keys(target)) {
      const delta = target[name] - current[name];
      current[name] += Math.abs(delta) < .006 ? delta : delta * smoothing;
      moving ||= Math.abs(delta) >= .006;
    }
    cameraPose();
    const ended = new Set();
    for (const [id, effect] of active) {
      const phase = Math.min(1, (now - effect.start) / 235);
      effect.group.position.y = -.68 * (1 - ease(phase));
      needsShadows = true;
      if (phase < 1) continue;
      free(effect.group);
      active.delete(id);
      ended.add(chunkId(id));
    }
    for (const id of ended) rebuild(id);
    for (let i = effects.length - 1; i >= 0; i--) {
      const { mesh, start } = effects[i];
      const phase = Math.min(1, (now - start) / 430);
      mesh.scale.setScalar(2.82 + ease(phase) * 1.4);
      mesh.material.opacity = .75 * (1 - phase);
      if (phase < 1) continue;
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
      effects.splice(i, 1);
    }
    board.updateMatrixWorld(true);
    onFrame(current);
    if (needsShadows) renderer.shadowMap.needsUpdate = true;
    needsShadows = false;
    renderer.render(scene, camera);
    if (moving || active.size || effects.length) requestDraw();
  }

  function requestDraw() {
    if (!draw) draw = requestAnimationFrame(frame);
  }

  function locate(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set((clientX - rect.left) / width * 2 - 1, -((clientY - rect.top) / height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    hits.length = 0;
    for (const group of board.children) {
      for (const object of group.children) {
        if (object.userData.buildings) ray.intersectObject(object, false, hits);
      }
    }
    const facade = hits[0];
    if (facade) {
      const id = facade.object.userData.plotIds[facade.faceIndex];
      return { id, occupied: true, building: true };
    }
    if (!ray.ray.intersectPlane(plane, hit)) return { id: -1, occupied: false, building: false };
    const id = atPoint(hit.x, hit.z);
    return { id, occupied: latest?.plots[id]?.kind === 'room', building: false };
  }

  function mark(plot, mode) {
    const visible = plot && plot.id >= 0 && (mode === 'add' ? !plot.occupied : plot.occupied);
    cursor.visible = !!visible;
    grid.material.opacity = mode === 'add' ? .16 : .065;
    if (!visible) return;
    const [x, z] = center(plot.id);
    const tint = mode === 'remove' ? '#e89776' : mode === 'recolor' ? '#aecbc5' : '#fff1c3';
    cursor.position.set(x, plot.occupied ? 4.995 : .048, z);
    line.material.color.set(tint);
    highlight.material.color.set(tint);
    highlight.material.opacity = plot.occupied ? .095 : .27;
  }

  function orbit(dx, dy) {
    target.orbit -= dx * .008;
    target.pitch = clamp(target.pitch + dy * .007, .27, 1.52);
    requestDraw();
  }

  function pan(dx, dy) {
    const meters = (current.span / Math.min(1, aspect * 1.38)) / height;
    const side = -dx * meters, forward = -dy * meters / Math.sin(current.pitch);
    const a = current.orbit;
    focus(target.x + Math.cos(a) * side + Math.sin(a) * forward,
      target.z - Math.sin(a) * side + Math.cos(a) * forward);
  }

  function zoom(amount, x, y) {
    const from = target.span;
    target.span = clamp(from * amount, 8, 176);
    if (x !== undefined && y !== undefined && from !== target.span) {
      const box = canvas.getBoundingClientRect();
      const fraction = 1 - target.span / from;
      pan((width / 2 + box.left - x) * fraction, (height / 2 + box.top - y) * fraction);
    }
    requestDraw();
  }

  function focus(x, z, span) {
    target.x = clamp(x, -HALF, HALF);
    target.z = clamp(z, -HALF, HALF);
    if (span) target.span = span;
    requestDraw();
  }

  function overview() {
    const close = target.span <= 105;
    Object.assign(target, close ? OVERVIEW : START);
    requestDraw();
  }

  function project(x, z, y = 0) {
    const rect = canvas.getBoundingClientRect();
    const p = new T.Vector3(x, y, z).project(camera);
    return [(p.x + 1) * width / 2 + rect.left, (1 - p.y) * height / 2 + rect.top];
  }

  new ResizeObserver(resize).observe(canvas);
  resize();
  return { sync, orbit, pan, zoom, focus, overview, locate, mark, project, requestDraw,
    camera: () => ({ ...current }), stats: () => ({ ...renderer.info.render, chunks: chunks.size }) };
}
