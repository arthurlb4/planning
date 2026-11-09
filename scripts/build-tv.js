// Construit la version télé (Samsung Tizen 6, moteur Chromium 76) du lecteur IPTV à partir de iptv/index.html :
// code converti pour ce moteur (esbuild), CSS traduit (inset, gap des lignes flexibles, dvh, min()), mise en page 1920×1080,
// déplacement à la télécommande, vidéo en plein écran.
// Usage : node scripts/build-tv.js iptv/index.html sortie/tv.html   (esbuild requis : npm install --no-save esbuild)
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('Usage : node scripts/build-tv.js iptv/index.html sortie/tv.html'); process.exit(1); }
let html = fs.readFileSync(src, 'utf8');
const TARGET = 'chrome76';

/* ---------- CSS ---------- */
const sides = v => { const p = v.trim().split(/\s+/); const [t, r = t, b = t, l = r] = p; return `top:${t};right:${r};bottom:${b};left:${l}`; };
function mediaRanges(css) {                      // zones des blocs @media (on n'y ajoute pas de marges de remplacement)
  const ranges = []; const re = /@media[^{]*\{/g; let m;
  while ((m = re.exec(css))) { let d = 1, i = re.lastIndex; while (i < css.length && d) { if (css[i] === '{') d++; else if (css[i] === '}') d--; i++; } ranges.push([m.index, i]); }
  return ranges;
}
function convertCss(css) {
  css = css.replace(/inset:\s*([^;}!]+)/g, (_, v) => sides(v));
  css = css.replace(/(\d+)dvh/g, '$1vh');
  css = css.replace(/:focus-visible/g, ':focus');
  // « gap » des lignes flexibles (Chromium 84+) : marges entre enfants, seulement si le moteur ne connaît pas (classe html.nogap)
  const media = mediaRanges(css), extra = [];
  const rule = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = rule.exec(css))) {
    if (media.some(([a, b]) => m.index >= a && m.index < b)) continue;
    const sel = m[1].trim(), body = m[2];
    if (!/display:\s*(inline-)?flex/.test(body) || sel.startsWith('@')) continue;
    const g = body.match(/(?:^|;)\s*gap:\s*([^;]+)/); if (!g) continue;
    const [rowGap, colGap = rowGap] = g[1].trim().split(/\s+/);
    const column = /flex-direction:\s*column/.test(body);
    const sels = sel.split(',').map(s => s.trim()).filter(Boolean);
    extra.push(sels.map(s => `html.nogap ${s}>*+*`).join(',') + `{margin-${column ? 'top' : 'left'}:${column ? rowGap : colGap}}`);
  }
  return css + '\n/* Remplacement de « gap » (moteur ancien) */\n' + extra.join('\n');
}
html = html.replace(/<style>([\s\S]*?)<\/style>/, (_, css) => `<style>${convertCss(css)}\n${TV_CSS()}</style>`);

/* ---------- JavaScript : conversion pour Chromium 76 ---------- */
html = html.replace(/<script>([\s\S]*?)<\/script>(\s*<\/body>)/, (_, js, tail) => {
  const main = esbuild.transformSync(js, { target: TARGET, loader: 'js', charset: 'utf8' }).code;
  const tv = esbuild.transformSync(TV_JS(), { target: TARGET, loader: 'js', charset: 'utf8' }).code;
  return `<script>${main}</script>\n<script>${tv}</script>${tail}`;
});
// Avant tout : mode télé, lecture par le lecteur de la télé d'abord, détection du « gap » flexible
html = html.replace('<head>', `<head>\n<script>document.documentElement.className+=' tv';window.PREFER_NATIVE=true;</script>`);
html = html.replace('<title>Lecteur IPTV</title>', '<title>Lecteur IPTV · TV</title>');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('OK   ' + out + ' (' + Math.round(html.length / 1024) + ' Ko)');

/* ---------- Mise en page télé (1920×1080, vue à 3 m) ---------- */
function TV_CSS() { return `
/* ===== Version télé ===== */
html.tv body{zoom:1.3}
/* Fluidité (moteur lent) : pas d'ombres, de flous, de dégradés ni d'animations, sauf l'indicateur de chargement */
html.tv *,html.tv *::before,html.tv *::after{transition:none!important;animation:none!important;box-shadow:none!important;text-shadow:none!important}
html.tv .spin{animation:sp .8s linear infinite!important}
html.tv img,html.tv .sq,html.tv .sq img,html.tv .poster .im{filter:none!important}
html.tv .sq,html.tv .poster .im,html.tv .tile .face{background:#2b2a28!important}
html.tv body.solo #now{background:rgba(0,0,0,.78)!important}
html.tv .modal{background:rgba(0,0,0,.7)}
html.tv #trackMenu,html.tv #stats{background:#1b1b1a}
html.tv,html.tv body{cursor:none}
html.tv #pipBtn,html.tv #moreBtn,html.tv #pasteBtn,html.tv label.btn,html.tv details,html.tv #demoBtn,html.tv #miniMove,html.tv #miniSize,html.tv #soloBtn,html.tv #soloExit{display:none!important}
html.tv :focus{outline:4px solid #62aadc!important;outline-offset:2px;z-index:2}
html.tv .poster:focus{outline:none!important}
html.tv .poster:focus .im{outline:4px solid #62aadc;outline-offset:3px}
html.tv .sq:focus{background:#3a3936!important}
html.tv .sq:focus .play{opacity:1;transform:none}
html.tv .ch:focus{background:var(--bg3)}
/* Tailles fixes là où le moteur ne connaît pas aspect-ratio ni min() */
html.tv .sq{height:220px}
html.tv .poster .im{height:225px}
html.tv .vgrid{grid-template-columns:repeat(auto-fill,150px)}
html.tv .vd .cv{height:255px}
html.tv body.homeview.mini #player{width:420px}
html.tv body.homeview.mini #screen{height:236px}
html.tv #groups{width:340px;max-width:none}
/* Plein écran : l'image seule, le bandeau (chaîne, programme, boutons) apparaît à la télécommande */
html.tv body.solo #now{top:auto;bottom:0;background:linear-gradient(transparent,rgba(0,0,0,.85));padding:30px 40px}
html.tv body.solo #now .meta .nm{font-size:22px}
html.tv #tvHint{position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:60;background:rgba(0,0,0,.75);padding:10px 18px;border-radius:999px;font-size:15px;display:none}
html.tv body.solo.ui #tvHint{display:block}
`; }

/* ---------- Télécommande : flèches pour aller d'un élément à l'autre, OK, Retour, chaînes +/-, touches de couleur ---------- */
function TV_JS() { return String.raw`
(function () {
  var root = document.documentElement;
  // « gap » des lignes flexibles connu du moteur ?
  var t = document.createElement('div'); t.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute';
  t.appendChild(document.createElement('div')); t.appendChild(document.createElement('div')); document.body.appendChild(t);
  if (t.scrollHeight !== 1) root.classList.add('nogap'); t.remove();

  video.controls = false;
  var hint = document.createElement('div'); hint.id = 'tvHint';
  hint.textContent = '▲▼ chaînes · ◀▶ avancer / reculer · OK menu · Retour accueil'; document.body.appendChild(hint);

  // Touches spéciales de la télécommande Samsung
  var KEYS = ['ChannelUp', 'ChannelDown', 'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaRewind', 'MediaFastForward',
    'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'Info', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  if (window.tizen && tizen.tvinputdevice) KEYS.forEach(function (k) { try { tizen.tvinputdevice.registerKey(k); } catch (e) {} });

  var SEL = 'button:not([disabled]),a[href],input,select,.ch,[tabindex]:not([tabindex="-1"])';
  // Les lignes de la liste des chaînes deviennent sélectionnables
  new MutationObserver(function () { var r = document.querySelectorAll('.ch:not([tabindex])'); for (var i = 0; i < r.length; i++) r[i].tabIndex = 0; })
    .observe(document.getElementById('rows'), { childList: true });

  function scope() {
    var m = document.querySelector('.modal.open'); if (m) return m;
    var tm = document.getElementById('trackMenu'); if (!tm.hidden) return tm;
    if (document.body.classList.contains('solo')) return document.getElementById('now');
    if (document.body.classList.contains('drawer')) return document.getElementById('groups');
    return document;
  }
  // Éléments sélectionnables visibles, avec leur position calculée une seule fois par appui (moteur lent)
  function cands() {
    var s = scope(), l = s.querySelectorAll(SEL), o = [], H = innerHeight * 2.5;
    for (var i = 0; i < l.length; i++) { var r = l[i].getBoundingClientRect(); if (r.width > 0 && r.height > 0 && r.bottom > -H && r.top < H) { l[i]._r = r; o.push(l[i]); } }
    return o;
  }
  function focusEl(el) { if (!el) return; el.focus({ preventScroll: true }); try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { el.scrollIntoView(false); } }
  // Touche maintenue : un déplacement par image au plus (évite l'engorgement du moteur)
  var lastMove = 0;
  function move(dir) {
    var list = cands(), cur = document.activeElement;
    if (!cur || cur === document.body || list.indexOf(cur) < 0) { focusEl(list[0]); return; }
    var a = cur.getBoundingClientRect(), best = null, bs = Infinity;
    list.forEach(function (el) {
      if (el === cur || el.contains(cur) || cur.contains(el)) return;
      var b = el._r, d, o;
      if (dir === 'right') { d = b.left - a.right; o = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom)); if (b.left + 1 < a.right && b.right <= a.right) return; }
      else if (dir === 'left') { d = a.left - b.right; o = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom)); if (b.right - 1 > a.left && b.left >= a.left) return; }
      else if (dir === 'down') { d = b.top - a.bottom; o = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right)); if (b.top + 1 < a.bottom && b.bottom <= a.bottom) return; }
      else { d = a.top - b.bottom; o = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right)); if (b.bottom - 1 > a.top && b.top >= a.top) return; }
      if (d < -8) return;
      var sc = Math.max(0, d) + o * 3;
      if (sc < bs) { bs = sc; best = el; }
    });
    if (best) focusEl(best);
  }

  var uiT;
  function showUi() {
    document.body.classList.add('ui'); clearTimeout(uiT);
    uiT = setTimeout(function () { document.body.classList.remove('ui'); if (document.getElementById('now').contains(document.activeElement)) document.activeElement.blur(); }, 5000);
  }
  // Lecture : toujours en plein écran sur la télé
  var _play = play;
  play = function (c, alts) { var r = _play(c, alts); document.body.classList.add('solo'); showUi(); return r; };
  function toHome() { document.body.classList.remove('solo', 'ui'); setHomeView(true, true); setTimeout(function () { focusEl(cands()[0]); }, 50); }
  var backT = 0;
  function back() {
    var tm = document.getElementById('trackMenu');
    if (!tm.hidden) { tm.hidden = true; focusEl(document.getElementById('trackBtn')); return; }
    if (document.querySelector('.modal.open')) { closeModals(); return; }
    if (document.body.classList.contains('solo')) {
      if (document.body.classList.contains('ui')) { document.body.classList.remove('ui'); if (document.activeElement) document.activeElement.blur(); return; }
      toHome(); return;
    }
    if (document.body.classList.contains('drawer')) { document.body.classList.remove('drawer'); return; }
    var b = document.body.classList;
    if (!b.contains('homeview') || b.contains('agenda') || b.contains('vod')) { toHome(); return; }
    if (Date.now() - backT < 2500) { try { tizen.application.getCurrentApplication().exit(); } catch (e) {} return; }
    backT = Date.now(); toast('Retour encore une fois pour quitter');
  }
  function seek(s) { if (isFinite(video.duration) && video.duration > 0) { video.currentTime = Math.max(0, Math.min(video.duration - 1, video.currentTime + s)); toast((s > 0 ? '+' : '') + s + ' s'); } }
  function playPause() { if (!S.current) return; video.paused ? video.play() : video.pause(); showUi(); }

  window.addEventListener('keydown', function (e) {
    var k = e.keyCode, b = document.body.classList, solo = b.contains('solo'), ui = b.contains('ui');
    var typing = /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '') && document.activeElement.type !== 'button';
    var handled = true;
    if (k === 10009 || k === 27 || (k === 8 && !typing)) back();
    else if (k === 427) { step(1); showUi(); }
    else if (k === 428) { step(-1); showUi(); }
    else if (k === 10252 || k === 415 || k === 19) playPause();
    else if (k === 413) { stopAll(); toHome(); }
    else if (k === 412) seek(-30);
    else if (k === 417) seek(30);
    else if (k === 403) toHome();
    else if (k === 404) { document.body.classList.remove('solo', 'ui'); setHomeView(true, true, 'agenda'); setTimeout(function () { focusEl(cands()[0]); }, 300); }
    else if (k === 405) { document.body.classList.remove('solo', 'ui'); setHomeView(true, true, 'vod'); setTimeout(function () { focusEl(cands()[0]); }, 800); }
    else if (k === 406) { if (S.current) { b.add('solo'); showUi(); document.getElementById('trackBtn').click(); setTimeout(function () { focusEl(cands()[0]); }, 50); } }
    else if (k === 457) { toggleStats(); showUi(); }
    else if (solo && !ui && k >= 37 && k <= 40) {          // plein écran, bandeau caché : chaînes et avance / retour
      if (k === 38) step(1); else if (k === 40) step(-1);
      else if (S.current && S.current.vod) seek(k === 39 ? 10 : -10);
      showUi();
    }
    else if (solo && !ui && k === 13) { showUi(); focusEl(document.getElementById('nowFav')); }
    else if (k >= 37 && k <= 40 && !(typing && (k === 37 || k === 39))) {
      if (solo) showUi();
      var now = Date.now(); if (now - lastMove > 60) { lastMove = now; move({ 37: 'left', 38: 'up', 39: 'right', 40: 'down' }[k]); }
    }
    else if (k === 13 && document.activeElement && document.activeElement !== document.body && document.activeElement.tagName !== 'SELECT' && !typing) {
      if (solo) showUi();                                   // OK : active l'élément sélectionné (bouton, chaîne, affiche…)
      document.activeElement.click();
    }
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // Premier élément sélectionné au démarrage, et après chaque changement de page
  setTimeout(function () { focusEl(cands()[0]); }, 1200);
})();
`; }
