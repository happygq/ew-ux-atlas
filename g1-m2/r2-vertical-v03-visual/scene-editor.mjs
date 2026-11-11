import * as THREE from 'three';

const CLICK_DISTANCE = 5;
const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

function cellMarker(color, opacity, order) {
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(.92, .92).rotateX(-Math.PI / 2);
  const fill = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  }));
  fill.renderOrder = order;
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({
    color, transparent: true, opacity: .92, depthTest: false, depthWrite: false,
  }));
  edge.renderOrder = order + 1;
  group.add(fill, edge);
  group.visible = false;
  return group;
}

// Editing is mounted only on the practice view. The playback canvas stays read-only.
export function createEditor({ canvas, camera, scene, grid, levelHeight, paint, onEdit, onHover }) {
  const guide = cellMarker('#bb631c', .35, 20);
  const cursor = cellMarker('#27635b', .24, 22);
  const lines = [];
  for (let x = 0; x <= grid.width; x++) lines.push(x, 0, 0, x, 0, -grid.depth);
  for (let z = 0; z <= grid.depth; z++) lines.push(0, 0, -z, grid.width, 0, -z);
  const planeGrid = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)),
    new THREE.LineBasicMaterial({ color: '#748b7d', opacity: .36, transparent: true, depthWrite: false }),
  );
  scene.add(planeGrid, guide, cursor);

  let level = 0;
  let target = null;
  let cell = null;
  let press = null;
  let meshes = [];
  const pointer = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
  const hit = new THREE.Vector3();
  const inGrid = (x, z) => x >= 0 && x < grid.width && z >= 0 && z < grid.depth;
  const gridHeight = () => level * levelHeight + .04;

  function place(marker, at, yOffset) {
    marker.visible = Boolean(at);
    if (at) marker.position.set(at.x + .5, at.level * levelHeight + yOffset, -at.z - .5);
  }

  function choose(at) {
    cell = at;
    place(cursor, at, .17);
    onHover?.(at);
    paint();
  }

  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    const u = (event.clientX - rect.left) / rect.width;
    const v = (event.clientY - rect.top) / rect.height;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return null;
    pointer.set(2 * u - 1, 1 - 2 * v);
    ray.setFromCamera(pointer, camera);
    // The target is drawn over the model. Clicking its visible tile takes
    // precedence over a neighboring volume that overlaps it in projection.
    if (target?.level === level && ray.intersectObject(guide.children[0], false).length) return target;
    const match = ray.intersectObjects(meshes, false)[0];
    if (match) return match.object.userData.cell;
    plane.constant = -gridHeight();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const x = Math.floor(hit.x), z = Math.floor(-hit.z);
    return inGrid(x, z) ? { x, z, level } : null;
  }

  function edit(type, at) {
    if (at) onEdit(type, at);
  }

  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '建造视图。方向键选格，回车添加，Delete 移除，Shift 加回车改色。');
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('pointerdown', event => {
    if (press && !event.isPrimary && event.pointerType === 'touch') press.moved = true;
    if (!event.isPrimary || ![0, 2].includes(event.button)) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, button: event.button, moved: false };
  });
  canvas.addEventListener('pointermove', event => {
    if (press?.id === event.pointerId &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) > CLICK_DISTANCE) press.moved = true;
    if (event.isPrimary) choose(press?.moved ? null : pick(event));
  });
  canvas.addEventListener('pointerup', event => {
    if (press?.id !== event.pointerId) return;
    const { x, y, button, moved } = press;
    press = null;
    if (moved || Math.hypot(event.clientX - x, event.clientY - y) > CLICK_DISTANCE) return;
    const at = pick(event);
    choose(at);
    edit(button === 2 ? 'Remove' : event.shiftKey ? 'Recolor' : 'Add', at);
  });
  canvas.addEventListener('pointercancel', event => {
    if (press?.id === event.pointerId) press = null;
    choose(null);
  });
  canvas.addEventListener('pointerleave', () => choose(null));
  canvas.addEventListener('keydown', event => {
    const direction = directions[event.key];
    if (!direction && event.key !== 'Enter' && event.key !== 'Delete') return;
    event.preventDefault();
    const at = cell ?? (target?.level === level ? target : { x: 0, z: 0, level });
    if (direction) {
      const x = THREE.MathUtils.clamp(at.x + direction[0], 0, grid.width - 1);
      const z = THREE.MathUtils.clamp(at.z + direction[1], 0, grid.depth - 1);
      choose({ x, z, level });
    } else {
      choose(at);
      edit(event.key === 'Delete' ? 'Remove' : event.shiftKey ? 'Recolor' : 'Add', at);
    }
  });

  let allMeshes = [];
  function useLayer() {
    meshes = allMeshes.filter(mesh => mesh.userData.cell.level === level);
    planeGrid.visible = level > 0;
    planeGrid.position.y = gridHeight();
  }
  useLayer();

  return {
    setMeshes(value) {
      allMeshes = value;
      useLayer();
    },
    setLayer(value) {
      level = value;
      useLayer();
      choose(null);
    },
    setTarget(value) {
      target = value;
      place(guide, value, .165);
      paint();
    },
  };
}
