import { readFile, writeFile } from 'node:fs/promises';

const output = process.argv[2];
if (!output) {
  console.error('Usage: node play/01/pack-preview.mjs <preview.html>');
  process.exit(1);
}

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const vendor = '../../g1-m2/r2-vertical-v03-visual/vendor/';
const sourceNames = ['world', 'spatial', 'structures', 'architecture', 'landscape', 'view', 'main'];
const vendorImport = vendor + 'three.module.min.js';
const encode = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const imports = { 'ew-play/three': encode(await read(vendorImport)) };
for (const name of sourceNames) {
  const source = (await read('./' + name + '.mjs'))
    .replaceAll(vendorImport, 'ew-play/three')
    .replace(/(from ['"])\.\/([a-z]+)\.mjs(['"])/g, '$1ew-play/$2$3');
  imports['ew-play/' + name] = encode(source);
}
const [page, stylesheet, license] = await Promise.all([read('./index.html'), read('./style.css'), read(vendor + 'THREE-LICENSE.txt')]);
const preview = page
  .replace('<link rel="stylesheet" href="./style.css">', '<style>\n' + stylesheet + '\n</style>')
  .replace('<script type="module" src="./main.mjs"></script>', `<!--\n${license}\n-->
  <script type="importmap">${JSON.stringify({ imports })}</script>
  <script type="module">import 'ew-play/main';</script>`);
await writeFile(output, preview);
console.log(output);
