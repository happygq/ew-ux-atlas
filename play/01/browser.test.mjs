// Chrome/DevTools startup follows the Hidden Courtyard Recovery smoke test.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compound, gate, u } from './test-fixtures.mjs';
import { AREA, BAY, COUNT, HALF, SIZE, cell, center, xOf, zOf } from './world.mjs';

const chromium = [process.env.EW_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome']
  .find(path => path && existsSync(path));
assert.ok(chromium, 'Set EW_CHROME to a local Chromium, Chrome or Edge executable');
const output = process.argv[2];
const offline = process.argv[3];
if (output) await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'ew-play-01-'));
const server = spawn(process.execPath, ['serve.mjs', '0'], { cwd: new URL('./', import.meta.url), windowsHide: true });
let browser;
let socket;
const timeout = (activity, label, ms = 24000) => {
  let timer;
  const limit = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ' timed out')), ms); });
  return Promise.race([activity, limit]).finally(() => clearTimeout(timer));
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  const [started] = await timeout(once(server.stdout, 'data'), 'Local server');
  const url = started.toString().trim();
  assert.equal((await fetch(url)).status, 200);
  browser = spawn(chromium, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=0',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--window-size=1440,900',
    `--user-data-dir=${profile}`, 'about:blank',
  ], { windowsHide: true });
  const debug = await timeout(new Promise((resolve, reject) => {
    let log = '';
    browser.once('error', reject);
    browser.once('exit', code => reject(new Error('Chrome exited ' + code + '\n' + log)));
    browser.stderr.on('data', chunk => {
      log += chunk;
      const match = log.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);
      if (match) resolve('http://127.0.0.1:' + match[1]);
    });
  }), 'Chrome DevTools');
  const [tab] = await fetch(debug + '/json/list').then(response => response.json());
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await timeout(once(socket, 'open'), 'Browser connection');
  const pending = new Map();
  const errors = [];
  let serial = 0;
  socket.addEventListener('message', ({ data }) => {
    const reply = JSON.parse(data);
    if (reply.id) pending.get(reply.id)?.(reply);
    if (reply.method === 'Runtime.exceptionThrown' || reply.method === 'Log.entryAdded'
      && reply.params.entry.level === 'error') errors.push(reply.params);
    if (reply.method === 'Runtime.consoleAPICalled' && reply.params.type === 'error') errors.push(reply.params.args);
  });
  function send(method, params = {}) {
    const id = ++serial;
    return timeout(new Promise((resolve, reject) => {
      pending.set(id, reply => reply.error ? reject(new Error(JSON.stringify(reply.error))) : resolve(reply.result));
      socket.send(JSON.stringify({ id, method, params }));
    }), method).finally(() => pending.delete(id));
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function until(expression, label) {
    for (let attempt = 0; attempt < 40; attempt++) {
      if (await evaluate(expression)) return;
      await pause(125);
    }
    throw new Error(label + ' did not reach the expected state');
  }
  const twoFrames = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  async function capture(name) {
    if (!output) return;
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(output, name + '.png'), Buffer.from(data, 'base64'));
  }
  async function captureScene(name) {
    const layers = '.masthead, .dock, .atlas, .view-tools';
    const showLayers = visible => evaluate(`document.querySelectorAll("${layers}").forEach(layer => { layer.hidden = ${!visible}; });`);
    await showLayers(false);
    try {
      await evaluate('document.querySelector("#valley").dispatchEvent(new PointerEvent("pointerleave"))');
      await twoFrames();
      await capture(name);
    } finally {
      await showLayers(true);
    }
  }
  const mouse = (type, [x, y], button = 'none', buttons = 0) => send('Input.dispatchMouseEvent', {
    type, x, y, button, buttons, clickCount: type === 'mouseMoved' ? 0 : 1,
  });
  async function click(point, button = 'left') {
    await mouse('mouseMoved', point);
    await mouse('mousePressed', point, button, button === 'right' ? 2 : 1);
    await mouse('mouseReleased', point, button);
    await twoFrames();
  }
  async function drag(from, to, button = 'left') {
    const mask = button === 'right' ? 2 : 1;
    await mouse('mousePressed', from, button, mask);
    await mouse('mouseMoved', to, 'none', mask);
    await mouse('mouseReleased', to, button);
    await twoFrames();
  }
  const buttonPoint = selector => evaluate(`(() => {
    const b = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return [b.x + b.width / 2, b.y + b.height / 2];
  })()`);
  const button = async selector => click(await buttonPoint(selector));
  const project = ([x, z], y = 0) => evaluate(`game.project(${x}, ${z}, ${y})`);
  const size = () => evaluate('game.inspect().rooms.length');
  const courts = () => evaluate('game.inspect().model.courts.map(c => c.kind)');
  const pose = () => evaluate('game.inspect().camera');
  const holdVisible = () => evaluate('!document.querySelector("#hold-meter").hidden');
  async function frameArchitecture([x, z], span, orbit, pitch) {
    const [focusX, focusZ] = center(cell(x, z));
    await evaluate(`game.focus(${x}, ${z}, ${span})`);
    await until(`(() => {
      const camera = game.inspect().camera;
      return Math.hypot(camera.x - ${focusX}, camera.z - ${focusZ}) < .2 && Math.abs(camera.span - ${span}) < .2;
    })()`, 'Architecture focus');
    const current = await pose();
    const turn = Math.atan2(Math.sin(current.orbit - orbit), Math.cos(current.orbit - orbit));
    const dx = Math.round(turn / .008), dy = Math.round((pitch - current.pitch) / .007);
    await drag([710, 390], [710 + dx, 390 + dy]);
    await until(`(() => {
      const camera = game.inspect().camera;
      return Math.abs(Math.sin((camera.orbit - ${orbit}) / 2)) < .016 && Math.abs(camera.pitch - ${pitch}) < .026;
    })()`, 'Architecture camera');
  }
  async function addByClick(coords) {
    const previous = await size();
    await click(await project(coords));
    assert.equal(await size(), previous + 1, `Add via a scene click at ${coords}`);
  }

  for (const method of ['Page.enable', 'Runtime.enable', 'Log.enable']) await send(method);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await until('!!document.querySelector("#valley")', 'Page');
  await evaluate('import("./main.mjs").then(module => { window.game = module.game; })');
  await twoFrames();
  assert.equal(await size(), 0);
  assert.equal(await evaluate('document.querySelector("#error").hidden'), true);
  assert.equal((await pose()).perspective, true);
  assert.ok(AREA > 20_000, 'The playable area exceeds 20,000 m²');
  assert.equal(await evaluate('document.querySelector("#map-size").textContent'), `${SIZE * BAY} × ${SIZE * BAY} m`);
  await capture('01-start');

  await evaluate('game.focus(10, 10, 27)');
  await pause(450);
  const start = await pose();
  await drag([811, 386], [810, 514]);
  const overhead = await pose();
  assert.ok(overhead.pitch > start.pitch + .3, JSON.stringify({ start, overhead }));
  assert.equal(await size(), 0);
  await mouse('mouseMoved', await project(u[0]));
  await twoFrames();
  assert.equal(await evaluate('document.querySelector("#valley").dataset.target'), 'ground');
  const effects = await evaluate(`(() => {
    game.edit({type:'add', x:14, z:14});
    const afterFirst = game.inspect().rendering.neighboringPulses;
    game.edit({type:'add', x:15, z:14});
    const afterJoin = game.inspect().rendering.neighboringPulses;
    game.edit({type:'remove', x:14, z:14});
    const afterDetach = game.inspect().rendering.neighboringPulses;
    for (let i = 0; i < 3; i++) game.edit({type:'undo'});
    return [afterFirst, afterJoin, afterDetach];
  })()`);
  assert.deepEqual(effects, [0, 1, 2], 'Existing neighboring roofs pulse after joining and detaching');
  for (const plot of u) await addByClick(plot);
  assert.deepEqual(await courts(), ['open']);
  await pause(450);
  await capture('02-three-sided');
  await addByClick(gate);
  assert.deepEqual(await courts(), ['enclosed']);
  assert.equal(await evaluate('game.inspect().model.courts[0].gateway.length'), 1);
  if (output) {
    await drag([710, 410], [710, 318]);
    await until('game.inspect().camera.pitch < 1', 'Angled façade view');
    await pause(500);
    await captureScene('09-compact-court-desktop');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await twoFrames();
    await captureScene('10-compact-court-mobile');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await twoFrames();
    await drag([710, 318], [710, 410]);
    await until('game.inspect().camera.pitch > 1.48', 'Restored plan camera');
  }
  const gatePoint = await project(gate, 4.57);
  await click(gatePoint);
  assert.equal(await size(), u.length + 1, 'A left click on a roof does not remove it');
  await click(await project([10, 10]), 'right');
  assert.equal(await size(), u.length + 1, 'A right click on the open skywell does not build or remove');
  await click(gatePoint, 'right');
  assert.deepEqual(await courts(), ['open']);
  assert.equal(await size(), u.length, 'One right click removes one building');
  assert.equal(await holdVisible(), false);
  await button('#undo');
  assert.deepEqual(await courts(), ['enclosed']);
  await button('[aria-label="Clay palette"]');
  assert.equal(await evaluate('game.inspect().rooms[0].palette'), 0, 'Palette selection leaves existing bays unchanged');
  await addByClick([12, 9]);
  assert.equal(await evaluate('game.inspect().model.compounds.length'), 2, 'An adjacent bay in a new color forms its own household');
  assert.equal(await evaluate(`game.inspect().rooms.find(room => room.id === ${cell(12, 9)}).palette`), 2);
  await capture('03a-color-seam');
  await button('#undo');
  await drag([785, 416], [742, 329]);
  await capture('03-four-sided');
  const beforePan = await pose();
  await drag([780, 416], [824, 406], 'right');
  const afterPan = await pose();
  assert.ok(Math.hypot(afterPan.x - beforePan.x, afterPan.z - beforePan.z) > .6,
    JSON.stringify({ beforePan, afterPan }));
  assert.equal(await size(), u.length + 1);

  await button('#eye-level');
  await until('Math.abs(game.inspect().camera.pitch) < .006 && Math.abs(game.inspect().camera.eyeY - 1.65) < .01', 'Eye-level camera');
  const horizon = await pose();
  await capture('07-eye-level');
  await click([720, 125]);
  assert.equal(await size(), u.length + 1, 'Clicking above the horizon does not place a bay');
  await drag([720, 445], [720, 165]);
  await until('Math.abs(game.inspect().camera.pitch + 70 * Math.PI / 180) < .006', '70° upward camera limit');
  const up = await pose();
  assert.ok(Math.hypot(up.eyeX - horizon.eyeX, up.eyeY - horizon.eyeY, up.eyeZ - horizon.eyeZ) < .06,
    'Tilting from horizon to sky keeps the camera at human height and position');
  await capture('08-upward');
  await button('#overview');
  await until(`game.inspect().camera.span > ${HALF * 2.25}`, 'Wide camera');

  assert.equal(cell(0, 0), -1, 'The square bounding box corner lies beyond the natural buildable boundary');
  await evaluate('game.focus(0, 0, 28)');
  await until('Math.abs(game.inspect().camera.span - 28) < .2', 'Boundary focus');
  await click(await project([0, 0]));
  assert.equal(await size(), u.length + 1, 'Clicking outside the natural buildable area cannot place a bay');

  const extended = Array.from({ length: COUNT }, (_, id) => [xOf(id), zOf(id)]).find(([x, z]) => {
    const id = cell(x, z);
    return id >= 0 && center(id).some(axis => Math.abs(axis) > 65);
  });
  assert.ok(extended, 'The revised valley has buildable plots beyond the previous footprint');
  await evaluate(`game.focus(${extended[0]}, ${extended[1]}, 32)`);
  await until('Math.abs(game.inspect().camera.span - 32) < .2', 'Expanded land focus');
  await addByClick(extended);
  await button('#undo');

  const mapX = compound.reduce((sum, plot) => sum + plot[0], 0) / compound.length;
  const mapZ = compound.reduce((sum, plot) => sum + plot[1], 0) / compound.length;
  const expectedX = (mapX + .5) * BAY - HALF, expectedZ = (mapZ + .5) * BAY - HALF;
  const map = await evaluate(`(() => {
    const b = document.querySelector('#map').getBoundingClientRect();
    return [b.x + b.width * (40 + 184 * ${mapX + .5} / ${SIZE}) / 264,
      b.y + b.height * (16 + 184 * ${mapZ + .5} / ${SIZE}) / 216];
  })()`);
  await click(map);
  await until(`Math.hypot(game.inspect().camera.x - ${expectedX}, game.inspect().camera.z - ${expectedZ}) < 1`, 'Minimap focus');
  await addByClick(compound[0]);
  await evaluate(`${JSON.stringify(compound.slice(1))}.forEach(([x, z]) => game.edit({type:'add', x, z, palette: 2}))`);
  assert.deepEqual(await courts(), ['enclosed', 'enclosed']);
  assert.equal(await evaluate('game.inspect().model.compounds.length'), 2);
  if (output) {
    await drag([710, 410], [710, 325]);
    await until('game.inspect().camera.pitch < 1', 'Angled wide courtyard');
    await pause(500);
    await captureScene('11-wide-court-desktop');
    await frameArchitecture([20, 21], 24, .28, -.035);
    await captureScene('15-street-gate-and-gables');
    await frameArchitecture([20, 19], 15, .10, .60);
    await captureScene('16-courtyard-timber');
  }
  await button('#overview');
  await until(`game.inspect().camera.span > ${HALF * 2.25}`, 'Overview');
  await capture('04-settlement');

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await evaluate('game.focus(15, 13, 32)');
  await until('Math.abs(game.inspect().camera.span - 32) < .3', 'Mobile focus');
  const touch = (type, positions, timestamp) => send('Input.dispatchTouchEvent', {
    type, touchPoints: positions.map(([x, y], id) => ({ x, y, id })), timestamp,
  });
  async function tap(at) {
    // A slow software-rendered frame should not turn a synthetic tap into a hold.
    const pressedAt = Date.now() / 1000;
    await touch('touchStart', [at], pressedAt);
    await touch('touchEnd', [], pressedAt + .06);
    await twoFrames();
  }
  const settledBayCount = u.length + 1 + compound.length;
  const newBay = [15, 13];
  const touchPoint = await project(newBay);
  await tap(touchPoint);
  assert.equal(await size(), settledBayCount + 1, JSON.stringify({
    touchPoint,
    notice: await evaluate('document.querySelector("#notice").textContent'),
    viewport: await evaluate('[innerWidth, innerHeight, devicePixelRatio]'),
  }));
  await pause(300);
  const roof = () => project(newBay, 4.57);
  await tap(await roof());
  assert.equal(await size(), settledBayCount + 1, 'A short touch on a roof preserves the bay');
  const [roofX, roofY] = await roof();
  await touch('touchStart', [[roofX, roofY]]);
  await pause(650);
  assert.equal(await holdVisible(), true);
  await touch('touchMove', [[roofX + 22, roofY + 19]]);
  await twoFrames();
  assert.equal(await holdVisible(), false, 'Dragging cancels a pending hold');
  await touch('touchEnd', []);
  await twoFrames();
  assert.equal(await size(), settledBayCount + 1);
  await touch('touchStart', [await roof()]);
  await pause(650);
  await touch('touchEnd', []);
  await twoFrames();
  assert.equal(await size(), settledBayCount, 'Holding and releasing on a roof removes one bay');
  await tap(await buttonPoint('#undo'));
  assert.equal(await size(), settledBayCount + 1);
  const touchPose = await pose();
  const [pinchX, pinchY] = await roof();
  await touch('touchStart', [[pinchX, pinchY]]);
  assert.equal(await holdVisible(), true);
  await touch('touchStart', [[pinchX, pinchY], [pinchX + 100, pinchY + 32]]);
  await twoFrames();
  assert.equal(await holdVisible(), false, 'Adding a second finger cancels a pending hold');
  await touch('touchMove', [[pinchX - 50, pinchY - 7], [pinchX + 125, pinchY + 30]]);
  await touch('touchEnd', []);
  await until(`game.inspect().camera.span < ${touchPose.span - 3}`, 'Pinch zoom');
  assert.ok(Math.abs((await pose()).x - touchPose.x) > .25, 'Two-finger pan changed the viewpoint');
  assert.equal(await size(), settledBayCount + 1);
  await capture('05-touch');
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('.dock-controls button, .view-tools button, .masthead button')).every(button => {
    const bounds = button.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= 383 && bounds.bottom <= 845;
  })`), 'The mobile construction and view controls fit in the viewport');
  await evaluate(`(() => {
    for (let z = 8; z <= 12; z++) {
      for (let x = 20; x <= 22; x++) {
        if (x !== 21 || z !== 9 && z !== 11) game.edit({type:'add', x, z, palette: 1});
      }
    }
    game.focus(21, 10, 37);
  })()`);
  await until('Math.abs(game.inspect().camera.span - 37) < .3', 'Multi-entry focus');
  assert.equal(await evaluate('game.inspect().model.courts.filter(c => c.fromCourt !== undefined).length'), 1);
  await capture('06-two-entry-home');
  const denseCount = await evaluate(`(() => {
    for (let z = 18; z < 27; z++) {
      for (let x = 6; x < 18; x++) {
        if (x % 5 === 2 && z % 3 === 1) continue;
        game.edit({type:'add', x, z, palette: x % 4});
      }
    }
    game.focus(11, 23, 65);
    return game.inspect().rooms.length;
  })()`);
  assert.ok(denseCount >= 120);
  await until('Math.abs(game.inspect().camera.span - 65) < .3', 'Dense settlement focus');
  await twoFrames();
  const sample = await evaluate('game.inspect().rendering');
  assert.ok(sample.calls > 0 && sample.chunks > 5);
  console.log(`Dense settlement rendered ${denseCount} plots`, sample);
  if (output) {
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: url + '?view=village' });
    await until('location.search === "?view=village" && !!document.querySelector("#valley")', 'Village view');
    await evaluate('import("./main.mjs").then(module => { window.game = module.game; })');
    await evaluate('game.edit({ type: "add", x: 11, z: 9 })');
    await frameArchitecture([11, 9], 11.5, .58, .39);
    await captureScene('14-single-bay');
    await evaluate('game.edit({ type: "undo" })');
    await frameArchitecture([10, 10], 56, .61, .74);
    const ring = JSON.stringify([...u, gate]);
    await evaluate(`(() => {
      const origins = [[6, 7], [11, 7], [6, 12], [11, 12]];
      origins.forEach(([ox, oz], palette) => ${ring}.forEach(([x, z]) => {
        game.edit({ type: 'add', x: ox + x - 9, z: oz + z - 9, palette });
      }));
    })()`);
    await until('Math.abs(game.inspect().camera.span - 56) < .3', 'Village focus');
    assert.equal(await evaluate('game.inspect().model.compounds.length'), 4);
    assert.ok(await evaluate('game.inspect().model.plots.some(plot => plot?.road && !plot.forecourt)'));
    await captureScene('12-four-households');
    await button('#overview');
    await until('game.inspect().camera.span > 202', 'Village overview');
    await captureScene('13-four-households-overview');
  }
  if (offline) {
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: pathToFileURL(offline).href });
    await until('location.protocol === "file:" && !!document.querySelector("#valley")', 'Offline page');
    await evaluate('import("ew-play/main").then(module => { window.game = module.game; })');
    await twoFrames();
    assert.equal(await size(), 0);
    assert.equal(await evaluate('document.querySelector("#error").hidden'), true);
    await evaluate('game.focus(10, 10, 34)');
    await until('Math.abs(game.inspect().camera.span - 34) < .3', 'Offline view');
    await addByClick([10, 10]);
    console.log('PASS standalone file preview');
  }
  assert.deepEqual(errors, []);
  console.log('PASS desktop left-click, right-click, right-drag, perspective eye level and 70° upward tilt, expanded terrain mask, courtyard replay, touch tap and hold, cancellation, pinch and undo');
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) {
    browser.kill();
    await timeout(once(browser, 'close'), 'Chrome shutdown', 5000).catch(() => {});
  }
  server.kill();
  const [temp, ownedProfile] = await Promise.all([realpath(tmpdir()), realpath(profile)]);
  if (/^ew-play-01-[a-zA-Z0-9]+$/.test(relative(temp, ownedProfile))) {
    await rm(ownedProfile, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 }).catch(error => {
      if (error.code !== 'EBUSY' && error.code !== 'EPERM') throw error;
    });
  }
}
