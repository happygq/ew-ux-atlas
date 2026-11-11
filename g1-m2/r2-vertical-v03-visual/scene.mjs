import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createEditor } from './scene-editor.mjs';

const LEVEL = 1.42;
const buildingColors = { east: '#586d8e', south: '#ae715a', support: '#9b8050', court: '#638679' };
const tints = { MIST: '#a3bdbd', SILK: '#cd8b79', MOUNTAIN: '#45584f' };
const colorFor = unit => {
  const color = new THREE.Color(buildingColors[unit.buildingId] ?? '#65726b');
  if (tints[unit.color]) color.lerp(new THREE.Color(tints[unit.color]), .74);
  return color;
};
const position = (x, level, z) => new THREE.Vector3(x, level * LEVEL, -z);
const material = (color, opacity = 1) => new THREE.MeshStandardMaterial({
  color, roughness: .82, transparent: opacity !== 1, opacity, depthWrite: opacity === 1,
});

function box(parent, size, at, paint, edge = null) {
  const geometry = new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, paint);
  mesh.position.copy(at);
  parent.add(mesh);
  if (edge) {
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: edge, transparent: true, opacity: .57 }));
    wire.position.copy(at);
    parent.add(wire);
  }
  return mesh;
}

function segment(parent, from, to, radius, color, overlay = false) {
  const axis = new THREE.Vector3().subVectors(to, from);
  const geometry = new THREE.CylinderGeometry(radius, radius, axis.length(), 8);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, depthTest: !overlay, depthWrite: !overlay }));
  mesh.position.copy(from).lerp(to, .5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
  mesh.renderOrder = overlay ? 10 : 0;
  parent.add(mesh);
}

function marker(parent, at, radius, color, overlay = false) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 6),
    new THREE.MeshBasicMaterial({ color, depthTest: !overlay, depthWrite: !overlay }));
  mesh.position.copy(at);
  mesh.renderOrder = overlay ? 11 : 0;
  parent.add(mesh);
}

function addGrid(scene, { width, depth }) {
  box(scene, [width + .32, .13, depth + .32], position(width / 2, -.05, depth / 2),
    material('#e2e2d6'), '#b6b9aa');
  const lines = [];
  for (let x = 0; x <= width; x++) lines.push(x, .002, 0, x, .002, -depth);
  for (let z = 0; z <= depth; z++) lines.push(0, .002, -z, width, .002, -z);
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  scene.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#b5baad' })));
}

function addUnit(parent, unit, pickable) {
  const { x, z, level, supportRole } = unit;
  const color = colorFor(unit);
  const outline = buildingColors[unit.buildingId] ?? '#65726b';
  const part = mesh => {
    if (pickable) {
      mesh.userData.cell = { x, z, level };
      pickable.push(mesh);
    }
  };
  const center = position(x + .5, level, z + .5);
  const floor = center.clone().add(new THREE.Vector3(0, .075, 0));
  part(box(parent, [.92, .13, .92], floor, material(color.clone().lerp(new THREE.Color('#fff7e9'), .22)), outline));
  const height = .89;
  const middle = center.clone().add(new THREE.Vector3(0, height / 2 + .14, 0));
  if (supportRole === 'COLUMN') {
    part(box(parent, [.18, height, .18], middle, material(color), outline));
  } else {
    part(box(parent, [.87, height, .87], middle, material(color, level ? .28 : .35), outline));
    part(box(parent, [.89, .035, .89], center.clone().add(new THREE.Vector3(0, height + .15, 0)), material(color, .38)));
  }
}

function addCourt(parent, court, lattice) {
  const hue = '#487767';
  for (const { x, z } of court.footprint) {
    box(parent, [.94, .028, .94], position(x + .5, court.bottomLevel + .018, z + .5), material(hue, .42), hue);
  }
  for (const tile of court.tiles) {
    const { u0, u1, v0, v1, plane } = tile.bounds;
    if (tile.kind === 'ROOF' && !tile.airOpen) {
      box(parent, [(u1 - u0) / lattice - .025, .07, (v1 - v0) / lattice - .025],
        position((u0 + u1) / (2 * lattice), plane, (v0 + v1) / (2 * lattice)), material(hue), hue);
    }
  }
  if (!court.roofClosure && court.skyConnected) {
    for (const { x, z } of court.footprint) {
      const y = court.topLevel + 1;
      const points = [[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1]]
        .map(([u, v]) => position(u, y, v));
      for (let i = 0; i < 4; i++) {
        const a = points[i], b = points[(i + 1) % 4];
        for (let k = 0; k < 3; k++) segment(parent, a.clone().lerp(b, k / 3), a.clone().lerp(b, k / 3 + .19), .015, hue);
      }
    }
  }
}

function addSupport(parent, support, units) {
  const upper = units.get(support.unitId);
  if (!upper) return;
  const to = position(upper.x + .5, upper.level + .23, upper.z + .5);
  const hue = '#a06325';
  for (const source of support.sources) {
    const unit = units.get(source.unitId);
    if (!unit) continue;
    const from = position(unit.x + .5, unit.level + .64, unit.z + .5);
    segment(parent, from, to, .026, hue);
    marker(parent, from, .058, hue);
  }
  marker(parent, to, .066, hue);
}

function addStair(parent, opening, lattice) {
  const [from, to] = opening.endpoints.map(({ bounds: b }) => position(
    (b.x0 + b.x1) / (2 * lattice), (b.y0 + b.y1) / 2, (b.z0 + b.z1) / (2 * lattice)));
  const hue = '#087780';
  for (let i = 0; i < 6; i++) {
    segment(parent, from.clone().lerp(to, i / 6), from.clone().lerp(to, i / 6 + .10), .036, hue, true);
  }
  marker(parent, from, .072, hue, true);
  marker(parent, to, .072, hue, true);
}

export function createScene(host, grid, interaction) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearAlpha(0);
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fffaf0', '#88918b', 2.15));
  const sun = new THREE.DirectionalLight('#fff4d9', 2.1);
  sun.position.set(-5, 12, 6);
  scene.add(sun);
  addGrid(scene, grid);
  const content = new THREE.Group();
  scene.add(content);
  const target = position(grid.width / 2, .32, grid.depth / 2);
  const initial = target.clone().add(new THREE.Vector3(7.7, 9.8, 9.4));
  const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, .1, 80);
  camera.position.copy(initial);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.minZoom = .45;
  controls.maxZoom = 3;
  controls.maxPolarAngle = Math.PI * .47;
  controls.update();
  controls.saveState();
  const paint = () => renderer.render(scene, camera);
  controls.addEventListener('change', paint);
  const editor = interaction ? createEditor({
    ...interaction, canvas: renderer.domElement, camera, scene, grid, levelHeight: LEVEL, paint,
  }) : null;

  function resize() {
    const { clientWidth: width, clientHeight: height } = host;
    if (!width || !height) return;
    const aspect = width / height;
    const half = Math.max(4.17, 5.95 / aspect);
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    paint();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  return {
    editor,
    reset: () => controls.reset(),
    render(model) {
      for (const item of [...content.children]) {
        item.geometry.dispose();
        item.material.dispose();
        content.remove(item);
      }
      const units = new Map(model.units.map(unit => [unit.unitId, unit]));
      const pickable = editor ? [] : null;
      model.units.forEach(unit => addUnit(content, unit, pickable));
      editor?.setMeshes(pickable);
      model.courts.forEach(court => addCourt(content, court, grid.lattice));
      model.supports.forEach(support => addSupport(content, support, units));
      const passageIds = new Set(model.passageIds);
      model.openings.filter(o => o.kind === 'STAIR' && passageIds.has(o.intentId) &&
        o.abstractRouteAuthorized && !o.physicalPassable && o.endpoints.every(e => e.bounds))
        .forEach(opening => addStair(content, opening, grid.lattice));
      paint();
    },
  };
}
