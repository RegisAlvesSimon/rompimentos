// Rompimentos — Abas, avisos rápidos (toast), copiar, abrir arquivo KMZ e exportar para o Google Earth.
'use strict';

/* ================= tabs, toast, copiar ================= */
function showTab(name) {
  $$('.tabs [data-tab]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  ['marcar', 'pesquisar', 'base'].forEach(n => { $('#p-' + n).hidden = n !== name; });
}
$$('.tabs [data-tab]').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
let toastTimer = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-copy]'); if (!b) return;
  const text = b.dataset.copy;
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Coordenadas copiadas.'); } catch (_) { toast(text); } ta.remove(); };
  try { navigator.clipboard.writeText(text).then(() => toast('Coordenadas copiadas.'), fallback); } catch (_) { fallback(); }
});
function handleWriteError(err) {
  const code = err && err.code;
  if (code === 'invalid_argument' || code === 'not_granted' || code === 'permission-denied') { S.canWrite = false; applyPerms(); toast('Seu acesso é só de leitura. Peça ao dono para te convidar como Editor.'); }
  else if (code === 'quota_exceeded') toast('O espaço de dados acabou. Exclua rompimentos antigos.');
  else toast('Não foi possível salvar agora. Tente de novo.');
  console.error(err);
}

/* ================= arquivos ================= */
async function readKmlFromFile(file) {
  const buf = await file.arrayBuffer(); const u8 = new Uint8Array(buf);
  if (u8[0] === 0x50 && u8[1] === 0x4b) {
    const zip = await JSZip.loadAsync(buf);
    const f = zip.file('doc.kml') || zip.file(/\.kml$/i)[0];
    if (!f) throw new Error('Não achei nenhum .kml dentro desse KMZ.');
    return await f.async('string');
  }
  return new TextDecoder('utf-8').decode(u8);
}
async function onFile(file) {
  if (!file) return;
  $('#uploadTitle').textContent = 'Lendo ' + file.name + '…';
  try {
    const text = await readKmlFromFile(file);
    const parsed = parseKml(text);
    const fresh = parsed.appBreaks.filter(b => !S.breaks.some(x => x.id === b.id));
    const hasMap = parsed.lines.length || parsed.points.length || parsed.polys.length;
    if (!hasMap && !parsed.appBreaks.length) throw new Error('Esse arquivo não tem rotas, pontos nem rompimentos.');
    if (hasMap) {
      if (!S.canBase && (S.mode === 'cloud' || S.mode === 'firebase')) {
        applyBase(stripAppFolder(text), { nome: file.name, enviadoEm: new Date().toISOString(), soSessao: true });
        toast('Mapa aberto só nesta tela. Só quem edita pode trocar o mapa de todos.');
      } else {
        await Store.saveBase(stripAppFolder(text), file.name);
        toast(`Mapa base salvo: ${parsed.lines.length} rotas e ${parsed.points.length} pontos.`);
      }
    }
    if (fresh.length) {
      if (S.canWrite) { setLoading(`Importando ${fresh.length} rompimentos…`); await Store.saveMany(fresh); setLoading(''); toast(`${fresh.length} rompimento(s) importado(s) do arquivo.`); }
      else toast('O arquivo tem rompimentos, mas seu acesso é só de leitura.');
    }
  } catch (err) {
    console.error(err); setLoading('');
    if (err && (err.code === 'permission-denied' || err.code === 'invalid_argument')) toast('Sua conta não tem permissão para trocar o mapa base.');
    else toast(err && err.message ? err.message : 'Não consegui ler esse arquivo.');
  } finally { updateBaseInfo(); $('#fileIn').value = ''; }
}
$('#fileIn').addEventListener('change', e => onFile(e.target.files[0]));
const drop = $('#drop');
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('drag'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('drag')));
drop.addEventListener('drop', e => { e.preventDefault(); onFile(e.dataTransfer.files[0]); });

function applyBase(text, meta) {
  try { folderCache = new Map(); S.parsed = parseKml(text); folderCache = new Map(); }
  catch (err) { toast(err.message); setLoading(''); return; }
  S.baseKml = text; S.baseMeta = meta || null;
  S.net = null; // a rede (grafo) é montada só quando for calcular um ponto
  buildPlaces(); renderBase(); renderAreaList(); renderList(); updateBaseInfo();
  setLoading('');
  updateHint('origin'); updateHint('dest');
  if (S.origin && S.dest) recalc({ keepManual: true, noPan: true });
}
function totalKm(lines) { let m = 0; for (const l of lines) for (let i = 1; i < l.coords.length; i++) m += hav(l.coords[i - 1], l.coords[i]); return m / 1000; }
function updateBaseInfo() {
  const el = $('#baseInfo'), P = S.parsed, M = S.baseMeta;
  $('#baseName').textContent = P ? ((M && M.nome) || P.docName || 'Mapa base') : 'Nenhum KMZ carregado';
  if (!P) {
    el.innerHTML = `<div class="empty-state" style="border:0;padding:0;background:none"><h3>Comece pelo seu KMZ</h3>
      <ol><li>Carregue aqui o KMZ que você já usa no Google Earth.</li><li>Na aba <b>Marcar</b>, escolha de onde, para onde e a distância.</li><li>O ponto do rompimento é calculado seguindo o traçado do cabo.</li><li>Baixe o KMZ com a pasta “Rompimentos” e abra no Google Earth.</li></ol></div>`;
  } else {
    const km = totalKm(P.lines);
    el.innerHTML = `<div><span class="lbl">Mapa base</span><div style="font-weight:600;font-size:15px;overflow-wrap:anywhere">${esc((M && M.nome) || P.docName || 'KMZ')}</div>
      ${M && M.enviadoEm ? `<div class="hint">${M.soSessao ? 'Aberto só nesta tela' : 'Salvo em ' + esc(fmtDate(M.enviadoEm))}</div>` : ''}</div>
      <div class="stats"><div class="stat"><b>${P.lines.length.toLocaleString('pt-BR')}</b><span>rotas</span></div>
      <div class="stat"><b>${km.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</b><span>km de cabo</span></div>
      <div class="stat"><b>${P.points.length.toLocaleString('pt-BR')}</b><span>pontos</span></div></div>`;
  }
  $('#uploadTitle').textContent = P ? 'Trocar KMZ' : 'Carregar meu KMZ';
  $('#uploadSub').textContent = (S.mode === 'cloud' || S.mode === 'firebase') && !S.canBase
    ? 'Você pode abrir um KMZ só para ver nesta tela. Só quem edita troca o mapa de todos.'
    : 'Toque para escolher o arquivo .kmz ou .kml (ou arraste aqui). Se ele tiver rompimentos exportados daqui, eles são importados.';
}

/* ================= exportar ================= */
const xesc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const cdata = s => String(s).replace(/]]>/g, ']]&gt;');
function titleOf(b) {
  const tr = [typeof b.distM === 'number' ? fmtDist(b.distM) : '', b.origem ? 'de ' + b.origem : '', b.destino ? '→ ' + b.destino : ''].filter(Boolean).join(' ');
  return [b.titulo, tr].filter(Boolean).join(' · ') || 'Rompimento';
}
function breaksFolderXml(list) {
  const style = (id, color) => `<Style id="${id}"><IconStyle><color>${color}</color><scale>1.2</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/caution.png</href></Icon></IconStyle><LabelStyle><scale>0.85</scale></LabelStyle></Style>`;
  const fields = b => [['Identificação', b.titulo], ['Origem', b.origem], ['Destino', b.destino], ['Distância da origem', fmtDist(b.distM)], ['Folga (%)', b.folgaPct || 0], ['Área', b.area], ['Situação', b.status === 'reparado' ? 'Reparado' : 'Aberto'], ['Data', fmtDate(b.dataHora)], ['Coordenadas', `${b.lat}, ${b.lng}`], ['Observação', b.obs]];
  const pm = b => {
    const f = fields(b);
    const desc = '<table>' + f.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('') + '</table>';
    return `<Placemark id="romp-${xesc(b.id)}"><name>${xesc(titleOf(b))}</name><description><![CDATA[${cdata(desc)}]]></description><styleUrl>#romp-${b.status === 'reparado' ? 'reparado' : 'aberto'}</styleUrl><ExtendedData>${f.map(([k, v]) => `<Data name="${xesc(k)}"><value>${xesc(v)}</value></Data>`).join('')}<Data name="romp_json"><value>${xesc(JSON.stringify(b))}</value></Data></ExtendedData><Point><coordinates>${b.lng},${b.lat},0</coordinates></Point></Placemark>`;
  };
  const open = list.filter(b => b.status !== 'reparado'), rep = list.filter(b => b.status === 'reparado');
  return `<Folder id="rompimentos-app"><name>Rompimentos</name><open>1</open>${style('romp-aberto', 'ff2a2ae6')}${style('romp-reparado', 'ff4c9e1e')}` +
    `<Folder><name>Abertos (${open.length})</name>${open.map(pm).join('')}</Folder>` +
    `<Folder><name>Reparados (${rep.length})</name><visibility>0</visibility>${rep.map(pm).join('')}</Folder></Folder>`;
}
function insertFolder(text, folder) {
  const t = stripAppFolder(text);
  const i = t.lastIndexOf('</Document>'); if (i >= 0) return t.slice(0, i) + folder + t.slice(i);
  const j = t.lastIndexOf('</kml>'); if (j >= 0) return t.slice(0, j) + '<Document>' + folder + '</Document>' + t.slice(j);
  return null;
}
async function exportKmz(list, full, label) {
  if (!list.length && !full) { toast('Não há rompimentos para exportar.'); return; }
  const folder = breaksFolderXml(list);
  let kml = full && S.baseKml ? insertFolder(S.baseKml, folder) : null;
  if (full && !S.baseKml) toast('Sem mapa base: o arquivo terá só os rompimentos.');
  if (!kml) kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Rompimentos</name>${folder}</Document></kml>`;
  const zip = new JSZip(); zip.file('doc.kml', kml);
  const kmz = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const d = new Date(), stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await deliver(`${label}_${stamp}.kmz`, kmz);
}
async function deliver(fname, blob) {
  if (S.inClaude) {
    const dl = S.api.downloads;
    if (!dl) { toast('Download indisponível nesta tela.'); return; }
    const zip = new JSZip(); zip.file(fname, blob);
    const z = await zip.generateAsync({ type: 'blob' });
    try { await dl.save({ filename: fname.replace(/\.kmz$/, '.zip'), data: z }); toast('Baixado. Abra o .zip e use o .kmz que está dentro.'); }
    catch (e) { if (e && e.code === 'declined') return; toast('Não foi possível baixar aqui (' + ((e && e.code) || 'erro') + ').'); }
    return;
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('KMZ baixado: ' + fname);
}
$('#expFull').addEventListener('click', () => exportKmz(S.breaks, true, 'rede_com_rompimentos'));
$('#expOnly').addEventListener('click', () => exportKmz(S.breaks, false, 'rompimentos'));
$('#expSearch').addEventListener('click', () => {
  const q = norm(S.filter.q).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  exportKmz(visibleBreaks(), false, 'rompimentos' + (q ? '_' + q : ''));
});

