import * as T from '../../g1-m2/r2-vertical-v03-visual/vendor/three.module.min.js';
import { BAY, DX, DZ, PALETTES, center } from './world.mjs';
import { DOOR, EAVE, FLOOR, PASSAGE, RIDGE, WALL } from './spatial.mjs';

const HALF = BAY / 2;
const sidestone = '#6b6e63';
const mortar = '#858375';
const darkWood = '#3d322a';
const glass = '#424748';
const up = new T.Vector3(0, 1, 0);
const xAxis = new T.Vector3(1, 0, 0);
const colors = new Map();
const cube = new T.BoxGeometry(1, 1, 1).toNonIndexed().attributes.position.array;

class Surface {
  position = [];
  normal = [];
  color = [];
  uv = [];
  plotIds = [];
  plot = -1;

  triangle(a, b, c, color, uv, upward = false) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const length = Math.hypot(...n);
    if (length < .000001) return;
    if (upward && n[1] < 0) {
      [b, c] = [c, b];
      n[0] *= -1;
      n[1] *= -1;
      n[2] *= -1;
    }
    if (!colors.has(color)) colors.set(color, new T.Color(color));
    const tint = colors.get(color);
    for (const p of [a, b, c]) {
      this.position.push(...p);
      this.normal.push(n[0] / length, n[1] / length, n[2] / length);
      this.color.push(tint.r, tint.g, tint.b);
      this.uv.push(...(uv ? uv(p, n) : [0, 0]));
    }
    this.plotIds.push(this.plot);
  }

  box(x, y, z, w, h, d, tint, rotation) {
    if (w <= 0 || h <= 0 || d <= 0) return;
    for (let i = 0; i < cube.length; i += 9) {
      const points = [i, i + 3, i + 6].map(j => {
        const px = cube[j] * w, py = cube[j + 1] * h, pz = cube[j + 2] * d;
        if (!rotation) return [x + px, y + py, z + pz];
        const p = new T.Vector3(px, py, pz).applyQuaternion(rotation);
        return [x + p.x, y + p.y, z + p.z];
      });
      this.triangle(...points, tint);
    }
  }

  beam(a, b, height, width, color) {
    const v = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = v.length();
    if (length < .001) return;
    const rotation = new T.Quaternion().setFromUnitVectors(xAxis, v.normalize());
    this.box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, length, height, width, color, rotation);
  }

  mesh(material) {
    if (!this.position.length) return null;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.position, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.normal, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.color, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    const mesh = new T.Mesh(g, material);
    mesh.userData.plotIds = Int16Array.from(this.plotIds);
    return mesh;
  }
}

export function roofProfile(plot) {
  const { roof, corners, id } = plot;
  const [x, z] = center(id);
  const ext = .28;
  const edge = roof.ridge.map((raised, d) => {
    const run = HALF + (raised ? 0 : ext);
    return [x + DX[d] * run, raised ? RIDGE : EAVE, z + DZ[d] * run];
  });
  const corner = corners.map((height, d) => {
    const side = (d + 1) % 4;
    // Both sides of a joined seam must use the same end point at a valley.
    // A diagonal is filled exactly when the neighboring bay continues the perpendicular ridge.
    const diagOccupied = plot.diagonals[d];
    const extension = a => !roof.ridge[a] && !diagOccupied ? ext : 0;
    return [
      x + DX[d] * (HALF + extension(d)) + DX[side] * (HALF + extension(side)),
      height,
      z + DZ[d] * (HALF + extension(d)) + DZ[side] * (HALF + extension(side)),
    ];
  });
  return { ridge: [x, RIDGE, z], edge, corner };
}

function localFrame(id, d) {
  const [x, z] = center(id);
  const point = (u, y, v) => [x - DZ[d] * u + DX[d] * v, y, z + DX[d] * u + DZ[d] * v];
  const box = (surface, u, y, v, w, h, thick, tint) => surface.box(
    ...point(u, y, v), DX[d] ? thick : w, h, DX[d] ? w : thick, tint,
  );
  return { point, box };
}

function wallOpenings(wall, d, plot) {
  if (wall.opening === 'passage') return [{ at: 0, width: PASSAGE, low: FLOOR, high: 2.51, kind: 'gate' }];
  if (wall.opening === 'door') {
    const door = { at: 0, width: DOOR, low: FLOOR, high: 2.29, kind: 'door' };
    if (wall.shared || plot.passages) return [door];
    return [-1.25, 1.25].map(at => ({ at, width: .58, low: 1.14, high: 2.03, kind: 'window' }))
      .concat(door).sort((a, b) => a.at - b.at);
  }
  if (wall.shared || plot.passages) return [];
  const paired = !plot.roof.gable[d] && (plot.id + d) % 3 !== 0;
  return (paired ? [-.77, .77] : [0]).map(at => ({
    at, width: paired ? .68 : .94, low: 1.18, high: 2.17, kind: 'window',
  }));
}

function buildWall(s, plot, d, paint) {
  const wall = plot.walls[d];
  if (!wall.owner) return;
  const { box } = localFrame(plot.id, d);
  const v = HALF - (wall.shared ? 0 : WALL / 2);
  const openings = wallOpenings(wall, d, plot);
  function solid(a, b, low, high) {
    box(s, (a + b) / 2, (low + high) / 2, v, b - a, high - low, WALL, paint.plaster);
    if (!wall.shared && low === FLOOR && b > a) {
      box(s, (a + b) / 2, .18, v + .052, b - a, .23, WALL, sidestone);
      box(s, (a + b) / 2, .315, v + .065, b - a, .048, WALL, mortar);
    }
  }
  let start = -HALF;
  for (const { at, width, low, high, kind } of openings) {
    const a = at - width / 2;
    const b = at + width / 2;
    solid(start, a, FLOOR, EAVE);
    if (low > FLOOR) solid(a, b, FLOOR, low);
    solid(a, b, high, EAVE);
    const outward = v + (wall.shared ? 0 : .061);
    for (const side of [-1, 1]) {
      box(s, at + side * (width / 2 + .04), (high + low) / 2, outward,
        .08, high - low, WALL + .09, paint.timber);
    }
    box(s, at, high + .052, outward, width + .24, .104, WALL + .13, paint.timber);
    if (kind === 'window') {
      box(s, at, low + .018, outward, width + .2, .08, WALL + .15, paint.trim);
      // Real opening in the plaster. A recessed lattice and backing belong to the window unit.
      box(s, at, (low + high) / 2, v - .071, width - .03, high - low - .025, .045, glass);
      for (let k = 1; k < 4; k++) {
        box(s, a + width * k / 4, (low + high) / 2, v + .023, .039, high - low, .045, paint.timber);
      }
      box(s, at, low + (high - low) * .44, v + .027, width, .052, .05, paint.timber);
    } else {
      box(s, at, FLOOR, outward, width + .08, .044, WALL + .35, mortar);
      if (!wall.shared) box(s, at, high + .18, v + .132, kind === 'gate' ? .68 : .36, .095, .064, paint.trim);
      if (kind === 'gate' && !wall.shared) {
        for (const side of [-1, 1]) {
          const post = at + side * (width / 2 + .175);
          box(s, post, 1.36, v + .09, .22, 2.59, .28, paint.trim);
          box(s, post, .20, v + .12, .28, .29, .33, sidestone);
        }
        box(s, at, high + .30, v + .105, width + .60, .092, .31, paint.timber);
      }
    }
    start = b;
  }
  solid(start, HALF, FLOOR, EAVE);
  if (wall.shared) return;
  if (!plot.roof.gable[d]) {
    box(s, 0, EAVE - .105, v + .055, BAY, .19, .145, paint.timber);
    for (const u of [-1.76, -1.35, -.9, -.45, 0, .45, .9, 1.35, 1.76]) {
      box(s, u, EAVE - .13, v + .17, .082, .104, .23, darkWood);
    }
  }
  for (const u of [-1.87, 1.87]) box(s, u, EAVE - .42, v + .038, .14, .49, .16, paint.trim);
}

function steppedGable(s, plot, d, paint, v = 1.91) {
  const { point, box } = localFrame(plot.id, d);
  const left = plot.diagonals[(d + 3) % 4] ? -1.83 : -2.26;
  const right = plot.diagonals[d] ? 1.83 : 2.26;
  const tiers = [left, -1.42, -.67, .67, 1.42, right];
  const tops = [3.93, 4.38, 4.88, 4.38, 3.93];
  for (let i = 0; i < tops.length; i++) {
    const a = tiers[i], b = tiers[i + 1], top = tops[i];
    const mid = (a + b) / 2;
    box(s, mid, (top + EAVE - .08) / 2, v, b - a, top - EAVE + .08, .25, paint.plaster);
    box(s, mid, top - .065, v + .025, b - a + .055, .087, .34, paint.trim);
    box(s, mid, top + .02, v + .02, b - a + .12, .078, .43, paint.tiles);
    s.beam(point(a - .055, top + .092, v + .02), point(b + .055, top + .092, v + .02), .106, .162, paint.tiles);
    const end = i < 2 ? a : b;
    const sign = i < 2 ? -1 : 1;
    s.beam(point(end - sign * .12, top + .08, v + .02), point(end + sign * .075, top + .21, v + .02),
      .098, .18, paint.tiles);
  }
}

function tileUV(p, normal) {
  const [nx, ny, nz] = normal;
  const h = Math.hypot(nx, nz);
  if (h < .001) return [p[0] / 1.35, p[2] / 1.2];
  const across = (-nz * p[0] + nx * p[2]) / h;
  const slope = (nx * p[0] + nz * p[2]) / h;
  const along = (ny * slope - h * p[1]) / Math.hypot(ny, h);
  return [across / 1.35, along / 1.19];
}

function buildRoof(s, tiles, plot, paint) {
  const { ridge, edge, corner } = roofProfile(plot);
  if (plot.roof.firewall) steppedGable(s, plot, 0, paint, HALF);
  for (let d = 0; d < 4; d++) {
    const next = (d + 1) % 4;
    tiles.triangle(ridge, edge[d], corner[d], paint.tiles, tileUV, true);
    tiles.triangle(ridge, corner[d], edge[next], paint.tiles, tileUV, true);

    if (plot.roof.ridge[d]) {
      const lift = ([x, y, z]) => [x, y + .065, z];
      s.beam(lift(ridge), lift(edge[d]), .135, .135, paint.tiles);
      if (plot.roof.gable[d]) steppedGable(s, plot, d, paint);
    } else {
      for (const end of [corner[(d + 3) % 4], corner[d]]) {
        const down = ([x, y, z]) => [x, y - .045, z];
        s.beam(down(edge[d]), down(end), .122, .092, paint.tiles);
      }
    }
    if (plot.roof.joined[d] && plot.roof.joined[next] && corner[d][1] < RIDGE) {
      const lift = ([x, y, z]) => [x, y + .018, z];
      s.beam(lift(ridge), lift(corner[d]), .06, .094, paint.tiles);
    }
  }
}

function passageInterior(s, plot, paint) {
  if (!plot.passages) return;
  const [x, z] = center(plot.id);
  const p = PASSAGE / 2 + .045;
  const edge = HALF - WALL;
  const grid = [-edge, -p, p, edge];
  const walk = (col, row) => col === 1 && row === 1
    || col === 1 && !!(plot.passages & (1 << (row === 0 ? 0 : 2)))
    || row === 1 && !!(plot.passages & (1 << (col === 0 ? 3 : 1)));
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const a = grid[col], b = grid[col + 1], c = grid[row], d = grid[row + 1];
      const cx = x + (a + b) / 2, cz = z + (c + d) / 2;
      if (walk(col, row)) {
        s.box(cx, FLOOR + .005, cz, b - a, .025, d - c, '#aaa18b');
      } else {
        s.box(cx, 1.64, cz, b - a, 3.03, d - c, paint.plaster);
        s.box(cx, .175, cz, b - a + .025, .20, d - c + .025, sidestone);
      }
    }
  }
}

export const noise = (a, b = 0) => {
  let h = Math.imul(a + 31, 0x45d9f3b) ^ Math.imul(b + 71, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const pavers = ['#9b947e', '#aaa189', '#a69e89', '#9e9786', '#aaa58d', '#b0a892'];
function buildGround(s, plot) {
  const [x, z] = center(plot.id);
  const { arms = 0, corners = 0 } = plot;
  const width = 4 * BAY / 6;
  const w = BAY / 4;
  const h = BAY / 6;
  for (let row = 0; row < 6; row++) {
    const across = plot.kind === 'court' || row < 4 && (arms & 1) || row >= 2 && (arms & 4);
    const west = across || (arms & 8) || row < 4 && (corners & 8) || row >= 2 && (corners & 4);
    const east = across || (arms & 2) || row < 4 && (corners & 1) || row >= 2 && (corners & 2);
    if (!west && !east) continue;
    const left = west ? -HALF : HALF - width;
    const right = east ? HALF : -HALF + width;
    const v = -HALF + (row + .5) * h;
    s.box(x + (left + right) / 2, -.006, z + v, right - left, .038, h, '#8d8773');
    const offset = (row + (plot.id % 2)) % 2 ? w / 2 : 0;
    for (let col = 0; col <= 4; col++) {
      const a = Math.max(left, -HALF + col * w - offset);
      const b = Math.min(right, -HALF + (col + 1) * w - offset);
      if (b - a < .04) continue;
      const u = (a + b) / 2;
      const shade = pavers[Math.floor(noise(plot.id, row * 5 + col) * pavers.length)];
      s.box(x + u, .018, z + v, b - a - .035, .038, h - .035, shade);
    }
  }
}

export function createArchitectureMaterials() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b6b8b8';
  ctx.fillRect(0, 0, 192, 192);
  for (let row = -1; row < 7; row++) {
    for (let col = 0; col < 9; col++) {
      const x = col * 24, y = row * 32;
      const shade = Math.floor(162 + noise(row, col) * 37);
      const g = ctx.createLinearGradient(x, 0, x + 24, 0);
      g.addColorStop(0, '#676d73');
      g.addColorStop(.19, '#e1e2e2');
      g.addColorStop(.44, `rgb(${shade},${shade},${shade})`);
      g.addColorStop(.87, '#b3b6b7');
      g.addColorStop(1, '#64696c');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 24, 32);
      ctx.strokeStyle = '#464b53';
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(x, y + 29);
      ctx.quadraticCurveTo(x + 12, y + 35, x + 24, y + 29);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 4200; i++) {
    ctx.fillStyle = i % 2 ? '#fff2' : '#241e1a20';
    ctx.fillRect(noise(i, 94) * 192, noise(i, 109) * 192, 1.1, .8);
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.anisotropy = 8;
  return {
    solid: new T.MeshStandardMaterial({ vertexColors: true, roughness: .86 }),
    roof: new T.MeshStandardMaterial({ vertexColors: true, roughness: .79, map, side: T.DoubleSide }),
  };
}

export function buildArchitecture(plots, materials) {
  const solid = new Surface(), tiles = new Surface();
  const ground = new Surface();
  for (const plot of plots) {
    if (plot.kind !== 'room') {
      buildGround(ground, plot);
      continue;
    }
    solid.plot = tiles.plot = plot.id;
    const [x, z] = center(plot.id);
    const paint = PALETTES[plot.palette];
    solid.box(x, FLOOR / 2, z, BAY - .035, FLOOR, BAY - .035, mortar);
    for (let d = 0; d < 4; d++) buildWall(solid, plot, d, paint);
    passageInterior(solid, plot, paint);
    buildRoof(solid, tiles, plot, paint);
  }
  const group = new T.Group();
  for (const [surface, material, buildings] of [
    [ground, materials.solid, false],
    [solid, materials.solid, true],
    [tiles, materials.roof, true],
  ]) {
    const mesh = surface.mesh(material);
    if (!mesh) continue;
    mesh.castShadow = buildings;
    mesh.receiveShadow = true;
    mesh.userData.buildings = buildings;
    group.add(mesh);
  }
  return group;
}
