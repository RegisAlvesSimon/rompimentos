// Rompimentos — Modo site: Firebase (login, permissões, quem está online, avisos), versão nova e instalar o app.
'use strict';

/* ================= modo site (GitHub Pages + Firebase) ================= */
const FB_CONFIG = {
  apiKey: 'AIzaSyDTwrJlSpVcQCsW6y4jJv8j90EmLo5TO-8',
  authDomain: 'rompimentos-8e475.firebaseapp.com',
  projectId: 'rompimentos-8e475',
  storageBucket: 'rompimentos-8e475.firebasestorage.app',
  messagingSenderId: '932804316170',
  appId: '1:932804316170:web:c4c521210885ff6685e3f3'
};
const FB_VER = '10.12.2';
const isSite = () => /github\.io$/.test(location.hostname) || /[?&]firebase\b/.test(location.search);
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('falha ao carregar ' + src)); document.head.appendChild(s); });
}
async function gzipB64(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const u = new Uint8Array(await new Response(stream).arrayBuffer());
  let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
async function gunzipB64(b64) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
const subs = [];
let presencaHb = null, presencaUid = null;
function stopSubs() { while (subs.length) { try { subs.pop()(); } catch (_) {} } }
function showLogin(msg, warn) {
  stopSubs(); clearInterval(presencaHb); presencaUid = null;
  S.breaks = []; renderAll();
  const m = $('#loginMsg'); m.textContent = msg || 'Use a conta que foi liberada para ver e marcar os rompimentos.'; m.className = 'hint' + (warn ? ' warn' : '');
  $('#login').hidden = false; $('#sairBtn').hidden = !warn; $('#acessoBox').hidden = true;
  $('#lgVerif').hidden = true; $('#loginForm').hidden = false; $('#googleBtn').hidden = false; $('.login-sep').hidden = false;
  setChip('Não conectado', 'local');
}
function showVerificar(email, verificado) {
  stopSubs(); S.breaks = []; renderAll();
  const m = $('#loginMsg');
  m.innerHTML = verificado
    ? `Seu pedido de acesso para <b>${esc(email)}</b> foi enviado ao responsável. Quando ele aprovar, toque no botão abaixo.`
    : `Falta um passo para <b>${esc(email)}</b>. Tem dois jeitos:<br>
    <b>1.</b> Abrir o e-mail de confirmação que enviamos e tocar no link. No Hotmail/Outlook ele costuma cair no <b>Lixo Eletrônico</b>; procure por “rompimentos”.<br>
    <b>2.</b> Ou pedir ao responsável para <b>aprovar</b> seu acesso no app (o pedido já foi enviado para ele).<br>
    Depois, toque no botão abaixo.`;
  m.className = 'hint';
  $('#lgJaConfirmei').textContent = verificado ? 'Já fui aprovado, entrar' : 'Já confirmei ou fui aprovado, entrar';
  $('#lgReenviar').hidden = !!verificado;
  $('#login').hidden = false; $('#lgVerif').hidden = false;
  $('#loginForm').hidden = true; $('#googleBtn').hidden = true; $('.login-sep').hidden = true;
  $('#sairBtn').hidden = true; $('#acessoBox').hidden = true;
  setChip('Confirmar e-mail', 'local');
}
let criando = false;
function setCriar(on) {
  criando = on;
  $('#lgSenha2Box').hidden = !on; $('#lgSenhaHint').hidden = !on; $('#lgReset').hidden = on;
  $('#lgEntrar').textContent = on ? 'Criar senha' : 'Entrar';
  $('#lgModo').textContent = on ? 'Já tenho senha: entrar' : 'Primeiro acesso: criar senha';
  $('#lgSenha').autocomplete = on ? 'new-password' : 'current-password';
}
// Versão do app: ao voltar para o app, confere se o site tem versão mais nova e oferece atualizar
function checarVersao() {
  if (!navigator.onLine) return;
  fetch(location.pathname + '?versao=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.text() : '').then(t => {
    const m = t.match(/APP_VERSAO = '([^']+)'/);
    if (m && m[1] !== APP_VERSAO) $('#novaVersao').hidden = false;
  }).catch(() => {});
}
function setupPwa() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
  $('#novaVersaoBtn').addEventListener('click', () => location.reload());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checarVersao(); });
  setTimeout(checarVersao, 15000);
  const btn = $('#instalarBtn');
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) return;
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; btn.hidden = false; });
  window.addEventListener('appinstalled', () => { btn.hidden = true; toast('App instalado. Procure o ícone Rompimentos na tela inicial.'); });
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios) btn.hidden = false;
  btn.addEventListener('click', async () => {
    if (deferred) { deferred.prompt(); try { await deferred.userChoice; } catch (_) {} deferred = null; btn.hidden = true; }
    else if (ios) toast('No iPhone: toque em Compartilhar (□↑) e depois em “Adicionar à Tela de Início”.');
    else toast('No menu do navegador (⋮), toque em “Instalar app” ou “Adicionar à tela inicial”.');
  });
}
function setupOnline() {
  const upd = () => {
    if (S.mode !== 'firebase' || !S.userEmail) return;
    if (navigator.onLine) setChip('Online · ' + S.userEmail, 'cloud');
    else setChip('Sem sinal · salva no aparelho', 'local');
  };
  window.addEventListener('online', () => { upd(); toast('Sinal de volta: enviando o que foi marcado.'); });
  window.addEventListener('offline', () => { upd(); toast('Sem sinal. Pode continuar marcando; envia quando voltar.'); });
  S.updOnline = upd;
}
async function initFirebase() {
  S.mode = 'firebase';
  addTiles(); setChip('Conectando…');
  setupPwa(); setupOnline();
  try { for (const f of ['app', 'auth', 'firestore']) await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-${f}-compat.js`); }
  catch (e) { toast('Sem conexão para entrar. Confira a internet e recarregue.'); setChip('Sem conexão', 'local'); return; }
  firebase.initializeApp(FB_CONFIG);
  const fs = firebase.firestore(), auth = firebase.auth();
  try { await fs.enablePersistence({ synchronizeTabs: true }); } catch (_) {}
  S.api.fs = fs; S.api.auth = auth;
  $('#googleBtn').addEventListener('click', async () => {
    const prov = new firebase.auth.GoogleAuthProvider(); prov.setCustomParameters({ prompt: 'select_account' });
    try { await auth.signInWithPopup(prov); }
    catch (e) {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) { try { await auth.signInWithRedirect(prov); } catch (_) {} }
      else if (e && e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') toast('Não foi possível entrar com Google (' + (e.code || 'erro') + ').');
    }
  });
  auth.languageCode = 'pt-BR';
  const voltar = { url: location.origin + location.pathname };
  $('#lgModo').addEventListener('click', () => setCriar(!criando));
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const em = $('#lgEmail').value.trim(), s1 = $('#lgSenha').value;
    if (!em) { toast('Digite seu e-mail.'); $('#lgEmail').focus(); return; }
    if (criando) {
      if (s1.length < 6) { toast('A senha precisa ter pelo menos 6 caracteres.'); return; }
      if (s1 !== $('#lgSenha2').value) { toast('As duas senhas não estão iguais.'); return; }
      try {
        const cred = await auth.createUserWithEmailAndPassword(em, s1);
        $('#lgSenha').value = $('#lgSenha2').value = ''; setCriar(false);
        try { await cred.user.sendEmailVerification(voltar); }
        catch (err2) { toast('Senha criada, mas o e-mail de confirmação não saiu (' + ((err2 && err2.code) || 'erro') + '). Peça ao responsável para aprovar seu acesso.'); }
      } catch (err) {
        const c = (err && err.code) || '';
        if (c === 'auth/email-already-in-use') { setCriar(false); toast('Esse e-mail já tem senha. Entre com ela, ou use “Esqueci a senha”. Se for conta Google, use “Entrar com Google”.'); }
        else if (c === 'auth/invalid-email') toast('E-mail inválido.');
        else if (c === 'auth/weak-password') toast('Senha fraca. Use pelo menos 6 caracteres.');
        else toast('Não foi possível criar a senha (' + (c || 'erro') + ').');
      }
      return;
    }
    try { await auth.signInWithEmailAndPassword(em, s1); }
    catch (err) { toast(err && /wrong-password|invalid-credential|user-not-found|invalid-login/.test(err.code || '') ? 'E-mail ou senha incorretos. No primeiro acesso, toque em “Primeiro acesso: criar senha”.' : 'Não foi possível entrar (' + ((err && err.code) || 'erro') + ').'); }
  });
  $('#lgJaConfirmei').addEventListener('click', async () => {
    const u = auth.currentUser; if (!u) { showLogin(); return; }
    try { await u.reload(); await auth.currentUser.getIdToken(true); } catch (_) {}
    S.tentouEntrar = true;
    startSession(auth.currentUser);
  });
  $('#lgReenviar').addEventListener('click', async () => {
    const u = auth.currentUser; if (!u) return;
    try { await u.sendEmailVerification(voltar); toast('Link reenviado para ' + u.email + '.'); }
    catch (err) { toast((err && err.code) === 'auth/too-many-requests' ? 'Muitos envios seguidos. Espere alguns minutos.' : 'Não foi possível reenviar agora (' + ((err && err.code) || 'erro') + ').'); }
  });
  $('#lgOutra').addEventListener('click', () => auth.signOut());
  $('#lgReset').addEventListener('click', async () => {
    const em = $('#lgEmail').value.trim(); if (!em) { toast('Digite seu e-mail primeiro.'); $('#lgEmail').focus(); return; }
    try { await auth.sendPasswordResetEmail(em); toast('Se esse e-mail tiver conta, chega um link para criar nova senha.'); } catch (_) { toast('Não foi possível enviar o e-mail agora.'); }
  });
  $('#sairBtn').addEventListener('click', async () => {
    clearInterval(presencaHb);
    if (presencaUid) { try { await S.api.fs.collection('presenca').doc(presencaUid).set({ email: S.userEmail, ativo: false, visto: firebase.firestore.FieldValue.serverTimestamp() }); } catch (_) {} }
    presencaUid = null; auth.signOut();
  });
  auth.onAuthStateChanged(u => { if (u) startSession(u); else showLogin(); });
}
async function startSession(u) {
  const fs = S.api.fs, email = (u.email || '').toLowerCase();
  // Conta com senha entra depois de confirmar o e-mail OU de o responsável aprovar (as regras do Firebase decidem).
  S.userId = u.uid; S.userEmail = email; S.isAdmin = false; S.isDono = false;
  try {
    // Só quem tem acesso consegue ler a própria entrada. O responsável (definido nas regras do Firebase)
    // consegue ler mesmo antes de existir a entrada, e então ela é criada como administrador.
    const ref = fs.collection('permitidos').doc(email);
    const d = await ref.get({ source: 'server' }).catch(() => ref.get());
    // dono = o responsável (só ele pode gravar “dono” na lista, as regras garantem); editor = só marca rompimentos novos
    if (d.exists) { S.isAdmin = d.data().admin === true; S.isDono = d.data().dono === true; }
    else { await ref.set({ admin: true, dono: true, liberadoEm: new Date().toISOString() }); S.isAdmin = true; S.isDono = true; }
  } catch (_) {
    if (!email) { showLogin('Essa conta não tem e-mail. Entre com outra conta.', true); return; }
    // Sem acesso ainda: registra o pedido para o responsável aprovar (vale para Google e para e-mail/senha)
    fs.collection('pedidos').doc(u.uid).set({ email, pedidoEm: new Date().toISOString(), google: !!u.emailVerified }).catch(() => {});
    showVerificar(email, u.emailVerified);
    if (S.tentouEntrar) toast(u.emailVerified ? 'Ainda não foi aprovado.' : 'Ainda não foi confirmado nem aprovado.');
    S.tentouEntrar = false;
    return;
  }
  S.tentouEntrar = false;
  $('#login').hidden = true; $('#sairBtn').hidden = false;
  // Responsável: faz tudo. Editor: só marca rompimentos novos (não edita, não exclui, não muda mapa nem acessos). Demais: só consultam.
  S.canWrite = S.isAdmin; S.canEdit = S.isDono; S.canBase = S.isDono;
  $('#roNote').textContent = 'Você pode consultar e pesquisar. Só o responsável marca e edita rompimentos.';
  $('#t-marcar').hidden = !S.isAdmin;
  if (!S.isAdmin) showTab('pesquisar');
  setChip('Online · ' + email, 'cloud'); if (S.updOnline) S.updOnline();
  applyPerms(); updateBaseInfo(); shareInfo();
  iniciarPresenca(u.uid, email);
  atualizarAvisosCard();
  // Avisa a pessoa quando o responsável muda o acesso dela (ex.: virou editor) e já aplica na hora
  subs.push(fs.collection('permitidos').doc(email).onSnapshot(s => {
    if (!s.exists) return;
    const d = s.data(), papel = d.dono === true ? 'dono' : d.admin === true ? 'editor' : 'consulta';
    const key = 'romp-papel-' + u.uid, ant = lsGet(key); lsSet(key, papel);
    if (papel !== 'dono' && ((ant && ant !== papel) || (!ant && papel === 'editor'))) {
      const msg = papel === 'editor' ? 'Agora você é editor: pode marcar rompimentos novos na aba Marcar.' : 'Seu acesso mudou para só consulta.';
      mostrarAviso(msg, papel === 'editor' ? () => showTab('marcar') : null);
      notificar('Seu acesso mudou', msg, 'papel');
    }
    if (papel !== 'dono' && S.isAdmin !== (papel === 'editor')) {
      S.isAdmin = papel === 'editor'; S.canWrite = S.isAdmin;
      $('#t-marcar').hidden = !S.isAdmin; if (!S.isAdmin && !$('#p-marcar').hidden) showTab('pesquisar');
      applyPerms(); renderAll();
    }
  }, () => {}));
  let loaded = false;
  const timer = setTimeout(() => { if (!loaded) toast('Ainda buscando os rompimentos… confira a internet.'); }, 10000);
  subs.push(fs.collection('rompimentos').onSnapshot({ includeMetadataChanges: false }, snap => {
    loaded = true; clearTimeout(timer);
    S.breaks = snap.docs.map(d => cleanBreak(Object.assign({}, d.data(), { id: d.id }))).filter(Boolean);
    renderAll();
    checarNovos();
  }, err => { clearTimeout(timer); toast('A conexão com os dados caiu (' + (err.code || 'erro') + '). Recarregue a página.'); }));
  subs.push(fs.collection('config').doc('base').onSnapshot(async s => {
    if (!s.exists) { updateBaseInfo(); return; }
    const d = s.data();
    if (d.versao && d.versao !== S.baseVersao) {
      S.baseVersao = d.versao;
      try {
        let text = null;
        const cache = await IDB.get('fbBase');
        if (cache && cache.versao === d.versao && cache.kml) text = cache.kml;
        if (!text) {
          setLoading('Baixando a rede do KMZ… só na primeira vez');
          const ps = await fs.collection('config').doc('base').collection('partes').get();
          const parts = ps.docs.filter(x => x.data().v === d.versao).sort((a, b) => a.id.localeCompare(b.id)).map(x => x.data().d);
          if (parts.length !== d.partes) throw new Error('partes incompletas');
          text = await gunzipB64(parts.join(''));
          IDB.set('fbBase', { versao: d.versao, kml: text });
        }
        setLoading('Desenhando a rede…');
        await new Promise(res => setTimeout(res, 30));
        applyBase(text, d);
      } catch (e) { console.error(e); setLoading(''); toast('Não consegui abrir o mapa base salvo.'); updateBaseInfo(); }
    } else { S.baseMeta = d; updateBaseInfo(); }
  }, () => {}));
  if (S.isDono) {
    $('#acessoBox').hidden = false;
    subs.push(fs.collection('permitidos').onSnapshot(snap => { S.acessos = snap.docs.map(d => Object.assign({ email: d.id }, d.data())); renderAcessos(); }, () => {}));
    let pedidosIni = true;
    subs.push(fs.collection('pedidos').onSnapshot(snap => {
      S.pedidos = snap.docs.map(d => Object.assign({ uid: d.id }, d.data())); renderAcessos();
      if (!pedidosIni) snap.docChanges().filter(c => c.type === 'added').forEach(c => {
        const em = c.doc.data().email || 'alguém';
        mostrarAviso(`Pedido de acesso: ${em}`, () => { showTab('base'); $('#acessoBox').scrollIntoView({ behavior: 'smooth' }); });
        notificar('Pedido de acesso', `${em} pediu para entrar no app.`, 'pedido-' + c.doc.id);
      });
      pedidosIni = false;
    }, () => {}));
    subs.push(fs.collection('presenca').onSnapshot(snap => {
      S.presenca = {}; S.presencaUid = {};
      snap.docs.forEach(d => { const x = d.data(); if (!x.email) return; S.presencaUid[d.id] = x.email; const t = x.visto && x.visto.toMillis ? x.visto.toMillis() : 0; const cur = S.presenca[x.email]; if (!cur || t > cur.t) S.presenca[x.email] = { t, ativo: x.ativo === true }; });
      renderAcessos();
    }, () => {}));
    if (!S.presencaTimer) S.presencaTimer = setInterval(() => { if (!$('#p-base').hidden) renderAcessos(); }, 30000);
  } else $('#acessoBox').hidden = true;
}
/* ---- quem está com o app aberto: cada um avisa a cada minuto; só o responsável vê a lista ---- */
function iniciarPresenca(uid, email) {
  const fs = S.api.fs, FV = firebase.firestore.FieldValue;
  presencaUid = uid;
  const ref = fs.collection('presenca').doc(uid);
  const bater = ativo => {
    if (!firebase.auth().currentUser || firebase.auth().currentUser.uid !== uid) { clearInterval(presencaHb); return; }
    ref.set({ email, ativo, visto: FV.serverTimestamp() }).catch(() => {});
  };
  clearInterval(presencaHb);
  const ligar = () => { clearInterval(presencaHb); bater(true); presencaHb = setInterval(() => bater(true), 60000); };
  if (document.visibilityState !== 'hidden') ligar();
  if (!S.presencaEventos) {
    S.presencaEventos = true;
    document.addEventListener('visibilitychange', () => {
      if (!presencaUid) return;
      if (document.visibilityState === 'hidden') { clearInterval(presencaHb); fs.collection('presenca').doc(presencaUid).set({ email: S.userEmail, ativo: false, visto: FV.serverTimestamp() }).catch(() => {}); }
      else if (presencaUid === (firebase.auth().currentUser || {}).uid) iniciarPresenca(presencaUid, S.userEmail);
    });
  }
}
/* ---- avisos: faixa no app + notificação do celular (quando permitida) ---- */
const lsGet = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
let avisoAcao = null, avisoOk = null;
function mostrarAviso(txt, ver, ok) {
  $('#avisoTxt').textContent = txt;
  avisoAcao = ver || null; avisoOk = ok || null;
  $('#avisoVer').hidden = !ver; $('#aviso').hidden = false;
}
$('#avisoVer').addEventListener('click', () => { $('#aviso').hidden = true; const f = avisoAcao; avisoAcao = null; if (avisoOk) avisoOk(); if (f) f(); });
$('#avisoOk').addEventListener('click', () => { $('#aviso').hidden = true; if (avisoOk) avisoOk(); avisoAcao = avisoOk = null; });
function notificar(titulo, corpo, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const op = { body: corpo, tag: tag || 'romp', icon: 'icon-192.png?v=2', badge: 'icon-192.png?v=2' };
  const simples = () => { try { new Notification(titulo, op); } catch (_) {} };
  if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then(r => r ? r.showNotification(titulo, op) : simples()).catch(simples);
  else simples();
}
function atualizarAvisosCard() {
  const card = $('#avisosCard'); if (S.mode !== 'firebase' || !S.userId) { card.hidden = true; return; }
  card.hidden = false;
  const oque = S.isDono ? 'quando alguém marcar um rompimento novo ou pedir acesso' : 'quando o responsável mudar o seu acesso (ex.: virar editor)';
  const btn = $('#avisosBtn'), h = $('#avisosHint');
  if (!('Notification' in window)) { btn.hidden = true; h.textContent = `O app avisa ${oque} com uma faixa no topo. Neste aparelho o aviso do sistema não funciona (no iPhone, instale o app na tela inicial).`; return; }
  const p = Notification.permission;
  btn.hidden = p !== 'default';
  h.textContent = p === 'granted' ? `Avisos ligados: o celular avisa ${oque} enquanto o app estiver aberto ou em segundo plano. Com o app fechado, o aviso aparece quando você abrir.`
    : p === 'denied' ? `Os avisos foram bloqueados neste navegador. Para ligar, libere as notificações deste site nas configurações. A faixa no topo do app continua avisando ${oque}.`
    : `Toque em “Ativar avisos” para o celular avisar ${oque}.`;
}
$('#avisosBtn').addEventListener('click', async () => { try { await Notification.requestPermission(); } catch (_) {} atualizarAvisosCard(); if (Notification.permission === 'granted') notificar('Avisos ligados', 'Pronto, este aparelho vai receber os avisos do Rompimentos.', 'teste'); });

// Para o responsável: rompimentos novos marcados por outras pessoas desde a última vez que ele viu
const jaNotificados = new Set();
function emailDoUid(uid) {
  const a = (S.acessos || []).find(x => x.uid === uid); if (a) return a.email;
  return (S.presencaUid || {})[uid] || 'um editor';
}
function checarNovos() {
  if (!S.isDono || !S.userId) return;
  const key = 'romp-visto-' + S.userId;
  let visto = lsGet(key);
  if (!visto) { lsSet(key, new Date().toISOString()); return; }
  const novos = S.breaks.filter(b => b.criadoPor && b.criadoPor !== S.userId && String(b.criadoEm || '') > visto)
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
  if (!novos.length) { if (S.avisoTipo === 'novos') { $('#aviso').hidden = true; S.avisoTipo = null; } return; }
  const quem = [...new Set(novos.map(b => emailDoUid(b.criadoPor)))].join(', ');
  const txt = novos.length === 1 ? `Rompimento novo: ${novos[0].titulo || titleOf(novos[0])} (marcado por ${quem})` : `${novos.length} rompimentos novos marcados por ${quem}`;
  const marcarVisto = () => { lsSet(key, novos[0].criadoEm); S.avisoTipo = null; };
  S.avisoTipo = 'novos';
  mostrarAviso(txt, () => { showTab('pesquisar'); focusBreak(novos[0].id, true); }, marcarVisto);
  const ineditos = novos.filter(b => !jaNotificados.has(b.id)); ineditos.forEach(b => jaNotificados.add(b.id));
  if (ineditos.length && document.visibilityState === 'hidden') notificar('Rompimento novo', txt, 'novos');
}
function textoPresenca(email) {
  const p = (S.presenca || {})[email]; if (!p || !p.t) return '<span class="pres off">sem registro ainda</span>';
  const min = (Date.now() - p.t) / 60000;
  if (p.ativo && min < 2.5) return '<span class="pres on">online agora</span>';
  const txt = min < 60 ? `visto há ${Math.max(1, Math.round(min))} min` : min < 1440 ? `visto há ${Math.round(min / 60)} h` : min < 2880 ? 'visto ontem' : `visto em ${new Date(p.t).toLocaleDateString('pt-BR')}`;
  return `<span class="pres off">${txt}</span>`;
}
function renderAcessos() {
  const ul = $('#acessos');
  const lista = S.acessos || [], pedidos = (S.pedidos || []).filter(p => {
    const a = lista.find(x => x.email === p.email); return !(a && a.uid === p.uid);
  });
  const rowsP = pedidos.map(p => {
    const lib = lista.some(x => x.email === p.email);
    return `<li class="pedido"><span><b>${esc(p.email)}</b> <small>· pediu acesso${p.google ? ' (Google)' : ''}${lib ? '' : ''}</small></span><span class="row"><button type="button" class="btn sm" data-aprovar="${esc(p.uid)}">Aprovar só consulta</button><button type="button" class="btn sm" data-aprovar="${esc(p.uid)}" data-editor="1">Aprovar como editor</button><button type="button" class="btn sm danger" data-recusar="${esc(p.uid)}">Recusar</button></span></li>`;
  });
  const rows = lista.slice().sort((a, b) => (b.admin === true) - (a.admin === true) || a.email.localeCompare(b.email)).map(p => {
    const eu = p.email === S.userEmail;
    return `<li><span>${textoPresenca(p.email)} ${esc(p.email)} <small>${eu ? '· você' : ''}${p.dono ? ' · <b>responsável</b>' : p.admin ? ' · <b>editor</b> (só marca novos)' : ' · só consulta'}</small></span>${eu ? '' : `<span class="row"><button type="button" class="btn sm" data-editor-toggle="${esc(p.email)}">${p.admin ? 'Tirar edição' : 'Dar edição'}</button><button type="button" class="btn sm danger" data-rm="${esc(p.email)}">Remover</button></span>`}</li>`;
  });
  ul.innerHTML = rowsP.join('') + rows.join('');
  const n = pedidos.length; const b = $('#badgeBase'); if (b) b.textContent = n ? String(n) : '';
}
$('#addAcesso').addEventListener('click', async () => {
  const em = $('#novoEmail').value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast('Digite um e-mail válido.'); return; }
  try { await S.api.fs.collection('permitidos').doc(em).set({ admin: $('#novoAdmin').checked, liberadoPor: S.userEmail, liberadoEm: new Date().toISOString() }); $('#novoEmail').value = ''; $('#novoAdmin').checked = false; toast('Acesso liberado para ' + em + '.'); }
  catch (e) { toast('Não foi possível liberar (' + ((e && e.code) || 'erro') + ').'); }
});
$('#acessos').addEventListener('click', async e => {
  const ap = e.target.closest('[data-aprovar]'), rc = e.target.closest('[data-recusar]');
  if (ap || rc) {
    const fs = S.api.fs, p = (S.pedidos || []).find(x => x.uid === (ap || rc).dataset[ap ? 'aprovar' : 'recusar']); if (!p) return;
    try {
      if (ap) {
        const editor = ap.dataset.editor === '1';
        await fs.collection('permitidos').doc(p.email).set({ admin: editor, uid: p.uid, aprovadoPor: S.userEmail, aprovadoEm: new Date().toISOString() }, { merge: true });
        toast(`Acesso aprovado para ${p.email} ${editor ? 'como editor' : '(só consulta)'}. A pessoa já pode entrar.`);
      } else toast('Pedido recusado.');
      await fs.collection('pedidos').doc(p.uid).delete();
    } catch (err) { toast('Não foi possível concluir (' + ((err && err.code) || 'erro') + ').'); }
    return;
  }
  const tg = e.target.closest('[data-editor-toggle]');
  if (tg) {
    const em = tg.dataset.editorToggle, atual = (S.acessos || []).find(x => x.email === em); if (!atual) return;
    try { await S.api.fs.collection('permitidos').doc(em).update({ admin: !(atual.admin === true) }); toast(atual.admin ? `${em} agora só consulta.` : `${em} agora pode marcar rompimentos novos.`); }
    catch (err) { toast('Não foi possível alterar (' + ((err && err.code) || 'erro') + ').'); }
    return;
  }
  const btn = e.target.closest('[data-rm]'); if (!btn) return;
  if (!armed.get(btn)) { armed.set(btn, true); btn.classList.add('armed'); btn.textContent = 'Confirmar'; setTimeout(() => { if (btn.isConnected) { armed.delete(btn); btn.classList.remove('armed'); btn.textContent = 'Remover'; } }, 4000); return; }
  try { await S.api.fs.collection('permitidos').doc(btn.dataset.rm).delete(); toast('Acesso removido.'); } catch (_) { toast('Não foi possível remover agora.'); }
});

