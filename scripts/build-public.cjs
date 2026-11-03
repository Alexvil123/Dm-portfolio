const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
// The only generated directory is the project's fixed dist directory.
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Unexpected output directory');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const relative of ['index.html', 'css', 'js', 'assets/images', 'assets/work', 'assets/video']) {
  fs.cpSync(path.join(root, relative), path.join(output, relative), { recursive: true });
}
const sources = ['index.html', 'css/style.css', 'js/main.js'];
const missing = new Set();
for (const source of sources) {
  const text = fs.readFileSync(path.join(root, source), 'utf8');
  for (const match of text.matchAll(/assets\/[a-zA-Z0-9_./-]+\.(?:png|jpg|jpeg|gif|webp|svg|mp4|webm)/g)) {
    if (!fs.existsSync(path.join(output, match[0]))) missing.add(match[0]);
  }
}
if (missing.size) throw new Error('Missing public assets: ' + [...missing].join(', '));
console.log('Built public website with all referenced media. Private configuration and setup files excluded.');
