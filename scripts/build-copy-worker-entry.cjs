const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'jumia-sync-worker.entry.js');
const destDir = path.join(process.cwd(), '.worker-dist', 'scripts');
const dest = path.join(destDir, 'jumia-sync-worker.entry.js');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[build] Copied ${path.relative(process.cwd(), src)} -> ${path.relative(process.cwd(), dest)}`);
