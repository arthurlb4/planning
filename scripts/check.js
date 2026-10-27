// Vérifie la syntaxe JS de l'app, de l'admin et du worker avant déploiement.
// Usage : node scripts/check.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const htmlFiles = ['index.html', '404.html', 'app/index.html', 'app/pc/index.html', 'admin/index.html', 'paie/index.html'];
const jsFiles = ['app/sw.js', 'app/core.js', 'app/ui.js', 'app/pc/pc.js'].filter(f => fs.existsSync(path.join(root, f)));
const moduleFiles = ['worker/index.js'];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-'));
let failed = false;

function check(file, label) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log('OK   ' + label);
  } catch (e) {
    failed = true;
    console.error('FAIL ' + label + '\n' + e.stderr.toString());
  }
}

// Les pages et leurs fichiers partagés (core.js, ui.js, style.css…) doivent arriver ensemble : chaque ?v= suit la version de l'app
for (const pg of ['app/index.html', 'app/pc/index.html']) { const fp = path.join(root, pg); if (!fs.existsSync(fp)) continue;
  const h = fs.readFileSync(fp, 'utf8'), v = (fs.readFileSync(path.join(root, 'app/index.html'), 'utf8').match(/name="app-version" content="v([\d.]+)"/) || [])[1];
  const refs = [...h.matchAll(/(?:src|href)="([^"]+\?v=([\d.]+))"/g)];
  const bad = refs.filter(m => m[2] !== v);
  if (!v || bad.length) { failed = true; console.error('FAIL ' + pg + ' : ' + bad.map(m => m[1]).join(', ') + ' ne suit pas la version v' + v); }
  else console.log('OK   ' + pg + ' : ' + refs.length + ' fichiers partagés en v' + v); }
for (const f of htmlFiles) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  const html = fs.readFileSync(p, 'utf8');
  const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
  let m, i = 0;
  while ((m = re.exec(html))) {
    if (/type=["'](?!text\/javascript|module)/.test(m[1])) continue;
    i++;
    const line = html.slice(0, m.index).split('\n').length;
    const out = path.join(tmp, f.replace(/\W/g, '_') + '_' + i + (/module/.test(m[1]) ? '.mjs' : '.js'));
    // Pad with blank lines so reported line numbers match the HTML file
    fs.writeFileSync(out, '\n'.repeat(line - 1) + m[2]);
    check(out, f + ' (script ligne ' + line + ')');
  }
}
for (const f of jsFiles) if (fs.existsSync(path.join(root, f))) check(path.join(root, f), f);
for (const f of moduleFiles) {
  const out = path.join(tmp, path.basename(f, '.js') + '.mjs');
  fs.copyFileSync(path.join(root, f), out);
  check(out, f);
}

fs.rmSync(tmp, { recursive: true, force: true });
if (failed) { console.error('\nErreurs de syntaxe : déploiement bloqué.'); process.exit(1); }
