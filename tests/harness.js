// Charge le script de l'app dans un contexte Node isolé (sans navigateur), avec une date fixe,
// pour tester les calculs d'heures. Usage : const app = load('2026-10-01');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function fakeEl() {
  const store = {};
  const el = new Proxy(function () {}, {
    get(t, k) {
      if (k in store) return store[k];
      if (k === 'style') return (store.style = new Proxy({}, { get: () => '', set: () => true }));
      if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      if (k === 'getBoundingClientRect') return () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 });
      if (k === 'querySelectorAll' || k === 'getElementsByTagName' || k === 'getElementsByClassName') return () => [];
      if (k === 'querySelector' || k === 'closest') return () => null;
      if (k === 'children' || k === 'childNodes') return [];
      if (k === Symbol.toPrimitive) return () => '';
      if (typeof k === 'string' && /^(offset|client|scroll)(Width|Height|Top|Left)$/.test(k)) return 0;
      if (k === 'textContent' || k === 'innerHTML' || k === 'value' || k === 'innerText') return '';
      return () => fakeEl();
    },
    set(t, k, v) { store[k] = v; return true; },
    apply() { return fakeEl(); },
  });
  return el;
}

function load(today) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  // Le script principal de l'app : le plus long des scripts en ligne (les petits scripts de démarrage sont ignorés)
  const code = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).sort((a, b) => b.length - a.length)[0];
  const FIXED = new Date(today + 'T12:00:00').getTime();
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(FIXED); else super(...a); }
    static now() { return FIXED; }
  }
  const mem = {};
  const ctx = {
    console, Math, JSON, Promise, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, Date: FixedDate, Intl, Set, Map, Array, Object, Number, String, Boolean, RegExp, Symbol, Proxy, Error, TypeError,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64'),
    localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: () => new Promise(() => {}), navigator: { onLine: true, userAgent: 'node', serviceWorker: { register: () => Promise.resolve() } },
    location: { href: 'http://localhost/planning/app/', search: '', hash: '', replace() {}, reload() {} },
    innerWidth: 1400, innerHeight: 900, devicePixelRatio: 1, matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    addEventListener() {}, removeEventListener() {}, getComputedStyle: () => new Proxy({}, { get: () => '' }),
    ResizeObserver: class { observe() {} disconnect() {} }, MutationObserver: class { observe() {} disconnect() {} },
    TextDecoder, TextEncoder, Uint8Array, DataView, ArrayBuffer, Blob: class {}, File: class {},
  };
  ctx.document = new Proxy({}, {
    get(t, k) {
      if (k === 'getElementById' || k === 'querySelector' || k === 'createElement' || k === 'createElementNS') return () => fakeEl();
      if (k === 'querySelectorAll' || k === 'getElementsByClassName' || k === 'getElementsByTagName') return () => [];
      if (k === 'documentElement' || k === 'body' || k === 'head') return fakeEl();
      if (k === 'addEventListener' || k === 'removeEventListener') return () => {};
      if (k === 'fonts') return { ready: Promise.resolve() };
      return undefined;
    },
  });
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'app/index.html' });
  // Évalue une expression dans la portée de l'app (accès à S, aux fonctions et aux constantes)
  ctx.run = src => vm.runInContext(src, ctx);
  // Profil de test : les cas ont été écrits pour la ligne 8 avec un matelas de 162h27 (l'app part d'un profil vide)
  ctx.run('S.profile.anchorLine=8;S.profile.matelas=162*60+27;');
  return ctx;
}

module.exports = { load };
