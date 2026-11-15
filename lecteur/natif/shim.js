// Pont entre la page et l'appli native : même window.desktop que l'appli Electron (voir lecteur/desktop/preload.js),
// par messages WebView2 ; les réponses immédiates attendues par la page (VPN, fenêtre agrandie) viennent d'un état tenu ici.
(() => {
  const W = window.chrome && window.chrome.webview; if (!W || window.desktop) return;
  const cfg = __CFG__;
  const L = { mpv: [], win: [], upd: [], yt: [] }, reqs = new Map();
  let rid = 0, max = false, vpn = { on: true, name: '', all: [], pat: '' };
  const send = (t, d) => W.postMessage(JSON.stringify(Object.assign({ t }, d || {})));
  const call = (t, d) => new Promise(r => { const id = ++rid; reqs.set(id, r); send(t, Object.assign({ id }, d || {})); });
  W.addEventListener('message', e => {
    const m = e.data; if (!m || typeof m !== 'object') return;
    if (m.t === 'res') { const r = reqs.get(m.id); if (r) { reqs.delete(m.id); r(m.v); } }
    else if (m.t === 'mpv') L.mpv.forEach(f => { try { f(m.st); } catch (er) {} });
    else if (m.t === 'win') { max = !!(m.st && m.st.max); L.win.forEach(f => { try { f(m.st); } catch (er) {} }); }
    else if (m.t === 'vpn') vpn = m.v || vpn;
  });
  window.desktop = {
    remux: cfg.remux, version: cfg.version, natif: true, native: !!cfg.mpv,
    updState: () => ({ state: 'latest' }), onUpdate: f => L.upd.push(f), checkUpdate: () => {},
    openVlc: (url, name) => call('vlc', { url, name }),
    ytLogin: () => send('yt'), onYtLogin: f => L.yt.push(f),
    vpn: pat => { pat = pat || ''; if (pat !== vpn.pat) { vpn = Object.assign({}, vpn, { pat }); send('vpn', { pat }); } return vpn; },
    mpv: cfg.mpv ? { play: o => call('mpvPlay', { o }), stop: () => send('mpvStop'), rect: r => send('mpvRect', { r }), cmd: a => send('mpvCmd', { a }), on: f => L.mpv.push(f) } : null,
    win: { act: a => send('win', { a }), isMax: () => max, onState: f => L.win.push(f) }
  };
  send('vpn', { pat: '' }); setInterval(() => send('vpn', { pat: vpn.pat || '' }), 3000);
})();
