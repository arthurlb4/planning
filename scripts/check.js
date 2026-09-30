// Vérifie la syntaxe JS de l'app, de l'admin et du worker avant déploiement.
// Usage : node scripts/check.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const htmlFiles = ['index.html', '404.html', 'app/index.html', 'admin/index.html', 'paie/index.html'];
const jsFiles = ['app/sw.js'];
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
