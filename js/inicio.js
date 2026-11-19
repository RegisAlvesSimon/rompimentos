// Rompimentos — Começa o app: escolhe o modo (site, Claude ou só no aparelho).
'use strict';

async function init() {
  fData.value = nowLocal();
  let modo0 = 'gps'; try { modo0 = localStorage.getItem('romp-modo') || 'gps'; } catch (_) {}
  setModo(modo0, { noAuto: true });
  renderResult(); renderList();
  if (location.protocol !== 'file:' && isSite()) { await initFirebase(); return; }
  if (location.protocol !== 'file:' && await waitClaude(2000)) {
    S.inClaude = true;
    let db = null;
    try { db = await window.claude.use('db'); } catch (_) {}
    if (db) {
      try { await initCloud(db); return; } catch (e) { console.error(e); }
    }
    const dl = await window.claude.use('downloads').catch(() => null); S.api.downloads = dl;
  }
  await initLocal();
}
// Ferramenta de diagnóstico da rede (só aparece com ?debug no endereço)
if (/[?&]debug\b/.test(location.search)) window.__romp = { S, map, computeRoute, getNet, nearestSeg, buildNet, hav, applyBase, checarNovos, mostrarAviso };
init();
