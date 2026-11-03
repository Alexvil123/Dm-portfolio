// Run: node integrations/google-sheets/configure.cjs <your /exec deployment URL>
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const url = process.argv[2] || '';
if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) {
  console.error('Provide the Google Apps Script web app URL ending in /exec.');
  process.exit(1);
}
const file = path.join(root, '.audit-config.json');
const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
settings.url = url;
fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
console.log('Google Sheets deployment configured. No server restart is needed.');
