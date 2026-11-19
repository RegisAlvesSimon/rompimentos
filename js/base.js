// Rompimentos — Atalhos usados em todo o app ($, norm, esc...) e contas de geometria (distância, caminhar na linha).
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const r6 = x => Math.round(x * 1e6) / 1e6;

/* ================= geometria ================= */
const R = 6371008.8, RAD = Math.PI / 180;
function hav(a, b) {
  const dLat = (b[0] - a[0]) * RAD, dLng = (b[1] - a[1]) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
function projectOnSeg(p, a, b) {
  const k = Math.cos(p[0] * RAD);
  const ax = a[1] * k, ay = a[0], dx = b[1] * k - ax, dy = b[0] - ay;
  const L = dx * dx + dy * dy;
  let t = L ? ((p[1] * k - ax) * dx + (p[0] - ay) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  const pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { t, pt, d: hav(p, pt) };
}
function fmtDist(m) {
  if (typeof m !== 'number' || !isFinite(m)) return '—';
  if (m >= 1000) return (m / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km';
  return Math.round(m).toLocaleString('pt-BR') + ' m';
}
function walk(coords, d) {
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const s = hav(coords[i - 1], coords[i]);
    if (acc + s >= d) {
      const t = s ? (d - acc) / s : 0, a = coords[i - 1], b = coords[i];
      return { pt: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], idx: i, over: false };
    }
    acc += s;
  }
  return { pt: coords[coords.length - 1], idx: coords.length - 1, over: d > acc + 0.5 };
}

