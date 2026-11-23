import * as T from '../../g1-m2/r2-vertical-v03-visual/vendor/three.module.min.js';
import { BAY, DX, DZ, PALETTES, center } from './world.mjs';
import { DOOR, FLOOR, PASSAGE, WALL } from './spatial.mjs';
import { buildSiteGround, buildUpper, courtGroundY } from './structures.mjs';
import { createArchitectureMaterials, finishOf, noise, WOOD } from './finishes.mjs';

export { createArchitectureMaterials, noise };

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
  finishKind = [];
  plotIds = [];
  plot = -1;
  lightPoints = [];
  glow = null;

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
    const finish = finishOf(color);
    for (const p of [a, b, c]) {
      this.position.push(...p);
      this.normal.push(n[0] / length, n[1] / length, n[2] / length);
      this.color.push(tint.r, tint.g, tint.b);
      this.uv.push(...(uv ?? solidUV)(p, n));
      this.finishKind.push(finish);
    }
    this.plotIds.push(this.plot);
  }

  box(x, y, z, w, h, d, tint, rotation) {
    if (w <= 0 || h <= 0 || d <= 0) return;
    const uv = finishOf(tint) === WOOD ? woodUV([x, y, z], [w, h, d], rotation) : undefined;
    for (let i = 0; i < cube.length; i += 9) {
      const points = [i, i + 3, i + 6].map(j => {
        const px = cube[j] * w, py = cube[j + 1] * h, pz = cube[j + 2] * d;
        if (!rotation) return [x + px, y + py, z + pz];
        const p = new T.Vector3(px, py, pz).applyQuaternion(rotation);
        return [x + p.x, y + p.y, z + p.z];
      });
      this.triangle(...points, tint, uv);
    }
  }

  glowBox(...args) {
    this.glow?.box(...args);
  }

  lantern(x, y, z) {
    this.lightPoints.push([x, y, z]);
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
    g.setAttribute('finishKind', new T.Float32BufferAttribute(this.finishKind, 1));
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

function woodUV(origin, dimensions, rotation) {
  const along = dimensions.indexOf(Math.max(...dimensions));
  const across = [0, 1, 2].filter(axis => axis !== along);
  const inverse = rotation?.clone().invert();
  const seed = origin[0] * .13 + origin[1] * .39 + origin[2] * .07;
  return (point, normal) => {
    let p = point.map((value, axis) => value - origin[axis]);
    if (inverse) {
      p = new T.Vector3(...p).applyQuaternion(inverse).toArray();
      normal = new T.Vector3(...normal).applyQuaternion(inverse).toArray();
    }
    const [a, b] = across;
    return [p[Math.abs(normal[a]) > Math.abs(normal[b]) ? b : a] / .39 + seed, p[along] / 3.1];
  };
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
  const glowBox = (surface, u, y, v, w, h, thick, tint) => (surface.glowBox ?? surface.box).call(surface,
    ...point(u, y, v), DX[d] ? thick : w, h, DX[d] ? w : thick, tint,
  );
  return { point, box, glowBox };
}

function lineBox(s, frame, a, b, low, high, v, thickness, paint) {
  frame.box(s, (a + b) / 2, (low + high) / 2, v, b - a, high - low, thickness, paint);
}

function slateStrip(tiles, a, b, c, d, color, uv = tileUV) {
  tiles.triangle(a, b, c, color, uv, true);
  tiles.triangle(a, c, d, color, uv, true);
}

function tileNoses(tiles, frame, left, right, lip, heightAt, color, spacing = .22) {
  const count = Math.max(1, Math.round((right - left) / spacing));
  const pitch = (right - left) / count;
  const arc = [[-1, 0], [-.71, .71], [0, 1], [.71, .71], [1, 0]];
  for (let i = 0; i < count; i++) {
    const u = left + (i + .5) * pitch;
    const y = heightAt(u);
    const front = arc.map(([x, z]) => frame.point(u + pitch * x * .35, y + z * .043, lip + .02));
    const rear = arc.map(([x, z]) => frame.point(u + pitch * x * .35, y + z * .043 + .025, lip - .093));
    const socket = frame.point(u, y, lip + .02);
    for (let j = 1; j < arc.length; j++) {
      slateStrip(tiles, rear[j - 1], rear[j], front[j], front[j - 1], color);
      tiles.triangle(socket, front[j], front[j - 1], color);
    }
  }
}

function timberPost(s, frame, u, v, h, paint) {
  frame.box(s, u, .128, v, .30, .13, .30, '#716c63');
  frame.box(s, u, .197, v, .238, .058, .238, '#898078');
  const facets = 8;
  const ring = (i, y, radius) => {
    const angle = (i + .5) / facets * Math.PI * 2;
    return frame.point(u + Math.cos(angle) * radius, y, v + Math.sin(angle) * radius);
  };
  for (let i = 0; i < facets; i++) {
    const a = ring(i, .223, .094), b = ring(i + 1, .223, .094);
    const c = ring(i + 1, h, .079), d = ring(i, h, .079);
    s.triangle(a, b, c, paint.timber);
    s.triangle(a, c, d, paint.timber);
  }
  frame.box(s, u, h - .058, v, .215, .091, .215, darkWood);
}

function lattice(s, frame, at, width, low, high, v, paint, kind, lit = false) {
  const narrow = kind === 'high' || kind === 'stone';
  const height = high - low;
  const count = narrow ? 1 : Math.min(3, Math.ceil(width / .68));
  const leafWidth = width / count;
  const wood = paint.timber;
  const pattern = '#865d3e';
  const border = narrow ? .035 : .065;
  for (let i = 0; i < count; i++) {
    const middle = at - width / 2 + leafWidth * (i + .5);
    const open = leafWidth - border;
    if (lit && i === Math.floor(count / 2)) {
      frame.glowBox(s, middle, (low + high) / 2, v - .034, open, height - .046, .017, '#da8338');
    } else {
      frame.box(s, middle, (low + high) / 2, v - .043, open, height - .035, .019, glass);
    }
    for (const side of [-1, 1]) {
      frame.box(s, middle + side * open / 2, (low + high) / 2, v + .028, border, height, .071, wood);
    }
    const rowCount = narrow ? 2 : 4;
    for (let row = 1; row < rowCount; row++) {
      const y = low + height * row / rowCount;
      frame.box(s, middle, y, v + .035, open, .027, .043, narrow ? wood : pattern);
    }
    if (narrow) frame.box(s, middle, (low + high) / 2, v + .031, .026, height - .05, .051, wood);
    else {
      frame.box(s, middle, (low + high) / 2, v + .041, .023, height - .06, .041, pattern);
      for (let row = 0; row < rowCount; row++) {
        const side = row % 2 ? -1 : 1;
        frame.box(s, middle + side * open * .24, low + height * (row + .5) / rowCount,
          v + .037, .023, height / rowCount, .045, wood);
      }
    }
  }
  for (const y of [low + .018, high - .022]) frame.box(s, at, y, v + .04, width + .034, .057, .088, wood);
}

function galleryCanopy(s, tiles, frame, left, right, boundary, eave, paint, joins, corners) {
  const overlap = .07;
  const from = boundary - overlap, lip = boundary + ARCADE_DEPTH;
  const front = eave - .39, back = eave + .015;
  const edgeA = joins[0] ? left : left + ARCADE_DEPTH;
  const edgeB = joins[1] ? right : right - ARCADE_DEPTH;
  const backA = corners[0] ? left - overlap : left;
  const backB = corners[1] ? right + overlap : right;
  const c = frame.point(edgeB, front, lip), e = frame.point(edgeA, front, lip);
  let a = frame.point(backA, back, from), b = frame.point(backB, back, from);
  for (const t of [.50, .82, 1]) {
    const run = T.MathUtils.lerp(from, lip, t);
    const h = T.MathUtils.lerp(back, front, t) - .054 * Math.sin(Math.PI * t);
    const p = frame.point(T.MathUtils.lerp(backA, edgeA, t), h, run);
    const q = frame.point(T.MathUtils.lerp(backB, edgeB, t), h, run);
    slateStrip(tiles, a, b, q, p, paint.tiles);
    a = p;
    b = q;
  }
  s.beam(e, c, .082, .135, paint.tiles);
  lineBox(s, frame, edgeA, edgeB, front - .196, front - .065, lip - .102, .14, paint.timber);
  lineBox(s, frame, edgeA, edgeB, front - .121, front - .076, lip - .036, .044, darkWood);
  tileNoses(tiles, frame, edgeA + .022, edgeB - .022, lip, () => front - .033, paint.tiles);
  if (!joins[0] && !corners[0]) timberPost(s, frame, edgeA + .13, lip - .105, front - .08, paint);
  if (!corners[1]) timberPost(s, frame, joins[1] ? edgeB - .03 : edgeB - .13, lip - .105, front - .08, paint);
  // Both angled canopy ends meet here when two sides turn into the same well.
  // Let only the clockwise member own the support at that mitre.
  if (corners[0]) timberPost(s, frame, edgeA + .02, lip - .13, front - .08, paint);
  const rafters = Math.max(4, Math.floor((edgeB - edgeA) / .31));
  for (let i = 0; i < rafters; i++) {
    const t = (i + .5) / rafters;
    const u = T.MathUtils.lerp(backA, backB, t), v = T.MathUtils.lerp(edgeA, edgeB, t);
    s.beam(frame.point(u, back - .11, from), frame.point(v, front - .074, lip - .028), .066, .062, paint.timber);
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

  lineBox(s, frame, left, right, h - .12, h + .08, v, .22, darkWood);
  lineBox(s, frame, left, right, h - .08, h + .04, v + .114, .025, paint.timber);
  lineBox(s, frame, left, right, h + .08, eave - .025, v - .039, .145, '#5d3c2a');
  if (wing) {
    // Lattice screens sit behind the columns and leave a sheltered eaves walk.
    const back = v;
    const path = Math.min(DOOR, bay);
    const panels = [[left, u - path / 2], [u + path / 2, right]];
    for (const [index, [a, b]] of panels.entries()) {
      courtPanel(s, frame, a, b, back, 1.00, Math.min(h - .12, 2.20), h, paint,
        (plot.id + d + index) % 4 === 0);
    }
    galleryCanopy(s, tiles, frame, left, right, bounds[d], eave, paint,
      plot.galleryJoins?.[d] ?? [false, false], plot.galleryCorners?.[d] ?? [false, false]);
  } else {
    for (const side of [-1, 1]) {
      timberPost(s, frame, edge(side), v, h, paint);
      timberBracket(s, frame, edge(side), h - .05, v, -side, paint);
      timberBracket(s, frame, edge(side), h - .05, v, side, paint);
    }
    courtPanel(s, frame, left, edge(-1), v - .05, .90, Math.min(h - .12, 2.28), h, paint, true);
    courtPanel(s, frame, edge(1), right, v - .05, .90, Math.min(h - .12, 2.28), h, paint, false);
    if (plot.face === d) hallLantern(s, frame, edge(1) - .22, h - .105, v + .18);
    // The hall mouth is open between the load-bearing posts.
    lineBox(s, frame, edge(-1), edge(1), FLOOR, FLOOR + .061, v, .36, '#8e8572');
  }
  for (let rafter = left + .16; rafter < right - .08; rafter += .31) {
    frame.box(s, rafter, eave - .12, v + .09, .063, .098, .34, paint.timber);
  }
}

function courtPanel(s, frame, a, b, v, sill, head, top, paint, lit) {
  const width = b - a;
  if (width < .15) return;
  lineBox(s, frame, a, b, FLOOR + .065, sill, v, .106, '#62402d');
  lineBox(s, frame, a, b, FLOOR, FLOOR + .13, v + .014, .126, paint.timber);
  lineBox(s, frame, a, b, head, top, v - .019, .13, paint.timber);
  if (width < .30) return;
  const count = Math.min(3, Math.ceil(width / .68));
  const leaf = width / count;
  for (let i = 0; i < count; i++) {
    const mid = a + leaf * (i + .5);
    lineBox(s, frame, mid - leaf * .38, mid + leaf * .38, FLOOR + .19, sill - .10, v + .049,
      .023, i % 2 ? '#744d33' : '#6d452e');
    frame.box(s, mid - leaf / 2 + .022, (FLOOR + sill) / 2, v + .063, .045, sill - FLOOR, .036, paint.timber);
  }
  lattice(s, frame, (a + b) / 2, width, sill, head, v, paint, 'screen', lit);
}

function timberBracket(s, frame, u, y, v, side, paint) {
  const profile = [[0, 0], [.41, 0], [.35, -.067], [.245, -.091], [.13, -.18], [.058, -.285], [0, -.29]];
  const face = depth => profile.map(([x, height]) => frame.point(u + side * x, y + height, v + depth));
  const front = face(.094), back = face(-.094);
  for (let i = 1; i < profile.length - 1; i++) {
    const [a, b] = side > 0 ? [i, i + 1] : [i + 1, i];
    s.triangle(front[0], front[a], front[b], paint.timber);
    s.triangle(back[0], back[b], back[a], paint.timber);
  }
  for (let i = 0; i < profile.length; i++) {
    const j = (i + 1) % profile.length;
    const [a, b] = side > 0 ? [i, j] : [j, i];
    s.triangle(front[a], back[a], back[b], darkWood);
    s.triangle(front[a], back[b], front[b], darkWood);
  }
}

function hallLantern(s, frame, u, y, v) {
  frame.box(s, u, y - .08, v, .024, .16, .024, darkWood);
  frame.box(s, u, y - .17, v, .142, .048, .139, '#663f29');
  frame.glowBox(s, u, y - .257, v, .161, .158, .154, '#ffad49');
  for (const side of [-1, 1]) {
    frame.box(s, u + side * .069, y - .257, v + .078, .012, .162, .012, '#9e5529');
    frame.box(s, u + side * .076, y - .257, v - .061, .013, .162, .013, '#9e5529');
  }
  frame.box(s, u, y - .343, v, .136, .046, .135, '#633923');
  frame.box(s, u, y - .38, v, .027, .057, .023, '#813e2a');
  s.lantern?.(...frame.point(u, y - .293, v + .18));
}

function portal(s, tiles, frame, u, v, width, high, paint, kind, wallTop) {
  const main = kind === 'main';
  const service = kind === 'service';
  const wing = main ? .34 : service ? .14 : .22;
  const [left, right] = [u - width / 2 - wing, u + width / 2 + wing];
  const brick = '#69635a';
  const edge = '#93877a';
  for (const side of [-1, 1]) {
    const jamb = u + side * (width / 2 + (main ? .13 : .095));
    frame.box(s, jamb, (FLOOR + high) / 2, v + (service ? .018 : .091),
      main ? .21 : .135, high - FLOOR, service ? .15 : .23, brick);
    if (service) continue;
    frame.box(s, jamb, (FLOOR + high) / 2, v + .204, main ? .122 : .079, high - FLOOR, .030, edge);
    frame.box(s, jamb, .244, v + .114, main ? .27 : .19, .25, .26, '#5f594f');
    frame.box(s, jamb, .389, v + .121, main ? .24 : .17, .056, .249, '#817367');
    frame.box(s, jamb, high - .077, v + .116, main ? .27 : .19, .084, .26, brick);
  }
  lineBox(s, frame, left, right, high, high + (service ? .091 : .111),
    v + (service ? .02 : .106), service ? .17 : .27, brick);
  if (service) return;

  const scale = Math.min(1, Math.max(.72, (wallTop - high + .12) / .56));
  const layer = (inset, from, to, depth, thickness, tint) => lineBox(s, frame, left + inset, right - inset,
    high + from * scale, high + to * scale, v + depth, thickness, tint);
  layer(.08, .11, .228, .124, .211, '#817469');
  layer(.039, .182, .221, .237, .072, '#918478');
  layer(.009, .225, .263, .257, .091, '#5e564e');
  layer(-.028, .270, .306, .273, .105, edge);
  if (main) {
    const relief = .111 + .282 * scale;
    layer(.016, .304, .404, .239, .184, brick);
    layer(-.054, .405, .435, .271, .188, '#aaa197');
    lineBox(s, frame, u - width * .24, u + width * .24, high + .317 * scale,
      high + .385 * scale, v + .342, .033, '#9d9184');
    for (const side of [-1, 1]) {
      for (let detail = 0; detail < 3; detail++) {
        const x = u + side * (width * .29 + .087 * detail);
        frame.box(s, x, high + (.345 + .014 * (detail % 2)) * scale, v + .344,
          .066, .032, .034, '#a59785');
        frame.box(s, x, high + .209 * scale, v + .279, .073, .034, .029, '#a49988');
      }
      frame.box(s, u + side * (width / 2 + .095), high + .284 * scale, v + relief,
        .13, .106, .094, '#786c60');
    }
  }
  portalHood(s, tiles, frame, u, (right - left) / 2, v, high, scale, paint, main);
}

function portalHood(s, tiles, frame, u, span, v, high, scale, paint, main) {
  const width = span + (main ? .17 : .093);
  const reach = main ? .51 : .37;
  const base = (main ? .475 : .355) * scale;
  const rise = main ? .19 : .095;
  const shape = station => {
    const t = Math.abs(station);
    const sweep = Math.pow(t, 4) * rise;
    return {
      rear: frame.point(u + station * (width - .063), high + base + .098 + .52 * sweep, v + .066),
      mid: frame.point(u + station * (width - .025), high + base + .028 + .81 * sweep, v + reach * .65),
      lip: frame.point(u + station * width, high + base + sweep, v + reach),
    };
  };
  const rows = ['rear', 'mid', 'lip'];
  const stations = main ? [-1, -.88, -.69, -.42, 0, .42, .69, .88, 1] : [-1, -.64, 0, .64, 1];
  let last = shape(stations[0]);
  for (const station of stations.slice(1)) {
    const section = shape(station);
    for (let i = 0; i < 2; i++) {
      const a = last[rows[i]], b = section[rows[i]], c = section[rows[i + 1]], d = last[rows[i + 1]];
      tiles.triangle(a, b, c, paint.tiles, tileUV, true);
      tiles.triangle(a, c, d, paint.tiles, tileUV, true);
    }
    const under = point => [point[0], point[1] - .026, point[2]];
    s.beam(under(last.lip), under(section.lip), .061, .101, '#373530');
    last = section;
  }
  const ends = Math.ceil(width * 2 / .115);
  for (let i = 1; i < ends; i++) {
    const t = i / ends * 2 - 1;
    const [, y] = shape(t).lip;
    frame.box(s, u + t * width, y + .007, v + reach - .008, .070, .054, .084, paint.tiles);
  }
}

const windowSizes = {
  high: [.30, .42, 1.98],
  stone: [.55, .65, 1.58],
  lattice: [.83, .89, 1.23],
};

function dressWindow(s, frame, kind, u, width, low, high, v, paint) {
  if (kind === 'lattice') {
    lattice(s, frame, u, width, low, high, v, paint, kind);
    return;
  }
  // The small lane window sits in a recessed brick/stone opening.
  const decorated = kind === 'stone';
  const surround = decorated ? .093 : .052;
  const a = u - width / 2 - surround, b = u + width / 2 + surround;
  const stone = decorated ? '#837a6e' : '#6b645b';
  lattice(s, frame, u, width, low, high, v - .088, paint, kind);
  for (const side of [-1, 1]) {
    frame.box(s, u + side * (width / 2 + surround / 2), (low + high) / 2, v + .013,
      surround, high - low, decorated ? .083 : .063, stone);
  }
  lineBox(s, frame, a - .035, b + .035, high, high + .063, v + .033, .105, stone);
  lineBox(s, frame, a, b, low - .065, low, v + .043, .125, stone);
  if (decorated) {
    lineBox(s, frame, a - .057, b + .057, high + .065, high + .113, v + .046, .165, '#55524a');
    lineBox(s, frame, a - .018, b + .018, low - .083, low - .055, v + .057, .104, '#94897b');
  }
}

function gateJoinery(s, frame, u, v, width, high, paint, reveal) {
  const timber = paint.accent ?? paint.timber;
  for (const side of [-1, 1]) {
    const jamb = u + side * (width / 2 + .066);
    const leafDepth = Math.min(.60, width * .46);
    const height = high - FLOOR - .16;
    const leafMid = v - leafDepth / 2 - .029;
    frame.box(s, jamb, FLOOR + .081 + height / 2, leafMid, .079, height, leafDepth, timber);
    const planks = ['#5e3e2d', '#63412d', '#6b4732', '#593b2b'];
    for (let i = 0; i < planks.length; i++) {
      const z = leafMid + (i - 1.5) * leafDepth / 4;
      frame.box(s, jamb - side * .039, FLOOR + .081 + height / 2, z, .029, height - .071,
        leafDepth / 4 - .008, planks[i]);
    }
    for (const y of [FLOOR + .19, high - .27]) {
      frame.box(s, jamb, y, leafMid, .106, .052, leafDepth - .012, darkWood);
    }
    frame.box(s, jamb - side * .045, FLOOR + .94, v - leafDepth + .054, .035, .077, .054, '#9f8456');
    if (reveal) frame.box(s, jamb, (high + .28) / 2, v + .148, .10, high - .28, .073, timber);
  }
  if (reveal) lineBox(s, frame, u - width / 2 - .10, u + width / 2 + .10,
    high + .015, high + .165, v + .153, .071, timber);
}

function lowerHallFront(s, frame, left, right, width, v, h, paint) {
  for (const side of [-1, 1]) {
    const u = side * (width / 2 + .20);
    timberPost(s, frame, u, v - .075, h + .11, paint);
    timberBracket(s, frame, u, h + .10, v - .068, side, paint);
  }
  lineBox(s, frame, left + .17, right - .17, h + .08, h + .235, v - .035, .174, paint.timber);
  for (const [a, b] of [[left + .25, -width / 2 - .2], [width / 2 + .2, right - .25]]) {
    courtPanel(s, frame, a, b, v + .068, .80, Math.min(h, 2.03), h + .085, paint, false);
  }
}

function buildWall(s, tiles, plot, d, paint, bounds) {
  const wall = plot.walls[d];
  const frame = localFrame(plot.id, d);
  const [ownLeft, ownRight] = sideSpan(bounds, d);
  const [spanLeft, spanRight] = wall.sharedSpan ?? [ownLeft, ownRight];
  const eave = roofHeight(plot);
  const top = wall.top ?? eave;
  const lowTop = wall.lowTop ?? eave;
  if (wall.shared) {
    const masonry = Math.max(.26, WALL);
    const exterior = bounds[d] - masonry / 2;
    for (const [from, to] of [[ownLeft, spanLeft], [spanRight, ownRight]]) {
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
  // The partition sits behind the outer skin where two room faces line up.
  const behindSkin = (side, end, outside) => wall.shared && Math.abs(end - outside) < .001
    && !plot.walls[side].shared && !plot.walls[side].court ? .055 : 0;
  const left = spanLeft + behindSkin(previous(d), spanLeft, ownLeft);
  const right = spanRight - behindSkin(next(d), spanRight, ownRight);
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
    const projection = wall.separated ? 0 : .065;
    lineBox(s, frame, from, to, .014, .13, v, thickness + projection, '#666057');
    lineBox(s, frame, from, to, .13, .326, v, thickness + projection * .8, '#777065');
    lineBox(s, frame, from, to, .326, .368, v, thickness + projection * .44, '#9a9182');
    if (wall.separated || (!wall.portal && wall.window !== 'stone')) return;
    const blocks = ['#777166', '#888074', '#6e685d', '#93887a', '#807669'];
    for (let row = 0; row < 2; row++) {
      const bottom = .063 + row * .132, depth = thickness / 2 + .029;
      for (let start = from - row * .26, i = 0; start < to - .049; start += .57, i++) {
        const left = Math.max(from + .01, start + .013), right = Math.min(start + .553, to - .01);
        lineBox(s, frame, left, right, bottom, bottom + .119, v + depth, .035, blocks[(i + row * 2) % blocks.length]);
      }
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
        portal(s, tiles, frame, u, v, width, high, paint, wall.separated ? 'service' : wall.portal, eave);
        gateJoinery(s, frame, u, v, width, high, paint, !wall.separated);
        if (wall.portal === 'main' && !wall.separated) {
          lineBox(s, frame, a - .13, b + .13, .017, .07, v + thickness / 2 + .25, .38, '#777064');
          lineBox(s, frame, a - .104, b + .104, .049, FLOOR, v + thickness / 2 + .091, .27, '#928679');
        }
      }
      if (wall.lowerHall) lowerHallFront(s, frame, left, right, width, v, high, paint);
    }
  }
}

const roofStations = [0, .28, .52, .75, .90, 1];
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

function wallCap(s, tiles, frame, left, right, top, v, paint, rise) {
  const span = right - left;
  lineBox(s, frame, left, right, top - .132, top - .071, v, .295, paint.trim);
  lineBox(s, frame, left - .025, right + .025, top - .071, top - .025, v, .347, '#92897c');
  lineBox(s, frame, left - .055, right + .055, top - .027, top + .018, v, .391, '#b0a99b');
  const step = Math.min(.23, span * .35);
  const stations = [left - .07, left + step * .13, left + step * .51, left + step,
    right - step, right - step * .51, right - step * .13, right + .07];
  const crown = u => top + .129 + rise[0] * Math.max(0, 1 - (u - left + .07) / (step + .07)) ** 2
    + rise[1] * Math.max(0, 1 - (right - u + .07) / (step + .07)) ** 2;
  const profile = u => {
    const y = crown(u);
    const end = Math.max(0, 1 - Math.min(u - left + .07, right + .07 - u) / (step + .07));
    const depth = 1 - .32 * end ** 2;
    return [
      frame.point(u, y - .096 * depth, v - .222 * depth),
      frame.point(u, y - .025 * depth, v - .068 * depth),
      frame.point(u, y, v),
      frame.point(u, y - .025 * depth, v + .068 * depth),
      frame.point(u, y - .096 * depth, v + .222 * depth),
    ];
  };
  let edge = profile(stations[0]);
  for (const u of stations.slice(1)) {
    const row = profile(u);
    for (let i = 1; i < row.length; i++) slateStrip(tiles, edge[i - 1], row[i - 1], row[i], edge[i], paint.tiles);
    for (const i of [0, row.length - 1]) {
      const a = edge[i], b = row[i];
      const lower = ([x, y, z]) => [x, y - .035, z];
      slateStrip(tiles, a, b, lower(b), lower(a), paint.tiles, solidUV);
    }
    edge = row;
  }
}

function steppedGable(s, tiles, plot, d, paint, bounds) {
  const frame = localFrame(plot.id, d);
  const base = roofHeight(plot) - .04;
  const tiers = gableProfile(plot, d);
  const middle = (tiers.length - 1) / 2;
  const v = bounds[d] - .165;
  for (const [i, { left: a, right: b, top }] of tiers.entries()) {
    const mid = (a + b) / 2;
    frame.box(s, mid, (top + base) / 2, v, b - a, top - base, .268, paint.plaster);
    const relief = i === middle ? .164 : .135;
    const turn = plot.role === 'wing' ? relief * .74 : relief;
    wallCap(s, tiles, frame, a, b, top, v, paint, [i <= middle ? turn : .038, i >= middle ? turn : .038]);
    if (b - a > .72 && !plot.roof.break[d]) {
      lineBox(s, frame, a + .07, b - .07, top - .211, top - .187, v + .133, .026, '#aaa194');
      for (const [end, sign] of [[a, 1], [b, -1]]) {
        const x = end + sign * .098;
        frame.box(s, x, top - .27, v + .136, .038, .164, .028, '#877e70');
        s.beam(frame.point(x, top - .252, v + .15),
          frame.point(x + sign * .084, top - .203, v + .15), .027, .028, '#877e70');
      }
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

const slopeHeight = (eave, peak, t) => T.MathUtils.lerp(peak, eave, t) - .135 * Math.sin(t * Math.PI);

function upperEave(s, tiles, plot, paint, bounds) {
  if (!plot.upper) return;
  const d = plot.upper.face;
  const frame = localFrame(plot.id, d);
  const [left, right] = sideSpan(bounds, d);
  const a = Math.max(left + .06, -1.57), b = Math.min(right - .06, 1.57);
  const near = bounds[d] - .10, far = bounds[d] + .61;
  const upper = roofHeight(plot) + .03, lower = upper - .265;
  let p = frame.point(a, upper, near), q = frame.point(b, upper, near);
  for (const t of [.49, .80, 1]) {
    const v = T.MathUtils.lerp(near, far, t);
    const y = T.MathUtils.lerp(upper, lower, t) - .058 * Math.sin(Math.PI * t);
    const r = frame.point(b, y, v), l = frame.point(a, y, v);
    slateStrip(tiles, p, q, r, l, paint.tiles);
    p = l;
    q = r;
  }
  s.beam(p, q, .073, .132, paint.tiles);
  tileNoses(tiles, frame, a + .02, b - .02, far, () => lower - .034, paint.tiles);
  for (const u of [a + .13, (a + b) / 2, b - .13]) {
    s.beam(frame.point(u, lower - .28, bounds[d] - .14),
      frame.point(u, lower - .046, far - .13), .091, .10, paint.timber);
  }
}

function buildRoof(s, tiles, plot, paint) {
  const { ridge, edge, corner } = roofProfile(plot);
  const { axis } = plot;
  const bounds = boundsOf(plot);
  const lift = ([x, y, z], amount) => [x, y + amount, z];
  s.beam(lift(edge[axis], .033), lift(edge[axis + 2], .033), .08, .206, paint.tiles);
  s.beam(lift(edge[axis], .089), lift(edge[axis + 2], .089), .058, .101, paint.tiles);
  for (const d of cardinal) {
    if (d % 2 === axis) {
      if (plot.roof.gable[d] || plot.roof.break[d]) steppedGable(s, tiles, plot, d, paint, bounds);
      else if (!plot.roof.joined[d]) gableInfill(s, plot, d, paint, bounds);
      continue;
    }
    const before = previous(d), after = next(d);
    const face = plot.walls[d];
    const frame = localFrame(plot.id, d);
    const [left, right] = sideSpan(bounds, d);
    const width = right - left;
    const eave = roofHeight(plot), peak = roofPeak(plot);
    const run = Math.hypot(corner[before][0] - edge[before][0], corner[before][2] - edge[before][2]);
    // Suppress projections at fabric joins and keep the wind-lifted ends clear of the firebreak.
    const projects = !face.shared && !face.separated;
    const projection = projects ? .22 : 0;
    const liftAmount = face.court || face.portal ? .068 : .034;
    const startLift = projects && !plot.roof.joined[before] && !plot.walls[before].shared ? liftAmount : 0;
    const endLift = projects && !plot.roof.joined[after] && !plot.walls[after].shared ? liftAmount : 0;
    const spanStations = startLift || endLift ? [0, .075, .22, .78, .925, 1] : [0, 1];
    const lip = 1 + projection / run;
    const roofHeightAt = (u, t) => {
      const lift = startLift * Math.max(0, 1 - u / .22) ** 2
        + endLift * Math.max(0, 1 - (1 - u) / .22) ** 2;
      const base = t > 1 ? eave - (t - 1) * run * .30 : slopeHeight(eave, peak, t);
      return base + lift * Math.min(t, 1) ** 4;
    };
    const roofPoint = (u, t) => frame.point(left + width * u, roofHeightAt(u, t), bounds[d] + (t - 1) * run);
    // Map by continuous world stations so the canvas tiles do not restart at each purlin.
    const uvScale = Math.hypot(run, peak - eave) / (run * 1.19);
    const across = axis === 0 ? 2 : 0, downslope = axis === 0 ? 0 : 2;
    const uv = point => [point[across] / 1.35, Math.abs(point[downslope] - ridge[downslope]) * uvScale];
    let row = spanStations.map(u => roofPoint(u, 0));
    const stations = projection ? [...roofStations, lip] : roofStations;
    for (const t of stations.slice(1)) {
      const nextRow = spanStations.map(u => roofPoint(u, t));
      for (let i = 1; i < row.length; i++) slateStrip(tiles, row[i - 1], row[i], nextRow[i], nextRow[i - 1], paint.tiles, uv);
      row = nextRow;
    }
    const skirt = ([x, y, z]) => [x - DX[d] * .037, y - .055, z - DZ[d] * .037];
    for (let i = 1; i < row.length; i++) {
      s.beam(skirt(row[i - 1]), skirt(row[i]), .112, .092, projects ? darkWood : paint.tiles);
      s.beam(lift(row[i - 1], -.021), lift(row[i], -.021), .068, .082, paint.tiles);
    }
    if (projects) {
      const v = bounds[d] + projection;
      const heightAt = u => roofHeightAt((u - left) / width, lip);
      tileNoses(tiles, frame, left + .023, right - .023, v, u => heightAt(u) - .038, paint.tiles);
      const count = Math.floor(width / .31);
      for (let i = 0; i < count; i++) {
        const u = left + width * (i + .5) / count;
        const y = heightAt(u);
        s.beam(frame.point(u, y + .015, bounds[d] - .20),
          frame.point(u, y - .106, v - .058), .061, .067, paint.timber);
      }
    }
    if (face.separated) {
      lineBox(s, frame, left, right, eave - .06, eave + .28, bounds[d] - .15, .28, paint.plaster);
      wallCap(s, tiles, frame, left, right, eave + .28, bounds[d] - .15, paint, [0, 0]);
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
  if (materials.glow) solid.glow = new Surface();
  for (const plot of plots) {
    if (plot.kind !== 'room') {
      buildSiteGround(ground, features, plot);
      continue;
    }
    solid.plot = tiles.plot = plot.id;
    if (solid.glow) solid.glow.plot = plot.id;
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
  group.userData.lights = solid.lightPoints;
  const contact = materials.contact && courtContact(plots, materials.contact);
  if (contact) group.add(contact);
  for (const [surface, material, buildings, castShadow, receivesShadow = true] of [
    [ground, materials.solid, false, false],
    [features, materials.solid, false, true],
    [solid, materials.solid, true, true],
    [tiles, materials.roof, true, true],
    [solid.glow, materials.glow, false, false, false],
  ]) {
    const mesh = surface?.mesh(material);
    if (!mesh) continue;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receivesShadow;
    mesh.userData.buildings = buildings;
    group.add(mesh);
  }
  return group;
}
