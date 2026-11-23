import * as T from '../../g1-m2/r2-vertical-v03-visual/vendor/three.module.min.js';
import { PALETTES } from './world.mjs';

export const WOOD = 2;
const plaster = new Set(PALETTES.map(palette => palette.plaster));
const timber = new Set(PALETTES.flatMap(palette => [palette.timber, palette.accent]));
const finishes = new Map();

export function finishOf(paint) {
  if (!finishes.has(paint)) {
    const rgb = Number.parseInt(paint.slice(1), 16);
    const red = rgb >> 16, green = rgb >> 8 & 255, blue = rgb & 255;
    const warmWood = red - green >= 13 && red - blue >= 22;
    finishes.set(paint, timber.has(paint) || warmWood ? WOOD : plaster.has(paint) ? 1 : 0);
  }
  return finishes.get(paint);
}

export function noise(a, b = 0) {
  let h = Math.imul(a + 31, 0x45d9f3b) ^ Math.imul(b + 71, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const side = 256;
const wrap = (n, period) => (n % period + period) % period;
const { lerp, clamp } = T.MathUtils;

function field(x, y, columns, rows, seed) {
  const dx = Math.floor(x), dy = Math.floor(y);
  const sx = x - dx, sy = y - dy;
  const u = sx * sx * (3 - 2 * sx), v = sy * sy * (3 - 2 * sy);
  const at = (a, b) => noise(wrap(a, columns) + seed, wrap(b, rows));
  return lerp(lerp(at(dx, dy), at(dx + 1, dy), u), lerp(at(dx, dy + 1), at(dx + 1, dy + 1), u), v);
}

function texture(sample, colorSpace = T.NoColorSpace) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = side;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(side, side);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const [red, green, blue] = sample(x / side, y / side, noise(x, y));
      const i = (y * side + x) * 4;
      pixels.data.set([red, green, blue, 255], i);
    }
  }
  context.putImageData(pixels, 0, 0);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = colorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}

// Each repeat covers eight pans/covers across by six courses downhill.
function tile(x, y, grit) {
  const across = x * 8;
  const col = Math.floor(across);
  const down = y * 6 + (col % 2) * .18;
  const row = Math.floor(down);
  const u = across - col, v = down - row;
  const roll = Math.pow(Math.abs(Math.cos(Math.PI * u)), 4);
  const head = Math.pow(Math.abs(Math.cos(Math.PI * (v + .07))), 12);
  const age = noise(col, wrap(row, 6) + 71);
  const edge = Math.max(0, 1 - Math.abs(v - .85) * 12);
  const shade = 202 + 24 * roll - 26 * edge + 26 * (age - .5) + 13 * (grit - .5);
  return { shade, height: 47 + 111 * roll + 49 * head + 21 * v - 16 * edge, age };
}

function solidFinishMaterial(maps) {
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .88 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, maps);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float finishKind;
        varying float vFinishKind;
        varying vec2 vFinishUv;
        varying vec3 vFinishPosition;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vFinishKind = finishKind;
        vFinishUv = uv;
        vFinishPosition = position;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vFinishKind;
        varying vec2 vFinishUv;
        varying vec3 vFinishPosition;
        uniform sampler2D stoneDetail;
        uniform sampler2D limeDetail;
        uniform sampler2D woodDetail;`)
      .replace('#include <map_fragment>', `
        if (vFinishKind > 1.5) {
          diffuseColor.rgb *= texture2D(woodDetail, vFinishUv).rgb;
        } else if (vFinishKind > .5) {
          vec3 lime = texture2D(limeDetail, vFinishUv * vec2(.53, .63)).rgb;
          float splash = 1. - smoothstep(.12, .93, vFinishPosition.y);
          vec3 grime = mix(vec3(.81, .77, .70), vec3(1.0), lime.g);
          diffuseColor.rgb *= lime * mix(vec3(1.0), grime, splash * .9);
        } else {
          diffuseColor.rgb *= texture2D(stoneDetail, vFinishUv).rgb;
        }`);
  };
  return material;
}

export function createArchitectureMaterials() {
  const stone = texture((x, y, grit) => {
    const mottling = 204 + 41 * field(x * 12, y * 11, 12, 11, 45) + 12 * (grit - .5);
    return [mottling + 2, mottling, mottling - 3];
  });
  const lime = texture((x, y, grit) => {
    const patches = field(x * 8, y * 5, 8, 5, 69);
    const streaks = field(x * 19, y * 3, 19, 3, 99);
    const dust = .52 * patches + .34 * streaks + .14 * grit;
    const shade = 249 - 76 * Math.pow(dust, 2.6);
    return [shade + 2, shade, shade - 3];
  });
  const wood = texture((x, y, grit) => {
    const bend = .048 * Math.sin(2 * Math.PI * y) + .013 * Math.sin(6 * Math.PI * y);
    const grain = field(wrap(x + bend, 1) * 54, y * 4, 54, 4, 130);
    const growth = .5 + .5 * Math.sin((x + bend) * 32 * Math.PI);
    const shade = clamp(190 + 54 * grain + 19 * growth + 10 * (grit - .5), 165, 255);
    return [shade + 4, shade, shade - 5];
  });
  const roof = texture((x, y, grit) => {
    const { shade, age } = tile(x, y, grit);
    return [shade + 2 * age, shade, shade - 2 * age];
  }, T.SRGBColorSpace);
  const relief = texture((x, y, grit) => {
    const { height } = tile(x, y, grit);
    return [height, height, height];
  });
  return {
    solid: solidFinishMaterial({ stoneDetail: { value: stone }, limeDetail: { value: lime }, woodDetail: { value: wood } }),
    roof: new T.MeshStandardMaterial({
      vertexColors: true, roughness: .91, map: roof, bumpMap: relief, bumpScale: .029, side: T.DoubleSide,
    }),
    glow: new T.MeshBasicMaterial({ vertexColors: true }),
    contact: new T.MeshBasicMaterial({ color: '#443f36', vertexColors: true, transparent: true,
      side: T.DoubleSide, depthWrite: false, toneMapped: false }),
  };
}
