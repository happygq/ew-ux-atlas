import * as T from '../../g1-m2/r2-vertical-v03-visual/vendor/three.module.min.js';
import { BAY, DX, DZ, PALETTES, center } from './world.mjs';
import { DOOR, FLOOR, PASSAGE, WALL } from './spatial.mjs';
import { buildSiteGround, buildUpper, courtGroundY } from './structures.mjs';

const HALF = BAY / 2;
const ARCADE_DEPTH = .88;
const sidestone = '#797e72';
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
      this.uv.push(...(uv ?? solidUV)(p, n));
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

function solidUV([x, y, z], normal) {
  const nx = Math.abs(normal[0]), ny = Math.abs(normal[1]), nz = Math.abs(normal[2]);
  if (ny >= nx && ny >= nz) return [x / 1.6, z / 1.6];
  return [nx > nz ? z / 1.6 : x / 1.6, y / 1.6];
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
  frame.box(s, u, .12, v, .31, .12, .30, sidestone);
  frame.box(s, u, .188, v, .245, .052, .242, '#85897e');
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

function galleryCanopy(s, tiles, frame, left, right, boundary, eave, paint, joins, corners) {
  const overlap = .07;
  const from = boundary - overlap, lip = boundary + ARCADE_DEPTH;
  const front = eave - .39, back = eave + .015;
  const edgeA = joins[0] ? left : left + ARCADE_DEPTH;
  const edgeB = joins[1] ? right : right - ARCADE_DEPTH;
  const backA = corners[0] ? left - overlap : left;
  const backB = corners[1] ? right + overlap : right;
  const a = frame.point(backA, back, from), b = frame.point(backB, back, from);
  const c = frame.point(edgeB, front, lip), e = frame.point(edgeA, front, lip);
  tiles.triangle(a, b, c, paint.tiles, tileUV, true);
  tiles.triangle(a, c, e, paint.tiles, tileUV, true);
  s.beam(e, c, .115, .14, paint.tiles);
  lineBox(s, frame, edgeA, edgeB, front - .19, front - .07, lip - .105, .17, paint.timber);
  if (!joins[0] && !corners[0]) timberPost(s, frame, edgeA + .13, lip - .105, front - .08, paint);
  if (!corners[1]) timberPost(s, frame, joins[1] ? edgeB - .03 : edgeB - .13, lip - .105, front - .08, paint);
  // Both angled canopy ends meet here when two sides turn into the same well.
  // Let only the clockwise member own the support at that mitre.
  if (corners[0]) timberPost(s, frame, edgeA + .02, lip - .13, front - .08, paint);
  for (let i = .14; i < 1; i += .14) {
    const u = T.MathUtils.lerp(backA, backB, i), v = T.MathUtils.lerp(edgeA, edgeB, i);
    s.beam(frame.point(u, back - .073, from), frame.point(v, front - .05, lip), .078, .068, paint.timber);
  }
  const plan = [[left, boundary], [right, boundary], [edgeB, lip], [edgeA, lip]];
  const top = plan.map(([u, v]) => frame.point(u, .10, v));
  const bottom = plan.map(([u, v]) => frame.point(u, .01, v));
  const stone = '#827f70';
  s.triangle(top[0], top[1], top[2], stone, undefined, true);
  s.triangle(top[0], top[2], top[3], stone, undefined, true);
  for (const i of cardinal) {
    const j = next(i);
    s.triangle(top[i], bottom[i], bottom[j], stone);
    s.triangle(top[i], bottom[j], top[j], stone);
  }
}

function courtFront(s, tiles, plot, d, paint, bounds) {
  const wall = plot.walls[d];
  const frame = localFrame(plot.id, d);
  const [left, right] = sideSpan(bounds, d);
  const width = right - left;
  const eave = roofHeight(plot) - (plot.upper?.deck ?? 0);
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
    galleryCanopy(s, tiles, frame, left, right, bounds[d], eave, paint,
      plot.galleryJoins?.[d] ?? [false, false], plot.galleryCorners?.[d] ?? [false, false]);
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

function portal(s, tiles, frame, u, v, width, high, paint, kind) {
  const main = kind === 'main';
  const service = kind === 'service';
  const wing = main ? .34 : service ? .15 : .24;
  const [left, right] = [u - width / 2 - wing, u + width / 2 + wing];
  for (const side of [-1, 1]) {
    const jamb = u + side * (width / 2 + (main ? .13 : .095));
    frame.box(s, jamb, (FLOOR + high) / 2, v + (service ? .018 : .091),
      main ? .21 : .135, high - FLOOR, service ? .15 : .23, '#77786e');
    if (!service) frame.box(s, jamb, .24, v + .114, main ? .27 : .19, .35, .26, '#62665f');
  }
  lineBox(s, frame, left, right, high, high + (main ? .15 : .105),
    v + (service ? .02 : .106), service ? .17 : .26, '#686c63');
  if (service) return;
  lineBox(s, frame, left + .065, right - .065, high + .15, high + (main ? .35 : .26), v + .105, .213, '#8f8e7e');
  if (main) {
    lineBox(s, frame, u - .41, u + .41, high + .20, high + .32, v + .235, .046, darkWood);
    for (const side of [-1, 1]) {
      for (let tier = 0; tier < 3; tier++) {
        frame.box(s, u + side * (.56 + tier * .075), high + .225 + tier * .034,
          v + .234, .175, .036, .032, tier % 2 ? '#a09c89' : '#787a70');
      }
    }
  }
  // The rain hood projects over the stone portal without touching the lintel opening.
  const outer = v + (main ? .39 : .25);
  const rise = main ? .439 : .319, fall = main ? .335 : .26;
  const a = frame.point(left - .06, high + rise, v - .018);
  const b = frame.point(right + .06, high + rise, v - .018);
  const c = frame.point(right + .06, high + fall, outer);
  const e = frame.point(left - .06, high + fall, outer);
  tiles.triangle(a, b, c, paint.tiles, tileUV, true);
  tiles.triangle(a, c, e, paint.tiles, tileUV, true);
  s.beam(e, c, .094, .117, paint.tiles);
}

const windowSizes = {
  high: [.30, .42, 1.98],
  stone: [.55, .65, 1.58],
  lattice: [.83, .89, 1.23],
};

function dressWindow(s, frame, kind, u, width, low, high, v, paint) {
  lattice(s, frame, u, width, low, high, v, paint, kind === 'high');
  if (kind !== 'stone') return;
  const a = u - width / 2 - .10, b = u + width / 2 + .10;
  for (const side of [-1, 1]) {
    frame.box(s, u + side * (width / 2 + .05), (low + high) / 2, v + .03,
      .10, high - low, .075, '#898d81');
  }
  lineBox(s, frame, a - .035, b + .035, high, high + .105, v + .042, .115, '#797f74');
  lineBox(s, frame, a, b, low - .085, low, v + .048, .127, '#85897e');
}

function gateJoinery(s, frame, u, v, width, high, paint, reveal) {
  const timber = paint.accent ?? paint.timber;
  for (const side of [-1, 1]) {
    const jamb = u + side * (width / 2 + .055);
    frame.box(s, jamb, (FLOOR + high) / 2, v - .25, .078, high - FLOOR - .11, .48, timber);
    for (const y of [FLOOR + .17, high - .24]) frame.box(s, jamb, y, v - .26, .092, .052, .482, darkWood);
    frame.box(s, jamb - side * .041, FLOOR + .93, v - .42, .031, .054, .055, '#aa9670');
    if (reveal) frame.box(s, jamb, (high + .28) / 2, v + .148, .10, high - .28, .073, timber);
  }
  if (reveal) lineBox(s, frame, u - width / 2 - .10, u + width / 2 + .10,
    high + .015, high + .165, v + .153, .071, timber);
}

function lowerHallFront(s, frame, left, right, width, v, h, paint) {
  for (const side of [-1, 1]) timberPost(s, frame, side * (width / 2 + .2), v - .075, h + .11, paint);
  lineBox(s, frame, left + .17, right - .17, h + .08, h + .235, v - .035, .174, paint.timber);
  for (const [a, b] of [[left + .25, -width / 2 - .2], [width / 2 + .2, right - .25]]) {
    if (b - a > .32) {
      lineBox(s, frame, a, b, FLOOR + .075, .82, v + .05, .085, paint.timber);
      lattice(s, frame, (a + b) / 2, b - a, .82, Math.min(h, 1.98), v + .089, paint, false);
    }
  }
}

function buildWall(s, tiles, plot, d, paint, bounds) {
  const wall = plot.walls[d];
  const frame = localFrame(plot.id, d);
  const [ownLeft, ownRight] = sideSpan(bounds, d);
  const [left, right] = wall.sharedSpan ?? [ownLeft, ownRight];
  const eave = roofHeight(plot);
  const top = wall.top ?? eave;
  const lowTop = wall.lowTop ?? eave;
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
  const window = !entry && !wall.shared && windowSizes[wall.window];
  const width = entry ? wall.opening === 'passage' ? PASSAGE : DOOR : window ? window[0] : 0;
  // Doorways on connected bays stay centred on the grid to align with the next bay.
  const u = entry ? 0 : (left + right) / 2;
  const low = entry ? FLOOR : window ? Math.min(eave - window[1] - .26, window[2]) : FLOOR;
  const high = entry ? Math.min(2.46, Math.min(eave, lowTop) - .4) : low + (window?.[1] ?? 0);
  const a = u - width / 2, b = u + width / 2;
  function stoneBase(from, to) {
    lineBox(s, frame, from, to, FLOOR, .265, v, thickness + (wall.separated ? 0 : .052), sidestone);
    lineBox(s, frame, from, to, .265, .32, v, thickness + (wall.separated ? 0 : .025), mortar);
    if (!wall.portal && wall.window !== 'stone') return;
    const courses = ['#777c71', '#85897e', '#74796e', '#8a8c7e'];
    for (let start = from, i = 0; start < to - .10; start += .57, i++) {
      const end = Math.min(start + .548, to);
      lineBox(s, frame, start + .012, end, FLOOR + .018, .247, v + thickness / 2 + .018, .032, courses[i % courses.length]);
    }
  }
  function solid(from, to, bottom, height) {
    lineBox(s, frame, from, to, bottom, Math.min(height, lowTop), v, thickness, plaster);
    if (height > lowTop) {
      lineBox(s, frame, from, to, Math.max(bottom, lowTop), height, v, thickness, paint.plaster);
    }
    if (!wall.shared && bottom === FLOOR) {
      stoneBase(from, to);
    }
  }
  if (!width) solid(left, right, FLOOR, top);
  else {
    solid(left, a, FLOOR, top);
    solid(a, b, low === FLOOR ? high : FLOOR, low === FLOOR ? top : low);
    solid(b, right, FLOOR, top);
    if (low > FLOOR) {
      solid(a, b, high, top);
      dressWindow(s, frame, wall.window, u, width, low, high, v + thickness / 2 - .03, paint);
    } else {
      for (const side of [-1, 1]) {
        frame.box(s, u + side * (width / 2 + .044), (low + high) / 2, v,
          .088, high - low, thickness + .049, paint.timber);
      }
      lineBox(s, frame, a - .07, b + .07, high, high + .104, v, thickness + .06, paint.timber);
      lineBox(s, frame, a, b, FLOOR, FLOOR + .031, v, thickness + .20, mortar);
      if (wall.portal) {
        portal(s, tiles, frame, u, v, width, high, paint, wall.separated ? 'service' : wall.portal);
        gateJoinery(s, frame, u, v, width, high, paint, !wall.separated);
      }
      if (wall.lowerHall) lowerHallFront(s, frame, left, right, width, v, high, paint);
    }
  }
}

const roofStations = [0, .50, .78, 1];
const gableCuts = {
  low: [0, .21, .79, 1],
  standard: [0, .15, .25, .75, .85, 1],
  tall: [0, .16, .27, .36, .64, .73, .84, 1],
};

export function gableProfile(plot, d) {
  const [left, right] = sideSpan(boundsOf(plot), d);
  const width = right - left;
  const middle = (left + right) / 2;
  const override = plot.roof.gables?.[d];
  const variant = override?.variant ?? override ?? plot.roof.gableVariant ?? 'standard';
  const cuts = gableCuts[variant] ?? gableCuts.standard;
  const courtSide = Number(!!plot.walls[next(d)].court) - Number(!!plot.walls[previous(d)].court);
  const bias = T.MathUtils.clamp(override?.bias ?? -.06 * courtSide, -.10, .10);
  const tiers = cuts.map((t, i) => i === 0 || i === cuts.length - 1 ? left + t * width : left + (t + bias) * width);
  const peak = roofPeak(plot), eave = roofHeight(plot);
  const center = (tiers.length - 2) / 2;
  return tiers.slice(0, -1).map((a, i) => {
    const b = tiers[i + 1];
    const station = a <= middle && b >= middle ? 0 : Math.min(Math.abs(a - middle), Math.abs(b - middle)) * 2 / width;
    const inward = i < center && courtSide < 0 || i > center && courtSide > 0;
    const clearance = i === center ? variant === 'low' ? .29 : .40 : inward ? .095 : .18;
    return { left: a, right: b, top: slopeHeight(eave, peak, station) + clearance };
  });
}

function steppedGable(s, plot, d, paint, bounds) {
  const { point, box } = localFrame(plot.id, d);
  const base = roofHeight(plot) - .04;
  const tiers = gableProfile(plot, d);
  const center = (tiers.length - 1) / 2;
  const v = bounds[d] - .165;
  for (const [i, { left: a, right: b, top }] of tiers.entries()) {
    const mid = (a + b) / 2;
    box(s, mid, (top + base) / 2, v, b - a, top - base, .268, paint.plaster);
    box(s, mid, top - .058, v, b - a, .083, .288, '#88877a');
    box(s, mid, top + .021, v, b - a + .026, .070, .322, paint.tiles);
    s.beam(point(a, top + .076, v), point(b, top + .076, v), .085, .125, paint.tiles);
    for (const [end, sign] of i === center ? [[a, -1], [b, 1]] : i < center ? [[a, -1]] : [[b, 1]]) {
      const overhang = i === 0 || i === tiers.length - 1 ? .025 : .086;
      s.beam(point(end - sign * .14, top + .075, v), point(end + sign * overhang, top + .157, v),
        .075, .132, paint.tiles);
      box(s, end - sign * .085, top - .115, v, .122, .135, .289, paint.trim);
    }
  }
}

function gableInfill(s, plot, d, paint, bounds) {
  const [left, right] = sideSpan(bounds, d), mid = (left + right) / 2;
  const { point } = localFrame(plot.id, d);
  const eave = roofHeight(plot), peak = roofPeak(plot);
  const base = eave - .05, v = bounds[d] - .085;
  const beam = u => point(u, base, v);
  const roof = (u, t) => point(u, Math.max(base, slopeHeight(eave, peak, t) - .039), v);
  for (const end of [left, right]) {
    for (let i = 1; i < roofStations.length; i++) {
      const t = roofStations[i - 1], nextT = roofStations[i];
      const start = T.MathUtils.lerp(mid, end, t), finish = T.MathUtils.lerp(mid, end, nextT);
      const a = beam(start), b = beam(finish), c = roof(finish, nextT), e = roof(start, t);
      s.triangle(a, b, c, paint.plaster);
      s.triangle(a, c, e, paint.plaster);
      s.triangle(c, b, a, paint.timber);
      s.triangle(e, c, a, paint.timber);
    }
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

const slopeHeight = (eave, peak, t) => T.MathUtils.lerp(peak, eave, t) - .10 * Math.sin(t * Math.PI);

function upperEave(s, tiles, plot, paint, bounds) {
  if (!plot.upper) return;
  const d = plot.upper.face;
  const frame = localFrame(plot.id, d);
  const [left, right] = sideSpan(bounds, d);
  const a = Math.max(left + .06, -1.57), b = Math.min(right - .06, 1.57);
  const near = bounds[d] - .10, far = bounds[d] + .61;
  const upper = roofHeight(plot) + .03, lower = upper - .265;
  const p = frame.point(a, upper, near), q = frame.point(b, upper, near);
  const r = frame.point(b, lower, far), t = frame.point(a, lower, far);
  tiles.triangle(p, q, r, paint.tiles, tileUV, true);
  tiles.triangle(p, r, t, paint.tiles, tileUV, true);
  s.beam(t, r, .091, .117, paint.tiles);
  for (const u of [a + .13, (a + b) / 2, b - .13]) {
    s.beam(frame.point(u, lower - .28, bounds[d] - .14),
      frame.point(u, lower - .046, far - .13), .091, .10, paint.timber);
  }
}

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
    for (const t of roofStations.slice(1)) {
      const c = station(edge[after], lipB, t), e = station(edge[before], lipA, t);
      tiles.triangle(a, b, c, paint.tiles, tileUV, true);
      tiles.triangle(a, c, e, paint.tiles, tileUV, true);
      a = e;
      b = c;
    }
    const underside = ([x, y, z]) => [x - DX[d] * .047, y - .039, z - DZ[d] * .047];
    s.beam(underside(lipA), underside(lipB), .105, .106, paint.tiles);
    const face = plot.walls[d];
    if ((face.court || face.portal) && !face.separated) {
      const frame = localFrame(plot.id, d);
      const [left, right] = sideSpan(bounds, d);
      const length = right - left;
      const count = Math.floor(length / .25);
      for (let i = 1; i < count; i++) {
        const u = T.MathUtils.lerp(left, right, i / count);
        frame.box(s, u, roofHeight(plot) - .019, bounds[d] - .011, .088, .059, .099, paint.tiles);
      }
    }
    if (plot.walls[d].separated) {
      const frame = localFrame(plot.id, d);
      const [left, right] = sideSpan(bounds, d);
      const eave = roofHeight(plot);
      lineBox(s, frame, left, right, eave - .06, eave + .28, bounds[d] - .15, .28, paint.plaster);
      lineBox(s, frame, left, right, eave + .28, eave + .36, bounds[d] - .15, .30, paint.tiles);
    }
  }
  upperEave(s, tiles, plot, paint, bounds);
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
  const arrival = plot.walls.findIndex(wall => wall.lowerHall);
  const courtward = (col, row) => arrival === 0 && row === 0 || arrival === 2 && row === 2
    || arrival === 1 && col === 2 || arrival === 3 && col === 0;
  const walk = (col, row) => col === 1 && row === 1
    || col === 1 && !!(plot.passages & (1 << (row === 0 ? 0 : 2)))
    || row === 1 && !!(plot.passages & (1 << (col === 0 ? 3 : 1))) || courtward(col, row);
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
      const shade = Math.floor(182 + noise(row, col) * 20);
      const g = ctx.createLinearGradient(x, 0, x + 24, 0);
      g.addColorStop(0, '#929596');
      g.addColorStop(.19, '#d0d2d1');
      g.addColorStop(.44, `rgb(${shade},${shade},${shade})`);
      g.addColorStop(.87, '#c1c4c5');
      g.addColorStop(1, '#909495');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 24, 32);
      ctx.strokeStyle = '#818586';
      ctx.lineWidth = .92;
      ctx.beginPath();
      ctx.moveTo(x, y + 29);
      ctx.quadraticCurveTo(x + 12, y + 35, x + 24, y + 29);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 1050; i++) {
    ctx.fillStyle = i % 2 ? '#fff2' : '#241e1a20';
    ctx.fillRect(noise(i, 94) * 192, noise(i, 109) * 192, 1.1, .8);
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.anisotropy = 8;
  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = grainCanvas.height = 128;
  const grain = grainCanvas.getContext('2d');
  grain.fillStyle = '#fafafa';
  grain.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2650; i++) {
    const x = noise(i, 105) * 128, y = noise(i, 132) * 128;
    grain.fillStyle = i % 3 ? '#1614100c' : '#ffffff3f';
    grain.fillRect(x, y, 1 + noise(i, 151) * 3.2, 1.15);
  }
  const grainMap = new T.CanvasTexture(grainCanvas);
  grainMap.colorSpace = T.SRGBColorSpace;
  grainMap.wrapS = grainMap.wrapT = T.RepeatWrapping;
  grainMap.anisotropy = 4;
  return {
    solid: new T.MeshStandardMaterial({ vertexColors: true, roughness: .86, map: grainMap }),
    roof: new T.MeshStandardMaterial({ vertexColors: true, roughness: .79, map, side: T.DoubleSide }),
    contact: new T.MeshBasicMaterial({ color: '#384337', vertexColors: true, transparent: true,
      side: T.DoubleSide, depthWrite: false, toneMapped: false }),
  };
}

function courtContact(plots, material) {
  const position = [], color = [];
  const width = .37;
  for (const plot of plots) {
    if (plot.kind !== 'court') continue;
    const [x0, z0] = center(plot.id);
    for (const d of cardinal) {
      if (!(plot.arms & (1 << d)) || plot.galleryArms & (1 << d)) continue;
      const f = localFrame(plot.id, d);
      // Keep the wide central arrival openings equal in brightness to their paths.
      for (const [a, b] of [[-HALF, -1.54], [1.54, HALF]]) {
        const edge = HALF - .013;
        for (const [x, v, opacity] of [[a, edge, .18], [b, edge, .18], [a, edge - width, 0],
          [a, edge - width, 0], [b, edge, .18], [b, edge - width, 0]]) {
          const [px, , pz] = f.point(x, 0, v);
          position.push(px, courtGroundY(plot, px - x0, pz - z0) + .009, pz);
          color.push(1, 1, 1, opacity);
        }
      }
    }
  }
  if (!position.length) return null;
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(position, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(color, 4));
  return new T.Mesh(geometry, material);
}

export function buildArchitecture(plots, materials) {
  const solid = new Surface(), tiles = new Surface();
  const ground = new Surface(), features = new Surface();
  for (const plot of plots) {
    if (plot.kind !== 'room') {
      buildSiteGround(ground, features, plot);
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
    buildUpper(solid, plot, paint);
    buildRoof(solid, tiles, plot, paint);
    alleyFloor(ground, plot);
  }
  const group = new T.Group();
  const contact = materials.contact && courtContact(plots, materials.contact);
  if (contact) group.add(contact);
  for (const [surface, material, buildings, castShadow] of [
    [ground, materials.solid, false, false],
    [features, materials.solid, false, true],
    [solid, materials.solid, true, true],
    [tiles, materials.roof, true, true],
  ]) {
    const mesh = surface.mesh(material);
    if (!mesh) continue;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.userData.buildings = buildings;
    group.add(mesh);
  }
  return group;
}
