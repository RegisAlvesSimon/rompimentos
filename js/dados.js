// Rompimentos — Onde os dados ficam: aparelho (IndexedDB), artefato do Claude e mapa base salvo.
'use strict';

/* ================= armazenamento ================= */
const IDB = (() => {
  let dbp = null; const mem = {};
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    try { const r = indexedDB.open('rompimentos', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
    catch (e) { rej(e); }
  }));
  return {
    async get(k) { try { const db = await open(); return await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); } catch (_) { return mem[k]; } },
    async set(k, v) { mem[k] = v; try { const db = await open(); await new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (_) {} }
  };
})();

const bodyOf = b => { const body = JSON.parse(JSON.stringify(b)); delete body.id; return body; };
const Store = {
  async save(b) {
    if (S.mode === 'cloud') { await S.api.db.collection('rompimentos').doc(b.id).set(bodyOf(b)); return; }
    if (S.mode === 'firebase') {
      // Sem sinal, o Firestore guarda no aparelho e envia quando voltar; não esperamos o servidor responder.
      const p = S.api.fs.collection('rompimentos').doc(b.id).set(bodyOf(b));
      if (navigator.onLine) await p; else { p.catch(handleWriteError); toast('Sem sinal: salvo no aparelho, envia quando voltar.'); }
      return;
    }
    const i = S.breaks.findIndex(x => x.id === b.id);
    S.breaks = i >= 0 ? S.breaks.map(x => x.id === b.id ? b : x) : [...S.breaks, b];
    await IDB.set('breaks', S.breaks); renderAll();
  },
  async saveMany(list) {
    if (S.mode === 'firebase') {
      const fs = S.api.fs;
      for (let i = 0; i < list.length; i += 400) {
        const batch = fs.batch();
        list.slice(i, i + 400).forEach(b => batch.set(fs.collection('rompimentos').doc(b.id), bodyOf(b)));
        await batch.commit();
      }
      return;
    }
    if (S.mode === 'local') {
      const map = new Map(S.breaks.map(b => [b.id, b])); list.forEach(b => map.set(b.id, b));
      S.breaks = [...map.values()]; await IDB.set('breaks', S.breaks); renderAll(); return;
    }
    for (const b of list) await Store.save(b);
  },
  async remove(id) {
    if (S.mode === 'cloud') { await S.api.db.collection('rompimentos').doc(id).delete(); return; }
    if (S.mode === 'firebase') {
      const p = S.api.fs.collection('rompimentos').doc(id).delete();
      if (navigator.onLine) await p; else p.catch(handleWriteError);
      return;
    }
    S.breaks = S.breaks.filter(x => x.id !== id); await IDB.set('breaks', S.breaks); renderAll();
  },
  async saveBase(text, nome) {
    const meta = { nome, enviadoEm: new Date().toISOString(), tamanho: text.length };
    if (S.mode === 'firebase') {
      // KMZ guardado no Firestore em partes compactadas (gzip + base64), cada uma abaixo de 1 MB
      setLoading('Enviando o mapa base…');
      const fs = S.api.fs, ref = fs.collection('config').doc('base');
      const b64 = await gzipB64(text), PART = 900000, n = Math.ceil(b64.length / PART);
      const versao = Date.now();
      for (let i = 0; i < n; i++) await ref.collection('partes').doc('p' + String(i).padStart(3, '0')).set({ v: versao, d: b64.slice(i * PART, (i + 1) * PART) });
      const old = await ref.collection('partes').get();
      for (const d of old.docs) if (+d.id.slice(1) >= n) await d.ref.delete();
      S.baseVersao = versao;
      await IDB.set('fbBase', { versao, kml: text });
      applyBase(text, meta);
      await ref.set(Object.assign({ versao, partes: n, enviadoPor: S.userEmail || null }, meta));
      return;
    }
    if (S.mode === 'cloud') {
      const old = S.baseAssetId;
      const up = await S.api.assets.upload(new Blob([text], { type: 'text/plain' }), { type: 'text/plain' });
      S.baseAssetId = up.id;
      applyBase(text, meta);
      await S.api.db.doc('config/base').set(Object.assign({ assetId: up.id, enviadoPor: S.userId || null }, meta));
      if (old && old !== up.id) S.api.assets.delete(old).catch(() => {});
      return;
    }
    await IDB.set('base', { kml: text, meta }); applyBase(text, meta);
  }
};

function setChip(text, cls) { const c = $('#modeChip'); c.textContent = text; c.className = 'chip' + (cls ? ' ' + cls : ''); }
function applyPerms() {
  $('#roNote').hidden = S.canWrite;
  $('#saveBtn').disabled = !S.canWrite;
  renderList();
}
function shareInfo() {
  const el = $('#shareText');
  if (S.mode === 'firebase') {
    el.innerHTML = `<p>Mande o link deste site para a pessoa:</p>
      <p><b class="mono" style="overflow-wrap:anywhere">${esc(location.origin + location.pathname)}</b> <button type="button" class="btn sm" data-copy="${esc(location.origin + location.pathname)}">Copiar link</button></p>
      <p>${S.isAdmin ? 'Depois libere o e-mail dela em <b>Quem pode entrar</b>, logo abaixo. Ela não precisa de conta no Claude.' : 'O responsável precisa liberar o e-mail dela antes.'}</p>`;
  } else if (S.mode === 'cloud') {
    el.innerHTML = `<p>Esta página está <b>online</b>: todo mundo que abre o link vê os mesmos rompimentos, na hora.</p>
      <p>Para mandar para alguém, use o botão <b>Compartilhar</b> no topo da página do Claude. Quem você convidar por e-mail como <b>Editor</b> também pode marcar rompimentos. Quem só tem o link consegue ver, mas não salvar.</p>`;
  } else {
    el.innerHTML = `<p>Esta cópia guarda os rompimentos <b>só neste aparelho</b>.</p>
      <p>Para passar para outra pessoa, baixe o <b>KMZ só com os rompimentos</b> e mande pelo WhatsApp ou e-mail. Ela pode abrir no Google Earth, ou carregar o arquivo aqui na aba Mapa base para importar os rompimentos.</p>`;
  }
  $('#expHint').textContent = S.inClaude
    ? 'Aqui no Claude o arquivo vem dentro de um .zip. Abra o .zip e arraste o .kmz para o Google Earth.'
    : 'No Google Earth: Arquivo › Abrir (ou Projetos › Abrir › Importar arquivo KML). Os rompimentos ficam na pasta “Rompimentos” e o nome de cada um tem as cidades, então a busca do Earth também acha.';
}

async function waitClaude(ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (window.claude && typeof window.claude.use === 'function') return true; await new Promise(r => setTimeout(r, 100)); }
  return !!(window.claude && typeof window.claude.use === 'function');
}
async function initLocal() {
  S.mode = 'local';
  setChip(S.inClaude ? 'Neste navegador' : 'Salvo neste aparelho', 'local');
  if (!S.inClaude) addTiles(); else { $('#mapHint').hidden = false; addMunicipios(); }
  const breaks = await IDB.get('breaks');
  S.breaks = Array.isArray(breaks) ? breaks.map(cleanBreak).filter(Boolean) : [];
  const base = await IDB.get('base');
  if (base && base.kml) applyBase(base.kml, base.meta); else updateBaseInfo();
  renderAll(); shareInfo();
}
async function initCloud(db) {
  S.mode = 'cloud'; S.api.db = db;
  $('#mapHint').hidden = false; addMunicipios();
  const use = n => window.claude.use(n).catch(() => null);
  const [user, assets, downloads] = await Promise.all([use('user'), use('assets'), use('downloads')]);
  S.api.user = user; S.api.assets = assets; S.api.downloads = downloads;
  S.canBase = !!assets;
  if (user) {
    try { S.userId = await user.id(); } catch (_) {}
    try { const c = await user.can('data.write'); if (c === false) S.canWrite = false; } catch (_) {}
  }
  setChip('Online · compartilhado', 'cloud');
  applyPerms(); updateBaseInfo(); shareInfo();
  let loaded = false;
  const timer = setTimeout(() => { if (!loaded) toast('Ainda buscando os rompimentos… confira a internet.'); }, 10000);
  db.collection('rompimentos').onSnapshot(snap => {
    if (!snap.metadata.fromCache) { loaded = true; clearTimeout(timer); }
    S.breaks = snap.docs.map(d => cleanBreak(Object.assign({}, d.data(), { id: d.id }))).filter(Boolean);
    renderAll();
  }, err => { clearTimeout(timer); toast('A conexão com os dados caiu (' + err.code + '). Recarregue a página.'); });
  db.doc('config/base').onSnapshot(async s => {
    if (!s.exists) { updateBaseInfo(); return; }
    const d = s.data();
    if (d.assetId && d.assetId !== S.baseAssetId) {
      S.baseAssetId = d.assetId;
      $('#baseName').textContent = 'Abrindo mapa base…';
      try {
        let text = null;
        const cache = await IDB.get('baseCache');
        if (cache && cache.assetId === d.assetId && cache.kml) text = cache.kml;
        if (!text) {
          setLoading('Baixando a rede do KMZ (15 MB)… só na primeira vez');
          const r = await fetch('/_blob/' + d.assetId); if (!r.ok) throw new Error(r.status);
          text = await r.text();
          IDB.set('baseCache', { assetId: d.assetId, kml: text });
        }
        setLoading('Desenhando a rede…');
        await new Promise(res => setTimeout(res, 30));
        applyBase(text, Object.assign({}, d));
      }
      catch (e) { setLoading(''); toast('Não consegui abrir o mapa base salvo.'); updateBaseInfo(); }
    } else { S.baseMeta = Object.assign({}, d); updateBaseInfo(); }
  }, () => {});
}

