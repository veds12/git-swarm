(function () {
'use strict';
const D = window.GS;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

function el(tag, a, p) {
  const n = document.createElementNS(NS, tag);
  if (a) for (const k in a) if (a[k] != null) n.setAttribute(k, a[k]);
  if (p) p.appendChild(n);
  return n;
}
function tx(p, x, y, s, a) { const t = el('text', Object.assign({ x, y }, a || {}), p); t.textContent = s; return t; }
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
function tween(ms, fn, e) {
  return new Promise(res => {
    if (REDUCED || ms <= 0) { fn(1); return res(); }
    let t0 = null;
    const step = now => { if (t0 === null) t0 = now; const t = Math.min(1, (now - t0) / ms); fn((e || ease)(t)); t < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
  });
}
const wait = ms => new Promise(r => setTimeout(r, REDUCED ? 0 : ms));
function onVisible(node, fn, th) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { io.disconnect(); setTimeout(fn, 180); }
  }), { threshold: th || .3 });
  io.observe(node);
}
const lin = (d0, d1, r0, r1) => v => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
const lg = (d0, d1, r0, r1) => { const a = Math.log10(d0), b = Math.log10(d1); return v => r0 + (Math.log10(v) - a) / (b - a) * (r1 - r0); };
const C = { blue: '#2b6cd4', purple: '#7d5cc6', orange: '#e2692b', pink: '#d0659a', teal: '#1a9e86', green: '#11865e', red: '#cf4a52', amber: '#d39613', gray: '#9aa1a9', ink: '#14171b', line: '#b7bec7' };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let clipN = 0;
function clip(svg, x, y, w, h) {
  const defs = svg.querySelector('defs') || el('defs', {}, svg);
  const id = 'gc' + (++clipN);
  const cp = el('clipPath', { id }, defs);
  const r = el('rect', { x, y, width: w, height: h }, cp);
  return { r, url: `url(#${id})` };
}
function curve(x1, y1, x2, y2) {
  if (Math.abs(y1 - y2) < .5) return `M${x1},${y1}L${x2},${y2}`;
  const mx = x1 + (x2 - x1) * .5;
  return `M${x1},${y1}C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}
// Draw a path in from its start (pathLength trick).
function drawIn(path, ms, delay) {
  path.setAttribute('pathLength', 1);
  const dash = path.getAttribute('stroke-dasharray');
  path.style.strokeDasharray = '1 1'; path.style.strokeDashoffset = 1;
  return wait(delay || 0).then(() => tween(ms, p => { path.style.strokeDashoffset = 1 - p; })).then(() => {
    if (dash) { path.style.strokeDasharray = ''; path.removeAttribute('pathLength'); } else path.style.strokeDasharray = 'none';
  });
}
function fadeIn(node, ms, delay) {
  node.style.opacity = 0;
  return wait(delay || 0).then(() => tween(ms || 300, p => { node.style.opacity = p; }, easeOut));
}

// Chart host: draw(false) to reserve space, animate on first view, redraw (static) on width change.
function mount(host, draw) {
  let seen = false, lastW = host.clientWidth;
  const hide = () => { const s = host.querySelector('svg'); if (s && !seen) s.style.opacity = 0; };
  draw(false); hide();
  onVisible(host, () => { seen = true; draw(true); });
  new ResizeObserver(() => {
    const w = host.clientWidth;
    if (w && Math.abs(w - lastW) > 2) { lastW = w; draw(false); hide(); }
  }).observe(host);
  return { replay: () => { if (seen) draw(true); }, get seen() { return seen; } };
}

function axes(g, sx, sy, w, h, o) {
  const ax = el('g', { class: 'ax' }, g);
  (o.yt || []).forEach(v => {
    const y = sy(v);
    el('line', { class: 'g', x1: 0, x2: w, y1: y, y2: y }, ax);
    tx(ax, -8, y + 3.6, (o.yf || String)(v), { 'text-anchor': 'end' });
  });
  el('path', { class: 'b', d: `M0,${h}H${w}` }, ax);
  (o.xt || []).forEach(v => {
    const x = sx(v);
    el('line', { x1: x, x2: x, y1: h, y2: h + 4, stroke: '#c5cad1' }, ax);
    tx(ax, x, h + 17, (o.xf || String)(v), { 'text-anchor': 'middle' });
  });
  if (o.xTitle) tx(ax, w / 2, h + 36, o.xTitle, { 'text-anchor': 'middle', class: 'ttl' });
}

function legend(host, items, onHover) {
  host.innerHTML = '';
  items.forEach(it => {
    const s = document.createElement('span');
    s.innerHTML = it.sq ? `<i class="sq" style="background:${it.color}"></i>` : `<i class="${it.dash ? 'dash' : ''}" style="border-color:${it.color}"></i>`;
    s.appendChild(document.createTextNode(it.name));
    if (onHover && it.key) {
      s.addEventListener('mouseenter', () => { host.classList.add('dim'); s.classList.add('on'); onHover(it.key); });
      s.addEventListener('mouseleave', () => { host.classList.remove('dim'); s.classList.remove('on'); onHover(null); });
    }
    host.appendChild(s);
  });
}

const REPLAY = {};
$$('.replay').forEach(b => {
  b.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 6a4 4 0 1 1-1.2-2.85"/><path d="M9.4 1.2v2.4H7"/></svg>Replay';
  b.addEventListener('click', () => REPLAY[b.dataset.replay] && REPLAY[b.dataset.replay]());
});

/* ================================================================== reveal + section index */
(function () {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .05 });
  $$('.rv').forEach(n => io.observe(n));
  const toc = $('.toc'), links = $$('.toc a');
  if (!toc) return;
  new IntersectionObserver(([e]) => toc.classList.toggle('show', !e.isIntersecting), { threshold: 0 }).observe($('header.top'));
  const secs = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
  const so = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-35% 0px -60% 0px' });
  secs.forEach(s => so.observe(s));
})();

/* ================================================================== hero swarm */
function startSwarm(cv, opt) {
  // A growing commit graph: one root on the left, branches fanning out to the right inside a lens-shaped
  // envelope. Agents sit at the frontier where their next commit will land, read their parent (and any
  // informed_by= source), work, and publish. Each cycle ends by tracing the final answer's ancestry.
  opt = opt || {};
  const ctx = cv.getContext('2d');
  const K = { edge: '#bac4d0', sem: '#8a67cf', agent: '#d39613', anc: C.green };
  const KC = { draft: C.blue, repair: C.amber, verify: C.purple };
  const TEND = opt.duration || 40, NW = opt.workers || 12;
  const FONT = opt.font || 'Optimistic, "Helvetica Neue", Helvetica, Arial, sans-serif';
  let rnd = mulberry32(opt.seed || 7);
  let W = 0, H = 0, x0 = 0, span = 0, yc = 0, hh = 0;
  let T = 0, commits = [], agents = [], final = null, ancN = 0, endT = 0, maxDepth = 0, cycle = 0;

  function resize() {
    const dpr = opt.dpr || Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    x0 = W * (opt.left || .05); span = W * (opt.span || .86); yc = H * .5 + (opt.dy || 0); hh = H * (opt.height || .4);
  }
  const PX = u => x0 + u * span, PY = v => yc + v * hh;
  const env = u => Math.min(1, Math.pow(Math.max(0, u) / .26, .55)) * (1 - .25 * Math.pow(Math.max(0, (u - .8) / .2), 2));
  const front = t => .3 + .62 * Math.min(1, t / TEND);
  const gauss = () => { let a = 0; for (let i = 0; i < 4; i++) a += rnd(); return (a - 2) / .58; };
  const pick = arr => arr[Math.floor(rnd() * arr.length)];

  function reset() {
    rnd = mulberry32((opt.seed || 7) + cycle * 101);
    T = 0; final = null; endT = 0;
    commits = [{ id: 0, u: 0, v: 0, t: -9, kind: 'root', parent: null, src: [] }];
    agents = Array.from({ length: NW }, (_, i) => ({ u: 0, v: 0, st: 'wait', until: .25 + i * .3, plan: null, a: 0 }));   // worker slots, not persistent workers
  }
  function tooClose(u, v) {
    const x = PX(u), y = PY(v);
    for (const c of commits) if (Math.abs(PX(c.u) - x) < 14 && Math.abs(PY(c.v) - y) < 14) return true;
    for (const a of agents) if (a.plan && Math.abs(PX(a.plan.u) - x) < 16 && Math.abs(PY(a.plan.v) - y) < 16) return true;
    return false;
  }
  function plan(a) {
    const f = front(T);
    let best = null;
    for (let k = 0; k < 10 && !best; k++) {
      // parent: mostly recent work, the root while the graph is young
      let parent;
      if (commits.length < 6 || rnd() < Math.max(.03, .5 - T / 14)) parent = commits[0];
      else {
        const ws = commits.map(c => c.kind === 'root' ? 0 : (Math.exp(-(T - c.t) / 7) + .08) * (c.used ? 1 : 3) * (c.kind === 'refute' ? .4 : 1));
        let r = rnd() * ws.reduce((s, w) => s + w, 0), i = 0;
        while (r > ws[i]) r -= ws[i++];
        parent = commits[Math.min(i, commits.length - 1)];
      }
      const u = parent.kind === 'root' ? f + (rnd() - .5) * .06 : Math.max(parent.u + .045, f + (rnd() - .5) * .07);
      if (u > .985) continue;
      const e = env(u) * .96;
      let v = parent.kind === 'root' ? (rnd() * 2 - 1) * e : parent.v * .9 + gauss() * .26;
      if (v > e) v = 2 * e - v; if (v < -e) v = -2 * e - v;          // reflect off the envelope instead of piling up on it
      v = Math.max(-e, Math.min(e, v));
      if (tooClose(u, v)) continue;
      const r = rnd();
      let kind = parent.kind === 'root' ? 'draft' : r < .07 ? 'refute' : r < .14 ? 'integrate' : r < .5 ? 'repair' : r < .74 ? 'verify' : 'draft';
      // informed_by= sources: real workers cite earlier work in nearly every episode, mostly nearby recent commits
      const cands = commits.filter(c => c !== parent && c.kind !== 'root' && c.u < u - .03 && c.u > u - .3 && Math.abs(c.v - v) < .75);
      let src = [];
      const fresh = cands.filter(c => !c.used), pool0 = fresh.length ? fresh : cands;
      const take = n => { const pool = pool0.slice(); while (src.length < n && pool.length) src.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]); };
      if (kind === 'integrate') { take(2); if (!src.length) kind = 'repair'; }
      else take(rnd() < .6 ? 1 : 0);
      best = { parent, u, v, kind, src };
    }
    a.plan = best;
    if (!best) { a.st = 'wait'; a.until = T + .6; return; }
    // a fresh worker spawns right where its contribution will land
    a.u = best.u + .028; a.v = best.v; a.abst = 0;
    a.st = 'spawn'; a.t0 = T; a.until = T + .45;
  }
  function step(dt) {
    T += dt;
    if (!final) {
      for (const a of agents) {
        if (T < a.until) continue;
        if (a.st === 'wait') { if (T < TEND) plan(a); else { a.st = 'gone'; a.until = 1e9; } }
        else if (a.st === 'spawn') { a.st = 'read'; a.until = T + .9 + rnd() * .5; }
        else if (a.st === 'read') { a.st = 'work'; a.w0 = T; a.until = T + 1.6 + rnd() * 2; }
        else if (a.st === 'work') {
          const p = a.plan;
          if (rnd() < .06) { a.abst = T; }   // abstain: nothing published
          else { commits.push({ id: commits.length, u: p.u, v: p.v, t: T, kind: p.kind, parent: p.parent, src: p.src }); p.parent.used = true; p.src.forEach(c => { c.used = true; }); }
          // the episode ends: the worker exits and its slot is refilled by a new worker elsewhere
          a.st = 'done'; a.td = T; a.du = p.u; a.until = T + .5;
        }
        else if (a.st === 'done') { a.plan = null; a.st = 'wait'; a.until = T + .2 + rnd() * .8; }
      }
      if (T >= TEND && agents.every(a => a.st === 'gone')) chooseFinal();
    } else if (T > endT + 1.4) { cycle++; reset(); }
    for (const a of agents) {
      if (a.st === 'spawn') a.a = easeOut(Math.min(1, (T - a.t0) / .45));
      else if (a.st === 'done') { const p = Math.min(1, (T - a.td) / .5); a.a = 1 - p; if (!a.abst) a.u = a.du + .028 * (1 - p); }
      else a.a = 1;
    }
  }
  function ancestry(c) {
    const depth = new Map([[c, 0]]), q = [c];
    while (q.length) { const n = q.shift(); [n.parent, ...n.src].forEach(p => { if (p && !depth.has(p)) { depth.set(p, depth.get(n) + 1); q.push(p); } }); }
    return depth;
  }
  function chooseFinal() {
    const late = commits.filter(c => c.kind !== 'root' && c.kind !== 'refute' && !c.used && c.u > front(TEND) - .22);
    if (!late.length) { cycle++; reset(); return; }
    late.sort((a, b) => ancestry(b).size - ancestry(a).size);
    const base = late[0], src = late.slice(1, 7);
    const fc = { id: commits.length, u: Math.min(.965, Math.max(...late.map(c => c.u)) + .05), v: base.v * .5, t: T, kind: 'final', parent: base, src };
    commits.push(fc);
    const bestD = ancestry(fc);
    final = fc; final.depth = bestD; maxDepth = Math.max(...bestD.values());
    ancN = bestD.size - 2;   // excludes the final commit itself and the task root
    final.t0 = T; endT = T + maxDepth * .1 + 4.2;
  }
  function curveTo(x1, y1, x2, y2, g) {
    const mx = x1 + (x2 - x1) * .5;
    ctx.moveTo(x1, y1);
    if (g >= 1) { ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2); return; }
    const L = (a, b) => [a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g];
    const P0 = [x1, y1], P1 = [mx, y1], P2 = [mx, y2], P3 = [x2, y2];
    const a = L(P0, P1), b = L(P1, P2), c = L(P2, P3), d = L(a, b), e = L(b, c), f = L(d, e);
    ctx.bezierCurveTo(a[0], a[1], d[0], d[1], f[0], f[1]);
  }
  function render() {
    ctx.clearRect(0, 0, W, H);
    const fade = final ? Math.max(0, Math.min(1, 1 - (T - endT) / 1.2)) : Math.min(1, T / .4 + .0001);
    const lit = c => final && final.depth.has(c) && T >= final.t0 + .4 + final.depth.get(c) * .1;
    const dimmed = final && T >= final.t0 + .4;
    ctx.lineCap = 'round';
    // edges
    for (const c of commits) {
      if (!c.parent) continue;
      const g = Math.min(1, (T - c.t) / .5);
      const on = lit(c) && lit(c.parent);
      ctx.globalAlpha = fade * (dimmed && !on ? .35 : 1);
      ctx.strokeStyle = on ? K.anc : K.edge; ctx.lineWidth = on ? 1.9 : 1.5; ctx.setLineDash([]);
      ctx.beginPath(); curveTo(PX(c.parent.u), PY(c.parent.v), PX(c.u), PY(c.v), easeOut(g)); ctx.stroke();
      if (c.src.length) {
        ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.strokeStyle = K.sem;
        for (const s of c.src) { ctx.globalAlpha = fade * (dimmed ? (lit(s) && lit(c) ? .55 : .12) : .38) * g; ctx.beginPath(); curveTo(PX(s.u), PY(s.v), PX(c.u), PY(c.v), 1); ctx.stroke(); }
        ctx.setLineDash([]);
      }
    }
    // commits
    for (const c of commits) {
      const x = PX(c.u), y = PY(c.v);
      const g = c.kind === 'root' ? 1 : Math.min(1, (T - c.t) / .35), r = 3.8 * easeOut(g);
      const on = lit(c);
      ctx.globalAlpha = fade * (dimmed && !on ? .4 : 1);
      if (c.kind === 'root') { ctx.fillStyle = '#4b5159'; ctx.beginPath(); ctx.arc(x, y, 5.2, 0, 6.29); ctx.fill(); }
      else if (c.kind === 'final') { continue; }
      else if (c.kind === 'refute') {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r + 1.2, 0, 6.29); ctx.fill();
        ctx.strokeStyle = C.red; ctx.lineWidth = 1.7; const q = r * .8;
        ctx.beginPath(); ctx.moveTo(x - q, y - q); ctx.lineTo(x + q, y + q); ctx.moveTo(x + q, y - q); ctx.lineTo(x - q, y + q); ctx.stroke();
      } else if (c.kind === 'integrate') {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = on ? K.anc : C.green; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r + .8, 0, 6.29); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = on ? K.anc : KC[c.kind] || C.blue; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill(); ctx.stroke();
      }
      if (g < 1) { ctx.globalAlpha = fade * (1 - g) * .5; ctx.strokeStyle = KC[c.kind] || (c.kind === 'refute' ? C.red : C.green); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 5 + g * 10, 0, 6.29); ctx.stroke(); }
    }
    // final answer
    if (final && T >= final.t0) {
      const p = Math.min(1, (T - final.t0) / .5), x = PX(final.u), y = PY(final.v);
      ctx.globalAlpha = fade * p;
      ctx.fillStyle = K.anc; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 6.29); ctx.fill();
      ctx.strokeStyle = K.anc; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, 10 + (1 - p) * 8, 0, 6.29); ctx.stroke();
      const right = x > W - 230;
      ctx.fillStyle = C.ink; ctx.font = `600 12px ${FONT}`; ctx.textAlign = right ? 'right' : 'left';
      const lx = right ? x - 16 : x + 16;
      const halo = (t, X, Y) => { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeText(t, X, Y); ctx.restore(); ctx.fillText(t, X, Y); };
      halo('final answer', lx, y - 14);
      const q = Math.min(1, Math.max(0, (T - final.t0 - .4) / (maxDepth * .1 + .2)));
      ctx.fillStyle = '#5d646d'; ctx.font = `400 11.5px ${FONT}`;
      const tot = commits.length - 2;
      halo(`builds on ${Math.round(q * ancN)} of ${tot} commits (${Math.round(q * ancN / tot * 100)}%)`, lx, y + 6);
    }
    // agents
    for (const a of agents) {
      if (a.st === 'gone' || a.st === 'wait') continue;
      const x = PX(a.u), y = PY(a.v);
      ctx.globalAlpha = fade * a.a;
      const sc = a.st === 'done' ? 1 - .5 * Math.min(1, (T - a.td) / .5) : a.st === 'spawn' ? .6 + .4 * a.a : 1;
      if (a.st === 'read' && a.plan) {
        ctx.setLineDash([2, 3]); ctx.lineWidth = 1; ctx.strokeStyle = K.agent;
        [a.plan.parent, ...a.plan.src].forEach(c => { ctx.globalAlpha = fade * .55; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(PX(c.u), PY(c.v)); ctx.stroke(); });
        ctx.setLineDash([]); ctx.globalAlpha = fade * a.a;
      }
      if (a.st === 'work') {
        const p = Math.min(1, (T - a.w0) / (a.until - a.w0));
        ctx.strokeStyle = '#efe2bf'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.29); ctx.stroke();
        ctx.strokeStyle = K.agent; ctx.beginPath(); ctx.arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + p * 6.283); ctx.stroke();
      }
      if (a.abst && T - a.abst < .5) { ctx.strokeStyle = '#a0a6ae'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(x, y, 8 + (T - a.abst) * 14, 0, 6.29); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = '#fff'; ctx.strokeStyle = K.agent; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y, 5.2 * sc, 0, 6.29); ctx.fill(); ctx.stroke();
      ctx.fillStyle = K.agent; ctx.beginPath(); ctx.arc(x, y, 1.9 * sc, 0, 6.29); ctx.fill();
    }
    // counters
    ctx.globalAlpha = 1; ctx.textAlign = 'right'; ctx.font = `400 11.5px ${FONT}`; ctx.fillStyle = '#8a919a';
    const live = agents.filter(a => a.st === 'spawn' || a.st === 'read' || a.st === 'work').length;
    ctx.fillText(`workers in flight ${live}   ·   commits ${commits.length - 1 - (final ? 1 : 0)}`, W - 12, 18);
  }
  resize(); reset();
  for (let i = 0; i < (opt.warm == null ? TEND * .5 : opt.warm) * 30; i++) step(1 / 30);
  render();
  if (REDUCED) { while (!final) step(1 / 10); T = final.t0 + maxDepth * .1 + 1; render(); return; }
  let running = false, last = 0;
  const loop = now => {
    if (!running) return;
    const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    step(dt); render(); requestAnimationFrame(loop);
  };
  const start = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } };
  new IntersectionObserver(([e]) => { if (e.isIntersecting && !document.hidden) start(); else running = false; }, { threshold: 0 }).observe(cv);
  document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; else if (cv.getBoundingClientRect().bottom > 0) start(); });
  let rw = W;
  new ResizeObserver(() => { if (Math.abs(cv.clientWidth - rw) > 2 || cv.clientHeight !== H) { rw = cv.clientWidth; resize(); render(); } }).observe(cv);
}
if ($('#swarm')) startSwarm($('#swarm'));

/* ================================================================== Figure 1: paradigms */
(function () {
  const A = $('#para-a'), B = $('#para-b'), Cc = $('#para-c');
  if (!A) return;
  function build(anim) {
    [A, B, Cc].forEach(s => { s.innerHTML = ''; });
    // (a) independent attempts
    const ys = [28, 52, 76, 100, 124], pick = 1, endsA = [];
    const pa = [];
    el('circle', { cx: 30, cy: 76, r: 5, fill: '#4b5159' }, A);
    ys.forEach((y, i) => {
      const p = el('path', { d: `M30,76 C90,76 90,${y} 150,${y} S230,${y + (i % 2 ? 5 : -5)} 262,${y}`, fill: 'none', stroke: i === pick ? C.blue : '#9aa6b5', 'stroke-width': 1.8 }, A);
      const e = el('g', {}, A);
      if (i === pick) {
        el('circle', { cx: 262, cy: y, r: 5, fill: C.blue }, e);
        el('path', { d: `M272,${y} l4,4 l8,-9`, fill: 'none', stroke: C.green, 'stroke-width': 2, 'stroke-linecap': 'round' }, e);
      } else el('circle', { cx: 262, cy: y, r: 4, fill: '#9aa6b5' }, e);
      pa.push([p, e, i === pick]);
    });
    // (b) one long trajectory with a moving context window
    const wav = 'M18,80 C40,58 58,98 80,78 S120,58 140,80 S180,100 200,76 S240,58 262,80 S280,88 286,80';
    const faded = el('path', { d: wav, fill: 'none', stroke: '#d3d8de', 'stroke-width': 1.8 }, B);
    const bl = el('path', { d: wav, fill: 'none', stroke: C.blue, 'stroke-width': 1.8 }, B);
    const win = el('rect', { x: 170, y: 46, width: 116, height: 66, rx: 4, fill: 'none', stroke: '#8b95a1', 'stroke-dasharray': '3 3' }, B);
    const wl = tx(B, 228, 128, 'context', { 'text-anchor': 'middle', 'font-size': 10.5, fill: '#7b828c', 'font-family': 'Optimistic, Helvetica Neue, Helvetica, Arial, sans-serif' });
    const cpB = clip(B, 0, 0, 300, 150);
    bl.setAttribute('clip-path', cpB.url);
    // (c) compounding graph
    const N = [[22, 75, 'r'], [62, 40, 'd'], [62, 110, 'd'], [100, 40, 'v'], [100, 75, 'd'], [104, 110, 'p'], [140, 40, 'x'], [146, 75, 'p'], [150, 110, 'v'], [190, 75, 'i'], [228, 75, 'p'], [232, 112, 'd'], [268, 75, 'w']];
    const E = [[0, 1], [0, 2], [1, 3], [3, 6], [0, 4], [4, 7], [2, 5], [5, 8], [7, 9], [9, 10], [10, 12], [8, 11]];
    const S = [[6, 7], [8, 9], [3, 4], [11, 12]];
    const kc = { d: C.blue, v: C.purple, p: C.amber };
    const eg = el('g', {}, Cc), ng = el('g', {}, Cc);
    const edges = E.map(([a, b]) => [b, el('path', { d: curve(N[a][0], N[a][1], N[b][0], N[b][1]), fill: 'none', stroke: '#aeb6c0', 'stroke-width': 1.5 }, eg)]);
    const sem = S.map(([a, b]) => [b, el('path', { d: curve(N[a][0], N[a][1], N[b][0], N[b][1]), fill: 'none', stroke: C.purple, 'stroke-width': 1.2, 'stroke-dasharray': '3 3', opacity: .8 }, eg)]);
    const nodes = N.map(([x, y, k]) => {
      const g = el('g', {}, ng);
      if (k === 'r') el('rect', { x: x - 4.5, y: y - 4.5, width: 9, height: 9, fill: '#4b5159' }, g);
      else if (k === 'x') { el('circle', { cx: x, cy: y, r: 5.5, fill: '#fff' }, g); el('path', { d: `M${x - 4},${y - 4}l8,8m0,-8l-8,8`, stroke: C.red, 'stroke-width': 1.8 }, g); }
      else if (k === 'i') el('circle', { cx: x, cy: y, r: 5.5, fill: '#fff', stroke: C.green, 'stroke-width': 2.2 }, g);
      else if (k === 'w') { el('circle', { cx: x, cy: y, r: 6, fill: C.green }, g); el('circle', { cx: x, cy: y, r: 10, fill: 'none', stroke: C.green, 'stroke-width': 1.3 }, g); }
      else el('circle', { cx: x, cy: y, r: 5, fill: kc[k] }, g);
      return g;
    });
    if (!anim) { win.setAttribute('x', 170); return; }
    // animate
    pa.forEach(([p, e, ok], i) => { drawIn(p, 1100, i * 80); fadeIn(e, 250, 1100 + i * 80); });
    wait(1700).then(() => pa.forEach(([p, e, ok]) => { if (!ok) tween(600, t => { p.style.opacity = 1 - .7 * t; e.style.opacity = 1 - .7 * t; }); }));
    const cpF = clip(B, 0, 0, 0, 150); faded.setAttribute('clip-path', cpF.url);
    tween(2600, t => {
      const xw = 18 + 270 * t, lo = Math.max(0, xw - 116);
      cpB.r.setAttribute('x', lo); cpB.r.setAttribute('width', xw - lo);
      cpF.r.setAttribute('width', lo);
      win.setAttribute('x', Math.max(12, xw - 116));
    }, t => t);
    nodes.forEach((n, i) => fadeIn(n, 250, 150 + i * 150));
    edges.forEach(([b, p]) => drawIn(p, 350, b * 150));
    sem.forEach(([b, p]) => { p.style.opacity = 0; wait(b * 150 + 200).then(() => tween(400, t => { p.style.opacity = .8 * t; })); });
  }
  const host = $('#fig-para');
  build(false);
  [A, B, Cc].forEach(s => s.style.opacity = 0);
  onVisible(host, () => { [A, B, Cc].forEach(s => s.style.opacity = 1); build(true); }, .35);
  REPLAY.para = () => build(true);
})();

/* ================================================================== Figure 2: repository explorer */
(function () {
  const host = $('#repo'); if (!host) return;
  const info = $('#repo-info');
  const N = {
    r: { x: 50, y: 125, k: 'root', sha: 'a0f3e1', d: 'Task specification (the root)' },
    a1: { x: 170, y: 52, k: 'draft', sha: 'c41d9e', d: 'First draft' },
    a2: { x: 300, y: 52, k: 'verify', sha: '7be210', d: 'Tests that expose an edge case' },
    a3: { x: 440, y: 52, k: 'refute', sha: '2d9f04', d: 'Shows this approach fails on nested input (refuted)' },
    d1: { x: 760, y: 52, k: 'draft', sha: '0c8e55', d: 'Late attempt to rescue the refuted approach' },
    b1: { x: 150, y: 125, k: 'draft', sha: '5e8a77', d: 'Alternative draft' },
    b2: { x: 290, y: 125, k: 'repair', sha: '91c3b0', d: 'Repair guided by the edge-case tests' },
    b3: { x: 440, y: 125, k: 'repair', sha: 'e0b6d2', d: 'Avoids the construction shown to fail' },
    b4: { x: 600, y: 125, k: 'integrate', sha: 'f1e2d3', d: 'Integrates the renderer branch' },
    b5: { x: 900, y: 125, k: 'repair', sha: '3a7c19', d: 'Final fixes (selected)' },
    c1: { x: 260, y: 198, k: 'draft', sha: '8d21fa', d: 'Renderer experiment' },
    c2: { x: 390, y: 198, k: 'repair', sha: '6c0e5b', d: 'Renderer fixes' },
    c3: { x: 520, y: 198, k: 'verify', sha: 'b72e4c', d: 'Renderer tests' },
    c4: { x: 740, y: 198, k: 'verify', sha: '4ad61f', d: 'Independent re-check of the integration' },
  };
  const P = { a1: 'r', a2: 'a1', a3: 'a2', d1: 'a3', b1: 'r', b2: 'b1', b3: 'b2', b4: 'b3', b5: 'b4', c1: 'b2', c2: 'c1', c3: 'c2', c4: 'c3' };
  const S = { b2: ['a2'], b3: ['a3'], b4: ['c2', 'c3'], c4: ['b4'] };
  const order = ['r', 'a1', 'b1', 'c1', 'b2', 'a2', 'c2', 'a3', 'b3', 'c3', 'b4', 'c4', 'd1', 'b5'];
  const KC = { draft: C.blue, repair: C.amber, verify: C.purple, refute: C.red, integrate: C.green };
  let selected = 'b5', parts = {};
  function ancestry(id) {
    const seen = new Set(), st = [id];
    while (st.length) { const n = st.pop(); [P[n], ...(S[n] || [])].forEach(p => { if (p && !seen.has(p)) { seen.add(p); st.push(p); } }); }
    return seen;
  }
  function highlight(id) {
    const anc = ancestry(id);
    const inA = n => n === id || anc.has(n);
    Object.entries(parts.nodes).forEach(([k, g]) => { g.style.opacity = inA(k) ? 1 : .28; g.querySelector('.ring').setAttribute('stroke', k === id ? C.ink : inA(k) && k !== id ? C.green : 'none'); });
    parts.edges.forEach(e => {
      const on = inA(e.b) && inA(e.a) && (e.b === id || anc.has(e.b));
      e.p.style.opacity = on ? 1 : .22;
      e.p.setAttribute('stroke', on ? (e.sem ? '#8a67cf' : C.green) : (e.sem ? '#8a67cf' : '#59616b'));
      e.p.setAttribute('stroke-width', on && !e.sem ? 2.6 : e.sem ? 1.4 : 1.6);
    });
    const n = N[id];
    const total = Object.keys(N).length - 1;
    const src = (S[id] || []).map(s => `<code>${N[s].sha}</code>`).join(', ');
    info.innerHTML = `<code>${n.sha}</code> &nbsp;${n.d}` +
      (P[id] ? ` &nbsp;·&nbsp; Git parent <code>${N[P[id]].sha}</code>` : '') +
      (src ? ` &nbsp;·&nbsp; semantic inheritance ${src}` : '') +
      (id !== 'r' ? ` &nbsp;·&nbsp; <b>ancestry: ${[...anc].filter(a => a !== 'r').length} of ${total - 1} other commits</b>` : '');
  }
  function draw(anim) {
    host.innerHTML = '';
    const svg = el('svg', { viewBox: '0 0 960 240', class: 'd' }, host);
    const defs = el('defs', {}, svg);
    const eg = el('g', {}, svg), ng = el('g', {}, svg);
    parts = { nodes: {}, edges: [] };
    order.forEach(id => {
      const n = N[id];
      if (P[id]) { const p = N[P[id]]; parts.edges.push({ a: P[id], b: id, sem: false, p: el('path', { d: curve(p.x, p.y, n.x, n.y), fill: 'none', stroke: '#59616b', 'stroke-width': 1.6 }, eg) }); }
      (S[id] || []).forEach(s => { const p = N[s]; parts.edges.push({ a: s, b: id, sem: true, p: el('path', { d: curve(p.x, p.y, n.x, n.y), fill: 'none', stroke: '#8a67cf', 'stroke-width': 1.4, 'stroke-dasharray': '4 4' }, eg) }); });
    });
    order.forEach(id => {
      const n = N[id], g = el('g', { class: 'node', tabindex: 0 }, ng);
      el('circle', { class: 'ring', cx: n.x, cy: n.y, r: 13, fill: 'none', stroke: 'none', 'stroke-width': 1.6 }, g);
      if (n.k === 'root') el('rect', { x: n.x - 7, y: n.y - 7, width: 14, height: 14, fill: '#4b5159' }, g);
      else if (n.k === 'refute') { el('circle', { cx: n.x, cy: n.y, r: 8.5, fill: '#fff', stroke: C.red, 'stroke-width': 1.6 }, g); el('path', { d: `M${n.x - 4},${n.y - 4}l8,8m0,-8l-8,8`, stroke: C.red, 'stroke-width': 1.8 }, g); }
      else if (n.k === 'integrate') el('circle', { cx: n.x, cy: n.y, r: 8, fill: '#fff', stroke: C.green, 'stroke-width': 2.6 }, g);
      else el('circle', { cx: n.x, cy: n.y, r: 8, fill: KC[n.k] }, g);
      tx(g, n.x, n.y + (n.y > 180 ? 30 : n.y < 60 ? -18 : 30), n.sha, { 'text-anchor': 'middle', 'font-size': 11.5, fill: '#69707a', 'font-family': 'Optimistic, Helvetica Neue, Helvetica, Arial, sans-serif' });
      el('circle', { cx: n.x, cy: n.y, r: 18, fill: '#fff', 'fill-opacity': 0 }, g);
      g.addEventListener('mouseenter', () => highlight(id));
      g.addEventListener('mouseleave', () => highlight(selected));
      g.addEventListener('click', () => { selected = id; highlight(id); });
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selected = id; highlight(id); } });
      parts.nodes[id] = g;
    });
    if (!anim) { highlight(selected); return; }
    info.innerHTML = '<span class="muted">Commits appear in the order workers publish them…</span>';
    const step = 170;
    order.forEach((id, i) => {
      fadeIn(parts.nodes[id], 260, i * step);
      parts.edges.filter(e => e.b === id).forEach(e => { e.p.style.opacity = 1; drawIn(e.p, 380, i * step - 120); });
    });
    wait(order.length * step + 300).then(() => { selected = 'b5'; highlight('b5'); });
  }
  const m = mount(host, draw);
  REPLAY.repo = m.replay;
})();

/* ================================================================== Figure 3: async vs synchronized */
(function () {
  if (!$('#async-a')) return;
  const dur = [7, 13, 5, 9, 6, 10, 4, 12, 6, 8, 5, 9, 7, 14, 6, 8, 6, 11, 5, 9];
  const SL = 5;
  function schedule(mode) {
    const out = [];
    if (mode === 'async') {
      const free = new Array(SL).fill(0);
      dur.forEach((d, i) => { let s = 0; for (let k = 1; k < SL; k++) if (free[k] < free[s] - 1e-9) s = k; out.push({ i, slot: s, t0: free[s], t1: free[s] + d }); free[s] += d; });
    } else {
      let t = 0;
      for (let w = 0; w < dur.length / SL; w++) {
        const ds = dur.slice(w * SL, w * SL + SL), end = t + Math.max(...ds);
        ds.forEach((d, k) => out.push({ i: w * SL + k, slot: k, t0: t, t1: t + d, wait: end }));
        t = end;
      }
    }
    return out;
  }
  const S = { async: schedule('async'), sync: schedule('sync') };
  const span = m => Math.max(...S[m].map(e => e.t1));
  const TMAX = Math.max(span('async'), span('sync')) + 2;
  function gantt(host, mode) { return mount(host, anim => draw(host, mode, anim)); }
  function draw(host, mode, anim) {
    host.innerHTML = '';
    const W = Math.max(320, host.clientWidth || 600), rowH = 28;
    const m = { l: 56, r: 12, t: 24, b: 40 };
    const H = m.t + rowH * (SL + 1) + 18 + m.b;
    const w = W - m.l - m.r, h = rowH * (SL + 1) + 18;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, host);
    const g = el('g', { transform: `translate(${m.l},${m.t})` }, svg);
    const sx = lin(0, TMAX, 0, w);
    const ticks = []; for (let v = 0; v <= TMAX; v += 10) ticks.push(v);
    const ax = el('g', { class: 'ax' }, g);
    ticks.forEach(v => { el('line', { class: 'g', x1: sx(v), x2: sx(v), y1: 0, y2: h }, ax); tx(ax, sx(v), h + 16, v + ' min', { 'text-anchor': 'middle' }); });
    el('path', { class: 'b', d: `M0,${h}H${w}` }, ax);
    for (let s = 0; s < SL; s++) tx(g, -10, s * rowH + rowH / 2 + 4, 'slot ' + (s + 1), { 'text-anchor': 'end', 'font-size': 11.5, fill: '#69707a' });
    const ry = SL * rowH + 18;
    tx(g, -10, ry + 10, 'commits', { 'text-anchor': 'end', 'font-size': 11.5, fill: '#69707a' });
    el('line', { x1: 0, x2: w, y1: ry + 6, y2: ry + 6, stroke: '#e2e5e9' }, g);
    const items = S[mode].map(e => {
      const y = e.slot * rowH + 5, bh = rowH - 10;
      const gg = el('g', {}, g);
      let waitL = null;
      if (e.wait && e.wait > e.t1 + .01) waitL = el('line', { x1: sx(e.t1) + 2, x2: sx(e.wait) - 2, y1: y + bh / 2, y2: y + bh / 2, stroke: '#b5bcc5', 'stroke-dasharray': '1.5 3', 'stroke-width': 1.4 }, gg);
      const r = el('rect', { x: sx(e.t0) + 1, y, width: Math.max(0, sx(e.t1) - sx(e.t0) - 2), height: bh, rx: 2.5, fill: '#dfe8f6', stroke: '#9fb7dc', 'stroke-width': 1 }, gg);
      const lab = sx(e.t1) - sx(e.t0) > 26 ? tx(gg, sx(e.t0) + 7, y + bh / 2 + 3.8, 'w' + String(e.i + 1).padStart(2, '0'), { 'font-size': 10, fill: '#4a5f80', 'font-family': 'Optimistic, Helvetica Neue, Helvetica, Arial, sans-serif' }) : null;
      const dot = el('circle', { cx: sx(e.t1), cy: ry + 6, r: 3.6, fill: C.blue }, g);
      return { e, r, lab, waitL, dot };
    });
    const endX = sx(span(mode));
    const endG = el('g', {}, g);
    el('line', { x1: endX, x2: endX, y1: -18, y2: ry + 12, stroke: C.ink, 'stroke-width': 1.2 }, endG);
    const endT = tx(endG, endX + 6, -10, `all 20 done · ${span(mode)} min`, { 'font-size': 12, 'font-weight': 600, fill: C.ink });
    if (endX > w - 125) { endT.setAttribute('x', endX - 6); endT.setAttribute('text-anchor', 'end'); }
    const ph = el('line', { x1: 0, x2: 0, y1: -4, y2: ry + 12, stroke: C.orange, 'stroke-width': 1.2, opacity: anim ? 1 : 0 }, g);
    const set = t => {
      items.forEach(({ e, r, lab, waitL, dot }) => {
        const p = Math.max(0, Math.min(1, (t - e.t0) / (e.t1 - e.t0)));
        r.setAttribute('width', Math.max(0, (sx(e.t1) - sx(e.t0) - 2) * p));
        r.style.opacity = t >= e.t0 ? 1 : 0;
        if (lab) lab.style.opacity = p > .5 ? 1 : 0;
        dot.style.opacity = t >= e.t1 ? 1 : 0;
        if (waitL) waitL.style.opacity = t >= e.t1 ? 1 : 0;
      });
      ph.setAttribute('x1', sx(t)); ph.setAttribute('x2', sx(t));
      endG.style.opacity = t >= span(mode) ? 1 : 0;
    };
    if (!anim) { set(TMAX); ph.style.opacity = 0; return; }
    // both panels share one clock, so the synchronized run visibly keeps going after the asynchronous one is done
    const T = span(mode);
    tween(T * 85, p => set(p * T), t => t).then(() => { set(T); tween(300, p => { ph.style.opacity = 1 - p; }); });
  }
  const a = gantt($('#async-a'), 'async'), b = gantt($('#async-s'), 'sync');
  REPLAY.async = () => { a.replay(); b.replay(); };
})();

/* ================================================================== Figure 4: terminals type in */
$$('.term[data-type]').forEach(t => {
  const lines = $$('.ln', t);
  onVisible(t, () => lines.forEach((l, i) => setTimeout(() => l.classList.add('in'), REDUCED ? 0 : i * 70)), .3);
});

/* ================================================================== Figure 5: episode stepper */
(function () {
  const list = $('#steps'); if (!list) return;
  const p = s => `<span class="p">$</span> <span class="c">${s}</span>`;
  const k = s => `<span class="k">${s}</span>`, y = s => `<span class="y">${s}</span>`, g = s => `<span class="g">${s}</span>`, m = s => `<span class="m">${s}</span>`, r = s => `<span class="r">${s}</span>`;
  const STEPS = [
    {
      t: 'Inspect the repository', s: 'read the work, not just commit titles',
      term: [p('git log --graph --oneline --all | head'),
        `* ${y('9ac922c')} ${k('(agent/w0087)')} regex: unify escape handling`,
        `| * ${y('7ce1034')} ${k('(agent/w0091)')} synthesis: CLI + regex branches`,
        `|/`,
        `| * ${y('d4e5f6a')} ${k('(agent/w0072)')} probe: \\B differs from reference`,
        `* | ${y('1e5a9ad')} ${k('(agent/w0064)')} repair: literal backspace in classes`,
        k('…'),
        p('git show 9ac922c:EVALUATION.md | head -3'),
        `- 212/240 differential checks pass`,
        `- ${r('FAIL')}: doubled \\B escapes (see probes/escapes.txt)`,
        p('gs_inspect d4e5f6a')],
      note: 'The worker starts from the whole commit graph and reads the actual work: code, the notes and self-evaluation every contributor leaves behind, and any probes or tests. Programming workers typically open five to seven candidate commits, not the entire graph.'
    },
    {
      t: 'Check what peers are doing', s: 'in-flight log and dashboard',
      term: [p('gs_inflight'),
        `${k('w0098')}  scoping   targets=${y('7ce1034')}  "compare CLI candidates"`,
        `${k('w0099')}  working   targets=${y('1e5a9ad')}  "repair: --null-data output"`,
        `${k('w0100')}  working   targets=${y('9ac922c')}  "tests: regex flag combos"`,
        ``,
        p('gs_dashboard | head -3'),
        `${k('Remaining worker budget:')}     101`,
        `${k('Workers currently in flight:')} 5`],
      note: 'Before choosing, it checks the in-flight log to avoid picking up work someone else is already doing, and the dashboard for the remaining budget and nomination state.'
    },
    {
      t: 'Scope one contribution', s: 'announce gap, deliverable, abort',
      term: [p('gs_inflight announce --stage scoping \\'),
        `    --summary "${m('Gap:')} regex candidates diverge on doubled`,
        `      word-boundary escapes | ${m('Deliverable:')} 9ac922c-based`,
        `      normalizer | ${m('Success:')} differential checks pass |`,
        `      ${m('Abort:')} if this exact refinement is already published" \\`,
        `    --target 9ac922c`,
        g('announced · visible to 4 in-flight peers')],
      note: 'It commits to one bounded contribution and announces it publicly: the gap, the deliverable, how success will be observed, and when it would give up. It starts from 9ac922c and plans to use a probe, d4e5f6a, from another branch.'
    },
    {
      t: 'Do the work', s: 'edit, test, post progress',
      term: [p('git switch -c agent/w0101/word-boundary-escapes 9ac922c'),
        p('$EDITOR ambr.py') + k('        # localized escape normalizer'),
        p('./compile.sh && python probes/escapes.py'),
        `  doubled \\B         ${g('18/18 match reference')}`,
        `  literal backspace  ${y('timeout (narrowing)')}`,
        p('gs_inflight update "Excluded doubled \\B after a reference'),
        `    probe failed; py_compile and compile.sh pass."`],
      note: 'It works in its own worktree, runs experiments and tests, and posts progress to its public log. If the abort condition is hit (say, someone publishes the same fix first), it should stop and abstain.'
    },
    {
      t: 'Publish, nominate or abstain', s: 'one terminal action',
      term: [p('git add ambr.py MY_THOUGHTS.md EVALUATION.md probes/'),
        p('git commit -m "regex: normalize doubled word-boundary escapes" \\'),
        `             -m "${m('informed_by=9ac922c,d4e5f6a')}"`,
        g('✓ validation passed') + '   ' + g('✓ published 3f7a2b1'),
        `  ${k('parent     ')} ${y('9ac922c')}`,
        `  ${k('informed_by')} ${y('9ac922c')}, ${y('d4e5f6a')}`],
      note: 'Here the episode ends with a contribution. Its informed_by= field names both the commit it started from and the probe it borrowed from another branch, and it is immediately visible to every worker spawned after it.'
    },
  ];
  const term = $('#ep-term'), note = $('#ep-note');
  let cur = 0, timer = null, auto = true;
  const btns = STEPS.map((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button"><i></i><span class="t">${s.t}</span><span class="s">${s.s}</span></button>`;
    list.appendChild(li);
    const b = li.firstChild;
    b.addEventListener('click', () => { auto = false; clearTimeout(timer); show(i); });
    return b;
  });
  function show(i) {
    cur = i;
    btns.forEach((b, j) => { b.classList.toggle('on', j === i); b.classList.remove('run'); });
    const s = STEPS[i];
    term.innerHTML = s.term.map(l => `<span class="ln">${l || ' '}</span>`).join('');
    $$('.ln', term).forEach((l, j) => setTimeout(() => l.classList.add('in'), REDUCED ? 0 : 60 + j * 90));
    note.textContent = s.note;
    if (auto) {
      void btns[i].offsetWidth; btns[i].style.setProperty('--dur', '7s'); btns[i].classList.add('run');
      timer = setTimeout(() => show((i + 1) % STEPS.length), 7000);
    }
  }
  show(0); auto = false; btns[0].classList.remove('run');
  onVisible($('#fig-episode'), () => { auto = true; show(0); }, .4);
})();

/* ================================================================== action glyphs */
(function () {
  const chain = (svg, n) => {
    for (let i = 0; i < n; i++) { if (i) el('line', { x1: 18 + (i - 1) * 34, x2: 18 + i * 34, y1: 36, y2: 36, stroke: '#b7bec7', 'stroke-width': 1.6 }, svg); el('circle', { cx: 18 + i * 34, cy: 36, r: 6, fill: '#c9cfd6' }, svg); }
  };
  const a = $('#act-c'), b = $('#act-n'), c = $('#act-a');
  if (!a) return;
  chain(a, 3);
  el('line', { x1: 86, x2: 120, y1: 36, y2: 36, stroke: C.green, 'stroke-width': 2 }, a);
  el('circle', { cx: 120, cy: 36, r: 7.5, fill: C.green }, a);
  el('path', { d: 'M120,32.5v7M116.5,36h7', stroke: '#fff', 'stroke-width': 1.6 }, a);
  tx(a, 120, 60, 'new commit', { 'text-anchor': 'middle', 'font-size': 10.5, fill: '#69707a' });
  chain(b, 3);
  el('circle', { cx: 86, cy: 36, r: 9.5, fill: 'none', stroke: C.ink, 'stroke-width': 1.3 }, b);
  el('rect', { x: 128, y: 14, width: 30, height: 38, rx: 2, fill: '#fff', stroke: '#8b95a1' }, b);
  el('path', { d: 'M134,24h18M134,30h18M134,36h12', stroke: '#b7bec7', 'stroke-width': 1.4 }, b);
  el('path', { d: 'M134,44 l3,3 l6,-6', stroke: C.green, 'stroke-width': 1.6, fill: 'none' }, b);
  el('path', { d: 'M96,36 C108,36 112,33 127,33', stroke: '#8b95a1', 'stroke-dasharray': '2 3', fill: 'none' }, b);
  tx(b, 143, 62, 'record', { 'text-anchor': 'middle', 'font-size': 10.5, fill: '#69707a' });
  chain(c, 3);
  el('line', { x1: 86, x2: 120, y1: 36, y2: 36, stroke: '#c9cfd6', 'stroke-width': 1.6, 'stroke-dasharray': '2 3' }, c);
  el('circle', { cx: 120, cy: 36, r: 7.5, fill: 'none', stroke: '#a0a6ae', 'stroke-dasharray': '2.5 2.5', 'stroke-width': 1.4 }, c);
  tx(c, 120, 60, 'nothing published', { 'text-anchor': 'middle', 'font-size': 10.5, fill: '#69707a' });
})();

/* ================================================================== Figure 6: decentralized readout */
(function () {
  const host = $('#readout'); if (!host) return;
  const CAND = [
    { id: 'A', sha: '7ce1034', x: 300, y: 92, desc: 'integration of three branches' },
    { id: 'B', sha: '1e5a9ad', x: 246, y: 44, desc: 'CLI-focused candidate' },
    { id: 'C', sha: '9ac922c', x: 222, y: 140, desc: 'regex-focused candidate' },
    { id: 'D', sha: 'b80d1e2', x: 150, y: 92, desc: 'early full draft' },
  ];
  const G = [[40, 92], [96, 44], [96, 92], [96, 140], [150, 92], [176, 44], [170, 140], [222, 140], [246, 44], [300, 92], [350, 44]];
  const GE = [[0, 1], [0, 2], [0, 3], [2, 4], [1, 5], [3, 6], [6, 7], [5, 8], [4, 9], [8, 10]];
  const GS = [[8, 9], [7, 9]];
  const votes = ['B', 'A', 'B', 'A', 'C', 'A', 'B', 'A', 'D', 'A'];
  function draw(anim) {
    host.innerHTML = '';
    const svg = el('svg', { viewBox: '0 0 960 190', class: 'd' }, host);
    const gg = el('g', { transform: 'translate(10,6)' }, svg);
    GE.forEach(([a, b]) => el('path', { d: curve(G[a][0], G[a][1], G[b][0], G[b][1]), fill: 'none', stroke: '#c3c9d1', 'stroke-width': 1.5 }, gg));
    GS.forEach(([a, b]) => el('path', { d: curve(G[a][0], G[a][1], G[b][0], G[b][1]), fill: 'none', stroke: '#8a67cf', 'stroke-width': 1.2, 'stroke-dasharray': '3 3', opacity: .7 }, gg));
    G.forEach(([x, y], i) => i === 0 ? el('rect', { x: x - 5, y: y - 5, width: 10, height: 10, fill: '#4b5159' }, gg) : el('circle', { cx: x, cy: y, r: 5.5, fill: '#c9cfd6' }, gg));
    tx(gg, 196, 182, 'commit graph (keeps growing)', { 'text-anchor': 'middle', 'font-size': 11, fill: '#8a919a' });
    const cn = {};
    CAND.forEach(c => {
      const g = el('g', {}, gg);
      el('circle', { cx: c.x, cy: c.y, r: 7.5, fill: C.blue }, g);
      tx(g, c.x, c.y + 3.6, c.id, { 'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': 600, fill: '#fff' });
      const ring = el('circle', { cx: c.x, cy: c.y, r: 13, fill: 'none', stroke: C.green, 'stroke-width': 2, opacity: 0 }, g);
      cn[c.id] = { g, ring, c };
    });
    // tally
    const TX = 470, rows = {};
    tx(gg, TX, 14, 'Nomination records', { 'font-size': 12, 'font-weight': 600, fill: C.ink });
    tx(gg, TX + 330, 14, 'separate from the graph', { 'font-size': 11, fill: '#8a919a' });
    CAND.forEach((c, i) => {
      const y = 40 + i * 34;
      const g = el('g', {}, gg);
      const bg = el('rect', { x: TX - 8, y: y - 13, width: 478, height: 28, rx: 3, fill: 'none' }, g);
      el('circle', { cx: TX + 6, cy: y + 1, r: 7, fill: C.blue }, g);
      tx(g, TX + 6, y + 4.5, c.id, { 'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': 600, fill: '#fff' });
      tx(g, TX + 22, y + 5, c.sha, { 'font-size': 12, fill: C.ink, 'font-family': 'Optimistic, Helvetica Neue, Helvetica, Arial, sans-serif' });
      tx(g, TX + 84, y + 5, c.desc, { 'font-size': 12, fill: '#69707a' });
      const cnt = tx(g, TX + 462, y + 5, '0', { 'font-size': 12.5, 'text-anchor': 'end', 'font-weight': 600, fill: C.ink, 'font-family': 'Optimistic, Helvetica Neue, Helvetica, Arial, sans-serif' });
      rows[c.id] = { y, g, bg, cnt, n: 0, pips: [] };
    });
    const verdict = tx(gg, TX, 182, '', { 'font-size': 12.5, fill: C.ink, 'font-weight': 500 });
    const pipX = (n) => TX + 290 + n * 17;
    const addPip = (id, instant) => {
      const R = rows[id];
      const p = el('rect', { x: pipX(R.n), y: R.y - 6, width: 11, height: 13, rx: 2, fill: C.green }, R.g);
      R.n++; R.cnt.textContent = R.n;
      if (!instant) fadeIn(p, 250);
      return p;
    };
    const finish = () => {
      const best = Object.entries(rows).sort((a, b) => b[1].n - a[1].n)[0][0];
      rows[best].bg.setAttribute('fill', '#eaf5ef');
      cn[best].ring.style.opacity = 1;
      verdict.textContent = `Budget exhausted → submit ${CAND.find(c => c.id === best).sha}, the most-nominated candidate`;
    };
    if (!anim) { votes.forEach(v => addPip(v, true)); finish(); return; }
    const nominator = el('g', { opacity: 0 }, gg);
    el('circle', { r: 5, fill: '#fff' }, nominator); el('circle', { r: 3.8, fill: C.ink }, nominator);
    (async () => {
      for (let i = 0; i < votes.length; i++) {
        const v = votes[i], c = cn[v].c;
        const sx0 = 40 + Math.random() * 300, sy0 = -2;
        nominator.setAttribute('opacity', 1);
        await tween(420, p => { nominator.setAttribute('transform', `translate(${sx0 + (c.x - sx0) * p},${sy0 + (c.y - 12 - sy0) * p})`); });
        const R = rows[v];
        const fly = el('rect', { x: c.x - 5, y: c.y - 6, width: 11, height: 13, rx: 2, fill: C.green }, gg);
        const tx0 = pipX(R.n), ty0 = R.y - 6;
        await tween(380, p => { fly.setAttribute('x', c.x - 5 + (tx0 - c.x + 5) * p); fly.setAttribute('y', c.y - 6 + (ty0 - c.y + 6) * p); });
        fly.remove(); addPip(v, true);
        nominator.setAttribute('opacity', 0);
        await wait(90);
      }
      finish();
    })();
  }
  const m = mount(host, draw);
  REPLAY.readout = m.replay;
})();

/* ================================================================== line chart */
function lineChart(host, cfg) {
  let st = Object.assign({}, cfg);
  let groups = {};
  function draw(anim) {
    host.innerHTML = '';
    const W = Math.max(320, host.clientWidth || 500), H = st.H || 300;
    const m = Object.assign({ l: 44, r: 18, t: 14, b: 44 }, st.m || {});
    const w = W - m.l - m.r, h = H - m.t - m.b;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, host);
    const g = el('g', { transform: `translate(${m.l},${m.t})` }, svg);
    const X = st.x, Y = st.y;
    const sx = (X.log ? lg : lin)(X.d[0], X.d[1], 0, w), sy = lin(Y.d[0], Y.d[1], h, 0);
    axes(g, sx, sy, w, h, { xt: X.ticks, yt: Y.ticks, xf: X.fmt, yf: Y.fmt, xTitle: X.title });
    (st.refs || []).forEach(r => {
      const yy = sy(r.v);
      el('line', { x1: 0, x2: w, y1: yy, y2: yy, stroke: '#8d949d', 'stroke-dasharray': '2 3' }, g);
      if (r.label) tx(g, r.left ? 4 : w - 2, yy - 5, r.label, { 'text-anchor': r.left ? 'start' : 'end', 'font-size': 11, fill: '#69707a' });
    });
    const cp = clip(svg, -8, -14, anim ? 0 : w + 30, h + 28);
    const plot = el('g', { 'clip-path': cp.url }, g);
    groups = {};
    const ends = [];
    st.series.forEach(s => {
      const gg = el('g', {}, plot); groups[s.key] = gg;
      const pts = s.pts.map(p => [sx(p[0]), sy(p[1])]);
      el('path', { d: 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L'), fill: 'none', stroke: s.color, 'stroke-width': s.width || 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': s.dash ? '5 4' : null }, gg);
      const vf = s.vfmt || (v => String(v));
      if (s.marks) pts.forEach((p, i) => {
        if (s.marks === 'dot') el('circle', { cx: p[0], cy: p[1], r: 3, fill: s.color }, gg);
        else el('circle', { cx: p[0], cy: p[1], r: 3.8, fill: '#fff', stroke: s.color, 'stroke-width': 1.9 }, gg);
        if (s.vals) {
          tx(gg, p[0], p[1] - 9, vf(s.pts[i][1]), { 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: s.color });
          if (s.labels && s.labels[i]) tx(gg, p[0], p[1] + 17, s.labels[i], { 'text-anchor': 'middle', 'font-size': 9.5, fill: '#8a919a' });
        } else if (s.labels && s.labels[i]) tx(gg, p[0] + (s.lx || 0), p[1] + (s.ly || -10), s.labels[i], { 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 500, fill: s.color });
      });
      if (s.peak) {
        let k = 0; s.pts.forEach((q, i) => { if (q[1] >= s.pts[k][1]) k = i; });
        tx(gg, pts[k][0], pts[k][1] - 9, vf(s.pts[k][1]), { 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: s.color });
      }
      if (s.end) { const L = pts[pts.length - 1]; ends.push({ x: L[0], y: L[1], text: vf(s.pts[s.pts.length - 1][1]), color: s.color, key: s.key }); }
    });
    // end-of-line values, nudged apart so they never overlap
    const endG = el('g', { opacity: anim && ends.length ? 0 : 1 }, g);
    ends.sort((a, b) => a.y - b.y);
    ends.forEach((e, i) => { e.ly = i ? Math.max(e.y, ends[i - 1].ly + 13) : e.y; });
    const over = ends.length ? ends[ends.length - 1].ly - (h + 4) : 0;
    if (over > 0) ends.forEach(e => { e.ly -= over; });
    ends.forEach(e => {
      tx(endG, e.x + 7, e.ly + 4, e.text, { 'font-size': 11.5, 'font-weight': 700, fill: e.color });
      el('circle', { cx: e.x, cy: e.y, r: 2.8, fill: e.color }, endG);
    });
    if (anim) wait(st.delay || 0).then(() => tween(st.dur || 2200, p => cp.r.setAttribute('width', (w + 30) * p))).then(() => tween(400, p => endG.setAttribute('opacity', p)));
  }
  const mt = mount(host, draw);
  return {
    hl: k => Object.entries(groups).forEach(([key, n]) => { n.style.transition = 'opacity .2s'; n.style.opacity = k === null || k === key ? 1 : .12; }),
    set(next, animate) { st = Object.assign({}, st, next); if (mt.seen || animate === false) draw(mt.seen && animate !== false); else { draw(false); const s = host.querySelector('svg'); if (s) s.style.opacity = 0; } },
    replay: mt.replay,
  };
}

/* ================================================================== Figure 7: scaling */
(function () {
  if (!$('#chart-pb')) return;
  const F = D.fig3;
  const pct = v => v.toFixed(1) + '%', one = v => v.toFixed(1);
  const fmtTok = v => v >= 1e9 ? (v / 1e9) + 'B' : v >= 1e6 ? (v / 1e6) + 'M' : (v / 1e3) + 'k';
  const pbS = [
    { key: 'gs_codex', name: 'GitSwarm (Codex workers)', color: C.blue, pts: F.gs_codex, marks: 'o', labels: ['B100', 'B200', 'B300', 'B500'], width: 2.5, vals: true, vfmt: pct },
    { key: 'gs_base', name: 'GitSwarm (base GPT-5.5)', color: C.purple, pts: F.gs_base, marks: 'o', labels: ['B100', 'B200', 'B300'], width: 2.3, vals: true, vfmt: pct },
    { key: 'forced_codex', name: 'Forced Codex (single agent)', color: C.orange, pts: F.forced_codex, marks: 'dot', width: 1.9, peak: true, vfmt: pct },
  ];
  const pb = lineChart($('#chart-pb'), {
    H: 300, series: pbS,
    x: { d: [4.5e7, 1.6e9], log: true, ticks: [1e8, 3e8, 1e9], fmt: fmtTok, title: 'input tokens per task' },
    y: { d: [59, 83], ticks: [60, 65, 70, 75, 80], fmt: v => v + '%' },
  });
  legend($('#key-pb'), pbS, pb.hl);
  const imoS = [
    { key: 'gs_gemini', name: 'GitSwarm', color: C.blue, pts: F.gs_gemini, marks: 'o', labels: ['B20', 'B40', 'B80', 'B120', 'B160'], width: 2.5, vals: true, vfmt: one },
    { key: 'forced_bash', name: 'Forced bash agent', color: C.orange, pts: F.forced_bash, marks: 'dot', width: 1.9, peak: true, vfmt: one },
    { key: 'forced_mini', name: 'Forced mini-SWE-agent', color: '#8a929c', pts: F.forced_mini, marks: 'dot', width: 1.9, peak: true, vfmt: one },
  ];
  const imo = lineChart($('#chart-imo'), {
    H: 300, series: imoS, m: { l: 34 },
    x: { d: [2.1e6, 4.2e7], log: true, ticks: [3e6, 1e7, 3e7], fmt: fmtTok, title: 'input tokens per problem' },
    y: { d: [18.5, 30.6], ticks: [20, 22, 24, 26, 28, 30], fmt: String },
    refs: [{ v: 30, label: 'all 30 solved', left: true }],
  });
  legend($('#key-imo'), imoS, imo.hl);
  REPLAY.scaling = () => { pb.replay(); imo.replay(); };
})();

/* ================================================================== commit-graph plot (Figures 8, 11) */
function mapPath(d, fx, fy) {
  return d.replace(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g, (_, a, b) => fx(+a).toFixed(1) + ',' + fy(+b).toFixed(1))
    .replace(/H(-?\d+\.?\d*)/g, (_, a) => 'H' + fx(+a).toFixed(1)).replace(/V(-?\d+\.?\d*)/g, (_, a) => 'V' + fy(+a).toFixed(1));
}

/* Figure 8: FFmpeg winner ancestry */
(function () {
  const host = $('#ffmpeg'); if (!host) return;
  const G = D.graphs.ffmpeg;
  const count = $('#ffmpeg-count');
  const nodes = G.nodes, edges = G.edges;
  const isRoot = n => n[3] === '#3c3b38', isWin = n => n[4] === '#183d32';
  const inA = n => n[3] === '#159a73';
  const nAnc = nodes.filter(n => inA(n) && !isWin(n)).length, nAll = nodes.filter(n => !isRoot(n) && !isWin(n)).length;
  function draw(anim) {
    host.innerHTML = '';
    const W = Math.max(340, host.clientWidth || 800), H = Math.round(Math.min(300, Math.max(190, W * .27)));
    const m = { l: 20, r: 24, t: 14, b: 30 };
    const fx = lin(14, 338, m.l, W - m.r), fy = lin(22, 106, m.t, H - m.b);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, host);
    const ax = el('g', { class: 'ax' }, svg);
    el('path', { class: 'b', d: `M${m.l},${H - m.b + 8}H${W - m.r}` }, ax);
    tx(ax, m.l, H - m.b + 24, 'run start', {});
    tx(ax, W - m.r, H - m.b + 24, 'run end', { 'text-anchor': 'end' });
    const base = el('g', {}, svg), grn = el('g', {}, svg), top = el('g', {}, svg);
    const r = W < 600 ? 3 : 3.8;
    edges.forEach(e => el('path', { d: mapPath(e[0], fx, fy), fill: 'none', stroke: '#d3d7dc', 'stroke-width': 1 }, base));
    nodes.forEach(n => { if (!isRoot(n) && !isWin(n)) el('circle', { cx: fx(n[0]), cy: fy(n[1]), r, fill: '#cfd3d8', stroke: '#fff', 'stroke-width': .8 }, base); });
    edges.forEach(e => { if (e[1] === '#58ad91') el('path', { d: mapPath(e[0], fx, fy), fill: 'none', stroke: C.green, 'stroke-width': 1.1, opacity: .55 }, grn); });
    nodes.forEach(n => { if (inA(n) && !isWin(n)) el('circle', { cx: fx(n[0]), cy: fy(n[1]), r, fill: C.green, stroke: '#fff', 'stroke-width': .8 }, grn); });
    const root = nodes.find(isRoot), win = nodes.find(isWin);
    el('rect', { x: fx(root[0]) - 4.5, y: fy(root[1]) - 4.5, width: 9, height: 9, fill: '#4b5159' }, top);
    const wx = fx(win[0]), wy = fy(win[1]);
    const wg = el('g', {}, top);
    el('circle', { cx: wx, cy: wy, r: 6.5, fill: C.green, stroke: C.ink, 'stroke-width': 1.4 }, wg);
    el('circle', { cx: wx, cy: wy, r: 11, fill: 'none', stroke: C.ink, 'stroke-width': 1 }, wg);
    tx(wg, wx, wy - 17, 'selected winner', { 'text-anchor': 'middle', 'font-size': 11.5, 'font-weight': 600, fill: C.ink });
    const cpB = clip(svg, 0, 0, anim ? 0 : W, H), cpG = clip(svg, anim ? wx : 0, 0, anim ? 0 : W, H);
    base.setAttribute('clip-path', cpB.url); grn.setAttribute('clip-path', cpG.url);
    const final = `${(nAnc / nAll * 100).toFixed(1)}% of commits in the winner's ancestry`;
    if (!anim) { count.textContent = final; return; }
    wg.style.opacity = 0; count.textContent = '';
    (async () => {
      await tween(2200, p => { cpB.r.setAttribute('width', W * p); count.textContent = `${Math.round(nAll * Math.min(1, p * 1.04))} commits`; }, t => t);
      await fadeIn(wg, 350);
      await wait(250);
      await tween(1700, p => { cpG.r.setAttribute('x', wx + 14 - (wx + 14) * p); cpG.r.setAttribute('width', (wx + 14) * p); count.textContent = `tracing ancestry… ${Math.round(nAnc * p)} of ${nAll}`; });
      count.textContent = final;
    })();
  }
  const m = mount(host, draw);
  REPLAY.ffmpeg = m.replay;
})();

/* Figure 9: ancestry bars */
function ancestryBars(host, opt) {
  opt = opt || {};
  const A = D.ancestry;
  function draw(anim) {
    host.innerHTML = '';
    const W = Math.max(340, host.clientWidth || 800), H = opt.H || 270;
    const m = { l: 40, r: 10, t: 30, b: 34 };
    const w = W - m.l - m.r, h = H - m.t - m.b;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, host);
    const g = el('g', { transform: `translate(${m.l},${m.t})` }, svg);
    const sy = lin(0, 100, h, 0);
    const ax = el('g', { class: 'ax' }, g);
    [0, 25, 50, 75, 100].forEach(v => { el('line', { class: 'g', x1: 0, x2: w, y1: sy(v), y2: sy(v) }, ax); tx(ax, -8, sy(v) + 3.6, v + '%', { 'text-anchor': 'end' }); });
    const groups = [['ProgramBench', A.pb], ['IMOProofBench-Advanced', A.imo]];
    const n = A.pb.length + A.imo.length, gap = w * .08;
    const slot = (w - gap) / n, bw = Math.min(46, slot * .62);
    let x0 = 0;
    const segs = [];
    groups.forEach(([name, rows], gi) => {
      const gw = slot * rows.length;
      tx(g, x0 + gw / 2, -14, name, { 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 600, fill: C.ink });
      rows.forEach(([lab, git, tot], i) => {
        const cx = x0 + slot * (i + .5), x = cx - bw / 2;
        el('rect', { x, y: 0, width: bw, height: h, fill: '#e4e6e9' }, g);
        const r1 = el('rect', { x, y: sy(0), width: bw, height: 0, fill: '#2c5f9e' }, g);
        const r2 = el('rect', { x, y: sy(git), width: bw, height: 0, fill: '#8fbbe9' }, g);
        const t = tx(g, cx, sy(tot) - 6, Math.round(tot) + '%', { 'text-anchor': 'middle', 'font-size': 11.5, 'font-weight': 600, fill: C.ink });
        tx(g, cx, h + 17, lab, { 'text-anchor': 'middle', 'font-size': 11, fill: '#727983' });
        const tg = tx(g, cx, sy(git / 2) + 4, Math.round(git) + '%', { 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 600, fill: '#fff' });
        segs.push({ r1, r2, t, tg, git, tot, d: (opt.delay || 0) + (gi * 5 + i) * 110 });
      });
      x0 += gw + gap;
    });
    const set = (s, p1, p2) => {
      s.r1.setAttribute('y', sy(s.git * p1)); s.r1.setAttribute('height', sy(0) - sy(s.git * p1));
      const top = s.git + (s.tot - s.git) * p2;
      s.r2.setAttribute('y', sy(top)); s.r2.setAttribute('height', Math.max(0, sy(s.git) - sy(top)));
    };
    if (!anim) { segs.forEach(s => set(s, 1, 1)); return; }
    segs.forEach(s => {
      set(s, 0, 0); s.t.style.opacity = 0; s.tg.style.opacity = 0;
      wait(s.d).then(() => tween(650, p => set(s, p, 0), easeOut)).then(() => { fadeIn(s.tg, 250); }).then(() => tween(750, p => set(s, 1, p), easeOut)).then(() => fadeIn(s.t, 250));
    });
  }
  return mount(host, draw);
}
if ($('#anc')) REPLAY.anc = ancestryBars($('#anc')).replay;

/* Figure 10: worker activity over the run */
(function () {
  if (!$('#activity-pb')) return;
  const ORDER = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#cfcec8', '#8a8984'];
  const COL = { '#2a78d6': '#3b78d8', '#eb6834': '#e8763d', '#1baf7a': '#27a98a', '#eda100': '#e4ac2e', '#e87ba4': '#d9769f', '#008300': '#2f7d4f', '#cfcec8': '#e1e4e8', '#8a8984': '#a5aab0' };
  const NAMES = {
    pb: ['Bootstrap (first version)', 'Capability expansion', 'Candidate synthesis', 'Fidelity repair', 'Empirical validation', 'Candidate selection (nomination)', 'Voluntary abstention', 'Invalid / no action'],
    imo: ['Initial proof', 'Proof exploration', 'Proof synthesis', 'Proof repair', 'Proof validation', 'Candidate selection (nomination)', 'Voluntary abstention', 'Invalid / no action'],
  };
  function setKey(bench) {
    legend($('#key-act-' + bench), NAMES[bench].map((n, i) => ({ name: n, color: COL[ORDER[i]], sq: true })).reverse().concat([{ name: 'all contributions', color: C.ink }]));
  }
  function draw(host, bench, anim) {
    host.innerHTML = '';
    const P = D.activity[bench];
    const W = Math.max(320, host.clientWidth || 800), H = 230;
    const m = { l: 38, r: 6, t: 22, b: 34 };
    const n = P.length, gap = W < 600 ? 8 : 16;
    const pw = (W - m.l - m.r - gap * (n - 1)) / n, h = H - m.t - m.b;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, host);
    const sy = lin(0, 1, h, 0);
    P.forEach((panel, pi) => {
      const g = el('g', { transform: `translate(${m.l + pi * (pw + gap)},${m.t})` }, svg);
      const sx = lin(0, 60, 0, pw);
      tx(g, 0, -8, panel.budget, { 'font-size': 12, 'font-weight': 600, fill: C.ink, 'font-family': 'Optimistic, Helvetica Neue, Helvetica, Arial, sans-serif' });
      const ax = el('g', { class: 'ax' }, g);
      if (pi === 0) [0, .5, 1].forEach(v => tx(ax, -6, sy(v) + 3.6, (v * 100) + '%', { 'text-anchor': 'end' }));
      tx(ax, 0, h + 15, '0%', { 'text-anchor': 'start' }); tx(ax, pw, h + 15, '100%', { 'text-anchor': 'end' });
      const cp = clip(svg, 0, -2, anim ? 0 : pw, h + 4);
      const plot = el('g', { 'clip-path': cp.url }, g);
      let prev = new Array(61).fill(0);
      ORDER.forEach(c => {
        const cur = panel.cum[c].map((v, i) => Math.max(v, prev[i]));
        const top = cur.map((v, i) => `${sx(i).toFixed(1)},${sy(Math.min(1, v)).toFixed(1)}`);
        const bot = prev.map((v, i) => `${sx(i).toFixed(1)},${sy(Math.min(1, v)).toFixed(1)}`).reverse();
        el('path', { d: 'M' + top.join('L') + 'L' + bot.join('L') + 'Z', fill: COL[c], stroke: COL[c], 'stroke-width': .4 }, plot);
        prev = cur;
      });
      const contrib = panel.cum['#e87ba4'];
      el('path', { d: 'M' + contrib.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join('L'), fill: 'none', stroke: C.ink, 'stroke-width': 1.3 }, plot);
      el('rect', { x: 0, y: 0, width: pw, height: h, fill: 'none', stroke: '#d5d9de' }, g);
      if (anim) wait(pi * 160).then(() => tween(1500, p => cp.r.setAttribute('width', pw * p), t => t));
    });
    tx(svg, m.l + (W - m.l - m.r) / 2, H - 4, 'progress through the run (share of workers spawned)', { 'text-anchor': 'middle', 'font-size': 11.5, fill: '#5d646d', 'font-weight': 500 });
  }
  const ms = ['pb', 'imo'].map(b => { setKey(b); const host = $('#activity-' + b); return mount(host, anim => draw(host, b, anim)); });
  REPLAY.activity = () => ms.forEach(m => m.replay());
})();

/* Figure 11: workflows */
(function () {
  if (!$('#flow-delta')) return;
  const COL = { '#1baf7a': C.teal, '#eda100': C.amber, '#e87ba4': C.pink, '#4a3aa7': C.purple, '#eb6834': C.orange, '#2a78d6': C.blue, '#0b0b0b': C.ink, '#52514e': '#4b5159', '#e1e0d9': '#e3e6e9', '#cfcec8': '#d6dade' };
  const CFG = {
    delta: { xr: [14.0, 198.65], yr: [34, 134], key: [['integrated input branches', C.teal, 1], ['other commits', '#cfd3d8', 1]] },
    cheat: { xr: [48.85, 233.45], yr: [16, 136], key: [['CLI / configuration', C.orange, 1], ['renderers', C.blue, 1], ['other commits', '#cfd3d8', 1]] },
  };
  function setKey(which) {
    const k = $('#key-flow-' + which);
    if (which === 'delta') k.innerHTML = `<span><i class="sq" style="background:${C.teal};border-radius:50%"></i><i class="sq" style="background:${C.amber};border-radius:50%;margin-left:-4px"></i><i class="sq" style="background:${C.pink};border-radius:50%;margin-left:-4px"></i>separately developed branches</span><span><i class="sq" style="background:#e3e6e9;border-radius:50%;box-shadow:inset 0 0 0 1px #a9afb7"></i>other commits</span><span>◆ strongest integration</span><span>◎ selected winner</span>`;
    else k.innerHTML = `<span><i class="sq" style="background:${C.orange};border-radius:50%"></i>CLI / configuration</span><span><i class="sq" style="background:${C.blue};border-radius:50%"></i>renderers</span><span><i class="sq" style="background:#e3e6e9;border-radius:50%;box-shadow:inset 0 0 0 1px #a9afb7"></i>other commits</span><span>◎ selected winner</span>`;
  }
  function draw(host, which, anim) {
    host.innerHTML = '';
    const G = D.graphs[which], cf = CFG[which];
    const W = Math.max(320, host.clientWidth || 800), H = Math.round(Math.min(330, Math.max(240, W * .3)));
    const m = { l: 46, r: 24, t: which === 'delta' ? 46 : 26, b: 40 };
    const fx = lin(cf.xr[0], cf.xr[1], m.l, W - m.r), fy = lin(cf.yr[0], cf.yr[1], m.t, H - m.b);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, host);
    const ax = el('g', { class: 'ax' }, svg);
    [0, .25, .5, .75, 1].forEach(v => { const x = m.l + (W - m.l - m.r) * v; el('line', { class: 'g', x1: x, x2: x, y1: m.t - 10, y2: H - m.b + 6 }, ax); tx(ax, x, H - m.b + 20, (v * 100) + '%', { 'text-anchor': 'middle' }); });
    tx(ax, m.l + (W - m.l - m.r) / 2, H - 4, 'normalized task runtime', { 'text-anchor': 'middle', class: 'ttl' });
    const plot = el('g', {}, svg), ann = el('g', {}, svg);
    const small = which === 'cheat';
    G.edges.forEach(e => {
      if (e[1] === '#0b0b0b') return;
      const c = COL[e[1]] || '#d6dade';
      const bold = e[2] > .9;
      el('path', { d: mapPath(e[0], fx, fy), fill: 'none', stroke: c, 'stroke-width': bold ? 2 : small ? .6 : 1, opacity: small ? .45 : c === '#d6dade' ? 1 : .9 }, plot);
    });
    const r0 = small ? 2.3 : 3.8;
    G.nodes.forEach(n => {
      const x = fx(n[0]), y = fy(n[1]), c = COL[n[3]] || n[3];
      if (n[3] === '#52514e') { el('rect', { x: x - 4, y: y - 4, width: 8, height: 8, fill: c }, plot); return; }
      if (n[3] === '#0b0b0b') {
        if (n[5] === 'd') el('path', { d: `M${x},${y - 7}L${x + 7},${y}L${x},${y + 7}L${x - 7},${y}Z`, fill: C.ink, stroke: '#fff' }, ann);
        else { el('circle', { cx: x, cy: y, r: 5, fill: C.ink }, ann); el('circle', { cx: x, cy: y, r: 9, fill: 'none', stroke: C.ink, 'stroke-width': 1.2 }, ann); }
        return;
      }
      const grey = n[3] === '#e1e0d9';
      el('circle', { cx: x, cy: y, r: grey ? r0 * .9 : r0, fill: c, stroke: grey ? '#a9afb7' : '#fff', 'stroke-width': grey ? .7 : .6 }, plot);
    });
    const lab = (x, y, s, a) => tx(ann, x, y, s, Object.assign({ 'font-size': 11.5, 'font-weight': 600, fill: C.ink }, a || {}));
    if (which === 'delta') {
      // stacked, right-aligned labels so they stay inside a half-width panel
      lab(fx(162.4) - 4, fy(40.8) - 12, 'strongest integration', { 'text-anchor': 'end' });
      lab(fx(184.66) + 10, fy(40.8) - 28, 'selected winner', { 'text-anchor': 'end' });
      tx(ann, fx(10.3) - 8, fy(89) + 4, 'root', { 'text-anchor': 'end', 'font-size': 11, fill: '#69707a' });
    } else {
      const px = m.l + (W - m.l - m.r) * .35;
      el('line', { x1: px, x2: px, y1: m.t - 10, y2: H - m.b + 4, stroke: C.ink, 'stroke-width': 1 }, ann);
      lab(px + 6, H - m.b - 4, 'pivot: burst of renderer experiments', { 'font-weight': 500, 'font-size': 11 });
      lab(fx(232.37) - 2, fy(83.7) - 15, 'selected winner', { 'text-anchor': 'end' });
      tx(ann, m.l - 6, fy(44), 'CLI', { 'text-anchor': 'end', 'font-size': 11, fill: C.orange, 'font-weight': 600 });
      tx(ann, m.l - 6, fy(108), 'render', { 'text-anchor': 'end', 'font-size': 11, fill: C.blue, 'font-weight': 600 });
    }
    if (!anim) return;
    const cp = clip(svg, 0, 0, 0, H);
    plot.setAttribute('clip-path', cp.url); ann.style.opacity = 0;
    tween(2600, p => cp.r.setAttribute('width', W * p), t => t).then(() => fadeIn(ann, 400));
  }
  const ms = ['delta', 'cheat'].map(w => { setKey(w); const host = $('#flow-' + w); return mount(host, anim => draw(host, w, anim)); });
  REPLAY.flow = () => ms.forEach(m => m.replay());
})();

/* ================================================================== Figure 12: research */
(function () {
  const host = $('#chart-res'); if (!host) return;
  const R = D.research;
  const hours = v => v + ' h';
  const f3 = v => v.toFixed(3);
  const TASKS = {
    rmt: {
      x: { d: [0, 72], ticks: [0, 12, 24, 36, 48, 60, 72], fmt: hours, title: 'active research time' },
      y: { d: [2.86, 3.22], ticks: [2.9, 3.0, 3.1, 3.2], fmt: v => v.toFixed(1) },
      refs: [{ v: 3.158, label: 'reference 3.158' }],
      series: [
        { key: 'gs_8gpu', name: 'GitSwarm · 8 GPUs', color: C.blue, pts: R.rmt.gs_8gpu, width: 2.5, end: true, vfmt: f3 },
        { key: 'gs_4gpu', name: 'GitSwarm · 4 GPUs', color: C.purple, pts: R.rmt.gs_4gpu, width: 2.2, end: true, vfmt: f3 },
        { key: 'direct_gpt', name: 'Single agent (direct GPT)', color: C.orange, pts: R.rmt.direct_gpt, width: 2, end: true, vfmt: f3 },
        { key: 'gs_seeded', name: 'GitSwarm seeded with 3 earlier runs', color: C.pink, pts: R.rmt.gs_seeded, width: 2, dash: true, end: true, vfmt: f3 },
      ],
      head: [['2.890', 'held-out loss, 8-GPU swarm', 1], ['2.894', 'held-out loss, 4-GPU swarm', 1], ['3.147', 'reference model']],
      note: 'Chart: best development loss so far (lower is better). All three headline models train on the same 1.3B tokens. The single agents reached 2.927 (direct GPT, 3.0B tokens) and 2.690 (Codex, 10.1B tokens), mostly by training longer rather than by changing the architecture.',
    },
    looped: {
      x: { d: [0, 26], ticks: [0, 6, 12, 18, 24], fmt: hours, title: 'active research time' },
      y: { d: [3.1, 4.25], ticks: [3.2, 3.4, 3.6, 3.8, 4.0, 4.2], fmt: v => v.toFixed(1) },
      refs: [{ v: 3.265, label: 'reference 3.265', left: true }],
      series: [
        { key: 'gs_55', name: 'GitSwarm (GPT-5.5)', color: C.blue, pts: R.looped.gs_55, width: 2.5, end: true, vfmt: f3 },
        { key: 'direct_55', name: 'Single agent (direct GPT-5.5)', color: C.orange, pts: R.looped.direct_55, width: 2, end: true, vfmt: f3 },
        { key: 'codex_55', name: 'Codex agent (GPT-5.5)', color: C.teal, pts: R.looped.codex_55, width: 2, end: true, vfmt: f3 },
      ],
      head: [['3.187', 'GitSwarm', 1], ['3.265', 'reference'], ['3.274', 'direct GPT'], ['3.479', 'Codex']],
      note: 'Chart: best development loss so far at eight loop iterations, first 26 hours (runs still in progress at the time of writing). A parameter-matched control reaches 3.212, so most of the gain is not just extra parameters.',
    },
    nanochat: {
      x: { d: [0, 24], ticks: [0, 6, 12, 18, 24], fmt: hours, title: 'active research time' },
      y: { d: [0.895, 1.0], ticks: [0.9, 0.92, 0.94, 0.96, 0.98, 1.0], fmt: v => v.toFixed(2) },
      refs: [{ v: 0.993, label: 'start ≈ 0.993' }],
      // all runs in one chart: solid = GB300 GPUs, dashed = H200 GPUs
      series: [
        { key: 'gs_astra', name: 'GitSwarm · GPT-6 Astra (GB300)', color: C.blue, pts: R.nanochat.gs_astra, width: 2.5, end: true, vfmt: f3 },
        { key: 'gs_sol', name: 'GitSwarm · GPT-5.6 Sol (GB300)', color: C.purple, pts: R.nanochat.gs_sol, width: 2.2, end: true, vfmt: f3 },
        { key: 'codex_sol', name: 'Codex agent · GPT-5.6 Sol (GB300)', color: C.teal, pts: R.nanochat.codex_sol, width: 2, end: true, vfmt: f3 },
        { key: 'gs_astra_dashed', name: 'GitSwarm · GPT-6 Astra (H200)', color: C.blue, pts: R.nanochat.gs_astra_dashed, width: 2.2, dash: true, end: true, vfmt: f3 },
        { key: 'gs_sol_dashed', name: 'GitSwarm · GPT-5.6 Sol (H200)', color: C.purple, pts: R.nanochat.gs_sol_dashed, width: 2, dash: true, end: true, vfmt: f3 },
        { key: 'evo_astra_dashed', name: 'Evolutionary search · GPT-6 Astra (H200)', color: C.orange, pts: R.nanochat.evo_astra_dashed, width: 2, dash: true, end: true, vfmt: f3 },
        { key: 'evo_sol_dashed', name: 'Evolutionary search · GPT-5.6 Sol (H200)', color: C.pink, pts: R.nanochat.evo_sol_dashed, width: 2, dash: true, end: true, vfmt: f3 },
      ],
      head: [['0.905', 'validation bits per byte, GitSwarm (Astra, GB300)', 1], ['0.993', 'starting model'], ['1,465', 'models trained in 24 h']],
      note: 'Chart: best validation bits per byte so far (lower is better). Solid lines ran on GB300 GPUs and dashed lines on H200; starting points and hardware differ across runs, so compare lines within a hardware setting. Unlike the other two tasks, model size is not capped here.',
    },
  };
  const STORY = {
    rmt: {
      lanes: 4,
      main: [['Base', ''], ['Bug fix', '0.6 h'], ['Tied embeddings', '1.8 h'], ['+ SwiGLU', '5.9 h'], ['Full size', '11.8 h · 2.962'], ['+ Head router', '34.6 h · 2.934'], ['+ Wider attention', '53.1 h · 2.924'], ['+ Temporal mixer', '65.9 h · submitted'], ['Rank 64', '98.7 h · best']],
      times: [0, .6, 1.8, 5.9, 11.8, 34.6, 53.1, 65.9, 98.7],
      side: [
        { id: 's1', lane: 1, t: .8, k: 'side', label: 'SwiGLU', sub: '0.8 h', from: 1, to: 3 },
        { id: 'r1', lane: 2, t: 5.2, k: 'side', label: 'Head router', sub: '5.2 h', from: 2 },
        { id: 'r2', lane: 2, t: 15.1, k: 'side', label: 'full-size win', sub: '15.1 h', from: 'r1', to: 5 },
        { id: 'w1', lane: 3, t: 8.2, k: 'side', label: 'Wider attention', sub: '8.2 h', from: 3 },
        { id: 'w2', lane: 3, t: 23.6, k: 'side', label: 'full-size win', sub: '23.6 h', from: 'w1', to: 6 },
        { id: 'f1', lane: 4, t: 1.2, k: 'fail', label: "Previous-token memory fails", sub: '1.2 h', from: 1 },
        { id: 'm1', lane: 4, t: 50.8, k: 'side', label: 'Mixer over several earlier tokens', sub: '50.8 h', reuse: 'f1', reuseLabel: 'failure cited 49.5 h later', to: 7, labelLeft: true },
      ],
      lastHollow: true,
      text: '<p>The final model combines six changes, but only two were first written on its own line of commits. The other four were developed on side branches by other workers and ported in later, sometimes after being validated at full size on their own branch first.</p><p>One of them began as a failure. Letting each token read the previous token\'s memory did not help. 49.5 hours later another worker cited that failure as evidence that longer look-backs were still unexplored, built a mixer over several earlier tokens, and it entered the submitted model. Counting cited evidence, the best model depends on 24 commits by 24 different workers.</p>',
    },
    looped: {
      lanes: 3,
      main: [['Base', ''], ['Feed-forward adapter', '0.4 h · 52M'], ['Longer run', '0.7 h'], ['Quick check: "reject"', '2.1 h · 128 examples'], ['Re-check: keep', '3.3 h · 512 examples'], ['124M', '5.8 h'], ['308M, full size', '9.1 h · 3.187']],
      times: [0, .4, .7, 2.1, 3.3, 5.8, 9.1],
      doubt: 3,
      side: [
        { id: 'lf', lane: 1, t: .2, k: 'side', label: 'Loss fix (other branch)', sub: '', to: 1, nofrom: true },
        { id: 'g1', lane: 2, t: 1.3, k: 'side', label: 'Rival idea: state gate leads early', sub: '', from: 1, evid: 4 },
        { id: 'g2', lane: 2, t: 6.6, k: 'fail', label: 'gain vanishes at larger sizes', sub: '', from: 'g1', labelLeft: true },
        { id: 't1', lane: 3, t: 2.6, k: 'side', label: 'Shared fast-evaluation tool', sub: '', nofrom: true, evid: 4 },
        { id: 'p1', lane: 3, t: 7.6, k: 'side', label: '188M result', sub: '', nofrom: true, evid: 6, labelLeft: true },
      ],
      text: '<p>The winning change is small: the adapter that feeds the input back in at every loop becomes a gated feed-forward network. It was written in the first 25 minutes and then nearly dropped. A quick check on 128 examples scored it slightly worse than the reference, and its author wrote that it "should not be promoted".</p><p>About an hour later another worker re-evaluated the same checkpoint on 512 examples and found it clearly better; a third confirmed it on the full set and showed it beat the leading rival. It then won at every model size. Its code comes from one short line of six commits, but it cites 89 commits by 89 workers as evidence, mostly experiments and controls rather than code.</p>',
    },
    nanochat: {
      lanes: 3,
      main: [['Base', '0.993'], ['Wider model', ''], ['Head shape, window', ''], ['Hashed bigrams', ''], ['Back-loaded MLP', '0.913 by 3 h'], ['Pre-RoPE norm', ''], ['Shared trigrams', '23.1 h'], ['Bigger table', '23.7 h · 0.905']],
      ordinal: true,
      side: [
        { id: 'sw', lane: 1, x: 1.45, k: 'fail', label: 'SwiGLU fails at the new width', sub: '', from: 1 },
        { id: 'md', lane: 1, x: 3.4, k: 'side', label: 'MLP donor', sub: '', from: 3, to: 4 },
        { id: 'pr', lane: 1, x: 4.5, k: 'side', label: 'Norm reorder (other worker)', sub: '', nofrom: true, to: 5 },
        { id: 'st', lane: 2, x: 2.6, k: 'fail', label: 'Separate trigram tables fail, twice', sub: '2.2 h', from: 3, reuseTo: 6, reuseLabel: 'failures cited ~21 h later' },
        { id: 'lp', lane: 3, x: 5.2, k: 'doubt', label: 'Shared-table idea (inconclusive)', sub: '', nofrom: true, evid: 6, labelLeft: true },
      ],
      text: '<p>In 24 hours the swarm cut validation bits per byte from 0.993 to 0.905 over 1,465 training runs. The final model combines changes developed on separate branches: a wider model, different attention shapes, and hashed bigram and trigram embeddings.</p><p>The trigram idea failed first: separate trigram tables made the model worse, twice. About 21 hours later another worker cited both failures, reused their hashing scheme in a single shared table borrowed from a third branch, and a fourth worker enlarged that table into the 24-hour incumbent. 70% of the run\'s negative results were cited by later work.</p>',
    },
  };
  let task = 'rmt';
  const seriesFor = t => TASKS[t].series;
  const chart = lineChart(host, Object.assign({ H: 300, dur: 2400, m: { r: 56 } }, TASKS.rmt, { series: TASKS.rmt.series }));
  function setHead() {
    const T = TASKS[task];
    $('#res-head').innerHTML = T.head.map(([v, l, gs]) => `<div><b class="${gs ? 'gs' : ''}">${v}</b>${l}</div>`).join('');
    $('#res-note').textContent = T.note;
    const key = $('#key-res');
    legend(key, seriesFor(task), chart.hl);
    $('#story-text').innerHTML = STORY[task].text;
  }

  /* story graph */
  const shost = $('#story');
  let storySeen = false;
  function story(anim) {
    shost.innerHTML = '';
    const S = STORY[task];
    const W = 1000, top = 64, gapY = 52, H = top + S.lanes * gapY + 36;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'd' }, shost);
    const defs = el('defs', {}, svg);
    const mk = (id, c) => { const m = el('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, defs); el('path', { d: 'M1,1 L9,5 L1,9', fill: 'none', stroke: c, 'stroke-width': 1.6 }, m); };
    mk('ar-b', C.blue); mk('ar-p', C.purple); mk('ar-g', '#9aa1a9');
    const n = S.main.length, x0 = 50, x1 = W - 60;
    const mx = i => x0 + (x1 - x0) * i / (n - 1);
    const xAt = t => {   // position of a time between main commits
      for (let i = 0; i < n - 1; i++) if (t <= S.times[i + 1]) return mx(i) + (mx(i + 1) - mx(i)) * (t - S.times[i]) / (S.times[i + 1] - S.times[i]);
      return mx(n - 1);
    };
    const Y = l => top + l * gapY;
    const pos = {};
    S.main.forEach((m, i) => { pos[i] = [mx(i), Y(0)]; });
    S.side.forEach(s => { pos[s.id] = [S.ordinal ? mx(s.x) : xAt(s.t), Y(s.lane)]; });
    const eg = el('g', {}, svg), ng = el('g', {}, svg), lg2 = el('g', {}, svg);
    const ev = [];   // [time-order, element, kind]
    const E = (a, b, kind, label) => {
      const [xa, ya] = pos[a], [xb, yb] = pos[b];
      let d;
      if (kind === 'main') d = `M${xa},${ya}L${xb},${yb}`;
      else if (Math.abs(ya - yb) < 1) d = `M${xa + 9},${ya}L${xb - 10},${yb}`;
      else if ((kind === 'evid' || kind === 'reuse') && ya > yb && xb - xa > 90) {   // run along the lane, then rise into the target
        const xt = xb - 46;
        d = `M${xa + 9},${ya}L${xt},${ya}C${xb - 14},${ya} ${xb - 4},${yb + 34} ${xb - 2},${yb + 10}`;
      }
      else d = curve(xa + (kind === 'branch' ? 0 : 6), ya, xb - (ya > yb ? 8 : 0), yb + (ya > yb ? 8 : -8));
      const st = {
        main: { stroke: C.green, 'stroke-width': 3.2 },
        branch: { stroke: '#b9c1cb', 'stroke-width': 1.4 },
        port: { stroke: C.blue, 'stroke-width': 1.6, 'marker-end': 'url(#ar-b)' },
        reuse: { stroke: C.purple, 'stroke-width': 1.7, 'stroke-dasharray': '5 4', 'marker-end': 'url(#ar-p)' },
        evid: { stroke: '#9aa1a9', 'stroke-width': 1.3, 'stroke-dasharray': '3 4', 'marker-end': 'url(#ar-g)' },
      }[kind];
      const p = el('path', Object.assign({ d, fill: 'none' }, st), kind === 'main' ? ng : eg);
      let lab = null;
      if (label) {
        const lx = xa + 18, ly = ya - 8;
        lab = tx(lg2, lx, ly, label, { 'text-anchor': 'start', 'font-size': 11.5, 'font-style': 'italic', fill: C.purple, 'font-family': 'Optimistic, Helvetica Neue, Helvetica, Arial, sans-serif' });
      }
      return { p, lab };
    };
    const order = [];
    // main line
    S.main.forEach((m, i) => order.push({ t: S.ordinal ? i : S.times[i] + i * 1e-3, kind: 'main', i }));
    S.side.forEach(s => order.push({ t: S.ordinal ? s.x : s.t, kind: 'side', s }));
    order.sort((a, b) => a.t - b.t);
    const nodeEls = {};
    const drawNode = (key, x, y, k, label, sub, below, left) => {
      const g = el('g', {}, ng);
      if (k === 'base') el('circle', { cx: x, cy: y, r: 6.5, fill: '#59616b' }, g);
      else if (k === 'main') el('circle', { cx: x, cy: y, r: 7, fill: C.green, stroke: '#fff', 'stroke-width': 1.5 }, g);
      else if (k === 'best') { el('circle', { cx: x, cy: y, r: 7.5, fill: C.green }, g); el('circle', { cx: x, cy: y, r: 12, fill: 'none', stroke: C.green, 'stroke-width': 1.5 }, g); }
      else if (k === 'hollow') { el('circle', { cx: x, cy: y, r: 7, fill: '#fff', stroke: C.green, 'stroke-width': 2.4 }, g); }
      else if (k === 'side') el('circle', { cx: x, cy: y, r: 6, fill: C.blue, stroke: '#fff', 'stroke-width': 1.5 }, g);
      else if (k === 'fail') { el('circle', { cx: x, cy: y, r: 7, fill: '#fff', stroke: C.red, 'stroke-width': 1.6 }, g); el('path', { d: `M${x - 3.5},${y - 3.5}l7,7m0,-7l-7,7`, stroke: C.red, 'stroke-width': 1.7 }, g); }
      else if (k === 'doubt') el('circle', { cx: x, cy: y, r: 7, fill: '#fff', stroke: C.amber, 'stroke-width': 2.4 }, g);
      if (below === 'main') {
        tx(g, x, y - 28, label, { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: k === 'doubt' ? '#9a6c05' : C.ink });
        if (sub) tx(g, x, y - 14, sub, { 'text-anchor': 'middle', 'font-size': 11, fill: '#69707a' });
      } else {
        const t = tx(g, x, y + 22, label, { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 500, fill: k === 'fail' ? '#a93a41' : k === 'doubt' ? '#8a6205' : C.ink });
        if (sub) { const ts = el('tspan', { fill: '#69707a', 'font-weight': 400, 'font-size': 11 }, t); ts.textContent = '\u00a0\u00b7\u00a0' + sub; }
      }
      nodeEls[key] = g;
      return g;
    };
    const steps = [];
    order.forEach(o => {
      if (o.kind === 'main') {
        const i = o.i, [x, y] = pos[i];
        let k = i === 0 ? 'base' : (i === n - 1 ? (S.lastHollow ? 'hollow' : 'best') : 'main');
        if (S.lastHollow && i === n - 2) k = 'best';
        if (S.doubt === i) k = 'doubt';
        const items = [];
        if (i > 0) items.push(E(i - 1, i, 'main'));
        items.push({ node: drawNode(i, x, y, k, S.main[i][0], S.main[i][1], 'main') });
        steps.push(items);
      } else {
        const s = o.s, [x, y] = pos[s.id];
        const items = [];
        if (!s.nofrom && s.from !== undefined) items.push(E(s.from, s.id, 'branch'));
        if (s.reuse) items.push(E(s.reuse, s.id, 'reuse', s.reuseLabel));
        items.push({ node: drawNode(s.id, x, y, s.k, s.label, s.sub, 'side', s.labelLeft) });
        steps.push(items);
      }
    });
    // edges into the main line (ports, evidence, reuse into main) appear with their target main commit
    const late = [];
    S.side.forEach(s => {
      if (s.to !== undefined) late.push({ src: s.id, target: s.to, e: E(s.id, s.to, 'port') });
      if (s.evid !== undefined) late.push({ src: s.id, target: s.evid, e: E(s.id, s.evid, 'evid') });
      if (s.reuseTo !== undefined) late.push({ src: s.id, target: s.reuseTo, e: E(s.id, s.reuseTo, 'reuse', s.reuseLabel) });
    });
    if (!anim) return;
    const all = [...steps.flat().map(x => x.node || x.p), ...late.map(l => l.e.p), ...[...lg2.childNodes]];
    all.forEach(e => e && (e.style.opacity = 0));
    const DT = 300;
    const idxOfMain = {};
    let si = 0;
    order.forEach((o, i) => { if (o.kind === 'main') idxOfMain[o.i] = i; });
    const sideIdx = {};
    order.forEach((o, i) => { if (o.kind === 'side') sideIdx[o.s.id] = i; });
    steps.forEach((items, i) => {
      items.forEach(it => {
        if (it.node) fadeIn(it.node, 300, i * DT + 120);
        else { it.p.style.opacity = 1; drawIn(it.p, 380, i * DT); if (it.lab) fadeIn(it.lab, 300, i * DT + 300); }
      });
    });
    late.forEach(l => {
      const ti = idxOfMain[l.target];
      const at = Math.max(ti, sideIdx[l.src]) * DT - 60;
      l.e.p.style.opacity = 1; drawIn(l.e.p, 450, at);
      if (l.e.lab) fadeIn(l.e.lab, 300, at + 400);
    });
  }
  function storyMount() {
    story(false); const s = shost.querySelector('svg'); if (s) s.style.opacity = 0;
    onVisible(shost, () => { storySeen = true; story(true); }, .3);
  }
  setHead(); storyMount();
  function switchTo(t) {
    task = t;
    $$('#task-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    setHead();
    const T = TASKS[t];
    chart.set({ x: T.x, y: T.y, refs: T.refs, series: seriesFor(t) });
    story(storySeen);
  }
  $$('#task-tabs button').forEach(b => b.addEventListener('click', () => switchTo(b.dataset.t)));
  REPLAY.research = () => { chart.replay(); if (storySeen) story(true); };
})();

window.GSLib = { el, tx, tween, wait, fadeIn, onVisible, lin, lg, C, clip, curve, mount, axes, legend, lineChart, startSwarm, ancestryBars, REDUCED, D };

})();
