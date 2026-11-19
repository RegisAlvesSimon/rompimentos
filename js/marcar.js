// Rompimentos — Aba Marcar: formulário, De/Para, GPS, tocar no mapa, coordenadas e salvar.
'use strict';

/* ================= formulário ================= */
const fOrig = $('#fOrig'), fDest = $('#fDest'), fDist = $('#fDist'), fUnit = $('#fUnit'), fFolga = $('#fFolga');
const fArea = $('#fArea'), fStatus = $('#fStatus'), fData = $('#fData'), fObs = $('#fObs'), fTitulo = $('#fTitulo');
const inputOf = w => w === 'origin' ? fOrig : fDest;

function nowLocal(d = new Date()) { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); }
let _cidades = null, _cidadesDe = null;
function cidadesDaRede(P) {
  if (_cidades && _cidadesDe === P) return _cidades;
  _cidadesDe = P; _cidades = [];
  let geo, nomes;
  try { geo = MUN_GEO; nomes = MUN_NOMES; } catch (_) { return _cidades; }
  // pontos com nome de lugar (tira referências “36km de Ilha Solteira”, RALs e rompimentos, que ficam fora da cidade)
  const pts = P.points.filter(p => p.name && p.coord);
  const lugares = pts.filter(p => !RE_MEDIDA.test(p.name) && !/refer[eê]ncia|\b(ral|rec|rup|romp)/i.test(p.name));
  // grade de ~1 km com quantos vértices de cabo tem em cada quadrado: a cidade é onde o traçado é mais denso
  const CEL = 0.01, grade = new Map();
  for (const l of P.lines) for (const c of l.coords) { const k = Math.floor(c[0] / CEL) + ':' + Math.floor(c[1] / CEL); grade.set(k, (grade.get(k) || 0) + 1); }
  const dentro = (pt, rings) => { let ins = false; for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const yi = ring[i][1], xi = ring[i][0], yj = ring[j][1], xj = ring[j][0]; if ((yi > pt[0]) !== (yj > pt[0]) && pt[1] < (xj - xi) * (pt[0] - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
  for (const f of geo.features) {
    const nome = nomes[f.properties && f.properties.codarea]; const g = f.geometry; if (!nome || !g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const big = polys.map(p => p[0]).reduce((a, b) => b.length > a.length ? b : a);
    let la = 0, ln = 0; for (const c of big) { la += c[1]; ln += c[0]; }
    const cen = [la / big.length, ln / big.length];
    // só cidades por onde a rede passa (algum ponto do KMZ a até 20 km)
    let perto = false; for (const p of pts) { if (Math.abs(p.coord[0] - cen[0]) < 0.2 && Math.abs(p.coord[1] - cen[1]) < 0.2 && hav(p.coord, cen) < 20000) { perto = true; break; } }
    if (!perto) continue;
    // o centro do município nem sempre é a cidade: usa os pontos do KMZ com o nome dela (ex.: “CS - ANDRADINA”), se houver
    const k = norm(nome), re = new RegExp('(^| )' + k.replace(/[^a-z0-9]+/g, ' ').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |$)');
    const meus = lugares.filter(p => re.test(norm(p.name).replace(/[^a-z0-9]+/g, ' ')) && hav(p.coord, cen) < 25000);
    let pos = cen;
    if (meus.length) { const med = a => { const s = a.slice().sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }; pos = [med(meus.map(p => p.coord[0])), med(meus.map(p => p.coord[1]))]; }
    else {
      // sem ponto com o nome: usa o lugar do município com mais cabo desenhado (normalmente a área urbana)
      const rings = polys.map(p => p[0]);
      let la0 = 90, la1 = -90, ln0 = 180, ln1 = -180; for (const c of big) { la0 = Math.min(la0, c[1]); la1 = Math.max(la1, c[1]); ln0 = Math.min(ln0, c[0]); ln1 = Math.max(ln1, c[0]); }
      let best = 0;
      for (let i = Math.floor(la0 / CEL); i <= Math.floor(la1 / CEL); i++) for (let j = Math.floor(ln0 / CEL); j <= Math.floor(ln1 / CEL); j++) {
        const n = grade.get(i + ':' + j); if (!n || n <= best) continue;
        const c = [(i + .5) * CEL, (j + .5) * CEL]; if (!dentro(c, rings)) continue;
        best = n; pos = c;
      }
    }
    _cidades.push({ name: nome, sub: 'Cidade', lat: r6(pos[0]), lng: r6(pos[1]), key: k, cidade: true });
  }
  return _cidades;
}
function buildPlaces() {
  const P = S.parsed; const list = [];
  if (P) {
    const count = new Map();
    P.points.forEach(p => { const k = norm(p.name); count.set(k, (count.get(k) || 0) + 1); });
    for (const p of P.points) {
      if (!p.name) continue;
      const dup = count.get(norm(p.name)) > 1;
      list.push({ name: p.name, sub: dup ? p.path.slice(-1)[0] || '' : (p.area || ''), lat: p.coord[0], lng: p.coord[1], key: norm(p.name) });
    }
  }
  // cidades (malha do IBGE embutida): dá para escolher “Andradina” como sentido da medida
  if (P) for (const c of cidadesDaRede(P)) list.push(c);
  // rompimentos salvos também servem de ponto de partida (ex.: RAL antiga a 54 km de Andradina)
  for (const b of S.breaks) {
    const nome = b.titulo || titleOf(b);
    if (!nome || !isFinite(b.lat)) continue;
    list.push({ name: nome, sub: 'Rompimento' + (b.dataHora ? ' · ' + fmtDate(b.dataHora).slice(0, 10) : ''), lat: b.lat, lng: b.lng, key: norm(nome + ' ' + (b.obs || '').slice(0, 120)) });
  }
  S.places = list;
}
function updateHint(w) {
  const h = w === 'origin' ? $('#hOrig') : $('#hDest');
  const v = S[w], txt = inputOf(w).value.trim();
  h.className = 'hint';
  if (v) { h.classList.add('set'); h.textContent = (v.picked ? 'Marcado no mapa · ' : '') + v.lat.toFixed(5) + ', ' + v.lng.toFixed(5); }
  else if (txt) h.textContent = 'Fica guardado como informação do rompimento.';
  else h.textContent = w === 'origin' ? 'Pode digitar livre ou escolher da lista do KMZ.' : '';
}
function setPlace(w, p, fromPick) {
  S[w] = { name: p.name, lat: p.lat, lng: p.lng, picked: !!fromPick };
  const inp = inputOf(w);
  if (!fromPick || !inp.value.trim()) inp.value = p.name;
  if (S.pick) endPick();
  updateHint(w); recalc();
}
function setupAC(inp, w, custom) {
  const list = inp.closest('.ac').querySelector('.aclist');
  let items = [], active = -1;
  const close = () => { list.hidden = true; active = -1; inp.setAttribute('aria-expanded', 'false'); };
  const render = () => {
    const q = norm(inp.value);
    if (!q) { close(); return; }
    items = S.places.filter(p => p.key.includes(q))
      .sort((a, b) => (a.key === q ? 0 : 1) - (b.key === q ? 0 : 1) || (a.cidade ? 0 : 1) - (b.cidade ? 0 : 1) || (a.key.startsWith(q) ? 0 : 1) - (b.key.startsWith(q) ? 0 : 1) || a.key.length - b.key.length).slice(0, 12);
    list.innerHTML = items.length
      ? items.map((p, i) => `<li role="option" data-i="${i}" aria-selected="${i === active}"><span>${esc(p.name)}</span><small>${esc(p.sub)}</small></li>`).join('')
      : `<li class="empty">${S.places.length ? 'Nenhum ponto com esse nome' : 'Carregue o KMZ para ver os nomes'}</li>`;
    list.hidden = false; inp.setAttribute('aria-expanded', 'true');
  };
  const choose = i => { const p = items[i]; if (!p) return; close(); if (custom) { inp.value = p.name; custom(p); } else setPlace(w, p); };
  inp.addEventListener('input', () => {
    if (custom) { const q0 = norm(inp.value); const ex = S.places.find(p => p.key === q0 || norm(p.name) === q0); active = -1; render(); custom(ex || null, true); return; }
    const cur = S[w];
    if (cur && cur.picked) cur.name = inp.value.trim() || 'Ponto no mapa';
    else { const q0 = norm(inp.value); const ex = S.places.find(p => p.key === q0 || norm(p.name) === q0); S[w] = ex ? { name: ex.name, lat: ex.lat, lng: ex.lng } : null; }
    active = -1; render(); updateHint(w); recalc();
  });
  inp.addEventListener('focus', () => { if (inp.value && !S[w]) render(); });
  inp.addEventListener('keydown', e => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { active = Math.min(items.length - 1, active + 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter') { if (items.length) { choose(active >= 0 ? active : 0); e.preventDefault(); } }
    else if (e.key === 'Escape') close();
  });
  list.addEventListener('mousedown', e => { const li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); choose(+li.dataset.i); } });
  inp.addEventListener('blur', () => setTimeout(close, 120));
}
setupAC(fOrig, 'origin'); setupAC(fDest, 'dest');

/* ---- jeitos de marcar: pela medida, GPS, tocar no mapa, coordenadas ---- */
// O local do rompimento sempre vem do GPS, do mapa ou de coordenadas; De/Para/Distância são só informação.
// (Para achar o ponto pela medida do OTDR use “Medir a partir daqui” na Pesquisar.)
const MODOS = ['gps', 'mapa', 'coord'];
function setModo(m, opts = {}) {
  if (!MODOS.includes(m)) m = 'gps';
  S.modo = m;
  try { localStorage.setItem('romp-modo', m); } catch (_) {}
  $$('#modoSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modo === m)));
  $('#pontoBox').hidden = m === 'otdr';
  $$('#pontoBox [data-p]').forEach(d => { d.hidden = d.dataset.p !== m; });
  $('#adv').hidden = m !== 'otdr';
  $('#trechoLegend').textContent = 'De onde para onde (informação do rompimento)';
  $('#distLabel').textContent = 'Distância do OTDR (informação do rompimento)';
  if (!opts.keepPonto) S.ponto = null;
  recalc({ keepManual: !!opts.keepPonto });
  if (m === 'gps' && !S.ponto && !opts.noAuto) pegarGps();
}
$$('#modoSeg button').forEach(b => b.addEventListener('click', () => setModo(b.dataset.modo)));

let gpsWatch = null;
function pararGps() { if (gpsWatch !== null) { try { navigator.geolocation.clearWatch(gpsWatch); } catch (_) {} gpsWatch = null; } }
function pegarGps() {
  const hint = $('#gpsHint');
  if (!('geolocation' in navigator)) { hint.textContent = 'Este aparelho não informa a localização.'; return; }
  pararGps();
  hint.textContent = 'Buscando sua localização…';
  const t0 = Date.now(); let melhor = null;
  gpsWatch = navigator.geolocation.watchPosition(pos => {
    const acc = pos.coords.accuracy;
    if (!melhor || acc < melhor) {
      melhor = acc;
      S.ponto = { lat: r6(pos.coords.latitude), lng: r6(pos.coords.longitude), acc: Math.round(acc), fonte: 'gps' };
      recalc({ keepManual: true });
      map.setView([S.ponto.lat, S.ponto.lng], Math.max(map.getZoom(), 17));
    }
    hint.textContent = acc <= 15 ? `Localização pega (precisão de ±${Math.round(acc)} m).` : `Melhorando a precisão… agora ±${Math.round(acc)} m. Pode salvar ou esperar.`;
    if (acc <= 10 || Date.now() - t0 > 25000) pararGps();
  }, err => {
    pararGps();
    hint.textContent = err.code === 1
      ? 'A localização foi bloqueada. Permita a localização para este site nas configurações do navegador e toque de novo.'
      : 'Não consegui pegar a localização agora. Tente de novo, ou use “No mapa”.';
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  setTimeout(pararGps, 30000);
}
$('#gpsBtn').addEventListener('click', pegarGps);
$('#mapaPickBtn').addEventListener('click', () => startPick('break'));

function parseCoordText(t) {
  t = String(t || '').trim(); if (!t) return null;
  let m;
  const ok = (la, ln) => (isFinite(la) && isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) ? { lat: r6(la), lng: r6(ln) } : null;
  if ((m = t.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/))) return ok(+m[1], +m[2]);
  if ((m = t.match(/[?&](?:q|query|ll|destination|center)=(-?\d+(?:\.\d+)?)\s*(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i))) return ok(+m[1], +m[2]);
  if ((m = t.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/))) return ok(+m[1], +m[2]);
  const dms = /(\d{1,3})\s*°\s*(\d{1,2})\s*['’]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:"|”|'')?\s*([NSns])[\s,;]+(\d{1,3})\s*°\s*(\d{1,2})\s*['’]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:"|”|'')?\s*([EWOLewol])/;
  if ((m = t.match(dms))) {
    const v = (d, mi, s) => +d + +mi / 60 + parseFloat(String(s).replace(',', '.')) / 3600;
    let la = v(m[1], m[2], m[3]), ln = v(m[5], m[6], m[7]);
    if (/[Ss]/.test(m[4])) la = -la; if (/[WOwo]/.test(m[8])) ln = -ln;
    return ok(la, ln);
  }
  if ((m = t.match(/(-?\d{1,3}[.,]\d+)\s*[,;\s]\s*(-?\d{1,3}[.,]\d+)/))) return ok(parseFloat(m[1].replace(',', '.')), parseFloat(m[2].replace(',', '.')));
  return null;
}
function usarCoord() {
  const raw = $('#fCoord').value;
  if (/goo\.gl|maps\.app/.test(raw)) { toast('Link curto não dá para ler. Abra o link, e na página do Google Maps copie as coordenadas ou o endereço completo da barra.'); return; }
  const p = parseCoordText(raw);
  if (!p) { toast('Não entendi essas coordenadas. Exemplo: -21.41234, -50.07123'); return; }
  S.ponto = Object.assign(p, { fonte: 'coord' });
  recalc({ keepManual: true });
  map.setView([p.lat, p.lng], Math.max(map.getZoom(), 16));
}
$('#coordBtn').addEventListener('click', usarCoord);
$('#fCoord').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); usarCoord(); } });

function placePreview(pos) {
  if (!previewMarker) {
    previewMarker = L.marker(pos, { icon: L.divIcon({ className: '', html: '<span class="pin preview"></span>', iconSize: [28, 28], iconAnchor: [14, 14] }), draggable: true, zIndexOffset: 1000 })
      .bindTooltip('Arraste para ajustar', { direction: 'top', offset: [0, -14] }).addTo(map);
    previewMarker.on('dragend', () => {
      const ll = previewMarker.getLatLng(), p = { lat: r6(ll.lat), lng: r6(ll.lng) };
      if (S.modo !== 'otdr') { if (S.ponto) { S.ponto.lat = p.lat; S.ponto.lng = p.lng; S.ponto.ajustado = true; } }
      else { S.manual = p; if (S.calc) { S.calc.lat = p.lat; S.calc.lng = p.lng; } }
      renderResult();
    });
  } else previewMarker.setLatLng(pos);
}
function snapInfo(p) {
  const net = getNet(); if (!net || !net.segs.length) return null;
  const s = nearestSeg(net, [p.lat, p.lng]); if (!s) return null;
  const ln = S.parsed && S.parsed.lines[net.segs[s.i][3]];
  return { d: s.d, pt: s.pt, nome: ln ? ln.name : '' };
}
function encaixarNoCabo() {
  if (!S.ponto) return; const s = snapInfo(S.ponto); if (!s) return;
  S.ponto.lat = r6(s.pt[0]); S.ponto.lng = r6(s.pt[1]); S.ponto.ajustado = true;
  recalc({ keepManual: true });
}
document.addEventListener('click', e => { if (e.target.closest('#snapBtn')) encaixarNoCabo(); });

function startPick(w) {
  S.pick = w;
  $('#pickText').textContent = w === 'med' ? 'Toque no mapa para marcar o SENTIDO da medida' : w === 'break' ? 'Toque no mapa onde foi o ROMPIMENTO' : w === 'origin' ? 'Toque no mapa para marcar a ORIGEM' : 'Toque no mapa para marcar o DESTINO';
  $('#pickbar').hidden = false; $('#map').classList.add('picking');
  if (window.innerWidth < 900) $('.mapbox').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function endPick() { S.pick = null; $('#pickbar').hidden = true; $('#map').classList.remove('picking'); }
$$('[data-pick]').forEach(b => b.addEventListener('click', () => startPick(b.dataset.pick)));

// GPS como ponta da medida: ex. cabo cortado no meio do trecho e medido dali com o OTDR
let gpsTrecho = null;
function usarGpsTrecho(w) {
  const hint = w === 'origin' ? $('#hOrig') : $('#hDest');
  if (!('geolocation' in navigator)) { hint.className = 'hint warn'; hint.textContent = 'Este aparelho não informa a localização.'; return; }
  if (gpsTrecho !== null) { try { navigator.geolocation.clearWatch(gpsTrecho); } catch (_) {} gpsTrecho = null; }
  hint.className = 'hint'; hint.textContent = 'Buscando sua localização…';
  const t0 = Date.now(); let melhor = null;
  const parar = () => { if (gpsTrecho !== null) { try { navigator.geolocation.clearWatch(gpsTrecho); } catch (_) {} gpsTrecho = null; } };
  gpsTrecho = navigator.geolocation.watchPosition(pos => {
    const acc = Math.round(pos.coords.accuracy);
    if (melhor === null || acc < melhor) {
      melhor = acc;
      const p = { lat: r6(pos.coords.latitude), lng: r6(pos.coords.longitude) };
      const inp = inputOf(w); inp.value = 'Minha localização (GPS)';
      S[w] = { name: 'Minha localização (GPS)', lat: p.lat, lng: p.lng, picked: true, gps: acc };
      recalc();
      const s = snapInfo(p);
      hint.className = 'hint set';
      hint.textContent = `GPS ±${acc} m · ${s ? 'a ' + fmtDist(s.d) + ' do cabo' + (s.nome ? ' (' + s.nome.slice(0, 40) + ')' : '') : 'sem cabo carregado'}${acc > 15 && Date.now() - t0 < 20000 ? ' · melhorando…' : ''}`;
      if (!map.getBounds().pad(-0.2).contains([p.lat, p.lng])) map.setView([p.lat, p.lng], Math.max(map.getZoom(), 15));
    }
    if (acc <= 10 || Date.now() - t0 > 25000) parar();
  }, err => {
    parar();
    hint.className = 'hint warn';
    hint.textContent = err.code === 1 ? 'Localização bloqueada. Permita a localização para este site nas configurações do navegador.' : 'Não consegui pegar a localização agora. Tente de novo ou use “No mapa”.';
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  setTimeout(parar, 30000);
}
$$('[data-gps]').forEach(b => b.addEventListener('click', () => usarGpsTrecho(b.dataset.gps)));
$('#pickCancel').addEventListener('click', endPick);
map.on('click', e => {
  if (!S.pick) { if (S.detalhe) fecharDetalhe(); return; }
  if (S.pick === 'med') {
    endPick();
    if (S.med) { S.med.dest = { name: 'Ponto no mapa', lat: r6(e.latlng.lat), lng: r6(e.latlng.lng) }; $('#mDest').value = 'Ponto no mapa'; medirCalc(); }
    return;
  }
  if (S.pick === 'break') {
    S.ponto = { lat: r6(e.latlng.lat), lng: r6(e.latlng.lng), fonte: 'mapa' };
    endPick(); recalc({ keepManual: true });
    if (window.innerWidth < 900) $('#result').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const w = S.pick, inp = inputOf(w);
  setPlace(w, { name: inp.value.trim() || 'Ponto no mapa', lat: r6(e.latlng.lat), lng: r6(e.latlng.lng) }, true);
});
$('#swap').addEventListener('click', () => {
  [S.origin, S.dest] = [S.dest, S.origin];
  const t = fOrig.value; fOrig.value = fDest.value; fDest.value = t;
  updateHint('origin'); updateHint('dest'); recalc();
});

function readDistM() { return parseDistM(fDist.value, fUnit.value); }
function parseDistM(valor, unidade) {
  const fUnit = { value: unidade };
  const v = String(valor).replace(/\s/g, '');
  // aceita conta de subtração: “65-54” = 11 (medida total menos a medida da referência)
  const sub = v.match(/^(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)$/);
  if (sub) { const d = parseFloat(sub[1].replace(',', '.')) - parseFloat(sub[2].replace(',', '.')); if (!isFinite(d) || d < 0) return null; return fUnit.value === 'km' ? d * 1000 : d; }
  const raw = parseFloat(v.replace(',', '.'));
  if (!isFinite(raw) || raw < 0) return null;
  return fUnit.value === 'km' ? raw * 1000 : raw;
}
function recalc(opts = {}) {
  if (!opts.keepManual) S.manual = null;
  routeLayer.clearLayers();
  S.calc = null;
  if (S.modo && S.modo !== 'otdr') {
    if (S.ponto) {
      placePreview([S.ponto.lat, S.ponto.lng]);
      if (!S.areaTouched) { const a = areaAt([S.ponto.lat, S.ponto.lng]); if (a) fArea.value = a; }
    } else if (previewMarker) { map.removeLayer(previewMarker); previewMarker = null; }
    renderResult(); return;
  }
  const o = S.origin, d = S.dest;
  if (!o || !d) { if (previewMarker) { map.removeLayer(previewMarker); previewMarker = null; } renderResult(); return; }
  const r = computeRoute(o, d);
  const accent = cssVar('--accent'), muted = cssVar('--muted');
  L.polyline(r.coords, { color: muted, weight: 7, opacity: .35, dashArray: r.network ? null : '6 8', interactive: false }).addTo(routeLayer);
  L.circleMarker(r.coords[0], { radius: 6, color: accent, weight: 3, fillColor: cssVar('--surface'), fillOpacity: 1, interactive: false }).addTo(routeLayer);
  const distM = readDistM();
  if (distM === null) {
    S.calc = { route: r };
    if (previewMarker) { map.removeLayer(previewMarker); previewMarker = null; }
    renderResult(); return;
  }
  const folga = Math.max(0, parseFloat(String(fFolga.value).replace(',', '.')) || 0);
  const eff = distM / (1 + folga / 100);
  const w = walk(r.coords, eff);
  L.polyline([...r.coords.slice(0, w.idx), w.pt], { color: accent, weight: 5, opacity: .95, interactive: false }).addTo(routeLayer);
  const pos = S.manual ? [S.manual.lat, S.manual.lng] : w.pt;
  S.calc = { route: r, distM, eff, folga, over: w.over, lat: r6(pos[0]), lng: r6(pos[1]), auto: { lat: r6(w.pt[0]), lng: r6(w.pt[1]) } };
  if (!S.areaTouched) { const a = areaAt(w.pt); if (a) fArea.value = a; }
  placePreview(pos);
  if (!opts.noPan && !map.getBounds().pad(-0.1).contains(pos)) map.panTo(pos);
  renderResult();
}
function gmapsUrl(lat, lng) { return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`; }
const FONTE_TXT = { gps: 'Sua localização (GPS)', mapa: 'Marcado no mapa', coord: 'Coordenadas digitadas', rota: 'Achado pela medida do OTDR' };
function renderResult() {
  const el = $('#result'), c = S.calc;
  el.classList.remove('ready');
  if (S.modo && S.modo !== 'otdr') {
    const p = S.ponto;
    if (!p) {
      const msg = { gps: 'Toque em <b>Pegar minha localização</b> estando no local do rompimento.', mapa: 'Toque em <b>Tocar no mapa para marcar</b> e depois no ponto do rompimento.', coord: 'Cole as coordenadas ou o link do Google Maps e toque em <b>Usar</b>.' }[S.modo];
      el.innerHTML = `<span class="k">Ponto do rompimento</span><span class="meta">${msg}</span>`;
      return;
    }
    const s = snapInfo(p);
    el.classList.add('ready');
    el.innerHTML = `<span class="k">Ponto do rompimento</span>
      <span class="coord">${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}</span>
      <span class="meta">${esc(FONTE_TXT[p.fonte] || 'Ponto')}${p.acc ? ` · precisão ±${p.acc} m` : ''}${p.ajustado ? ' · ajustado à mão' : ''}</span>
      ${s ? `<span class="meta">A <b class="mono">${fmtDist(s.d)}</b> do cabo mais próximo${s.nome ? ` (${esc(s.nome)})` : ''}.</span>` : ''}
      ${p.acc && p.acc > 50 ? '<span class="warn">Precisão baixa. Se puder, espere um pouco ou ajuste arrastando o ponto.</span>' : ''}
      <div class="links">${s && s.d > 3 && s.d < 500 ? `<button type="button" class="btn sm" id="snapBtn">Encaixar no cabo</button>` : ''}<a class="btn sm" href="${gmapsUrl(p.lat, p.lng)}" target="_blank" rel="noopener">Abrir no Google Maps</a><button type="button" class="btn sm" data-copy="${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}">Copiar coordenadas</button></div>`;
    return;
  }
  if (!S.origin || !S.dest) {
    el.innerHTML = `<span class="k">Ponto do rompimento</span><span class="meta">Preencha <b>de onde</b>, <b>para onde</b> e a <b>distância</b>. O ponto aparece no mapa e você pode arrastar para ajustar.</span>`;
    return;
  }
  const r = c.route;
  const warns = [];
  if (!r.network) warns.push(r.broken ? 'Não achei um caminho ligado entre os dois pontos na rede do KMZ. Usei linha reta.' : 'Sem rede carregada: usei linha reta entre os pontos. Carregue o KMZ na aba Mapa base.');
  if (r.network && r.snapO > 300) warns.push(`A origem fica a ${fmtDist(r.snapO)} da rede. A medida começa no ponto da rede mais próximo dela.`);
  if (r.network && r.snapD > 300) warns.push(`O destino fica a ${fmtDist(r.snapD)} da rede.`);
  if (r.network && r.reta > 2000 && r.length > 2.2 * r.reta) warns.push(`Atenção: pela rede deu ${fmtDist(r.length)}, bem mais que a distância em linha reta (${fmtDist(r.reta)}). Provavelmente falta um trecho de cabo no KMZ entre esses pontos e o caminho está dando a volta. Confira o ponto antes de usar.`);
  if (r.pontes && r.pontes.length) warns.push(`O caminho passa por ${r.pontes.length === 1 ? 'um trecho que não está desenhado no KMZ' : r.pontes.length + ' trechos que não estão desenhados no KMZ'} (${r.pontes.map(d => fmtDist(d)).join(', ')}). O app emendou em linha reta.`);
  if (c.distM === undefined) {
    el.innerHTML = `<span class="k">Trecho pela rede</span><span class="meta"><b>${esc(S.origin.name)}</b> → <b>${esc(S.dest.name)}</b>: <span class="mono">${fmtDist(r.length)}</span></span>
      ${warns.map(w => `<span class="warn">${esc(w)}</span>`).join('')}<span class="meta">Agora informe a distância.</span>`;
    return;
  }
  if (c.over) warns.push(`A distância passa do fim do trecho (${fmtDist(r.length)}). O ponto ficou no destino. Confira o sentido ou o destino.`);
  if (S.manual) warns.push('Posição ajustada à mão no mapa.');
  const pct = Math.min(100, (c.eff / Math.max(1, r.length)) * 100);
  el.classList.add('ready');
  el.innerHTML = `<span class="k">Ponto do rompimento</span>
    <span class="coord">${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}</span>
    <span class="meta"><b class="mono">${fmtDist(c.distM)}</b> de <b>${esc(S.origin.name)}</b> sentido <b>${esc(S.dest.name)}</b>${c.folga ? ` · ${fmtDist(c.eff)} no mapa (folga ${String(c.folga).replace('.', ',')}%)` : ''}</span>
    <div class="km-scale" aria-hidden="true"><span style="width:${pct.toFixed(1)}%"></span></div>
    <div class="scale-labels"><span>${esc(S.origin.name)}</span><span class="mono">${fmtDist(r.length)} pela rede</span><span>${esc(S.dest.name)}</span></div>
    ${warns.map(w => `<span class="warn">${esc(w)}</span>`).join('')}
    <div class="links"><a class="btn sm" href="${gmapsUrl(c.lat, c.lng)}" target="_blank" rel="noopener">Abrir no Google Maps</a><button type="button" class="btn sm" data-copy="${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}">Copiar coordenadas</button></div>`;
}
[fDist, fFolga].forEach(i => i.addEventListener('input', () => recalc()));
fUnit.addEventListener('change', () => recalc());
fArea.addEventListener('input', () => { S.areaTouched = true; });

function resetForm(keepTrecho) {
  S.editId = null; S.manual = null; S.areaTouched = false; S.ponto = null; pararGps();
  $('#fCoord').value = '';
  $('#editNote').hidden = true; $('#saveBtn').textContent = 'Salvar rompimento';
  fDist.value = ''; fObs.value = ''; fTitulo.value = ''; fStatus.value = 'aberto'; fData.value = nowLocal();
  if (!keepTrecho) { S.origin = S.dest = null; fOrig.value = fDest.value = ''; fArea.value = ''; fFolga.value = '0'; updateHint('origin'); updateHint('dest'); }
  recalc();
}
$('#cancelEdit').addEventListener('click', () => resetForm(false));

function cleanBreak(o) {
  if (!o || typeof o !== 'object') return null;
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  const str = (v, n = 300) => typeof v === 'string' ? v.slice(0, n) : '';
  const b = {
    id: /^[A-Za-z0-9_-]{4,60}$/.test(o.id || '') ? o.id : uid(),
    titulo: str(o.titulo, 160), importado: o.importado === true, cidades: str(o.cidades, 300), pasta: str(o.pasta, 300),
    origem: str(o.origem, 120), destino: str(o.destino, 120),
    origemLat: num(o.origemLat), origemLng: num(o.origemLng), destinoLat: num(o.destinoLat), destinoLng: num(o.destinoLng),
    distM: num(o.distM), unidade: o.unidade === 'm' ? 'm' : 'km', folgaPct: num(o.folgaPct) || 0,
    lat: num(o.lat), lng: num(o.lng), rotaM: num(o.rotaM), metodo: ['manual', 'gps', 'mapa', 'coord'].includes(o.metodo) ? o.metodo : 'rota', precisaoM: num(o.precisaoM),
    area: str(o.area, 120), status: o.status === 'reparado' ? 'reparado' : 'aberto',
    dataHora: str(o.dataHora, 40), obs: str(o.obs, 2000),
    criadoEm: str(o.criadoEm, 40), atualizadoEm: str(o.atualizadoEm, 40), criadoPor: str(o.criadoPor, 120) || null
  };
  if (b.lat === null || b.lng === null) return null;
  return b;
}

$('#form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!S.canWrite) { toast('Você só tem acesso de leitura.'); return; }
  const now = new Date().toISOString();
  const prev = S.editId ? S.breaks.find(b => b.id === S.editId) : null;
  let dh = now; try { if (fData.value) dh = new Date(fData.value).toISOString(); } catch (_) {}
  if (S.modo && S.modo !== 'otdr') {
    // Marcado pelo GPS, tocando no mapa ou por coordenadas: o ponto é o próprio local; trecho e medida são só registro.
    if (!S.ponto) { toast('Defina o local do rompimento primeiro.'); return; }
    const dm = readDistM();
    const b = Object.assign({}, prev || {}, {
      id: S.editId || uid(), titulo: fTitulo.value.trim(), importado: prev ? !!prev.importado : false,
      origem: fOrig.value.trim(), destino: fDest.value.trim(),
      origemLat: S.origin ? S.origin.lat : null, origemLng: S.origin ? S.origin.lng : null,
      destinoLat: S.dest ? S.dest.lat : null, destinoLng: S.dest ? S.dest.lng : null,
      distM: dm === null ? null : Math.round(dm * 100) / 100, unidade: fUnit.value, folgaPct: 0,
      lat: r6(S.ponto.lat), lng: r6(S.ponto.lng), rotaM: null, metodo: S.ponto.fonte || 'mapa', precisaoM: S.ponto.acc || null,
      area: fArea.value.trim(), status: fStatus.value, dataHora: dh, obs: fObs.value.trim(),
      criadoEm: prev ? prev.criadoEm : now, atualizadoEm: now, criadoPor: prev ? prev.criadoPor : (S.userId || null)
    });
    const btn = $('#saveBtn'); btn.disabled = true;
    try { await Store.save(b); toast(S.editId ? 'Alterações salvas.' : 'Rompimento salvo.'); resetForm(true); }
    catch (err) { handleWriteError(err); }
    finally { btn.disabled = !S.canWrite; }
    return;
  }
  const hasCalc = S.origin && S.dest && S.calc && S.calc.distM !== undefined;
  if (prev && !hasCalc) {
    // edição de um rompimento sem trecho (ex.: importado do KMZ antigo): mantém a posição
    const b = Object.assign({}, prev, { titulo: fTitulo.value.trim(), area: fArea.value.trim(), status: fStatus.value, obs: fObs.value.trim(), dataHora: fData.value ? dh : prev.dataHora, atualizadoEm: now });
    if (S.manual) { b.lat = S.manual.lat; b.lng = S.manual.lng; }
    try { await Store.save(b); toast('Alterações salvas.'); resetForm(false); } catch (err) { handleWriteError(err); }
    return;
  }
  if (!S.origin || !S.dest) { toast('Defina de onde e para onde.'); (S.origin ? fDest : fOrig).focus(); return; }
  if (!S.calc || S.calc.distM === undefined) { toast('Informe a distância do rompimento.'); fDist.focus(); return; }
  const c = S.calc;
  const b = {
    id: S.editId || uid(), titulo: fTitulo.value.trim(), importado: prev ? !!prev.importado : false,
    origem: S.origin.name, destino: S.dest.name,
    origemLat: S.origin.lat, origemLng: S.origin.lng, destinoLat: S.dest.lat, destinoLng: S.dest.lng,
    distM: Math.round(c.distM * 100) / 100, unidade: fUnit.value, folgaPct: c.folga || 0,
    lat: c.lat, lng: c.lng, rotaM: Math.round(c.route.length), metodo: S.manual ? 'manual' : 'rota',
    area: fArea.value.trim(), status: fStatus.value, dataHora: dh, obs: fObs.value.trim(),
    criadoEm: prev ? prev.criadoEm : now, atualizadoEm: now, criadoPor: prev ? prev.criadoPor : (S.userId || null)
  };
  const btn = $('#saveBtn'); btn.disabled = true;
  try {
    await Store.save(b);
    toast(S.editId ? 'Alterações salvas.' : 'Rompimento salvo.');
    resetForm(true);
  } catch (err) { handleWriteError(err); }
  finally { btn.disabled = !S.canWrite; }
});

