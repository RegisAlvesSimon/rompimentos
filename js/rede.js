// Rompimentos — Rede de cabos como grafo: liga os traçados e calcula o caminho pela rede (Dijkstra).
'use strict';

/* ================= rede (grafo) ================= */
function buildNet(lines) {
  const nodes = [], lineOf = [], adj = [], segs = [], key = new Map(), ends = [];
  const node = (p, li) => {
    const k = p[0].toFixed(6) + ',' + p[1].toFixed(6);
    let i = key.get(k);
    if (i === undefined) { i = nodes.length; key.set(k, i); nodes.push(p); lineOf.push(li); adj.push([]); }
    else if (lineOf[i] !== li) lineOf[i] = -2;
    return i;
  };
  const edge = (a, b, w) => { adj[a].push(b, w); adj[b].push(a, w); };
  lines.forEach((ln, li) => {
    const c = ln.coords; let prev = -1, first = -1;
    for (let j = 0; j < c.length; j++) {
      const i = node(c[j], li);
      if (first < 0) first = i;
      if (prev >= 0 && prev !== i) { const w = hav(nodes[prev], nodes[i]); edge(prev, i, w); segs.push([prev, i, w, li]); }
      prev = i;
    }
    if (first >= 0) { ends.push([first, li]); ends.push([prev, li]); }
  });
  const C = 0.0005, gk = (y, x) => y + ':' + x;
  const ng = new Map();
  nodes.forEach((p, i) => { const k = gk(Math.floor(p[0] / C), Math.floor(p[1] / C)); let a = ng.get(k); if (!a) ng.set(k, a = []); a.push(i); });
  const sg = new Map();
  segs.forEach((s, si) => {
    const a = nodes[s[0]], b = nodes[s[1]];
    const y0 = Math.floor(Math.min(a[0], b[0]) / C), y1 = Math.floor(Math.max(a[0], b[0]) / C);
    const x0 = Math.floor(Math.min(a[1], b[1]) / C), x1 = Math.floor(Math.max(a[1], b[1]) / C);
    if ((y1 - y0 + 1) * (x1 - x0 + 1) > 2500) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = gk(y, x); let arr = sg.get(k); if (!arr) sg.set(k, arr = []); arr.push(si); }
  });
  // Emendas: cada ponta de cabo se liga a TODOS os outros cabos que passam a até SNAP metros
  // (antes era só ao mais próximo; com traçados duplicados no KMZ, a ponta se ligava à própria cópia
  // e ignorava o cabo vizinho — era isso que deixava trechos “soltos”).
  const SNAP = 35, TOQUE = 3, nOrig = nodes.length;
  let joins = 0;
  const ligado = new Set();
  const liga = (a, b, w) => { if (a === b) return; const k = a < b ? a + ':' + b : b + ':' + a; if (ligado.has(k)) return; ligado.add(k); edge(a, b, w); joins++; };
  for (const [n, li] of ends) {
    const p = nodes[n], cy = Math.floor(p[0] / C), cx = Math.floor(p[1] / C);
    const porLinha = new Map(); const seen = new Set();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const arr = sg.get(gk(cy + dy, cx + dx)); if (!arr) continue;
      for (const si of arr) {
        if (seen.has(si)) continue; seen.add(si);
        const s = segs[si]; if (s[3] === li) continue;
        const pr = projectOnSeg(p, nodes[s[0]], nodes[s[1]]);
        if (pr.d >= SNAP) continue;
        const b = porLinha.get(s[3]); if (!b || pr.d < b.pr.d) porLinha.set(s[3], { s, pr });
      }
    }
    for (const { s, pr } of porLinha.values()) {
      if (s[0] === n || s[1] === n) continue; // já é o mesmo ponto
      if (pr.t <= 0.001 || pr.t >= 0.999) { const alvo = pr.t <= 0.001 ? s[0] : s[1]; liga(n, alvo, hav(p, nodes[alvo])); continue; }
      const m = nodes.length; nodes.push(pr.pt); lineOf.push(-2); adj.push([]);
      edge(m, s[0], s[2] * pr.t); edge(m, s[1], s[2] * (1 - pr.t)); liga(n, m, pr.d);
    }
  }
  // Vértices de cabos diferentes que praticamente se tocam (até TOQUE m) também viram emenda
  for (let i = 0; i < nOrig; i++) {
    const p = nodes[i], cy = Math.floor(p[0] / C), cx = Math.floor(p[1] / C);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const arr = ng.get(gk(cy + dy, cx + dx)); if (!arr) continue;
      for (const j of arr) {
        if (j <= i || (lineOf[i] === lineOf[j] && lineOf[i] !== -2)) continue;
        const d = hav(p, nodes[j]); if (d <= TOQUE) liga(i, j, d);
      }
    }
  }
  // Pontes: ponta de cabo que termina “no nada” (sem outro cabo) se emenda ao pedaço de rede
  // mais próximo, se estiver a até PONTE metros. Buracos maiores ficam como estão.
  const PONTE = 300, RC = Math.ceil(PONTE / 50);
  const par = new Int32Array(nodes.length); for (let i = 0; i < par.length; i++) par[i] = i;
  const raiz = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const une = (a, b) => { a = raiz(a); b = raiz(b); if (a !== b) par[a] = b; };
  for (let i = 0; i < adj.length; i++) for (let k = 0; k < adj[i].length; k += 2) une(i, adj[i][k]);
  let pontes = 0; const pontesLista = [];
  for (const [n] of ends) {
    const p = nodes[n], cy = Math.floor(p[0] / C), cx = Math.floor(p[1] / C), rn = raiz(n);
    let best = -1, bd = PONTE;
    for (let dy = -RC; dy <= RC; dy++) for (let dx = -RC; dx <= RC; dx++) {
      const arr = ng.get(gk(cy + dy, cx + dx)); if (!arr) continue;
      for (const j of arr) { if (raiz(j) === rn) continue; const d = hav(p, nodes[j]); if (d < bd) { bd = d; best = j; } }
    }
    if (best >= 0) { liga(n, best, bd); une(n, best); pontes++; pontesLista.push([n, best, bd]); }
  }
  const pontesSet = new Map(); pontesLista.forEach(([a, b, d]) => { pontesSet.set(a + ':' + b, d); pontesSet.set(b + ':' + a, d); });
  return { nodes, adj, segs, joins, pontes, pontesSet };
}
function nearestSeg(net, p) {
  const k = Math.cos(p[0] * RAD), N = net.nodes, segs = net.segs;
  let bi = -1, bt = 0, bd = Infinity;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i], a = N[s[0]], b = N[s[1]];
    const ax = a[1] * k, ay = a[0], dx = b[1] * k - ax, dy = b[0] - ay, px = p[1] * k - ax, py = p[0] - ay;
    const L = dx * dx + dy * dy;
    let t = L ? (px * dx + py * dy) / L : 0; if (t < 0) t = 0; else if (t > 1) t = 1;
    const ex = px - t * dx, ey = py - t * dy, d2 = ex * ex + ey * ey;
    if (d2 < bd) { bd = d2; bi = i; bt = t; }
  }
  if (bi < 0) return null;
  const s = segs[bi], a = N[s[0]], b = N[s[1]];
  const pt = [a[0] + (b[0] - a[0]) * bt, a[1] + (b[1] - a[1]) * bt];
  return { i: bi, t: bt, pt, d: hav(p, pt) };
}
function shortest(net, src, dst, extra) {
  const n = net.nodes.length + 2;
  const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
  const hn = [], hd = [];
  const push = (v, d) => {
    hn.push(v); hd.push(d); let i = hn.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (hd[p] <= hd[i]) break; let t = hn[p]; hn[p] = hn[i]; hn[i] = t; t = hd[p]; hd[p] = hd[i]; hd[i] = t; i = p; }
  };
  const pop = () => {
    const v = hn[0], d = hd[0], lv = hn.pop(), ld = hd.pop();
    if (hn.length) {
      hn[0] = lv; hd[0] = ld; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < hn.length && hd[l] < hd[m]) m = l; if (r < hn.length && hd[r] < hd[m]) m = r;
        if (m === i) break; let t = hn[m]; hn[m] = hn[i]; hn[i] = t; t = hd[m]; hd[m] = hd[i]; hd[i] = t; i = m;
      }
    }
    return [v, d];
  };
  dist[src] = 0; push(src, 0);
  while (hn.length) {
    const [u, d] = pop();
    if (d > dist[u]) continue;
    if (u === dst) break;
    const relax = arr => { for (let k = 0; k < arr.length; k += 2) { const v = arr[k], nd = d + arr[k + 1]; if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push(v, nd); } } };
    if (u < net.nodes.length) relax(net.adj[u]);
    const x = extra.get(u); if (x) relax(x);
  }
  if (!isFinite(dist[dst])) return null;
  const path = []; for (let v = dst; v !== -1; v = prev[v]) path.push(v);
  return { path: path.reverse(), length: dist[dst] };
}
function computeRoute(o, d) {
  const po = [o.lat, o.lng], pd = [d.lat, d.lng];
  const net = getNet();
  if (!net || !net.segs.length) return { coords: [po, pd], length: hav(po, pd), network: false, snapO: 0, snapD: 0 };
  const so = nearestSeg(net, po), sd = nearestSeg(net, pd);
  const N = net.nodes.length, O = N, D = N + 1, extra = new Map();
  const add = (a, b, w) => { let x = extra.get(a); if (!x) extra.set(a, x = []); x.push(b, w); let y = extra.get(b); if (!y) extra.set(b, y = []); y.push(a, w); };
  const sO = net.segs[so.i], sD = net.segs[sd.i];
  add(O, sO[0], sO[2] * so.t); add(O, sO[1], sO[2] * (1 - so.t));
  add(D, sD[0], sD[2] * sd.t); add(D, sD[1], sD[2] * (1 - sd.t));
  if (so.i === sd.i) add(O, D, Math.abs(so.t - sd.t) * sO[2]);
  const r = shortest(net, O, D, extra);
  if (!r) return { coords: [po, pd], length: hav(po, pd), network: false, broken: true, snapO: so.d, snapD: sd.d };
  const coords = r.path.map(v => v === O ? so.pt : v === D ? sd.pt : net.nodes[v]);
  const pontes = [];
  if (net.pontesSet) for (let k = 1; k < r.path.length; k++) { const d = net.pontesSet.get(r.path[k - 1] + ':' + r.path[k]); if (d !== undefined) pontes.push(d); }
  return { coords, length: r.length, network: true, snapO: so.d, snapD: sd.d, pontes, reta: hav(po, pd) };
}
function getNet() {
  if (!S.net && S.parsed) S.net = buildNet(S.parsed.lines);
  return S.net;
}
function areaAt(pt) {
  const net = getNet();
  if (!net || !net.segs.length) return '';
  const s = nearestSeg(net, pt); if (!s || s.d > 2000) return '';
  const ln = S.parsed.lines[net.segs[s.i][3]];
  return ln ? ln.area : '';
}

