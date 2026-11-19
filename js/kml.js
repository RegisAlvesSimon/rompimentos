// Rompimentos — Leitura do KMZ/KML do Google Earth: linhas, pontos, pastas, estilos e referências.
'use strict';

/* ================= KML ================= */
const kids = (el, tag) => { const out = []; for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === tag) out.push(c); return out; };
const childText = (el, tag) => { for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === tag) return c.textContent.trim(); return ''; };
function parseCoords(txt) {
  return String(txt).trim().split(/\s+/).map(s => s.split(',')).filter(a => a.length >= 2)
    .map(a => [parseFloat(a[1]), parseFloat(a[0])]).filter(p => isFinite(p[0]) && isFinite(p[1]) && Math.abs(p[0]) <= 90);
}
function kmlColor(abgr) {
  abgr = String(abgr || '').trim();
  if (!/^[0-9a-f]{8}$/i.test(abgr)) return null;
  return '#' + abgr.slice(6, 8) + abgr.slice(4, 6) + abgr.slice(2, 4);
}
function readStyle(st) {
  const out = {};
  const ls = kids(st, 'LineStyle')[0];
  if (ls) { out.color = kmlColor(childText(ls, 'color')); const w = parseFloat(childText(ls, 'width')); if (isFinite(w)) out.width = w; }
  const ps = kids(st, 'PolyStyle')[0];
  if (ps) out.fill = kmlColor(childText(ps, 'color'));
  return out;
}
let folderCache = new Map();
function folderName(p) {
  let n = folderCache.get(p);
  if (n === undefined) {
    n = '';
    for (let c = p.firstElementChild; c; c = c.nextElementSibling) if (c.localName === 'name') { n = c.textContent.trim(); break; }
    folderCache.set(p, n);
  }
  return n;
}
function folderInfo(pm) {
  const path = []; let area = '', first = '';
  for (let p = pm.parentElement; p; p = p.parentElement) {
    if (p.localName === 'Folder' || p.localName === 'Document') {
      const n = folderName(p);
      if (n) {
        path.unshift(n);
        if (p.localName === 'Folder') { first = n; if (/\b[áa]rea\b/i.test(n) && !area) area = n; }
      }
    }
  }
  return { path, area: area || first };
}
function parseKml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('O arquivo KML está com defeito e não pôde ser lido.');
  const styles = {};
  for (const st of doc.getElementsByTagNameNS('*', 'Style')) { const id = st.getAttribute('id'); if (id) styles['#' + id] = readStyle(st); }
  for (const cs of doc.getElementsByTagNameNS('*', 'CascadingStyle')) {
    const id = cs.getAttribute('kml:id') || cs.getAttribute('id'); const inner = kids(cs, 'Style')[0];
    if (id && inner) styles['#' + id] = readStyle(inner);
  }
  for (const sm of doc.getElementsByTagNameNS('*', 'StyleMap')) {
    const id = sm.getAttribute('id'); if (!id) continue;
    for (const pair of kids(sm, 'Pair')) if (childText(pair, 'key') === 'normal') {
      const inl = kids(pair, 'Style')[0];
      styles['#' + id] = inl ? readStyle(inl) : { ref: childText(pair, 'styleUrl') };
    }
  }
  const resolve = (url, depth = 0) => {
    if (!url) return null; const key = url.includes('#') ? url.slice(url.indexOf('#')) : url;
    const s = styles[key]; if (!s) return null; return s.ref && depth < 4 ? resolve(s.ref, depth + 1) : s;
  };
  const docName = (() => { const d = doc.getElementsByTagNameNS('*', 'Document')[0]; return d ? childText(d, 'name') : ''; })();
  const lines = [], points = [], polys = [], appBreaks = [];
  for (const pm of doc.getElementsByTagNameNS('*', 'Placemark')) {
    if (pm.closest('[id="rompimentos-app"]')) {
      let json = '';
      for (const d of pm.getElementsByTagNameNS('*', 'Data')) if (d.getAttribute('name') === 'romp_json') json = childText(d, 'value');
      if (json) { try { const b = cleanBreak(JSON.parse(json)); if (b) appBreaks.push(b); } catch (e) { /* ignora */ } }
      continue;
    }
    const name = childText(pm, 'name');
    const { path, area } = folderInfo(pm);
    const inl = kids(pm, 'Style')[0];
    const style = inl ? readStyle(inl) : resolve(childText(pm, 'styleUrl'));
    for (const ls of pm.getElementsByTagNameNS('*', 'LineString')) {
      const c = ls.getElementsByTagNameNS('*', 'coordinates')[0];
      const coords = c ? parseCoords(c.textContent) : [];
      if (coords.length >= 2) lines.push({ name, path, area, coords, style });
    }
    for (const pt of pm.getElementsByTagNameNS('*', 'Point')) {
      const c = pt.getElementsByTagNameNS('*', 'coordinates')[0];
      const coords = c ? parseCoords(c.textContent) : [];
      if (coords.length) points.push({ name, path, area, coord: coords[0], desc: textoDesc(childText(pm, 'description')) });
    }
    for (const pg of pm.getElementsByTagNameNS('*', 'Polygon')) {
      const c = pg.getElementsByTagNameNS('*', 'coordinates')[0];
      const coords = c ? parseCoords(c.textContent) : [];
      if (coords.length >= 3) polys.push({ name, coords, style });
    }
  }
  return { docName, lines, points, polys, appBreaks };
}
// Descrição do KMZ (HTML) em texto simples
function textoDesc(html) {
  if (!html) return '';
  const t = String(html).replace(/<br\s*\/?>|<\/(div|p|li|tr)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return t.split('\n').map(s => s.trim()).filter(Boolean).join('\n').slice(0, 800);
}
// Pontos de referência: têm “referência” no nome ou uma medida no nome (ex.: “22KM ILHS”, “2270KM DE BTU”, “km 138+308”).
// Pontos que são registros de rompimento (RAL, ROMP, RUP) ficam de fora — esses já estão na lista de rompimentos.
const RE_MEDIDA = /\d+(?:[.,]\d+)?\s*(?:km|m)\b|\bkm\s*\d/i;
function isReferencia(p) {
  const n = p.name || '';
  if (/\bral\b|ral\s*[-:]?\s*\d|romp|\brup\b/i.test(n)) return false;
  if (/ral\s*[-:]?\s*\d{4,}|rompiment/i.test(p.desc || '')) return false;
  return /refer[eê]ncia/i.test(n) || RE_MEDIDA.test(n);
}
function stripAppFolder(text) {
  if (!text.includes('rompimentos-app')) return text;
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const els = Array.from(doc.querySelectorAll('[id="rompimentos-app"]'));
  if (!els.length) return text;
  els.forEach(e => e.remove());
  let out = new XMLSerializer().serializeToString(doc);
  if (!/^<\?xml/.test(out)) out = '<?xml version="1.0" encoding="UTF-8"?>\n' + out;
  return out;
}

