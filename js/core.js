/* ============ Siloam Exposure Report — core.js ============
   SPA hash-router • SWR + TTL kesegaran • api() timeout/retry/idempoten • batch • polling adaptif
   (gas-instant-ux-pro + gas-scale-turbo). Rahasia TIDAK pernah ada di sini. */
const GAS_URL = (window.APP_CONFIG || {}).GAS_URL || '';
const LS = 'siloam:v1:';
const S = { token: '', me: null, boot: null, cfg: null, tables: {} };
const Pages = {}, Actions = {}, Cache = {};
const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ico = (n, c) => '<span class="ms ' + (c || '') + '" aria-hidden="true">' + n + '</span>';
const arr = v => { if (Array.isArray(v)) return v; try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };

// ---------- penyimpanan lokal (namespace per user, versi skema) ----------
const Store = {
  get(k, d) { try { const v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) { try { Object.keys(localStorage).filter(x => x.indexOf(LS + 'c:') === 0).forEach(x => localStorage.removeItem(x)); localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e2) {} } },
  del(k) { try { localStorage.removeItem(LS + k); } catch (e) {} }
};
const uk = k => 'c:' + (S.me ? S.me.email : 'anon') + ':' + k;
const hashStr = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; };

// ---------- pengukur ----------
const Perf = { rows: [], add(a, t, s, c) { this.rows.push({ aksi: a, total: t, server: s == null ? null : s, jaringan: s != null ? t - s : null, cache: !!c }); if (this.rows.length > 200) this.rows.shift(); }, table() { console.table(this.rows.slice(-30)); } };
window.Perf = Perf;

// ---------- API ----------
const READ = /^(auth\.config|boot|batch|insiden\.(mine|list|get)|lab\.worklist|stat\.dashboard|users\.list|aturan\.get|audit\.list|setting\.get|rahasia\.status|notif\.(config|antrian)|blast\.list|crm\.list|dok\.unduh|template\.info|verify\.doc|ping)$/;
const inflight = {}; let epoch = 0;
async function apiOnce(action, data, timeout, reqId) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout), t0 = performance.now();
  try {
    const res = await fetch(GAS_URL, { method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, token: S.token || '', reqId, data: data || {} }) });
    const text = await res.text();
    try { const j = JSON.parse(text); Perf.add(action, Math.round(performance.now() - t0), j.ms); return j; }
    catch (e) { return { success: false, network: true, retryable: res.status >= 500 || res.status === 429 || res.status === 200, message: 'Server membalas HTTP ' + res.status + ' (bukan JSON).' }; }
  } catch (err) { return { success: false, network: true, retryable: true, message: err.name === 'AbortError' ? 'Server terlalu lama merespons.' : 'Koneksi terputus.' }; }
  finally { clearTimeout(timer); }
}
const waitOnline = ms => new Promise(r => { if (navigator.onLine !== false) return r(); const t = setTimeout(done, ms); function done() { clearTimeout(t); removeEventListener('online', done); r(); } addEventListener('online', done); });
async function apiRun(action, data) {
  if (!GAS_URL || /GANTI|XXXX/.test(GAS_URL)) return { success: false, message: 'Konfigurasi belum lengkap: isi GAS_URL di js/config.js.' };
  const isRead = READ.test(action), reqId = isRead ? '' : (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random()), tries = isRead ? 3 : 2; let res;
  for (let i = 0; i < tries; i++) {
    if (i) { await new Promise(r => setTimeout(r, 1200 * i)); if (navigator.onLine === false) await waitOnline(15000); }
    res = await apiOnce(action, data, isRead ? (i ? 40000 : 25000) : 90000, reqId);
    if (res.success || !res.retryable) break;
  }
  if (!res.success && res.data && res.data.code === 'AUTH') onSessionExpired();
  if (res && res.nq > 0) scheduleDrain();
  return res;
}
function api(action, data) {
  if (!READ.test(action)) { epoch++; return apiRun(action, data); }
  const k = epoch + '|' + action + '|' + S.token + '|' + JSON.stringify(data || {});
  if (inflight[k]) return inflight[k];
  const p = apiRun(action, data); inflight[k] = p; p.then(() => delete inflight[k], () => delete inflight[k]); return p;
}
let drainT = null, drainN = 0;
function scheduleDrain() { clearTimeout(drainT); drainT = setTimeout(async () => { if (!S.token) return; const r = await apiRun('drain', {}); if (r.success && r.data.left > 0 && ++drainN < 4) scheduleDrain(); else drainN = 0; }, 600); }
function warmUp() { try { fetch(GAS_URL + '?ping=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {}); } catch (e) {} }

/** SWR: render(cache) → (segar? selesai) : ke server → render bila data berubah */
async function swr(key, action, payload, render, opt) {
  opt = opt || {}; const fresh = opt.fresh == null ? 30000 : opt.fresh, c = Store.get(uk(key), null);
  if (c) render(c.data, true);
  if (c && !opt.force && Date.now() - c.t < fresh) { Perf.add(action, 0, 0, true); return { success: true, data: c.data, cached: true }; }
  const res = await api(action, payload);
  if (res.success) { const h = hashStr(JSON.stringify(res.data)); Store.set(uk(key), { t: Date.now(), h, data: res.data }); if (!c || c.h !== h) render(res.data, false); }
  else if (!c) render(null, false, res);
  return res;
}
const invalidate = pref => Object.keys(localStorage).filter(k => k.indexOf(LS + uk(pref || '')) === 0).forEach(k => localStorage.removeItem(k));

// ---------- UI helper ----------
function toast(msg, type) { const t = document.createElement('div'); t.className = 'toast ' + (type || 'in'); t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), type === 'er' ? 5500 : 3200); }
function modal(html) { const m = $('#modal'); m.innerHTML = '<div class="box">' + html + '</div>'; m.hidden = false; m.onclick = e => { if (e.target === m) closeModal(); }; }
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
function confirmBox(title, text, okLabel) { return new Promise(res => { modal('<h3>' + esc(title) + '</h3><p class="mu mt">' + esc(text) + '</p><div class="row mt2" style="justify-content:flex-end"><button class="btn g" id="cb-n">Batal</button><button class="btn p" id="cb-y">' + esc(okLabel || 'Lanjutkan') + '</button></div>'); $('#cb-n').onclick = () => { closeModal(); res(false); }; $('#cb-y').onclick = () => { closeModal(); res(true); }; }); }
function busy(btn, on, label) { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.l = btn.innerHTML; btn.innerHTML = '<span class="ms sm">sync</span> ' + (label || 'Memproses…'); } else if (btn.dataset.l) btn.innerHTML = btn.dataset.l; }
const fmtDT = iso => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? esc(iso) : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }); };
const fmtD = iso => { if (!iso) return '—'; const d = new Date(String(iso).length === 10 ? iso + 'T00:00:00+07:00' : iso); return isNaN(d) ? esc(iso) : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }); };
const jamSejak = iso => Math.max(0, (Date.now() - new Date(iso).getTime()) / 36e5);
function chipJam(iso, done) { const j = jamSejak(iso), c = j <= 24 ? 'ok' : j <= 72 ? 'wn' : 'er', t = j < 1 ? Math.round(j * 60) + ' mnt' : j < 48 ? Math.round(j) + ' jam' : Math.round(j / 24) + ' hari'; return '<span class="pill ' + (done ? '' : c) + '">' + ico('schedule', 'sm') + t + ' sejak paparan</span>'; }
const STATUS_C = { 'Dilaporkan': 'in', 'Dinilai RMO': 'in', 'Pemeriksaan Berjalan': 'wn', 'Menunggu Approval': 'wn', 'Disetujui': 'ok', 'Tindak Lanjut': 'nv2', 'Selesai': '', 'Dibatalkan': '', 'Draft': '' };
const pillStatus = s => '<span class="pill ' + (STATUS_C[s] || '') + '">' + esc(s) + '</span>';
const LBL = { HIV: 'HIV (Ag/Ab)', HBSAG: 'Hepatitis B (HBsAg)', ANTI_HBS: 'Hepatitis B (anti-HBs)', ANTI_HCV: 'Hepatitis C (anti-HCV)', HCV_RNA: 'Hepatitis C (HCV RNA)', HIV_NAT: 'HIV NAT' };
function badgeHasil(h) {
  if (!h) return '<div class="rb"><div class="rc non">' + ico('remove') + '</div><div><div class="rl mu">Belum ada</div></div></div>';
  if (h.Ditahan) return '<div class="rb"><div class="rc lock">' + ico('lock') + '</div><div><div class="rl">Hasil tersedia</div><div class="xs mu">Silakan temui RMO</div></div></div>';
  if (h.Status === 'Selesai' && h.Interpretasi === 'NEGATIF') return '<div class="rb"><div class="rc neg">' + ico('check', 'fill') + '</div><div><div class="rl neg">NEGATIF</div><div class="xs mu">Non-reaktif</div></div></div>';
  if (h.Status === 'Selesai' && h.Interpretasi === 'POSITIF') return '<div class="rb"><div class="rc pos">' + ico('priority_high') + '</div><div><div class="rl pos">POSITIF</div><div class="xs mu">Reaktif</div></div></div>';
  if (h.Status === 'Selesai') return '<div class="rb"><div class="rc non">' + ico('remove') + '</div><div><div class="rl">Tidak ditentukan</div></div></div>';
  const m = { 'Tidak Diketahui': 'Sumber tidak diketahui', 'Menolak': 'Menolak tes', 'Tidak Dilakukan': 'Tidak dilakukan' }[h.Status];
  return '<div class="rb"><div class="rc non">' + ico(m ? 'info' : 'hourglass_empty') + '</div><div><div class="rl mu">' + esc(m || (h.Status === 'Diproses' || h.Status === 'Diminta' || h.Status === 'Menunggu Validasi' ? 'Diproses' : 'Belum ada')) + '</div></div></div>';
}
const skel = n => Array.from({ length: n || 3 }, () => '<div class="card"><div class="sk" style="width:55%"></div><div class="sk mt" style="width:90%"></div><div class="sk mt" style="width:70%"></div></div>').join('');
const empty = (icon, t, s) => '<div class="empty">' + ico(icon) + '<div class="b">' + esc(t) + '</div>' + (s ? '<div class="sm mt">' + esc(s) + '</div>' : '') + '</div>';
const errBox = (r, retry) => '<div class="card center">' + ico('error', 'lg') + '<div class="b mt">Gagal memuat data</div><div class="mu sm">' + esc((r && r.message) || 'Periksa koneksi Anda.') + '</div><button class="btn s mt" data-act="retry" data-p="' + esc(retry || '') + '">Coba lagi</button></div>';
const opts = (name, list, val, cls, multi) => '<div class="opts ' + (cls || '') + '">' + list.map(v => { const val_ = typeof v === 'object' ? v.v : v, lab = typeof v === 'object' ? v.l : v, on = multi ? (val || []).indexOf(val_) > -1 : val === val_; return '<button type="button" class="opt ' + (on ? 'on' : '') + '" data-act="opt" data-n="' + esc(name) + '" data-v="' + esc(val_) + '" data-m="' + (multi ? 1 : 0) + '">' + ico('check') + '<span>' + esc(lab) + '</span></button>'; }).join('') + '</div>';
const seg = (name, val, list) => '<div class="seg">' + (list || [['YA', 'Ya'], ['TIDAK', 'Tidak']]).map(x => '<button type="button" class="' + (val === x[0] ? 'on' : '') + '" data-act="seg" data-n="' + esc(name) + '" data-v="' + esc(x[0]) + '">' + esc(x[1]) + '</button>').join('') + '</div>';
const sel = (id, list, val, ph) => '<select id="' + id + '"><option value="">' + esc(ph || 'Pilih…') + '</option>' + list.map(v => '<option ' + (v === val ? 'selected' : '') + '>' + esc(v) + '</option>').join('') + '</select>';
const M = k => ((S.boot && S.boot.master) || {})[k] || [];

// ---------- tanda tangan jari ----------
const Sig = {
  init(box) {
    const cv = $('canvas', box), ph = $('.ph', box), ctx = cv.getContext('2d'); let draw = false, dirty = false;
    const fit = () => { const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d; ctx.scale(d, d); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = '#0A2780'; dirty = false; ph.style.display = ''; }; fit();
    const pt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.onpointerdown = e => { draw = true; cv.setPointerCapture(e.pointerId); const [x, y] = pt(e); ctx.beginPath(); ctx.moveTo(x, y); ph.style.display = 'none'; };
    cv.onpointermove = e => { if (!draw) return; const [x, y] = pt(e); ctx.lineTo(x, y); ctx.stroke(); dirty = true; };
    cv.onpointerup = cv.onpointercancel = () => { draw = false; };
    box._sig = { put: url => { const im = new Image(); im.onload = () => { const r = cv.getBoundingClientRect(); ctx.drawImage(im, 0, 0, r.width, r.height); dirty = true; ph.style.display = 'none'; }; im.src = url; }, clear: () => { ctx.clearRect(0, 0, cv.width, cv.height); dirty = false; ph.style.display = ''; }, empty: () => !dirty, data: () => { const o = document.createElement('canvas'), w = 420, h = Math.round(420 * cv.height / cv.width); o.width = w; o.height = h; const c2 = o.getContext('2d'); c2.drawImage(cv, 0, 0, w, h); return o.toDataURL('image/png'); } };
  }
};
const sigBox = id => '<div class="sig" id="' + id + '"><canvas></canvas><div class="ph">Tanda tangan dengan jari / mouse di sini</div></div><div class="row sp mt"><span class="hint">Tanda tangan tertaut login & waktu pengiriman.</span><button type="button" class="btn g sm" data-act="sig-clear" data-p="' + id + '">Hapus</button></div>';
Actions['sig-clear'] = a => { const b = $('#' + a.dataset.p); b && b._sig && b._sig.clear(); };
const sigGet = id => { const b = $('#' + id); return b && b._sig && !b._sig.empty() ? b._sig.data() : ''; };
function initSigs(root) { $$('.sig', root).forEach(b => { if (!b._sig) Sig.init(b); }); }

// ---------- login Google ----------
async function getCfg() { if (S.cfg) return S.cfg; const c = Store.get('cfg', null); if (c) { S.cfg = c; api('auth.config').then(r => { if (r.success) { S.cfg = r.data; Store.set('cfg', r.data); } }); return c; } const r = await api('auth.config'); if (r.success) { S.cfg = r.data; Store.set('cfg', r.data); return r.data; } return { err: r.message }; }
function gsiReady() { return new Promise(res => { let n = 0; const t = setInterval(() => { if (window.google && google.accounts && google.accounts.id) { clearInterval(t); res(true); } else if (++n > 80) { clearInterval(t); res(false); } }, 100); }); }
async function renderGoogleButton(el, onCred, text) {
  const cfg = await getCfg();
  if (cfg.err) { el.innerHTML = '<div class="alert er">' + ico('error') + '<div>' + esc(cfg.err) + '</div></div>'; return; }
  if (!cfg.googleClientId) { el.innerHTML = '<div class="alert wn">' + ico('warning') + '<div>Login Google belum dikonfigurasi. Admin: masuk dengan <b>akses darurat</b>, lalu isi Google Client ID di menu Keamanan.</div></div>'; return; }
  if (!(await gsiReady())) { el.innerHTML = '<div class="alert er">' + ico('error') + '<div>Pustaka Google Sign-In gagal dimuat. Periksa koneksi/pemblokir iklan.</div></div>'; return; }
  google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: r => onCred(r.credential), ux_mode: 'popup', auto_select: false });
  el.innerHTML = ''; google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: text || 'signin_with', width: Math.min(340, el.clientWidth || 340), logo_alignment: 'left' });
}
function setSession(d) { S.token = d.token; S.me = d.me; S.boot = d.boot; Store.set('token', d.token); Store.set('me', d.me); Store.set(uk('boot'), { t: Date.now(), data: d.boot }); }
function onSessionExpired() { if (!S.token) return; S.token = ''; Store.del('token'); toast('Sesi berakhir, silakan masuk kembali.', 'wn'); go('login'); }
function logout() { S.token = ''; S.me = null; S.boot = null; Store.del('token'); Store.del('me'); try { google.accounts.id.disableAutoSelect(); } catch (e) {} go('login'); }
Actions.logout = () => logout();

// ---------- router ----------
function go(name, param) { const h = '#/' + name + (param ? '/' + encodeURIComponent(param) : ''); if (location.hash === h) route(); else location.hash = h; }
const NAV = {
  STAF: [['beranda', 'home', 'Beranda'], ['pertolongan', 'add', 'Lapor'], ['status', 'science', 'Status Periksa'], ['profil', 'person', 'Profil']],
  RMO: [['antrean', 'medication', 'Antrean Kasus'], ['semua', 'description', 'Semua Kasus'], ['pertolongan', 'add', 'Lapor Baru'], ['profil', 'person', 'Profil']],
  LAB: [['worklist', 'biotech', 'Worklist'], ['riwayat-lab', 'history', 'Riwayat'], ['profil', 'person', 'Profil']],
  K3: [['laporan', 'description', 'Laporan'], ['tindaklanjut', 'event_note', 'Tindak Lanjut'], ['statistik', 'bar_chart', 'Statistik'], ['profil', 'person', 'Profil']],
  ADMIN: [['statistik', 'bar_chart', 'Statistik'], ['laporan', 'description', 'Laporan'], ['pengguna', 'groups', 'Pengguna'], ['master', 'tune', 'Master & Aturan'], ['notif', 'notifications', 'Notifikasi & CRM'], ['dokumen', 'assignment', 'Template Dokumen'], ['migrasi', 'swap_horiz', 'Migrasi Data'], ['keamanan', 'security', 'Keamanan'], ['audit', 'fact_check', 'Audit Log'], ['profil', 'person', 'Profil']]
};
const HOME = { STAF: 'beranda', RMO: 'antrean', LAB: 'worklist', K3: 'laporan', ADMIN: 'statistik' };
const PUBLIC_P = ['login', 'daftar', 'verifikasi'];
function shell() {
  const app = $('#app'); if (app.dataset.shell === S.me.email + S.me.role) return; app.dataset.shell = S.me.email + S.me.role;
  const nav = NAV[S.me.role] || [], ini = (S.me.nama || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
  app.innerHTML = '<div class="shell"><aside class="side"><div class="lg"><img src="assets/logo-white.png" alt="Siloam"></div><nav>' + nav.map(n => '<button class="nv" data-act="nav" data-p="' + n[0] + '" data-nav="' + n[0] + '">' + ico(n[1]) + '<span>' + n[2] + '</span></button>').join('') + '</nav><button class="nv" data-act="logout">' + ico('logout') + '<span>Keluar</span></button></aside>'
    + '<div class="main"><header class="top"><img class="lg" src="assets/logo.png" alt="Siloam"><div class="tt" id="ttl"></div><div class="who"><div class="meta"><div class="b sm">' + esc(S.me.nama) + '</div><small>' + esc(S.me.role) + (S.me.darurat ? ' · Darurat' : '') + '</small></div><div class="av">' + esc(ini) + '</div></div></header><div id="view"></div></div>'
    + '<nav class="tabs">' + nav.slice(0, 5).map(n => '<button data-act="nav" data-p="' + n[0] + '" data-nav="' + n[0] + '">' + ico(n[1]) + '<span>' + n[2].split(' ')[0] + '</span></button>').join('') + '</nav></div>';
}
Actions.nav = a => go(a.dataset.p);
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent), name = parts[0] || '', param = parts[1], p3 = parts[2], p4 = parts[3];
  if (PUBLIC_P.indexOf(name) > -1) {
    if (name !== 'verifikasi' && S.token && S.me) return go(HOME[S.me.role]);
    const app = $('#app'); app.dataset.shell = ''; app.innerHTML = '<div id="view"></div>'; return Pages[name].show($('#view'), param, p3, p4);
  }
  if (!S.token || !S.me) return go('login');
  const def = Pages[name]; if (!def || (def.roles && def.roles.indexOf(S.me.role) === -1)) return go(HOME[S.me.role]);
  shell(); $$('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === name));
  const view = $('#view'), key = name + (param ? '/' + param : ''); let el = view.querySelector('.page[data-k="' + key + '"]');
  if (!el) { el = document.createElement('section'); el.className = 'page'; el.dataset.k = key; view.appendChild(el); }
  $$('.page', view).forEach(p => p.hidden = p !== el);
  $('#ttl').textContent = typeof def.title === 'function' ? def.title(param) : (def.title || ''); window.scrollTo(0, 0);
  stopPolls(); def.show(el, param);
}
Actions.retry = a => route();
const polls = []; function stopPolls() { while (polls.length) clearInterval(polls.pop()); }
const Activity = { at: Date.now(), last: {}, init() { ['pointerdown', 'keydown', 'touchstart', 'focus'].forEach(ev => addEventListener(ev, () => this.at = Date.now(), { passive: true })); }, idle() { return Date.now() - this.at > 120000; }, due(k, a, i) { if (document.visibilityState !== 'visible') return false; if (Date.now() - (this.last[k] || 0) < (this.idle() ? i : a) - 500) return false; this.last[k] = Date.now(); return true; } };
function poll(key, fn, active, idle) { polls.push(setInterval(() => { if (Activity.due(key, active, idle)) fn(); }, 5000)); }
// ---------- delegasi event ----------
document.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a) return; const f = Actions[a.dataset.act]; if (f) { e.preventDefault(); f(a, e); } });
document.addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.bind && Actions['bind:' + t.dataset.bind]) Actions['bind:' + t.dataset.bind](t, e); });
Actions.opt = a => { const n = a.dataset.n, v = a.dataset.v, h = Actions['set:' + n.split('.')[0]]; if (h) h(n, v, a.dataset.m === '1'); };
Actions.seg = a => { const h = Actions['set:' + a.dataset.n.split('.')[0]]; if (h) h(a.dataset.n, a.dataset.v, false); };
// ---------- unduh berkas dari base64 ----------
function unduh(d) { const bin = atob(d.base64), n = bin.length, u8 = new Uint8Array(n); for (let i = 0; i < n; i++) u8[i] = bin.charCodeAt(i); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u8], { type: d.mime })); a.download = d.nama; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
async function unduhDok(btn, id, format, versi) { busy(btn, true, 'Menyiapkan…'); const r = await api('dok.unduh', { id, format, versi }); busy(btn, false); if (r.success) unduh(r.data); else toast(r.message, 'er'); }
Actions.dok = a => unduhDok(a, a.dataset.id, a.dataset.f, a.dataset.v);
