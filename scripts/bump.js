// Passe l'app à la version suivante (ou à celle donnée) : balise app-version et adresses ?v= des deux pages.
// Usage : node scripts/bump.js            → +0.01
//         node scripts/bump.js 8.10       → 8.10
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), pages = ['app/index.html', 'app/pc/index.html'];
const cur = fs.readFileSync(path.join(root, pages[0]), 'utf8').match(/name="app-version" content="v([\d.]+)"/)[1];
const next = process.argv[2] || (Math.round(parseFloat(cur) * 100 + 1) / 100).toFixed(2);
for (const p of pages) {
  const f = path.join(root, p);
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, 'utf8').replace(/name="app-version" content="v[\d.]+"/, 'name="app-version" content="v' + next + '"').replace(/\?v=[\d.]+"/g, '?v=' + next + '"');
  fs.writeFileSync(f, s);
}
console.log('v' + cur + ' → v' + next);
