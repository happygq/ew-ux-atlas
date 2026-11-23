import * as T from '../../g1-m2/r2-vertical-v03-visual/vendor/three.module.min.js';
import { BAY, DX, DZ, PALETTES, center } from './world.mjs';
import { DOOR, FLOOR, PASSAGE, WALL } from './spatial.mjs';

const HALF = BAY / 2;
const ARCADE_DEPTH = .88;
const sidestone = '#6b6e63';
const mortar = '#858375';
const darkWood = '#3d322a';
const glass = '#424748';
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

const cardinal = [0, 1, 2, 3];
const next = d => (d + 1) % 4;
const previous = d => (d + 3) % 4;
const boundsOf = plot => plot.insets.map(inset => HALF - inset);
const sideSpan = (bounds, d) => [-bounds[previous(d)], bounds[next(d)]];
const roofHeight = plot => plot.roof.eave;
const roofPeak = plot => plot.roof.peak;

export function roofProfile(plot) {
  const [x, z] = center(plot.id);
  const [north, east, south, west] = boundsOf(plot);
  const eave = roofHeight(plot), peak = roofPeak(plot);
  const rx = x + (east - west) / 2;
  const rz = z + (south - north) / 2;
  const { axis } = plot;
  // A roof bar keeps the same transverse profile at both ends. Its edge
  // stations agree exactly across a seam that the spatial model joins.
  const edge = [
    [rx, axis === 0 ? peak : eave, z - north],
    [x + east, axis === 1 ? peak : eave, rz],
    [rx, axis === 0 ? peak : eave, z + south],
    [x - west, axis === 1 ? peak : eave, rz],
  ];
  const corner = [
    [x + east, eave, z - north], [x + east, eave, z + south],
    [x - west, eave, z + south], [x - west, eave, z - north],
  ];
  return { ridge: [rx, peak, rz], edge, corner };
}

function localFrame(id, d) {
  const [x, z] = center(id);
  const point = (u, y, v) => [x - DZ[d] * u + DX[d] * v, y, z + DX[d] * u + DZ[d] * v];
  const box = (surface, u, y, v, w, h, thick, tint) => surface.box(
    ...point(u, y, v), DX[d] ? thick : w, h, DX[d] ? w : thick, tint,
  );
  return { point, box };
}

function lineBox(s, frame, a, b, low, high, v, thickness, paint) {
  frame.box(s, (a + b) / 2, (low + high) / 2, v, b - a, high - low, thickness, paint);
}

function timberPost(s, frame, u, v, h, paint) {
  frame.box(s, u, .13, v, .30, .13, .29, sidestone);
  frame.box(s, u, (.19 + h) / 2, v, .17, h - .19, .18, paint.timber);
  frame.box(s, u, h - .13, v, .25, .17, .25, darkWood);
}

function lattice(s, frame, at, width, low, high, v, paint, narrow) {
  frame.box(s, at, (low + high) / 2, v - .052, width - .028, high - low - .022, .03, glass);
  const count = narrow ? 3 : 5;
  for (let i = 1; i < count; i++) {
    frame.box(s, at + (i / count - .5) * width, (low + high) / 2, v + .035, .033, high - low, .035, paint.timber);
  }
  frame.box(s, at, (low + high) / 2, v + .041, width, .035, .037, paint.timber);
  frame.box(s, at, low, v + .043, width + .10, .07, .082, paint.trim);
}

function galleryCanopy(s, tiles, frame, left, right, boundary, eave, paint) {
  const from = boundary - .07, lip = boundary + ARCADE_DEPTH;
  const front = eave - .39, back = eave + .015;
  const edgeA = left + ARCADE_DEPTH, edgeB = right - ARCADE_DEPTH;
  const a = frame.point(left, back, from), b = frame.point(right, back, from);
  const c = frame.point(edgeB, front, lip), e = frame.point(edgeA, front, lip);
  tiles.triangle(a, b, c, paint.tiles, tileUV, true);
  tiles.triangle(a, c, e, paint.tiles, tileUV, true);
  s.beam(e, c, .115, .14, paint.tiles);
  lineBox(s, frame, edgeA, edgeB, front - .19, front - .07, lip - .105, .17, paint.timber);
  for (const u of [edgeA + .11, edgeB - .11]) timberPost(s, frame, u, lip - .105, front - .08, paint);
  for (let i = .14; i < 1; i += .14) {
    const u = T.MathUtils.lerp(left, right, i), v = T.MathUtils.lerp(edgeA, edgeB, i);
    s.beam(frame.point(u, back - .073, from), frame.point(v, front - .05, lip), .078, .068, paint.timber);
  }
}

function courtFront(s, tiles, plot, d, paint, bounds) {
  const wall = plot.walls[d];
  const frame = localFrame(plot.id, d);
  const [left, right] = sideSpan(bounds, d);
  const width = right - left;
  const eave = roofHeight(plot);
  const u = (left + right) / 2;
  const v = bounds[d] - .23;
  const wing = wall.opening === 'wing';
  const hall = wall.opening === 'hall';
  const bay = Math.min(width - .45, hall ? 2.64 : 1.72);
  const h = eave - .33;
  const edge = side => u + side * (bay / 2 + .10);

  lineBox(s, frame, left, right, h - .13, h + .12, v, .24, darkWood);
  lineBox(s, frame, left, right, h + .12, eave - .025, v, .115, paint.timber);
  if (wing) {
    // Lattice screens sit behind the columns and leave a sheltered eaves walk.
    const back = v;
    const path = Math.min(DOOR, bay);
    const panels = [[left, u - path / 2], [u + path / 2, right]];
    for (const [a, b] of panels) {
      lineBox(s, frame, a, b, FLOOR, 1.16, back, .112, paint.timber);
      lineBox(s, frame, a, b, 2.25, h + .04, back, .112, paint.timber);
      if (b - a > .25) lattice(s, frame, (a + b) / 2, b - a, 1.16, 2.23, back, paint, false);
    }
    const lip = bounds[d] + ARCADE_DEPTH;
    lineBox(s, frame, left, right, .032, .10, (lip + back) / 2, lip - back, '#827f70');
    galleryCanopy(s, tiles, frame, left, right, bounds[d], eave, paint);
  } else {
    for (const side of [-1, 1]) timberPost(s, frame, edge(side), v, h, paint);
    for (const [a, b] of [[left, edge(-1)], [edge(1), right]]) {
      lineBox(s, frame, a, b, FLOOR, 1.08, v - .05, .125, paint.timber);
      lineBox(s, frame, a, b, 2.22, h, v - .05, .125, paint.timber);
      if (b - a > .25) lattice(s, frame, (a + b) / 2, b - a, 1.08, 2.22, v - .05, paint, false);
    }
    // The hall mouth is open between the load-bearing posts.
    lineBox(s, frame, edge(-1), edge(1), FLOOR, FLOOR + .061, v, .36, '#8e8572');
  }
  for (let rafter = left + .16; rafter < right - .08; rafter += .31) {
    frame.box(s, rafter, eave - .12, v + .09, .063, .098, .34, paint.timber);
  }
}

function portal(s, tiles, frame, u, v, width, high, paint) {
  const [left, right] = [u - width / 2 - .34, u + width / 2 + .34];
  for (const side of [-1, 1]) {
    const jamb = u + side * (width / 2 + .13);
    frame.box(s, jamb, (FLOOR + high) / 2, v + .105, .21, high - FLOOR, .28, '#77786e');
    frame.box(s, jamb, .24, v + .142, .27, .35, .26, '#62665f');
  }
  lineBox(s, frame, left, right, high, high + .15, v + .117, .27, '#686c63');
  lineBox(s, frame, left + .10, right - .10, high + .17, high + .35, v + .105, .22, '#8f8e7e');
  lineBox(s, frame, u - .40, u + .40, high + .20, high + .32, v + .24, .046, darkWood);
  // The rain hood projects over the stone portal without touching the lintel opening.
  const outer = v + .39;
  const a = frame.point(left - .06, high + .50, v - .018);
  const b = frame.point(right + .06, high + .50, v - .018);
  const c = frame.point(right + .06, high + .37, outer);
  const e = frame.point(left - .06, high + .37, outer);
  tiles.triangle(a, b, c, paint.tiles, tileUV, true);
  tiles.triangle(a, c, e, paint.tiles, tileUV, true);
  s.beam(e, c, .094, .117, paint.tiles);
}

function buildWall(s, tiles, plot, d, paint, bounds) {
  const wall = plot.walls[d];
  const frame = localFrame(plot.id, d);
  const [ownLeft, ownRight] = sideSpan(bounds, d);
  const [left, right] = wall.sharedSpan ?? [ownLeft, ownRight];
  const eave = roofHeight(plot);
  if (wall.shared) {
    const masonry = Math.max(.26, WALL);
    const exterior = bounds[d] - masonry / 2;
    for (const [from, to] of [[ownLeft, left], [right, ownRight]]) {
      if (to - from <= .001) continue;
      lineBox(s, frame, from, to, FLOOR, eave, exterior, masonry, paint.plaster);
      lineBox(s, frame, from, to, FLOOR, .265, exterior, masonry, sidestone);
    }
  }
  if (!wall.owner) return;
  if (wall.opening === 'hall' || wall.opening === 'wing') {
    courtFront(s, tiles, plot, d, paint, bounds);
    return;
  }
  const thickness = wall.shared ? .14 : Math.max(.26, WALL);
  const v = bounds[d] - (wall.shared ? 0 : thickness / 2);
  const plaster = wall.shared ? paint.timber : paint.plaster;
  const entry = wall.opening === 'passage' || wall.opening === 'door';
  const window = !entry && !wall.shared && !wall.separated && !plot.passages && !plot.roof.gable?.[d]
    && (plot.id + d) % 3 === 0;
  const width = entry ? wall.opening === 'passage' ? PASSAGE : DOOR : window ? .32 : 0;
  // Doorways on connected bays stay centred on the grid to align with the next bay.
  const u = entry ? 0 : (left + right) / 2;
  const low = entry ? FLOOR : Math.min(eave - .78, 2.10);
  const high = entry ? Math.min(2.46, eave - .4) : low + .39;
  const a = u - width / 2, b = u + width / 2;
  function solid(from, to, bottom, top) {
    lineBox(s, frame, from, to, bottom, top, v, thickness, plaster);
    if (!wall.shared && bottom === FLOOR) {
      lineBox(s, frame, from, to, FLOOR, .265, v, thickness + (wall.separated ? 0 : .052), sidestone);
      lineBox(s, frame, from, to, .265, .32, v, thickness + (wall.separated ? 0 : .025), mortar);
    }
  }
  if (!width) solid(left, right, FLOOR, eave);
  else {
    solid(left, a, FLOOR, eave);
    solid(a, b, low === FLOOR ? high : FLOOR, low === FLOOR ? eave : low);
    solid(b, right, FLOOR, eave);
    if (low > FLOOR) {
      solid(a, b, high, eave);
      lattice(s, frame, u, width, low, high, v + thickness / 2 - .03, paint, true);
    } else {
      const exteriorGate = !wall.shared && !wall.separated && !wall.court;
      for (const side of [-1, 1]) {
        frame.box(s, u + side * (width / 2 + .044), (low + high) / 2, v,
          .088, high - low, thickness + .049, paint.timber);
      }
      lineBox(s, frame, a - .07, b + .07, high, high + .104, v, thickness + .06, paint.timber);
      lineBox(s, frame, a, b, FLOOR, FLOOR + .031, v, thickness + .20, mortar);
      if (exteriorGate) portal(s, tiles, frame, u, v, width, high, paint);
    }
  }
}

function steppedGable(s, plot, d, paint, bounds) {
  const { point, box } = localFrame(plot.id, d);
  const [left, right] = sideSpan(bounds, d);
  const width = right - left;
  const middle = (left + right) / 2;
  const tiers = [left, middle - .34 * width, middle - .24 * width,
    middle + .24 * width, middle + .34 * width, right];
  const peak = roofPeak(plot), eave = roofHeight(plot);
  const base = eave - .04;
  const shoulder = peak - Math.min(.62, (peak - eave) * .45);
  const flank = peak - Math.min(.17, (peak - eave) * .23);
  const tops = [shoulder, flank, peak + .40, flank, shoulder];
  const v = bounds[d] - .165;
  for (let i = 0; i < tops.length; i++) {
    const a = tiers[i], b = tiers[i + 1], top = tops[i];
    const mid = (a + b) / 2;
    box(s, mid, (top + base) / 2, v, b - a, top - base, .268, paint.plaster);
    box(s, mid, top - .058, v, b - a, .083, .288, '#88877a');
    box(s, mid, top + .021, v, b - a + .026, .070, .322, paint.tiles);
    s.beam(point(a, top + .076, v), point(b, top + .076, v), .085, .125, paint.tiles);
    for (const [end, sign] of i === 2 ? [[a, -1], [b, 1]] : i < 2 ? [[a, -1]] : [[b, 1]]) {
      const overhang = end === left || end === right ? .025 : .086;
      s.beam(point(end - sign * .14, top + .075, v), point(end + sign * overhang, top + .157, v),
        .075, .132, paint.tiles);
      box(s, end - sign * .085, top - .115, v, .122, .135, .289, paint.trim);
    }
  }
}

function gableInfill(s, plot, d, paint, bounds) {
  const [left, right] = sideSpan(bounds, d);
  const { point } = localFrame(plot.id, d);
  const v = bounds[d] - .085;
  const a = point(left, roofHeight(plot) - .04, v);
  const b = point((left + right) / 2, roofPeak(plot) - .065, v);
  const c = point(right, roofHeight(plot) - .04, v);
  s.triangle(a, b, c, paint.plaster);
  s.triangle(c, b, a, paint.timber);
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

const slopeHeight = (eave, peak, t) => T.MathUtils.lerp(peak, eave, t) - .10 * Math.sin(t * Math.PI);

function buildRoof(s, tiles, plot, paint) {
  const { edge, corner } = roofProfile(plot);
  const { axis } = plot;
  const bounds = boundsOf(plot);
  const lift = ([x, y, z]) => [x, y + .06, z];
  s.beam(lift(edge[axis]), lift(edge[axis + 2]), .112, .163, paint.tiles);
  for (const d of cardinal) {
    if (d % 2 === axis) {
      if (plot.roof.gable[d] || plot.roof.break[d]) steppedGable(s, plot, d, paint, bounds);
      else if (!plot.roof.joined[d]) gableInfill(s, plot, d, paint, bounds);
      continue;
    }
    const before = previous(d), after = next(d);
    const lipA = corner[before], lipB = corner[d];
    // A gentle curve near the eave follows the purlin stations. Each bar
    // pitches across its own section, including the fall towards the court.
    function station(crest, lip, t) {
      return [
        T.MathUtils.lerp(crest[0], lip[0], t),
        slopeHeight(lip[1], crest[1], t),
        T.MathUtils.lerp(crest[2], lip[2], t),
      ];
    }
    let a = edge[before], b = edge[after];
    for (const t of [.50, .78, 1]) {
      const c = station(edge[after], lipB, t), e = station(edge[before], lipA, t);
      tiles.triangle(a, b, c, paint.tiles, tileUV, true);
      tiles.triangle(a, c, e, paint.tiles, tileUV, true);
      a = e;
      b = c;
    }
    const underside = ([x, y, z]) => [x - DX[d] * .047, y - .039, z - DZ[d] * .047];
    s.beam(underside(lipA), underside(lipB), .105, .106, paint.tiles);
    if (plot.walls[d].separated) {
      const frame = localFrame(plot.id, d);
      const [left, right] = sideSpan(bounds, d);
      const eave = roofHeight(plot);
      lineBox(s, frame, left, right, eave - .06, eave + .28, bounds[d] - .15, .28, paint.plaster);
      lineBox(s, frame, left, right, eave + .28, eave + .36, bounds[d] - .15, .30, paint.tiles);
    }
  }
}

function timberFrame(s, plot, paint) {
  const bounds = boundsOf(plot);
  const { axis } = plot;
  const frame = localFrame(plot.id, axis);
  const [left, right] = sideSpan(bounds, axis);
  const center = (left + right) / 2;
  const eave = roofHeight(plot), peak = roofPeak(plot);
  const tieTop = eave - .11;
  for (const v of [-bounds[axis + 2] + .28, bounds[axis] - .28]) {
    for (const u of [left + .33, right - .33]) timberPost(s, frame, u, v, eave - .20, paint);
    lineBox(s, frame, left + .21, right - .21, eave - .32, tieTop, v, .18, paint.timber);
    frame.box(s, center, (tieTop + peak - .10) / 2, v, .153, peak - .10 - tieTop, .16, paint.timber);
    for (const side of [-1, 1]) {
      const inner = center + side * (right - left) * .25;
      const upper = slopeHeight(eave, peak, .5) - .09;
      frame.box(s, inner, (tieTop + upper) / 2, v, .12, upper - tieTop, .12, paint.timber);
      const end = side < 0 ? left : right;
      let previousPoint = frame.point(center, peak - .145, v);
      for (const t of [.50, .78, .92]) {
        const point = frame.point(T.MathUtils.lerp(center, end, t), slopeHeight(eave, peak, t) - .145, v);
        s.beam(previousPoint, point, .117, .128, paint.timber);
        previousPoint = point;
      }
    }
  }
}

function passageInterior(s, plot, paint) {
  if (!plot.passages) return;
  const [x, z] = center(plot.id);
  const p = PASSAGE / 2 + .045;
  const [north, east, south, west] = boundsOf(plot);
  const across = [-west + .20, -p, p, east - .20];
  const depth = [-north + .20, -p, p, south - .20];
  const h = roofHeight(plot) - FLOOR - .04;
  const walk = (col, row) => col === 1 && row === 1
    || col === 1 && !!(plot.passages & (1 << (row === 0 ? 0 : 2)))
    || row === 1 && !!(plot.passages & (1 << (col === 0 ? 3 : 1)));
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const a = across[col], b = across[col + 1], c = depth[row], d = depth[row + 1];
      const cx = x + (a + b) / 2, cz = z + (c + d) / 2;
      if (walk(col, row)) {
        s.box(cx, FLOOR + .005, cz, b - a, .025, d - c, '#aaa18b');
      } else {
        s.box(cx, FLOOR + h / 2, cz, b - a, h, d - c, paint.timber);
        s.box(cx, .175, cz, b - a, .20, d - c, sidestone);
      }
    }
  }
}

export const noise = (a, b = 0) => {
  let h = Math.imul(a + 31, 0x45d9f3b) ^ Math.imul(b + 71, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const pavers = ['#858981', '#96998e', '#92958d', '#899088', '#9ea096', '#8c9186'];

function drain(s, x, z, w, d) {
  s.box(x, .038, z, w + .08, .012, d + .08, '#7e8379');
  s.box(x, .043, z, w, .011, d, '#4b5a54');
}

function courtyardDetails(s, plot, x, z) {
  const arms = plot.arms ?? 0;
  const outlet = plot.outlet ?? !!arms;
  for (const d of cardinal) {
    if (!(arms & 1 << d)) continue;
    const gallery = !!((plot.galleryArms ?? 0) & 1 << d);
    const lip = HALF - (gallery ? ARCADE_DEPTH + .12 : .23);
    const span = HALF * 2 - .52;
    drain(s, x + DX[d] * lip, z + DZ[d] * lip, DX[d] ? .081 : span, DX[d] ? span : .081);
    if (outlet) {
      const run = lip - .10;
      drain(s, x + DX[d] * (lip - run / 2), z + DZ[d] * (lip - run / 2),
        DX[d] ? run : .061, DX[d] ? .061 : run);
    }
  }
  if (!outlet) return;
  const alongZ = plot.axis !== 1;
  const span = alongZ ? .54 : .28;
  const breadth = alongZ ? .28 : .54;
  s.box(x, .041, z, breadth + .10, .018, span + .10, '#767b71');
  s.box(x, .048, z, breadth, .012, span, '#3f4a44');
  for (let i = -3; i <= 3; i++) {
    s.box(x + (alongZ ? 0 : i * .066), .055, z + (alongZ ? i * .066 : 0),
      alongZ ? .255 : .026, .012, alongZ ? .026 : .255, '#747b71');
  }
}

function buildGround(s, plot) {
  const [x, z] = center(plot.id);
  const { arms = 0, corners = 0 } = plot;
  const width = 3 * BAY / 6;
  const w = BAY / 4;
  const h = BAY / 6;
  for (let row = 0; row < 6; row++) {
    const across = plot.kind === 'court' || row < 3 && (arms & 1) || row >= 3 && (arms & 4);
    const west = across || (arms & 8) || row < 3 && (corners & 8) || row >= 3 && (corners & 4);
    const east = across || (arms & 2) || row < 3 && (corners & 1) || row >= 3 && (corners & 2);
    if (!west && !east) continue;
    const left = west ? -HALF : HALF - width;
    const right = east ? HALF : -HALF + width;
    const v = -HALF + (row + .5) * h;
    s.box(x + (left + right) / 2, -.006, z + v, right - left, .038, h, '#788076');
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
  if (plot.kind === 'court') courtyardDetails(s, plot, x, z);
}

function alleyFloor(s, plot) {
  const bounds = boundsOf(plot);
  for (const d of cardinal) {
    const setback = HALF - bounds[d];
    if (!setback) continue;
    const frame = localFrame(plot.id, d);
    const v = HALF - setback / 2;
    const [left, right] = d % 2 === 0 ? [-HALF, HALF] : sideSpan(bounds, d);
    lineBox(s, frame, left, right, -.021, .011, v, setback, '#777e72');
    for (let a = left, row = 0; a < right - .07; a += .57, row++) {
      const b = Math.min(right, a + .57);
      const shade = pavers[Math.floor(noise(plot.id + d, row) * pavers.length)];
      lineBox(s, frame, a + .014, b - .014, .008, .028, v, setback - .017, shade);
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
    const bounds = boundsOf(plot);
    const [north, east, south, west] = bounds;
    const paint = PALETTES[plot.palette];
    const floorX = x + (east - west) / 2, floorZ = z + (south - north) / 2;
    const floorColor = plot.role === 'hall' ? '#898373' : plot.role === 'wing' ? paint.timber : mortar;
    solid.box(floorX, FLOOR / 2, floorZ, west + east - .03, FLOOR, north + south - .03, floorColor);
    for (const d of cardinal) buildWall(solid, tiles, plot, d, paint, bounds);
    timberFrame(solid, plot, paint);
    passageInterior(solid, plot, paint);
    buildRoof(solid, tiles, plot, paint);
    alleyFloor(ground, plot);
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
