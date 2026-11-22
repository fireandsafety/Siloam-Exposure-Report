/* ============ start.js — inisialisasi ============ */
(function () {
  Activity.init();
  const hideBoot = () => { const b = $('#boot'); if (b) { b.classList.add('off'); setTimeout(() => b.remove(), 300); } $('#app').hidden = false; };
  S.token = Store.get('token', '') || ''; S.me = S.token ? Store.get('me', null) : null;
  if (S.me) { const c = Store.get(uk('boot'), null); if (c) S.boot = c.data; }
  if (!S.me) S.token = '';
  addEventListener('hashchange', route);
  addEventListener('online', () => toast('Kembali online.', 'ok'));
  addEventListener('offline', () => toast('Anda sedang offline — data tersimpan di perangkat tetap tampil.', 'wn'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') Activity.at = Date.now(); });
  if (!location.hash || location.hash === '#') location.hash = S.me ? '#/' + HOME[S.me.role] : '#/login';
  route(); hideBoot();
  if (S.token) api('boot').then(r => { if (r.success) { S.boot = Object.assign(S.boot || {}, r.data); Store.set(uk('boot'), { t: Date.now(), data: S.boot }); } });   // memvalidasi sesi di latar
  setInterval(() => { if (document.visibilityState === 'visible') warmUp(); }, 4 * 60 * 1000);
})();
