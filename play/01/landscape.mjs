import * as T from '../../g1-m2/r2-vertical-v03-visual/vendor/three.module.min.js';
import { BAY, HALF, buildable, center, neighbors, bankDistance } from './world.mjs';

const WATER_LEVEL = -.97;
const FLAT_GRADE = -.045;
const { clamp, lerp, smoothstep } = T.MathUtils;
const color = value => new T.Color(value);

function terrain(scene) {
  const width = HALF * 2 + 40;
  const geometry = new T.PlaneGeometry(width, width, 140, 140).rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const grass = color('#a7aa99'), shade = color('#929d89'), silt = color('#aaa394');
  const tint = new T.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    const distance = bankDistance(x, z);
    const bankWidth = 7.5 + .7 * Math.sin(.073 * x + .049 * z) + .55 * Math.cos(.093 * z - .041 * x);
    const descent = smoothstep(distance, 1.8, bankWidth);
    positions.setY(i, lerp(FLAT_GRADE, WATER_LEVEL - .38, descent));
    // Low-frequency variation lets the playable ground read as one large surface.
    const drift = .34 + .15 * Math.sin(.081 * x + .039 * z) + .10 * Math.cos(.06 * z - .069 * x);
    tint.copy(grass).lerp(shade, drift).lerp(silt, smoothstep(distance, 1.9, 5.2) * .80);
    tint.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const ground = new T.Mesh(geometry, new T.MeshStandardMaterial({ vertexColors: true, roughness: .98 }));
  ground.receiveShadow = true;
  scene.add(ground);
}

function water(scene) {
  const surface = new T.Mesh(
    new T.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2),
    new T.ShaderMaterial({
      uniforms: {
        mid: { value: color('#829f99') }, deep: { value: color('#72918f') },
        light: { value: color('#bcc6b5') }, haze: { value: scene.fog.color },
        ripples: { value: .14 },
      },
      vertexShader: `
        varying vec3 world;
        void main() {
          world = (modelMatrix * vec4(position, 1.)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        }`,
      fragmentShader: `
        varying vec3 world;
        uniform vec3 mid;
        uniform vec3 deep;
        uniform vec3 light;
        uniform vec3 haze;
        uniform float ripples;
        void main() {
          vec2 p = world.xz;
          float broad = sin(p.x * .032 + sin(p.y * .019) * .65) * .5 + .5;
          float ridge = sin(p.y * 3.05 + sin(p.x * .44) * .75 + p.x * .12);
          float crests = pow(max(0., ridge), 12.) * pow(max(0., sin(p.x * .24 + p.y * .41)), 3.);
          float detail = 1. - smoothstep(.13, .54, length(fwidth(p)));
          float distanceFog = smoothstep(165., 576., length(world - cameraPosition));
          gl_FragColor = vec4(mix(mix(deep, mid, broad), light, crests * detail * ripples), 1.);
          #include <tonemapping_fragment>
          gl_FragColor.rgb = mix(gl_FragColor.rgb, haze, distanceFog);
          #include <colorspace_fragment>
        }`,
    }),
  );
  surface.position.y = WATER_LEVEL;
  scene.add(surface);
  return surface.material.uniforms.ripples;
}

function hills(scene, { inner, outer, height, phase, shadow, light }) {
  const angles = 192, slopes = 14;
  const vertices = [], colors = [], faces = [];
  const dark = color(shadow), bright = color(light), tint = new T.Color();
  for (let j = 0; j <= slopes; j++) {
    const t = j / slopes;
    for (let i = 0; i < angles; i++) {
      const angle = i / angles * Math.PI * 2;
      const a = angle + phase;
      const spread = Math.sin(t * Math.PI);
      const radius = lerp(inner, outer, t) + spread * (13 * Math.sin(a * 3) + 9 * Math.cos(a * 7));
      const form = .50 + .17 * Math.sin(a * 5) + .12 * Math.sin(a * 9 + .8) + .07 * Math.cos(a * 16 + .4);
      const y = (spread ** 1.5) * height * form * (1 + .11 * Math.sin(t * 8 + a * 13));
      vertices.push(Math.sin(angle) * radius, WATER_LEVEL + y, Math.cos(angle) * radius);
      tint.copy(dark).lerp(bright, clamp(.22 + t * .27 + y / 83 + .11 * Math.cos(a * 9 + t * 11), 0, 1));
      colors.push(tint.r, tint.g, tint.b);
      if (j === slopes) continue;
      const v = j * angles + i, next = j * angles + (i + 1) % angles;
      faces.push(v, v + angles, next, next, v + angles, next + angles);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(faces);
  scene.add(new T.Mesh(geometry, new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
}

function gridForGround() {
  const positions = [];
  const y = FLAT_GRADE + .018;
  const r = BAY / 2;
  function edge(ax, az, bx, bz) {
    positions.push(ax, y, az, bx, y, bz);
  }
  for (const [id, playable] of buildable.entries()) {
    if (!playable) continue;
    const [x, z] = center(id);
    edge(x - r, z - r, x + r, z - r);
    edge(x - r, z - r, x - r, z + r);
    if (neighbors[id][1] < 0) edge(x + r, z - r, x + r, z + r);
    if (neighbors[id][2] < 0) edge(x - r, z + r, x + r, z + r);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  return new T.LineSegments(geometry, new T.LineBasicMaterial({
    color: '#b9baac', transparent: true, opacity: .09, depthWrite: false,
  }));
}

export function makeLandscape(scene) {
  const ripples = water(scene);
  terrain(scene);
  hills(scene, { inner: 170, outer: 289, height: 35, phase: .71, shadow: '#8eaaa0', light: '#b3c2b8' });
  hills(scene, { inner: 282, outer: 451, height: 63, phase: 1.38, shadow: '#a6b6b4', light: '#c3cdca' });
  const grid = gridForGround();
  scene.add(grid);
  return {
    grid,
    faceCamera(pitch) {
      ripples.value = lerp(.085, .17, smoothstep(pitch, .14, .68));
    },
  };
}
