import * as T from '../../g1-m2/r2-vertical-v03-visual/vendor/three.module.min.js';
import { BAY, HALF } from './world.mjs';
import { noise } from './architecture.mjs';

const material = settings => new T.MeshStandardMaterial({ roughness: .93, ...settings });
const color = hex => new T.Color(hex);
const mix = T.MathUtils.lerp;

function shore(x, z) {
  return Math.max(Math.abs(x) - HALF, Math.abs(z) - HALF);
}

function groundHeight(x, z) {
  const d = shore(x, z);
  if (d <= 0) return -.045;
  const inlet = Math.sin(x * .076 + z * .054) * 1.75 + Math.cos(x * .081 - z * .063) * 1.28;
  const edge = 7 + inlet;
  const rise = Math.sin(Math.min(1, d / edge) * Math.PI) * (.26 + .23 * Math.sin((x + z) * .12));
  return -.045 + rise - Math.max(0, d - edge) * .43;
}

function groundMap() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#eeeeea';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 13500; i++) {
    ctx.fillStyle = i % 3 ? '#655b4d28' : '#fff7d945';
    const x = noise(i, 6) * 256, y = noise(i, 8) * 256;
    ctx.fillRect(x, y, 1 + noise(i, 5) * 2, 1 + noise(i, 9) * 1.4);
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.repeat.set(48, 48);
  map.anisotropy = 8;
  return map;
}

function terrain(scene) {
  const geometry = new T.PlaneGeometry(176, 176, 176, 176).rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  const light = color('#b9b97d'), moss = color('#838e55'), bank = color('#97856c'), low = color('#6b7250');
  const tint = new T.Color();
  const colors = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    const h = groundHeight(x, z);
    positions.setY(i, h);
    const waves = .45 + .18 * Math.sin(.119 * x + .16 * z) + .13 * Math.cos(.205 * x - .057 * z)
      + .09 * Math.sin(.41 * z + .47 * x);
    tint.copy(moss).lerp(light, waves);
    if (shore(x, z) > 0) tint.lerp(low, Math.min(.53, shore(x, z) / 12));
    if (h < -.31) tint.lerp(bank, Math.min(1, (-.31 - h) * 2));
    colors.push(tint.r, tint.g, tint.b);
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const ground = new T.Mesh(geometry, material({ vertexColors: true, map: groundMap() }));
  ground.receiveShadow = true;
  scene.add(ground);
}

function water(scene) {
  const surface = new T.Mesh(
    new T.PlaneGeometry(1300, 1300).rotateX(-Math.PI / 2),
    new T.ShaderMaterial({
      uniforms: {
        mid: { value: color('#6faaa1') }, deep: { value: color('#4d8f91') },
        light: { value: color('#c3d4ba') }, haze: { value: scene.fog.color },
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
        void main() {
          vec2 p = world.xz;
          float conv = sin(p.x * .043 + p.y * .055) * .5 + .5;
          float wave = sin(p.y * 3.7 + sin(p.x * .58) * .52 + sin(p.x * .14 + p.y * .47));
          float stripes = pow(max(0., wave), 16.) * pow(max(0., sin(p.x * .25 + p.y * .63)), 3.);
          float distanceFog = smoothstep(56., 430., length(world - cameraPosition));
          vec3 tint = mix(deep, mid, conv);
          tint = mix(tint, light, stripes * .32);
          gl_FragColor = vec4(mix(tint, haze, distanceFog * .92), 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  surface.position.y = -1.08;
  scene.add(surface);
}

function batch(scene, geometry, items, shadows) {
  if (items.length === 0) return;
  const instanced = new T.InstancedMesh(geometry, material({ color: '#ffffff' }), items.length);
  const transform = new T.Object3D();
  for (let i = 0; i < items.length; i++) {
    const { at, scale, rotation, tint } = items[i];
    transform.position.set(...at);
    transform.scale.set(...scale);
    transform.rotation.set(0, rotation, 0);
    transform.updateMatrix();
    instanced.setMatrixAt(i, transform.matrix);
    instanced.setColorAt(i, color(tint));
  }
  instanced.castShadow = shadows;
  instanced.receiveShadow = true;
  scene.add(instanced);
}

function vegetation(scene) {
  const leaves = [], pine = [], wood = [], stones = [], grass = [];
  const leafTints = ['#657749', '#708453', '#566e48', '#7e8a49', '#8d9755', '#a0a263'];
  for (let i = 0; i < 1020; i++) {
    const x = (noise(i, 11) - .5) * 147;
    const z = (noise(i, 15) - .5) * 147;
    const y = groundHeight(x, z);
    const rim = shore(x, z);
    if (rim < 2.4 || y < -.74) continue;
    const height = 1.6 + noise(i, 18) * 3.7;
    const rotation = noise(i, 17) * Math.PI * 2;
    if (i % 5 === 1) {
      stones.push({ at: [x, y + .15, z], scale: [height * .32, height * .13, height * .23], rotation, tint: '#989684' });
      continue;
    }
    wood.push({ at: [x, y + height * .3, z], scale: [.13, height * .64, .14], rotation, tint: '#6e6048' });
    const tint = leafTints[i % leafTints.length];
    if (i % 3 === 0) {
      for (let branch = 0; branch < 3; branch++) {
        const size = height * (.29 - branch * .051);
        pine.push({ at: [x, y + height * (.47 + branch * .18), z],
          scale: [size, height * .51, size], rotation: rotation + branch, tint });
      }
    } else {
      for (let b = 0; b < 4; b++) {
        const angle = rotation + b * 2.29;
        const spread = b ? height * .16 : 0;
        const size = height * (b ? .19 : .28);
        leaves.push({ at: [x + Math.cos(angle) * spread, y + height * (b ? .73 : .87), z + Math.sin(angle) * spread],
          scale: [size * 1.4, size, size * 1.12], rotation: angle, tint: leafTints[(i + b) % leafTints.length] });
      }
    }
  }
  const grassTints = ['#93965e', '#aba26b', '#788456'];
  for (let i = 0; i < 1550; i++) {
    const x = (noise(i, 34) - .5) * 141, z = (noise(i, 38) - .5) * 141;
    if (shore(x, z) < 0 || groundHeight(x, z) < -.34) continue;
    const scale = .075 + noise(i, 8) * .17;
    grass.push({ at: [x, groundHeight(x, z) + scale * .2, z], scale: [scale, scale * 1.9, scale],
      rotation: i * .21, tint: grassTints[i % 3] });
  }
  batch(scene, new T.CylinderGeometry(.58, 1, 1, 6), wood, true);
  batch(scene, new T.ConeGeometry(1, 1, 7), pine, true);
  batch(scene, new T.IcosahedronGeometry(1, 1), leaves, true);
  batch(scene, new T.DodecahedronGeometry(1, 0), stones, true);
  batch(scene, new T.ConeGeometry(1, 1, 4), grass, false);
}

function hills(scene) {
  const hillsides = [];
  for (let i = 0; i < 33; i++) {
    const outer = i >= 16;
    const angle = (i % 17) / 17 * Math.PI * 2 + (outer ? .19 : 0);
    const distance = (outer ? 250 : 184) + noise(i, 78) * (outer ? 99 : 28);
    const sx = 22 + noise(i, 51) * (outer ? 46 : 26);
    const sy = (outer ? 23 : 11) + noise(i, 52) * (outer ? 51 : 24);
    const sz = 15 + noise(i, 53) * 26;
    const geometry = new T.SphereGeometry(1, 19, 10, 0, Math.PI * 2, 0, Math.PI * .58);
    const positions = geometry.attributes.position;
    const colors = [];
    const shade = color(outer ? '#83958d' : '#6d846d');
    const bright = color(outer ? '#c1c9a9' : '#96a678');
    for (let j = 0; j < positions.count; j++) {
      const x = positions.getX(j), y = positions.getY(j), z = positions.getZ(j);
      const ridge = 1 + .16 * Math.sin(x * 8 + z * 3 + i) + .08 * Math.sin(x * 19 + z * 12);
      positions.setXYZ(j, x * sx * ridge + sy * Math.max(0, y) * .19,
        (y * ridge + .025 * Math.cos(z * 8)) * sy, z * sz * ridge);
      const tint = shade.clone().lerp(bright, Math.max(0, Math.min(1, y * .62 + noise(j, i) * .15)));
      colors.push(tint.r, tint.g, tint.b);
    }
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const hill = new T.Mesh(geometry, material({ vertexColors: true }));
    hill.position.set(Math.cos(angle) * distance, -4, Math.sin(angle) * distance);
    hill.rotation.y = -angle + mix(-1.25, 1.25, noise(i, 59));
    scene.add(hill);
    hillsides.push(hill);
  }
  return hillsides;
}

export function makeLandscape(scene) {
  water(scene);
  const hillsides = hills(scene);
  terrain(scene);
  vegetation(scene);
  const positions = [];
  for (let m = -HALF; m <= HALF; m += BAY) {
    positions.push(m, -.029, -HALF, m, -.029, HALF, -HALF, -.029, m, HALF, -.029, m);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  const grid = new T.LineSegments(geometry, new T.LineBasicMaterial({ color: '#f7eed8', transparent: true, opacity: .16 }));
  scene.add(grid);
  // The distant scenery stays behind the work area at low orbit angles.
  function faceCamera(pitch, orbit) {
    const x = Math.sin(orbit), z = Math.cos(orbit);
    for (const hill of hillsides) {
      hill.visible = pitch > .96 || hill.position.x * x + hill.position.z * z < 70;
    }
  }
  return { grid, faceCamera };
}
