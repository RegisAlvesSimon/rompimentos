// Rompimentos — Estado do app (S) e o mapa (Leaflet): camadas, fundo de ruas/satélite e municípios.
'use strict';

/* ================= estado ================= */
const S = {
  mode: 'loading', inClaude: false, breaks: [], baseKml: null, baseMeta: null, baseAssetId: null,
  parsed: null, net: null, places: [], canWrite: true, canBase: true, userId: null,
  origin: null, dest: null, calc: null, manual: null, editId: null, areaTouched: false, pick: null,
  filter: { q: '', status: 'all', area: '' }, api: {}, fitted: false
};

/* ================= mapa ================= */
const map = L.map('map', { preferCanvas: true, zoomControl: true, attributionControl: false }).setView([-21.15, -50.6], 8);
const polyLayer = L.layerGroup().addTo(map);
const lineLayer = L.layerGroup().addTo(map);
const pointLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);
const refLayer = L.layerGroup().addTo(map);
const breakLayer = L.layerGroup().addTo(map);
let previewMarker = null;
const refMarkers = new Map();
const zoomLbl = () => $('#map').classList.toggle('zoom-alto', map.getZoom() >= 13);
map.on('zoomend', zoomLbl);
const breakMarkers = new Map();

let tilesOn = false;
function addTiles() {
  if (tilesOn) return; tilesOn = true;
  L.control.attribution({ prefix: false }).addTo(map);
  const esri = s => `https://server.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/{z}/{y}/{x}`;
  const ruas = L.tileLayer(esri('World_Street_Map'), { maxZoom: 19, crossOrigin: 'anonymous', attribution: 'Tiles © Esri' }).addTo(map);
  const sat = L.tileLayer(esri('World_Imagery'), { maxZoom: 19, crossOrigin: 'anonymous', attribution: 'Imagens © Esri' });
  L.control.layers({ 'Ruas': ruas, 'Satélite': sat }, null, { position: 'topright', collapsed: false }).addTo(map);
}
try { new ResizeObserver(() => map.invalidateSize()).observe($('#map')); } catch (_) {}

// Fundo com os municípios de SP (malha IBGE embutida na página) — usado quando não há mapa de ruas
function addMunicipios() {
  let geo, nomes;
  try { geo = MUN_GEO; nomes = MUN_NOMES; } catch (_) { return; }
  map.createPane('mun').style.zIndex = 250;
  const lp = map.createPane('munlbl'); lp.style.zIndex = 380; lp.style.pointerEvents = 'none';
  const renderer = L.canvas({ pane: 'mun' });
  const stroke = cssVar('--mun-line'), fill = cssVar('--mun-fill');
  const labels = L.layerGroup();
  for (const f of geo.features) {
    const g = f.geometry; if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const rings = polys.map(p => p[0].map(c => [c[1], c[0]]));
    L.polygon(rings, { renderer, color: stroke, weight: 1, fillColor: fill, fillOpacity: 1, interactive: false }).addTo(map);
    const big = rings.reduce((a, b) => b.length > a.length ? b : a);
    let la = 0, ln = 0; for (const p of big) { la += p[0]; ln += p[1]; }
    const name = nomes[f.properties && f.properties.codarea] || '';
    if (name) L.marker([la / big.length, ln / big.length], { pane: 'munlbl', interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'mun-lbl', html: `<span>${esc(name)}</span>`, iconSize: [0, 0] }) }).addTo(labels);
  }
  const upd = () => { if (map.getZoom() >= 10) labels.addTo(map); else labels.remove(); };
  map.on('zoomend', upd); upd();
}
function setLoading(msg) { const el = $('#loadNote'); el.textContent = msg; el.hidden = !msg; }

function renderBase() {
  polyLayer.clearLayers(); lineLayer.clearLayers(); pointLayer.clearLayers();
  const P = S.parsed; if (!P) return;
  const route = cssVar('--route'), ink = cssVar('--ink'), surf = cssVar('--surface');
  for (const pg of P.polys) L.polygon(pg.coords, { color: (pg.style && pg.style.color) || route, weight: 1, opacity: .5, fillOpacity: .05, interactive: false }).addTo(polyLayer);
  for (const ln of P.lines) {
    const w = ln.style && ln.style.width ? Math.min(6, Math.max(2, ln.style.width)) : 3;
    L.polyline(ln.coords, { color: (ln.style && ln.style.color) || route, weight: w, opacity: .9 })
      .bindTooltip(esc(ln.name || 'Rota sem nome') + (ln.area ? ' · ' + esc(ln.area) : ''), { sticky: true }).addTo(lineLayer);
  }
  const small = P.points.length > 2000;
  refLayer.clearLayers(); refMarkers.clear();
  S.refs = [];
  P.points.forEach((p, i) => { if (p.name && isReferencia(p)) { p.ref = true; p.refId = 'ref' + i; S.refs.push(p); } });
  for (const p of S.refs) {
    const curto = p.name.length > 40 ? p.name.slice(0, 40) + '…' : p.name;
    const m = L.marker(p.coord, { icon: L.divIcon({ className: '', html: `<span class="ref-pin"></span><span class="ref-lbl">${esc(curto)}</span>`, iconSize: [16, 16], iconAnchor: [8, 8] }), keyboard: false, zIndexOffset: 200, bubblingMouseEvents: false })
      .bindTooltip(esc(p.name), { direction: 'top', offset: [0, -8] });
    m.on('click', () => {
      if (S.pick === 'break') { S.ponto = { lat: r6(p.coord[0]), lng: r6(p.coord[1]), fonte: 'mapa' }; endPick(); recalc({ keepManual: true }); }
      else if (S.pick) setPlace(S.pick, { name: p.name, lat: p.coord[0], lng: p.coord[1] });
      else abrirDetalhe({ tipo: 'ref', refId: p.refId });
    });
    m.addTo(refLayer); refMarkers.set(p.refId, m);
  }
  zoomLbl();
  for (const p of P.points) {
    if (p.ref) continue;
    const m = L.circleMarker(p.coord, { radius: small ? 3 : 5, color: ink, weight: 1.5, fillColor: surf, fillOpacity: 1, bubblingMouseEvents: false });
    m.bindTooltip(esc(p.name || 'Ponto sem nome'), { direction: 'top' });
    m.on('click', () => {
      if (S.pick === 'break') { S.ponto = { lat: r6(p.coord[0]), lng: r6(p.coord[1]), fonte: 'mapa' }; endPick(); recalc({ keepManual: true }); }
      else if (S.pick) setPlace(S.pick, { name: p.name || 'Ponto', lat: p.coord[0], lng: p.coord[1] });
      else abrirDetalhe({ tipo: 'ponto', p });
    });
    m.addTo(pointLayer);
  }
  if (!S.fitted) {
    const b = coreBounds([...P.lines.flatMap(l => [l.coords[0], l.coords[l.coords.length - 1]]), ...P.points.map(p => p.coord)]);
    if (b) { map.fitBounds(b, { padding: [20, 20] }); S.fitted = true; }
  }
}

// Enquadra onde está a maior parte da rede, ignorando pontos soltos longe (ex.: marcadores de exemplo do Google Earth no exterior)
function coreBounds(pts) {
  if (!pts.length) return null;
  const q = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(p * (arr.length - 1))))];
  const la = pts.map(p => p[0]).sort((a, b) => a - b), ln = pts.map(p => p[1]).sort((a, b) => a - b);
  const lo = pts.length > 50 ? 0.01 : 0, hi = 1 - lo;
  return L.latLngBounds([q(la, lo), q(ln, lo)], [q(la, hi), q(ln, hi)]);
}
function breakIcon(b) {
  const ok = b.status === 'reparado';
  return L.divIcon({ className: '', html: `<span class="pin ${ok ? 'ok' : 'open'}"></span>`, iconSize: [22, 22], iconAnchor: [11, 11] });
}
function renderBreakMarkers() {
  breakLayer.clearLayers(); breakMarkers.clear();
  for (const b of visibleBreaks()) {
    if (!isFinite(b.lat) || !isFinite(b.lng)) continue;
    const m = L.marker([b.lat, b.lng], { icon: breakIcon(b), keyboard: false, zIndexOffset: b.status === 'reparado' ? 0 : 500 })
      .bindTooltip(esc(titleOf(b)), { direction: 'top', offset: [0, -10] });
    m.on('click', () => { if (S.pick) return; abrirDetalhe({ tipo: 'break', id: b.id }); });
    m.addTo(breakLayer); breakMarkers.set(b.id, m);
  }
}

