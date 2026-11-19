// Rompimentos — Aba Pesquisar: lista, filtros, referências, cartão de detalhe, perto de mim e Medir a partir daqui.
'use strict';

/* ================= pesquisa ================= */
function visibleRefs() {
  if (S.filter.status !== 'all' && S.filter.status !== 'ref') return [];
  const terms = norm(S.filter.q).split(' ').filter(Boolean);
  return (S.refs || []).filter(p =>
    (!S.filter.area || p.area === S.filter.area) &&
    (!terms.length || (() => { const h = norm([p.name, p.desc, p.path.join(' ')].join(' ')); return terms.every(t => h.includes(t)); })())
  );
}
function refHtml(p) {
  const pasta = p.path.slice(-2).join(' / ');
  return `<li class="item refitem" data-ref="${esc(p.refId)}">
      <div class="item-head"><span class="pill ref">Referência</span>${p.area && /[áa]rea/i.test(p.area) ? `<span>${esc(p.area)}</span>` : ''}</div>
      <div class="item-title"><b>${esc(p.name)}</b></div>
      <div class="coords mono">${p.coord[0].toFixed(6)}, ${p.coord[1].toFixed(6)}</div>
      ${pasta ? `<div class="coords">Pasta: ${esc(pasta)}</div>` : ''}
      ${p.desc ? `<p class="obs">${esc(p.desc.length > 400 ? p.desc.slice(0, 400) + '…' : p.desc)}</p>` : ''}
      <div class="item-actions">
        <button type="button" class="btn sm" data-act="refmap">Ver no mapa</button>
        <a class="btn sm" href="${gmapsUrl(p.coord[0], p.coord[1])}" target="_blank" rel="noopener">Google Maps</a>
        <button type="button" class="btn sm" data-copy="${p.coord[0].toFixed(6)}, ${p.coord[1].toFixed(6)}">Copiar</button>
        <button type="button" class="btn sm" data-act="reforig">Medir a partir daqui</button>
      </div></li>`;
}
function focusRef(refId, pan = true) {
  const p = (S.refs || []).find(x => x.refId === refId); if (!p) return;
  if (!visibleRefs().some(x => x.refId === refId)) {
    S.filter = { q: '', status: 'ref', area: '' }; $('#q').value = '';
    $$('.seg button[data-st]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.st === 'ref')));
    renderList(); renderBreakMarkers();
  }
  showTab('pesquisar');
  if (pan) { map.setView(p.coord, Math.max(map.getZoom(), 15)); if (window.innerWidth < 900) $('.mapbox').scrollIntoView({ behavior: 'smooth' }); }
  const m = refMarkers.get(refId); if (m) m.openTooltip();
  $$('.item.hl').forEach(x => x.classList.remove('hl'));
  const li = $(`.item[data-ref="${CSS.escape(refId)}"]`);
  if (li) { li.classList.add('hl'); if (!pan || window.innerWidth >= 900) li.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}
function visibleBreaks() {
  const terms = norm(S.filter.q).split(' ').filter(Boolean);
  if (S.filter.status === 'ref') return [];
  return S.breaks.filter(b =>
    (S.filter.status === 'all' || b.status === S.filter.status) &&
    (!S.filter.area || b.area === S.filter.area) &&
    (!terms.length || (() => { const h = norm([b.titulo, b.origem, b.destino, b.area, b.cidades, b.pasta, b.obs].join(' ')); return terms.every(t => h.includes(t)); })())
  ).sort((a, b) => String(b.dataHora || '').localeCompare(String(a.dataHora || '')));
}
function fmtDate(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function renderList() {
  const list = visibleBreaks(), refs = visibleRefs();
  const open = list.filter(b => b.status !== 'reparado').length;
  $('#summary').innerHTML = S.filter.status === 'ref'
    ? `<b>${refs.length}</b> ${refs.length === 1 ? 'referência' : 'referências'}`
    : `<b>${list.length}</b> ${list.length === 1 ? 'rompimento' : 'rompimentos'} · <b>${open}</b> abertos · <b>${list.length - open}</b> reparados${refs.length ? ` · <b>${refs.length}</b> referências` : ''}`;
  if (S.perto) $('#summary').innerHTML += ' · do mais perto de você';
  const allOpen = S.breaks.filter(b => b.status !== 'reparado').length;
  $('#badge').textContent = allOpen ? String(allOpen) : '';
  // áreas
  const areas = [...new Set(S.breaks.map(b => b.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const sel = $('#fltArea'), cur = S.filter.area;
  sel.innerHTML = '<option value="">Todas as áreas</option>' + areas.map(a => `<option ${a === cur ? 'selected' : ''}>${esc(a)}</option>`).join('');
  const ul = $('#list');
  if (!S.breaks.length) {
    ul.innerHTML = `<li class="empty-state"><h3>Nenhum rompimento ainda</h3>Quando você salvar um rompimento na aba <b>Marcar</b>, ele aparece aqui. Depois é só digitar a cidade (ex.: Penápolis, Araçatuba, Andradina) ou a área para ver todos dela.</li>`;
    return;
  }
  if (!list.length && !refs.length) { ul.innerHTML = `<li class="empty-state">Nada encontrado para essa pesquisa.</li>`; return; }
  if (S.perto) {
    // ordenado pela distância até você (rompimentos e referências juntos)
    const me = [S.perto.lat, S.perto.lng];
    const itens = [...list.map(b => ({ d: hav(me, [b.lat, b.lng]), html: breakHtml(b) })), ...refs.map(p => ({ d: hav(me, p.coord), html: refHtml(p) }))]
      .sort((a, b) => a.d - b.d).slice(0, 300);
    ul.innerHTML = itens.map(x => x.html.replace('<div class="item-head">', `<div class="item-head"><span class="pill perto">a ${esc(fmtDist(x.d))} de você</span>`)).join('');
    return;
  }
  ul.innerHTML = refs.slice(0, 300).map(refHtml).join('') + list.map(breakHtml).join('');
}
function breakHtml(b) {
  const rw = S.canEdit !== false && S.canWrite;
  {
    const rep = b.status === 'reparado';
    return `<li class="item ${rep ? 'rep' : ''}" data-id="${esc(b.id)}">
      <div class="item-head"><span class="pill ${rep ? 'ok' : 'bad'}">${rep ? 'Reparado' : 'Aberto'}</span><time>${esc(fmtDate(b.dataHora))}</time>${b.area ? `<span>· ${esc(b.area)}</span>` : ''}</div>
      ${b.titulo ? `<div class="item-title"><b>${esc(b.titulo)}</b></div>` : ''}
      ${trechoHtml(b)}
      <div class="coords mono">${Number(b.lat).toFixed(6)}, ${Number(b.lng).toFixed(6)}${b.folgaPct ? ` · folga ${esc(String(b.folgaPct).replace('.', ','))}%` : ''}${({ manual: ' · ajustado à mão', gps: ' · pelo GPS' + (b.precisaoM ? ` (±${b.precisaoM} m)` : ''), mapa: ' · marcado no mapa', coord: ' · por coordenadas' })[b.metodo] || ''}</div>
      ${b.cidades ? `<div class="coords">Cidades: ${esc(b.cidades)}</div>` : ''}
      ${b.obs ? `<p class="obs">${esc(b.obs.length > 400 ? b.obs.slice(0, 400) + '…' : b.obs)}</p>` : ''}
      <div class="item-actions">
        <button type="button" class="btn sm" data-act="map">Ver no mapa</button>
        <a class="btn sm" href="${gmapsUrl(b.lat, b.lng)}" target="_blank" rel="noopener">Google Maps</a>
        <button type="button" class="btn sm" data-copy="${Number(b.lat).toFixed(6)}, ${Number(b.lng).toFixed(6)}">Copiar</button>
        ${rw ? `<button type="button" class="btn sm" data-act="toggle">${rep ? 'Reabrir' : 'Marcar reparado'}</button>
        <button type="button" class="btn sm" data-act="edit">Editar</button>
        <button type="button" class="btn sm danger" data-act="del">Excluir</button>` : ''}
        <button type="button" class="btn sm" data-act="breakorig">Medir a partir daqui</button>
      </div></li>`;
  }
}
function pontoHtml(p) {
  const pasta = p.path.slice(-2).join(' / ');
  return `<li class="item pontoitem">
      <div class="item-head"><span class="pill ponto">Ponto do KMZ</span>${p.area && /[áa]rea/i.test(p.area) ? `<span>${esc(p.area)}</span>` : ''}</div>
      <div class="item-title"><b>${esc(p.name || 'Ponto sem nome')}</b></div>
      <div class="coords mono">${p.coord[0].toFixed(6)}, ${p.coord[1].toFixed(6)}</div>
      ${pasta ? `<div class="coords">Pasta: ${esc(pasta)}</div>` : ''}
      ${p.desc ? `<p class="obs">${esc(p.desc.length > 600 ? p.desc.slice(0, 600) + '…' : p.desc)}</p>` : ''}
      <div class="item-actions">
        <a class="btn sm" href="${gmapsUrl(p.coord[0], p.coord[1])}" target="_blank" rel="noopener">Google Maps</a>
        <button type="button" class="btn sm" data-copy="${p.coord[0].toFixed(6)}, ${p.coord[1].toFixed(6)}">Copiar</button>
        <button type="button" class="btn sm" data-act="pontoorig">Medir a partir daqui</button>
      </div></li>`;
}
/* ---- cartão de detalhe ao tocar num ponto do mapa ---- */
function abrirDetalhe(d) { S.detalhe = d; renderDetalhe(); }
function fecharDetalhe() { S.detalhe = null; $('#detalhe').hidden = true; }
function renderDetalhe() {
  const el = $('#detalhe'), d = S.detalhe;
  if (!d) { el.hidden = true; return; }
  let html = '';
  if (d.tipo === 'break') { const b = S.breaks.find(x => x.id === d.id); if (!b) { fecharDetalhe(); return; } html = breakHtml(b); }
  else if (d.tipo === 'ref') { const p = (S.refs || []).find(x => x.refId === d.refId); if (!p) { fecharDetalhe(); return; } html = refHtml(p); }
  else if (d.tipo === 'ponto') html = pontoHtml(d.p);
  $('#detalheCorpo').innerHTML = html.replace('data-act="map"', 'data-act="zoom"').replace('data-act="refmap"', 'data-act="zoom"').replace('>Ver no mapa<', '>Aproximar<');
  el.hidden = false;
}
$('#detalheFechar').addEventListener('click', fecharDetalhe);
function trechoHtml(b) {
  if (!b.origem && !b.destino && typeof b.distM !== 'number') return '';
  const dist = typeof b.distM === 'number' ? `<span class="dist">${esc(fmtDist(b.distM))}</span> ` : '';
  return `<div class="item-title">${dist}${b.origem ? `de <b>${esc(b.origem)}</b>` : ''}${b.destino ? ` → ${esc(b.destino)}` : ''}</div>`;
}
function renderAll() { buildPlaces(); renderList(); renderBreakMarkers(); renderAreaList(); if (S.detalhe) renderDetalhe(); }
function renderAreaList() {
  const set = new Set(S.breaks.map(b => b.area).filter(Boolean));
  if (S.parsed) S.parsed.lines.forEach(l => l.area && set.add(l.area));
  $('#areaList').innerHTML = [...set].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })).map(a => `<option value="${esc(a)}"></option>`).join('');
}
$('#q').addEventListener('input', e => { S.filter.q = e.target.value; renderList(); renderBreakMarkers(); });

/* ---- "Pegar minha localização" na pesquisa: mostra você no mapa e ordena pelo mais perto ---- */
const meLayer = L.layerGroup().addTo(map);
let pertoWatch = null;
function pararPerto() { if (pertoWatch !== null) { try { navigator.geolocation.clearWatch(pertoWatch); } catch (_) {} pertoWatch = null; } }
function desenharEu() {
  meLayer.clearLayers(); if (!S.perto) return;
  const c = [S.perto.lat, S.perto.lng], azul = cssVar('--route');
  if (S.perto.acc) L.circle(c, { radius: S.perto.acc, color: azul, weight: 1, fillColor: azul, fillOpacity: .12, interactive: false }).addTo(meLayer);
  L.circleMarker(c, { radius: 8, color: '#fff', weight: 3, fillColor: azul, fillOpacity: 1, interactive: false }).addTo(meLayer);
}
$('#pertoBtn').addEventListener('click', () => {
  const hint = $('#pertoHint'); hint.hidden = false; hint.className = 'hint';
  if (!('geolocation' in navigator)) { hint.className = 'hint warn'; hint.textContent = 'Este aparelho não informa a localização.'; return; }
  pararPerto(); hint.textContent = 'Buscando sua localização…';
  const t0 = Date.now(); let melhor = null, primeira = true;
  pertoWatch = navigator.geolocation.watchPosition(pos => {
    const acc = Math.round(pos.coords.accuracy);
    if (melhor === null || acc < melhor) {
      melhor = acc;
      S.perto = { lat: r6(pos.coords.latitude), lng: r6(pos.coords.longitude), acc };
      desenharEu(); renderList();
      if (primeira) { map.setView([S.perto.lat, S.perto.lng], Math.max(map.getZoom(), 13)); primeira = false; }
      hint.className = 'hint set';
      hint.textContent = `Você está aqui (±${acc} m). Lista ordenada do mais perto para o mais longe.`;
      $('#pertoLimpar').hidden = false; $('#pertoBtn').textContent = 'Atualizar localização';
    }
    if (acc <= 15 || Date.now() - t0 > 20000) pararPerto();
  }, err => {
    pararPerto(); hint.className = 'hint warn';
    hint.textContent = err.code === 1 ? 'Localização bloqueada. Permita a localização para este site nas configurações do navegador.' : 'Não consegui pegar a localização agora. Tente de novo.';
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  setTimeout(pararPerto, 25000);
});
$('#pertoLimpar').addEventListener('click', () => {
  pararPerto(); S.perto = null; desenharEu(); renderList();
  $('#pertoHint').hidden = true; $('#pertoLimpar').hidden = true; $('#pertoBtn').textContent = 'Pegar minha localização';
});
$$('.seg button[data-st]').forEach(b => b.addEventListener('click', () => {
  S.filter.status = b.dataset.st; $$('.seg button[data-st]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  renderList(); renderBreakMarkers();
}));
$('#fltArea').addEventListener('change', e => { S.filter.area = e.target.value; renderList(); renderBreakMarkers(); });
$('#fitAll').addEventListener('click', () => {
  const pts = [...visibleBreaks().map(b => [b.lat, b.lng]), ...visibleRefs().map(p => p.coord)];
  if (!pts.length) { toast('Nada nesta pesquisa.'); return; }
  if (pts.length === 1) map.setView(pts[0], 15); else map.fitBounds(coreBounds(pts), { padding: [40, 40], maxZoom: 15 });
  if (window.innerWidth < 900) $('.mapbox').scrollIntoView({ behavior: 'smooth' });
});

function focusBreak(id, pan = true) {
  const b = S.breaks.find(x => x.id === id); if (!b) return;
  if (!visibleBreaks().some(x => x.id === id)) {
    S.filter = { q: '', status: 'all', area: '' }; $('#q').value = '';
    $$('.seg button[data-st]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.st === 'all')));
    renderList(); renderBreakMarkers();
  }
  showTab('pesquisar');
  if (pan) { map.setView([b.lat, b.lng], Math.max(map.getZoom(), 15)); if (window.innerWidth < 900) $('.mapbox').scrollIntoView({ behavior: 'smooth' }); }
  const m = breakMarkers.get(id); if (m) m.openTooltip();
  $$('.item.hl').forEach(x => x.classList.remove('hl'));
  const li = $(`.item[data-id="${CSS.escape(id)}"]`);
  if (li) { li.classList.add('hl'); if (!pan || window.innerWidth >= 900) li.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}
const armed = new WeakMap();
/* ---- Medir a partir daqui (na Pesquisar): primeiro acha o rompimento, depois decide se marca ---- */
const medLayer = L.layerGroup().addTo(map);
function medirDaqui(nome, coord) {
  fecharDetalhe();
  S.med = { orig: { name: nome, lat: coord[0], lng: coord[1] }, dest: null };
  $('#mOrigNome').textContent = nome;
  $('#mDest').value = ''; $('#mDist').value = '';
  $('#medirBox').hidden = false;
  showTab('pesquisar');
  medirCalc();
  $('#medirBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => $('#mDest').focus({ preventScroll: true }), 350);
}
function fecharMedir() { S.med = null; medLayer.clearLayers(); $('#medirBox').hidden = true; if (S.pick === 'med') endPick(); }
function medirCalc() {
  medLayer.clearLayers();
  const M = S.med, el = $('#mResult'); if (!M) return;
  el.classList.remove('ready');
  const accent = cssVar('--accent'), muted = cssVar('--muted');
  L.circleMarker([M.orig.lat, M.orig.lng], { radius: 7, color: accent, weight: 3, fillColor: cssVar('--surface'), fillOpacity: 1, interactive: false }).addTo(medLayer);
  const h = $('#mDestHint'); h.className = 'hint';
  if (M.dest) { h.classList.add('set'); h.textContent = M.dest.lat.toFixed(5) + ', ' + M.dest.lng.toFixed(5); }
  else if ($('#mDest').value.trim()) { h.classList.add('warn'); h.textContent = 'Não achei esse nome no KMZ. Escolha da lista ou use “No mapa”.'; }
  else h.textContent = 'Escolha uma cidade ou ponto do KMZ no sentido do rompimento.';
  if (!M.dest) { el.innerHTML = '<span class="k">Ponto do rompimento</span><span class="meta">Escolha o <b>sentido</b> e digite a <b>distância</b> do OTDR.</span>'; return; }
  const r = computeRoute(M.orig, M.dest);
  L.polyline(r.coords, { color: muted, weight: 7, opacity: .35, dashArray: r.network ? null : '6 8', interactive: false }).addTo(medLayer);
  const warns = [];
  if (!r.network) warns.push(r.broken ? 'Não achei um caminho ligado entre os dois pontos na rede do KMZ. Usei linha reta.' : 'Sem rede carregada: usei linha reta entre os pontos.');
  if (r.network && r.snapO > 300) warns.push(`O ponto de partida fica a ${fmtDist(r.snapO)} da rede. A medida começa no cabo mais próximo dele.`);
  if (r.network && r.reta > 2000 && r.length > 2.2 * r.reta) warns.push(`Atenção: pela rede deu ${fmtDist(r.length)}, bem mais que em linha reta (${fmtDist(r.reta)}). Pode faltar um trecho de cabo no KMZ. Confira o ponto.`);
  if (r.pontes && r.pontes.length) warns.push(`O caminho passa por ${r.pontes.length === 1 ? 'um trecho que não está desenhado no KMZ' : r.pontes.length + ' trechos que não estão desenhados no KMZ'} (${r.pontes.map(d => fmtDist(d)).join(', ')}).`);
  const distM = parseDistM($('#mDist').value, $('#mUnit').value);
  if (distM === null) {
    el.innerHTML = `<span class="k">Trecho pela rede</span><span class="meta"><b>${esc(M.orig.name)}</b> → <b>${esc(M.dest.name)}</b>: <span class="mono">${fmtDist(r.length)}</span></span>${warns.map(w => `<span class="warn">${esc(w)}</span>`).join('')}<span class="meta">Agora digite a distância.</span>`;
    if (!map.getBounds().contains(L.latLngBounds(r.coords))) map.fitBounds(L.latLngBounds(r.coords).pad(0.1));
    return;
  }
  const folga = Math.max(0, parseFloat(String($('#mFolga').value).replace(',', '.')) || 0);
  const eff = distM / (1 + folga / 100);
  const w = walk(r.coords, eff);
  L.polyline([...r.coords.slice(0, w.idx), w.pt], { color: accent, weight: 5, opacity: .95, interactive: false }).addTo(medLayer);
  L.marker(w.pt, { icon: L.divIcon({ className: '', html: '<span class="pin preview"></span>', iconSize: [28, 28], iconAnchor: [14, 14] }), zIndexOffset: 1000, interactive: false }).addTo(medLayer);
  if (w.over) warns.push(`A distância passa do fim do trecho (${fmtDist(r.length)}). O ponto ficou no destino. Confira o sentido.`);
  M.calc = { distM, folga, lat: r6(w.pt[0]), lng: r6(w.pt[1]) };
  if (!map.getBounds().pad(-0.1).contains(w.pt)) map.panTo(w.pt);
  const lat = M.calc.lat, lng = M.calc.lng, pct = Math.min(100, (eff / Math.max(1, r.length)) * 100);
  el.classList.add('ready');
  el.innerHTML = `<span class="k">Ponto do rompimento</span>
    <span class="coord">${lat.toFixed(6)}, ${lng.toFixed(6)}</span>
    <span class="meta"><b class="mono">${fmtDist(distM)}</b> no OTDR de <b>${esc(M.orig.name)}</b> sentido <b>${esc(M.dest.name)}</b>${folga ? ` · <b class="mono">${fmtDist(eff)}</b> no mapa (folga ${String(folga).replace('.', ',')}%)` : ''}</span>
    <div class="km-scale" aria-hidden="true"><span style="width:${pct.toFixed(1)}%"></span></div>
    <div class="scale-labels"><span>${esc(M.orig.name)}</span><span class="mono">${fmtDist(r.length)} pela rede</span><span>${esc(M.dest.name)}</span></div>
    ${warns.map(x => `<span class="warn">${esc(x)}</span>`).join('')}
    <div class="links"><button type="button" class="btn sm" id="mVer">Ver no mapa</button><a class="btn sm" href="${gmapsUrl(lat, lng)}" target="_blank" rel="noopener">Google Maps</a><button type="button" class="btn sm" data-copy="${lat.toFixed(6)}, ${lng.toFixed(6)}">Copiar coordenadas</button></div>
    ${S.canWrite ? '<button type="button" class="primary" id="mMarcar" style="margin-top:10px">Marcar rompimento aqui</button>' : ''}`;
}
setupAC($('#mDest'), null, (p, digitando) => { if (!S.med) return; S.med.dest = p ? { name: p.name, lat: p.lat, lng: p.lng } : null; medirCalc(); if (p && !digitando) $('#mDist').focus(); });
$('#mDist').addEventListener('input', medirCalc);
try { const f = localStorage.getItem('romp-folga'); if (f !== null && f !== '') $('#mFolga').value = f; } catch (_) {}
$('#mFolga').addEventListener('input', () => { try { localStorage.setItem('romp-folga', $('#mFolga').value); } catch (_) {} medirCalc(); });
$('#mUnit').addEventListener('change', medirCalc);
$('#mDestPick').addEventListener('click', () => startPick('med'));
$('#medirFechar').addEventListener('click', fecharMedir);
$('#mResult').addEventListener('click', e => {
  const M = S.med; if (!M || !M.calc) return;
  if (e.target.closest('#mVer')) { map.setView([M.calc.lat, M.calc.lng], Math.max(map.getZoom(), 16)); if (window.innerWidth < 900) $('.mapbox').scrollIntoView({ behavior: 'smooth' }); }
  if (e.target.closest('#mMarcar')) {
    // leva a medida pronta para a aba Marcar
    if (S.editId) resetForm(false);
    showTab('marcar');
    S.ponto = { lat: M.calc.lat, lng: M.calc.lng, fonte: 'rota' };
    setModo('mapa', { keepPonto: true, noAuto: true });
    S.origin = { ...M.orig, picked: true }; S.dest = { ...M.dest, picked: true };
    fOrig.value = M.orig.name; fDest.value = M.dest.name;
    const dm = M.calc.distM; fUnit.value = 'km'; fDist.value = String(Math.round(dm) / 1000).replace('.', ',');
    updateHint('origin'); updateHint('dest');
    fecharMedir(); recalc({ keepManual: true });
    toast('Medida levada para Marcar. Confira e salve.');
    $('#result').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
const acaoItem = async e => {
  const btn = e.target.closest('button[data-act]'); if (!btn) return;
  const noDetalhe = !!btn.closest('#detalhe');
  if (btn.dataset.act === 'pontoorig') { const p = S.detalhe && S.detalhe.p; if (p) medirDaqui(p.name || 'Ponto', p.coord); return; }
  if (btn.dataset.act === 'zoom') {
    const d = S.detalhe; if (!d) return;
    const c = d.tipo === 'break' ? (() => { const b = S.breaks.find(x => x.id === d.id); return b && [b.lat, b.lng]; })()
      : d.tipo === 'ref' ? ((S.refs || []).find(x => x.refId === d.refId) || {}).coord : d.p.coord;
    if (c) map.setView(c, Math.max(map.getZoom() + 2, 16));
    return;
  }
  const refLi = btn.closest('.refitem');
  if (refLi) {
    const p = (S.refs || []).find(x => x.refId === refLi.dataset.ref); if (!p) return;
    if (btn.dataset.act === 'refmap') focusRef(p.refId, true);
    else if (btn.dataset.act === 'reforig') medirDaqui(p.name, p.coord);
    return;
  }
  const id = btn.closest('.item').dataset.id; const b = S.breaks.find(x => x.id === id); if (!b) return;
  const act = btn.dataset.act;
  if (act === 'map') focusBreak(id, true);
  else if (act === 'edit') { if (noDetalhe) fecharDetalhe(); loadForEdit(b); }
  else if (act === 'breakorig') medirDaqui(b.titulo || titleOf(b), [b.lat, b.lng]);
  else if (act === 'toggle') {
    try { await Store.save(Object.assign({}, b, { status: b.status === 'reparado' ? 'aberto' : 'reparado', atualizadoEm: new Date().toISOString() })); toast(b.status === 'reparado' ? 'Reaberto.' : 'Marcado como reparado.'); }
    catch (err) { handleWriteError(err); }
  } else if (act === 'del') {
    if (!armed.get(btn)) { armed.set(btn, true); btn.classList.add('armed'); btn.textContent = 'Confirmar exclusão'; setTimeout(() => { if (btn.isConnected) { armed.delete(btn); btn.classList.remove('armed'); btn.textContent = 'Excluir'; } }, 4000); return; }
    try { await Store.remove(id); toast('Rompimento excluído.'); if (noDetalhe) fecharDetalhe(); } catch (err) { handleWriteError(err); }
  }
};
$('#list').addEventListener('click', acaoItem);
$('#detalhe').addEventListener('click', acaoItem);
function loadForEdit(b) {
  showTab('marcar');
  S.editId = b.id; S.areaTouched = true;
  $('#editNote').hidden = false; $('#saveBtn').textContent = 'Salvar alterações';
  const hasTrecho = b.origem && b.destino && b.origemLat != null && b.destinoLat != null && typeof b.distM === 'number';
  S.origin = hasTrecho ? { name: b.origem, lat: b.origemLat, lng: b.origemLng, picked: true } : null;
  S.dest = hasTrecho ? { name: b.destino, lat: b.destinoLat, lng: b.destinoLng, picked: true } : null;
  fOrig.value = hasTrecho ? b.origem : ''; fDest.value = hasTrecho ? b.destino : '';
  fTitulo.value = b.titulo || '';
  fUnit.value = b.unidade === 'm' ? 'm' : 'km';
  if (typeof b.distM === 'number' && hasTrecho) { const v = fUnit.value === 'km' ? b.distM / 1000 : b.distM; fDist.value = String(Math.round(v * 1000) / 1000).replace('.', ','); }
  else fDist.value = '';
  fFolga.value = String(b.folgaPct || 0); if (b.folgaPct) $('#adv').open = true;
  fArea.value = b.area || ''; fStatus.value = b.status; fObs.value = b.obs || '';
  fData.value = b.dataHora ? nowLocal(new Date(b.dataHora)) : nowLocal();
  updateHint('origin'); updateHint('dest');
  {
    // marcado por ponto (GPS, mapa, coordenadas) ou importado do KMZ antigo: edita como ponto
    if (!hasTrecho) { fOrig.value = b.origem || ''; fDest.value = b.destino || ''; }
    if (typeof b.distM === 'number' && !hasTrecho) { const v = fUnit.value === 'km' ? b.distM / 1000 : b.distM; fDist.value = String(Math.round(v * 1000) / 1000).replace('.', ','); }
    const fonte = ['gps', 'mapa', 'coord', 'rota'].includes(b.metodo) ? b.metodo : 'mapa';
    S.ponto = { lat: b.lat, lng: b.lng, fonte, acc: b.precisaoM || null };
    setModo(fonte === 'rota' ? 'mapa' : fonte, { keepPonto: true, noAuto: true });
  }
  map.setView([b.lat, b.lng], Math.max(map.getZoom(), 14));
  $('.panel').scrollTo && $('.panel').scrollTo({ top: 0, behavior: 'smooth' });
}

