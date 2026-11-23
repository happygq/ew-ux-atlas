import { BAY, DX, DZ, PALETTES, center } from './world.mjs';
import { FLOOR as floor } from './spatial.mjs';

const half = BAY / 2;
const stone = '#8d9189';
const stoneMold = '#747b71';
const paving = ['#92968f', '#a0a296', '#969a91', '#a4a497', '#9da298'];
const plank = '#776655';
const dark = '#4f4338';
const channel = '#525b55';

function frame(id, d) {
  const [x, z] = center(id);
  const at = (u, y, v) => [x - DZ[d] * u + DX[d] * v, y, z + DX[d] * u + DZ[d] * v];
  return {
    at,
    box(surface, u, y, v, w, h, depth, paint) {
      surface.box(...at(u, y, v), DX[d] ? depth : w, h, DX[d] ? w : depth, paint);
    },
  };
}

function masonryScreen(solid, plot) {
  const [x, z] = center(plot.id);
  const palette = PALETTES[plot.palette ?? 0];
  for (const { side: d, opening } of plot.screen ?? []) {
    const f = frame(plot.id, d);
    const edge = half - .14;
    const gap = .84;
    const top = 2.41;
    if (!opening) {
      f.box(solid, 0, top / 2, edge, BAY, top, .25, palette.plaster);
      f.box(solid, 0, .17, edge, BAY, .30, .29, stoneMold);
    }
    for (const side of opening ? [-1, 1] : []) {
      const width = half - gap;
      const u = side * (gap + width / 2);
      f.box(solid, u, top / 2, edge, width, top, .25, palette.plaster);
      f.box(solid, u, .17, edge, width, .30, .29, stoneMold);
      f.box(solid, side * (gap + .065), 1.13, edge, .13, 2.22, .32, palette.timber);
    }
    if (opening) f.box(solid, 0, 2.31, edge, gap * 2, .20, .28, palette.timber);
    f.box(solid, 0, top + .015, edge, BAY, .08, .33, palette.tiles);
    f.box(solid, 0, top + .092, edge + .015, BAY - .13, .075, .21, palette.tiles);
  }
  for (const d of plot.cornerSeals ?? []) {
    const n = (d + 1) % 4;
    const pt = (a, b, y) => [x + DX[d] * a + DX[n] * b, y, z + DZ[d] * a + DZ[n] * b];
    solid.beam(pt(half + .03, half - .46, 1.14), pt(half - .46, half + .03, 1.14),
      2.26, .24, palette.plaster);
    solid.beam(pt(half + .03, half - .46, 2.30), pt(half - .46, half + .03, 2.30),
      .092, .28, palette.tiles);
  }
}

function slit(a, b, active) {
  if (!active || b <= -.05 || a >= .05) return [[a, b]];
  return [[a, Math.min(b, -.05)], [Math.max(a, .05), b]].filter(([l, r]) => r - l > .028);
}

export function courtGroundY(plot, x, z) {
  const water = plot.drain;
  if (!water) return .0385;
  const links = water.links;
  const fromLong = links & (z < 0 ? 1 : 4) ? Math.abs(x) : Math.hypot(x, z);
  const fromCross = links & (x < 0 ? 8 : 2) ? Math.abs(z) : Math.hypot(x, z);
  return .036 + water.level * .55 + Math.min(fromLong, fromCross) * .007;
}

function pavingStone(surface, plot, x, z, a, b, c, d, shade) {
  const left = a + .009, right = b - .009, near = c + .009, far = d - .009;
  const point = (u, v) => [x + u, courtGroundY(plot, u, v), z + v];
  const corners = [point(left, near), point(left, far), point(right, far), point(right, near)];
  surface.triangle(corners[0], corners[1], corners[2], shade, undefined, true);
  surface.triangle(corners[0], corners[2], corners[3], shade, undefined, true);
  for (let i = 0; i < 4; i++) {
    const first = corners[i], next = corners[(i + 1) % 4];
    const low = [first[0], -.013, first[2]], lowNext = [next[0], -.013, next[2]];
    surface.triangle(first, low, lowNext, shade);
    surface.triangle(first, lowNext, next, shade);
  }
}

function tileGround(s, plot) {
  const [x, z] = center(plot.id);
  const court = plot.kind === 'court';
  const arms = (plot.arms ?? 0) | (plot.road ?? 0);
  const width = plot.road ? 2.2 : 1.22;
  const full = court || plot.forecourt;
  const step = BAY / 8;
  for (let row = 0; row < 8; row++) {
    const z0 = -half + row * step, z1 = z0 + step;
    const nz = (z0 + z1) / 2;
    const across = full || !plot.road && ((arms & 1) && nz <= -half + width || (arms & 4) && nz >= half - width);
    const upright = plot.road && ((arms & 1) && nz <= width / 2 || (arms & 4) && nz >= -width / 2);
    const west = across || !!(arms & 8), east = across || !!(arms & 2);
    if (!west && !east && !upright) continue;
    const centralRow = z1 > -width / 2 && z0 < width / 2;
    if (!across && !upright && !centralRow) continue;
    const left = across || west && centralRow ? -half : plot.road ? -width / 2 : half - width;
    const right = across || east && centralRow ? half : plot.road ? width / 2 : -half + width;
    const loZ = across || upright ? z0 : Math.max(z0, -width / 2);
    const hiZ = across || upright ? z1 : Math.min(z1, width / 2);
    if (hiZ - loZ < .04) continue;
    const laneMask = plot.drain?.links ?? 0;
    const insetSlotX = court && (laneMask & 5) && (nz < 0 ? laneMask & 1 : laneMask & 4);
    const offset = row % 2 ? BAY / 10 : 0;
    for (let col = 0; col <= 5; col++) {
      const a = Math.max(left, -half + col * BAY / 5 - offset);
      const b = Math.min(right, -half + (col + 1) * BAY / 5 - offset);
      if (b - a < .045) continue;
      const shade = paving[(plot.id * 7 + row * 3 + col) % paving.length];
      for (const [loX, hiX] of slit(a, b, insetSlotX)) {
        const mx = (loX + hiX) / 2;
        const insetSlotZ = court && (laneMask & 10) && (mx < 0 ? laneMask & 8 : laneMask & 2);
        for (const [from, to] of slit(loZ, hiZ, insetSlotZ)) {
          if (court) pavingStone(s, plot, x, z, loX, hiX, from, to, shade);
          else s.box(x + mx, .016, z + (from + to) / 2, hiX - loX - .018, .045, to - from - .018, shade);
        }
      }
    }
  }
}

function drains(s, plot) {
  const [x, z] = center(plot.id);
  const water = plot.drain;
  if (!water) return;
  const y = -.011 + water.level;
  for (let d = 0; d < 4; d++) {
    if (!(water.links & (1 << d))) continue;
    const end = [x + DX[d] * half, y + (water.falls[d] ?? 0), z + DZ[d] * half];
    s.beam([x, y, z], end, .030, .082, channel);
  }
  if (plot.outlet) {
    s.box(x, .004, z, .35, .030, .48, channel);
    for (let i = -3; i <= 3; i++) s.box(x, .027, z + i * .061, .33, .019, .022, stoneMold);
  }
}

export function buildSiteGround(ground, features, plot) {
  tileGround(ground, plot);
  if (plot.kind !== 'court') return;
  drains(ground, plot);
  masonryScreen(features, plot);
}

function walkableStair(s, f, deck, base, paint) {
  const sx = 1.38, width = .98;
  const start = 1.70, end = -1.80, run = start - end;
  const rise = deck - base, count = 15;
  const step = run / count;
  for (let i = 0; i < count; i++) {
    const height = rise * (i + 1) / count;
    f.box(s, sx, base + height / 2, start - (i + .5) * step, width, height, step + .009, paint.timber);
    f.box(s, sx, base + height - .015, start - (i + .5) * step, width + .065, .034, step + .016, plank);
  }
  for (const side of [-1, 1]) {
    const u = sx + side * (width / 2 + .032);
    s.beam(f.at(u, base + .87, start), f.at(u, deck + .87, end), .068, .058, dark);
    for (const t of [0, .25, .5, .75, 1]) {
      const y = base + rise * t;
      f.box(s, u, y + .425, start - t * run, .061, .85, .061, paint.timber);
    }
  }
}

export function buildUpper(solid, plot, paint) {
  const facing = plot.upper?.face ?? plot.face ?? 2;
  const f = frame(plot.id, facing);
  if (plot.floorRaise) {
    const [x, z] = center(plot.id);
    solid.box(x, floor + plot.floorRaise / 2, z, BAY - 1.02, plot.floorRaise, BAY - 1.02, stone);
    f.box(solid, 0, floor + plot.floorRaise / 4, half - .40, 2.56, plot.floorRaise / 2, .31, stoneMold);
  }
  if (plot.splitHall) {
    const partition = frame(plot.id, plot.splitHall.face);
    const door = plot.splitHall.through ? .65 : 0;
    for (const dir of [-1, 1]) {
      const width = half - door;
      partition.box(solid, dir * (door + width / 2), 1.43, 0, width, 2.65, .115, paint.timber);
    }
    if (door) partition.box(solid, 0, 2.53, 0, 1.30, .37, .135, dark);
  }
  if (!plot.upper) return;
  const deck = plot.upper.deck;
  const line = (left, right, near, far) => f.box(solid, (left + right) / 2, deck - .08, (near + far) / 2,
    right - left, .16, far - near, plank);
  line(-half + .24, .83, -half + .23, half - .23);
  line(1.94, half - .24, -half + .23, half - .23);
  line(.83, 1.94, -half + .23, -1.81);
  line(.83, 1.94, 1.71, half - .23);
  walkableStair(solid, f, deck, floor + (plot.floorRaise ?? 0), paint);

  const height = plot.roof.eave - deck;
  const inner = half - .255;
  for (const u of [-2.08, -1.26, 1.26, 2.08]) {
    f.box(solid, u, deck + height / 2 - .08, inner, .142, height - .17, .18, paint.timber);
  }
  for (const side of [-1, 1]) {
    f.box(solid, side * 1.69, deck + .31, inner, .72, .59, .13, paint.timber);
    for (const t of [-.25, -.08, .08, .25]) {
      f.box(solid, side * 1.69 + t, deck + 1.20, inner, .034, 1.13, .038, paint.timber);
    }
  }
  f.box(solid, 0, plot.roof.eave - .18, inner, BAY - .44, .34, .22, dark);
  f.box(solid, 0, deck - .075, half + .14, 2.76, .15, .78, plank);
  const outer = half + .49;
  f.box(solid, 0, deck + .94, outer, 2.80, .074, .085, paint.timber);
  for (let i = -5; i <= 5; i++) f.box(solid, i * .259, deck + .47, outer, .052, .91, .064, paint.timber);
  for (const side of [-1, 1]) {
    f.box(solid, side * 1.374, deck + .46, half + .14, .07, .91, .71, paint.timber);
  }
}
