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
  const mouse = (type, [x, y], button = 'none', buttons = 0) => send('Input.dispatchMouseEvent', {
    type, x, y, button, buttons, clickCount: type === 'mouseMoved' ? 0 : 1,
  });
  async function click(point) {
    await mouse('mouseMoved', point);
    await mouse('mousePressed', point, 'left', 1);
    await mouse('mouseReleased', point, 'left');
    await twoFrames();
  }
  async function drag(from, to, button = 'left') {
    const mask = button === 'right' ? 2 : 1;
    await mouse('mousePressed', from, button, mask);
    await mouse('mouseMoved', to, 'none', mask);
    await mouse('mouseReleased', to, button);
    await twoFrames();
  }
  const button = async selector => click(await evaluate(`(() => {
    const b = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return [b.x + b.width / 2, b.y + b.height / 2];
  })()`));
  const project = ([x, z], y = 0) => evaluate(`game.project(${x}, ${z}, ${y})`);
  const size = () => evaluate('game.inspect().rooms.length');
  const courts = () => evaluate('game.inspect().model.courts.map(c => c.kind)');
  const pose = () => evaluate('game.inspect().camera');
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
  for (const plot of u) await addByClick(plot);
  assert.deepEqual(await courts(), ['open']);
  await pause(450);
  await capture('02-three-sided');
  await addByClick(gate);
  assert.deepEqual(await courts(), ['enclosed']);
  assert.equal(await evaluate('game.inspect().model.courts[0].gateway.length'), 1);
  await button('[data-tool="recolor"]');
  await button('[aria-label="Clay palette"]');
  await click(await project(u[0], 4.57));
  assert.equal(await evaluate('game.inspect().rooms[0].palette'), 2);
  await button('[data-tool="remove"]');
  await click(await project(gate, 4.57));
  assert.deepEqual(await courts(), ['open']);
  await button('#undo');
  assert.deepEqual(await courts(), ['enclosed']);
  await button('[data-tool="add"]');
  await drag([785, 416], [742, 329]);
  await capture('03-four-sided');
  const beforePan = await pose();
  await drag([780, 416], [824, 406], 'right');
  const afterPan = await pose();
  assert.ok(Math.hypot(afterPan.x - beforePan.x, afterPan.z - beforePan.z) > .6,
    JSON.stringify({ beforePan, afterPan }));
  assert.equal(await size(), u.length + 1);

  const map = await evaluate(`(() => {
    const b = document.querySelector('#map').getBoundingClientRect();
    return [b.x + b.width * (40 + 184 * 25.5 / 30) / 264, b.y + b.height * (16 + 184 * 24.5 / 30) / 216];
  })()`);
  await click(map);
  await until('game.inspect().camera.x > 35 && game.inspect().camera.z > 32', 'Minimap focus');
  await addByClick(compound[0]);
  await evaluate(`${JSON.stringify(compound.slice(1))}.forEach(([x, z], i) => game.edit({type:'add', x, z, palette: i < 4 ? 1 : 0}))`);
  assert.deepEqual(await courts(), ['enclosed', 'enclosed']);
  assert.equal(await evaluate('game.inspect().model.compounds.length'), 2);
  await button('#overview');
  await until('game.inspect().camera.span > 139', 'Overview');
  await capture('04-settlement');

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await evaluate('game.focus(18, 18, 32)');
  await until('Math.abs(game.inspect().camera.span - 32) < .3', 'Mobile focus');
  const touch = (type, positions) => send('Input.dispatchTouchEvent', {
    type, touchPoints: positions.map(([x, y], id) => ({ x, y, id })),
  });
  await touch('touchStart', [await project([18, 18])]);
  await touch('touchEnd', []);
  await twoFrames();
  assert.equal(await size(), u.length + 1 + compound.length + 1);
  const touchPose = await pose();
  await touch('touchStart', [[140, 380], [245, 415]]);
  await touch('touchMove', [[92, 373], [270, 413]]);
  await touch('touchEnd', []);
  await until(`game.inspect().camera.span < ${touchPose.span - 3}`, 'Pinch zoom');
  assert.ok(Math.abs((await pose()).x - touchPose.x) > .25, 'Two-finger pan changed the viewpoint');
  assert.equal(await size(), u.length + 1 + compound.length + 1);
  await capture('05-touch');
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('.dock-controls button, .view-tools button')).every(button => {
    const bounds = button.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= 391 && bounds.bottom <= 845;
  })`), 'The mobile construction and view controls fit in the viewport');
  const denseCount = await evaluate(`(() => {
    for (let z = 19; z < 27; z++) {
      for (let x = 3; x < 16; x++) {
        if (x % 5 === 2 && z % 3 === 1) continue;
        game.edit({type:'add', x, z, palette: x % 4});
      }
    }
    game.focus(9, 22, 65);
    return game.inspect().rooms.length;
  })()`);
  assert.ok(denseCount >= 120);
  await until('Math.abs(game.inspect().camera.span - 65) < .3', 'Dense settlement focus');
  await twoFrames();
  const sample = await evaluate('game.inspect().rendering');
  assert.ok(sample.calls > 0 && sample.chunks > 5);
  console.log(`Dense settlement rendered ${denseCount} plots`, sample);
  if (offline) {
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: pathToFileURL(offline).href });
    await until('location.protocol === "file:" && !!document.querySelector("#valley")', 'Offline page');
    await evaluate('import("ew-play/main").then(module => { window.game = module.game; })');
    await twoFrames();
    assert.equal(await size(), 0);
    await click([720, 450]);
    assert.equal(await size(), 1, 'Offline build works through an ordinary click');
    console.log('PASS standalone file preview');
  }
  assert.deepEqual(errors, []);
  console.log('PASS desktop startup, pointer-built U and enclosure, recolor, remove, undo, pan, minimap, overview, touch build and pinch');
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
