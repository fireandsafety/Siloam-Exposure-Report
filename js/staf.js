/* ============ staf.js — autentikasi + portal staf terpapar ============ */
PUBLIC_P.push('darurat');
const authCard = inner => '<div class="auth"><div class="card"><div class="center"><img src="assets/logo.png" alt="Siloam" width="170"></div><h2 class="center mt">Siloam Exposure Report</h2><p class="center mu sm" style="margin-bottom:18px">Pelaporan Insiden Paparan Okupasional</p>' + inner + '</div></div>';

// ---------- LOGIN ----------
Pages.login = { show(el) {
  warmUp();
  el.innerHTML = authCard('<div id="gbtn" style="min-height:44px;display:flex;justify-content:center"><div class="sk" style="width:260px;height:44px"></div></div><div id="lerr"></div><div class="row mt2"><hr class="grow" style="border:0;border-top:1px solid var(--bd)"><span class="mu xs">atau</span><hr class="grow" style="border:0;border-top:1px solid var(--bd)"></div><button class="btn s blk mt" data-act="nav" data-p="daftar">Daftar sebagai Staf</button><p class="center xs mu mt2">' + ico('lock', 'sm') + ' Masuk aman dengan Google OAuth 2.0 · sesi tetap aktif saat halaman di-refresh</p>');
  renderGoogleButton($('#gbtn', el), async cred => {
    const b = $('#gbtn'); b.style.opacity = .5; const r = await api('auth.google', { credential: cred }); b.style.opacity = 1;
    if (r.success) { setSession(r.data); toast('Selamat datang, ' + r.data.me.nama.split(' ')[0] + '!', 'ok'); go(HOME[r.data.me.role]); }
    else if (r.data && r.data.code === 'NOT_REGISTERED') { S.pendingReg = r.data; toast('Email belum terdaftar — silakan lengkapi pendaftaran.', 'in'); go('daftar'); }
    else $('#lerr', el).innerHTML = '<div class="alert er mt">' + ico('error') + '<div>' + esc(r.message) + '</div></div>';
  });
} };
Pages.darurat = { show(el) {            // tidak ditautkan dari mana pun (R9)
  el.innerHTML = authCard('<div class="alert wn">' + ico('warning') + '<div>Akses darurat Admin. Gunakan hanya bila login Google belum dikonfigurasi.</div></div><div class="fld mt"><label>Nama pengguna</label><input type="text" id="du" autocomplete="off"></div><div class="fld"><label>Kata sandi</label><input type="password" id="dp" autocomplete="off" style="width:100%;min-height:46px;padding:10px 14px;border:1.5px solid var(--bd);border-radius:12px"></div><button class="btn n blk" data-act="darurat">Masuk</button><div id="derr"></div>');
} };
Actions.darurat = async a => { busy(a, true); const r = await api('auth.darurat', { username: $('#du').value, password: $('#dp').value }); busy(a, false); $('#dp').value = ''; if (r.success) { setSession(r.data); go(HOME.ADMIN); } else $('#derr').innerHTML = '<div class="alert er mt">' + ico('error') + '<div>' + esc(r.message) + '</div></div>'; };

// ---------- DAFTAR ----------
Pages.daftar = { show(el) {
  const p = S.pendingReg || {};
  el.innerHTML = authCard('<button class="btn g sm" data-act="nav" data-p="login">' + ico('arrow_back', 'sm') + ' Kembali ke login</button><h3 class="mt">Daftar Akun Staf</h3>' + (p.email ? '<div class="alert in mt">' + ico('info') + '<div>Email Google <b>' + esc(p.email) + '</b> belum terdaftar. Lengkapi data berikut.</div></div>' : '')
    + '<div class="mt"><div class="fld"><label class="req">Nama lengkap (sesuai KTP)</label><input type="text" id="r-nama" value="' + esc(p.nama || '') + '" autocomplete="name"></div><div class="fld"><label class="req">NIK karyawan</label><input type="text" id="r-nik" inputmode="numeric"></div><div class="fld"><label class="req">Tanggal lahir</label><input type="date" id="r-tgl"></div><div class="fld"><label class="req">Unit kerja</label>' + sel('r-unit', M('UNIT')) + '</div><div class="fld"><label class="req">Profesi</label>' + sel('r-prof', M('PROFESI')) + '</div><div class="fld"><label class="req">No. WhatsApp</label><input type="tel" id="r-wa" placeholder="08123456789" inputmode="tel"></div></div>'
    + '<div class="alert in">' + ico('info') + '<div>Peran RMO, K3, Lab, dan Admin diberikan oleh Admin. Email Anda diverifikasi oleh Google — tidak perlu kata sandi.</div></div><p class="lbl mt2 center">Lanjutkan dengan akun Google:</p><div id="gbtn" class="mt" style="min-height:44px;display:flex;justify-content:center"></div><div id="rerr"></div>');
  const fill = (id, list) => { const s = $('#' + id); if (s && list && list.length) s.innerHTML = '<option value="">Pilih…</option>' + list.map(v => '<option>' + esc(v) + '</option>').join(''); };
  getCfg().then(c => { fill('r-unit', c.unit); fill('r-prof', c.profesi); });
  renderGoogleButton($('#gbtn', el), async cred => {
    const d = { credential: cred, nama: $('#r-nama').value, nik: $('#r-nik').value, tglLahir: $('#r-tgl').value, unit: $('#r-unit').value, profesi: $('#r-prof').value, wa: $('#r-wa').value };
    if (!d.nama || !d.nik || !d.tglLahir || !d.unit || !d.profesi || !d.wa) { $('#rerr').innerHTML = '<div class="err mt">Lengkapi semua kolom bertanda * lalu tekan tombol Google lagi.</div>'; return; }
    const r = await api('auth.register', d); if (r.success) { S.pendingReg = null; setSession(r.data); toast('Pendaftaran berhasil!', 'ok'); go(HOME.STAF); } else $('#rerr').innerHTML = '<div class="alert er mt">' + ico('error') + '<div>' + esc(r.message) + '</div></div>';
  }, 'signup_with');
} };

// ---------- DASHBOARD STAF ----------
const kasusLabelCard = k => '<button class="card hv" data-act="nav-kasus" data-p="' + esc(k.ID) + '" style="width:100%;text-align:left;display:block"><div class="row sp"><b style="font-family:ui-monospace,monospace">' + esc(k.ID) + '</b>' + pillStatus(k.Status) + '</div><div class="row sp wrap mt"><span class="mu sm">' + fmtDT(k.KejadianAt) + '</span>' + (['Selesai', 'Dibatalkan'].indexOf(k.Status) > -1 ? '' : chipJam(k.KejadianAt)) + '</div></button>';
Actions['nav-kasus'] = a => go('kasus', a.dataset.p);
Pages.beranda = { title: 'Beranda', roles: ['STAF'], show(el) {
  const draw = (b, cached) => {
    if (!b) return; S.boot = Object.assign(S.boot || {}, b); const kasus = b.kasus || [], tl = (b.tl || []).filter(t => t.Status === 'Menunggu').sort((a, c) => a.JatuhTempo.localeCompare(c.JatuhTempo)), aktif = kasus.filter(k => ['Selesai', 'Dibatalkan'].indexOf(k.Status) === -1), sudahSetuju = kasus.filter(k => k.Setuju);
    el.innerHTML = '<div class="stack"><div class="hero"><span class="pill" style="background:rgba(251,189,60,.2);color:var(--gold)">KRITIS ≤ 24 JAM</span><h2 class="mt">Terpapar atau tertusuk jarum?</h2><p>Segera lakukan pertolongan pertama dan buat laporan digital agar profilaksis dapat dimulai tepat waktu.</p><button class="btn p" data-act="nav" data-p="pertolongan">' + ico('add') + ' Buat Laporan Baru</button></div>'
      + '<div class="grid g2"><div class="card"><h3>Laporan Saya</h3><div class="stack mt">' + (kasus.length ? kasus.slice(0, 5).map(kasusLabelCard).join('') : empty('shield', 'Belum ada laporan', 'Tekan "Buat Laporan Baru" bila terjadi paparan.')) + '</div></div>'
      + '<div class="stack"><div class="card"><h3>Rekomendasi</h3>' + (sudahSetuju.length ? '<div class="row sp mt"><div><span class="pill ok">Disetujui</span><div class="sm mt">Kasus ' + esc(sudahSetuju[0].ID) + '</div></div><button class="btn s sm" data-act="nav-rekom" data-p="' + esc(sudahSetuju[0].ID) + '">Lihat Rekomendasi</button></div>' : aktif.length ? '<div class="row mt">' + ico('lock') + '<div><span class="pill wn">Menunggu persetujuan RMO</span><div class="xs mu mt">Rekomendasi tampil setelah RMO menyetujui.</div></div></div>' : '<div class="mu sm mt">Belum ada rekomendasi.</div>') + '</div>'
      + '<div class="card"><h3>Jadwal Tindak Lanjut</h3>' + (tl.length ? '<div class="tl mt">' + tl.slice(0, 5).map(t => { const h = Math.ceil((new Date(t.JatuhTempo + 'T00:00:00+07:00') - Date.now()) / 864e5); return '<div class="it"><div class="b sm">' + esc(t.Keterangan) + '</div><div class="xs mu">' + fmtD(t.JatuhTempo) + ' · <span style="color:' + (h < 0 ? 'var(--er)' : 'inherit') + '">' + (h < 0 ? 'terlambat ' + (-h) + ' hari' : h + ' hari lagi') + '</span></div></div>'; }).join('') + '</div>' : '<div class="mu sm mt">Belum ada jadwal.</div>') + '</div></div></div>'
      + (aktif.length ? '<div id="held"></div>' : '') + '</div>';
    if (aktif.length && !cached) swr('k:' + aktif[0].ID, 'insiden.get', { id: aktif[0].ID }, d => { const h = $('#held', el); if (h && d && d.hasil.some(x => x.Ditahan)) h.innerHTML = '<div class="alert wn">' + ico('lock') + '<div><b>Hasil pemeriksaan tersedia.</b> Mohon temui dokter RMO di IGD/Poli untuk konseling dan membuka hasil.</div></div>'; }, { fresh: 60000 });
  };
  const c = Store.get(uk('boot'), null); if (c) draw(c.data, true); else el.innerHTML = skel(3);
  swr('boot', 'boot', {}, (d, cc, err) => { if (d) draw(d, cc); else if (!c) el.innerHTML = errBox(err); }, { fresh: 20000 });
} };
Actions['nav-rekom'] = a => go('rekom', a.dataset.p);

// ---------- PERTOLONGAN PERTAMA ----------
Pages.pertolongan = { title: 'Pertolongan Pertama', roles: ['STAF', 'RMO'], show(el) {
  const kontak = (S.boot && S.boot.setting && S.boot.setting.KONTAK_RMO) || '';
  const st = [['Cuci luka sekarang', 'Cuci dengan sabun dan air mengalir. Mata, hidung, mulut: bilas banyak-banyak dengan air bersih atau NaCl 0,9%.'], ['Jangan salah langkah', 'Jangan dihisap, digosok keras, atau diberi antiseptik/pemutih. Jangan dipencet keras.'], ['Lapor segera', 'Setelah luka dibersihkan, isi laporan digital ini — RMO dan K3 langsung diberi tahu.'], ['Hubungi RMO', 'Datang ke IGD/RMO untuk penilaian. PEP HIV paling efektif bila dimulai secepatnya (idealnya ≤ 24 jam).']];
  el.innerHTML = '<div class="stack" style="max-width:640px;margin:auto"><div class="alert er">' + ico('warning') + '<div><b>Lakukan sekarang — jangan tunda.</b></div></div>' + st.map((s, i) => '<div class="card step"><div class="n">' + (i + 1) + '</div><div><h3>' + s[0] + '</h3><p class="mu sm mt">' + s[1] + '</p></div></div>').join('')
    + (kontak ? '<a class="btn s blk" href="tel:' + esc(kontak.replace(/[^0-9+]/g, '')) + '">' + ico('call') + ' Telepon RMO · ' + esc(kontak) + '</a>' : '') + '<button class="btn p blk" data-act="mulai-lapor">Saya sudah melakukan pertolongan pertama — Lanjut ke Laporan</button></div>';
} };
Actions['mulai-lapor'] = () => { const d = Store.get(uk('draft'), null); if (d && d.d && Object.keys(d.d).length > 1) { confirmBox('Lanjutkan draf?', 'Ada draf laporan yang belum dikirim. Lanjutkan draf tersebut?', 'Lanjutkan draf').then(y => { if (!y) Store.del(uk('draft')); go('lapor'); }); } else go('lapor'); };

// ---------- WIZARD LAPORAN (5 langkah) ----------
let W = null;
const wLoad = () => W || (W = Store.get(uk('draft'), { step: 0, d: {} }));
const wSave = () => Store.set(uk('draft'), W);
Actions['set:w'] = (n, v, multi) => { const k = n.split('.')[1], d = wLoad().d; if (multi) { const a = d[k] || []; d[k] = a.indexOf(v) > -1 ? a.filter(x => x !== v) : a.concat(v); } else d[k] = v; wSave(); wRender(); };
Actions['bind:w'] = t => { wLoad().d[t.dataset.n] = t.value; wSave(); };
const STEPS = ['Rincian Kejadian', 'Cairan & Alat', 'Sumber & Asal', 'Profil Risiko Anda', 'Tinjau & Tanda Tangan'];
Pages.lapor = { title: 'Laporan Insiden Paparan', roles: ['STAF', 'RMO'], show(el) {
  const now = new Date(Date.now() + 7 * 3600e3), p2 = n => String(n).padStart(2, '0'); wLoad(); const d = W.d;
  if (!d.tgl) { d.tgl = now.getUTCFullYear() + '-' + p2(now.getUTCMonth() + 1) + '-' + p2(now.getUTCDate()); d.waktu = p2(now.getUTCHours()) + ':' + p2(now.getUTCMinutes()); if (!d.ppDone) d.ppDone = 'YA'; wSave(); }
  el.innerHTML = '<div style="max-width:680px;margin:auto"><div class="row sp"><span class="xs b" id="wst"></span><span class="xs mu" id="wsv">' + ico('cloud_done', 'sm') + ' Draf tersimpan</span></div><div class="prog mt"><i id="wpg"></i></div><h2 class="mt" id="wtt"></h2><div class="card mt" id="wbody"></div><div class="sticky"><button class="btn g" data-act="w-prev">Kembali</button><button class="btn p" data-act="w-next" id="wnext">Lanjut</button></div></div>';
  wRender();
} };
function wRender() {
  const el = $('#wbody'); if (!el) return; const d = W.d, s = W.step; $('#wst').textContent = 'Langkah ' + (s + 1) + ' dari 5'; $('#wpg').style.width = ((s + 1) * 20) + '%'; $('#wtt').textContent = STEPS[s]; $('#wnext').innerHTML = s === 4 ? ico('send', 'sm') + ' Kirim Laporan' : 'Lanjut';
  const txt = (k, ph, type) => '<input type="' + (type || 'text') + '" data-bind="w" data-n="' + k + '" value="' + esc(d[k] || '') + '" placeholder="' + esc(ph || '') + '">', fld = (l, inner, req) => '<div class="fld"><label class="' + (req ? 'req' : '') + '">' + l + '</label>' + inner + '</div>';
  const berdarahQ = (d.cairan || []).some(c => c === 'Saliva/liur' || c === 'Eksudat luka bakar/lesi kulit');
  let h = '';
  if (s === 0) h = fld('Tanggal kejadian', txt('tgl', '', 'date'), 1) + fld('Waktu kejadian', txt('waktu', '', 'time'), 1) + fld('Tempat kejadian', '<select data-bind="w" data-n="tempat"><option value="">Pilih…</option>' + M('TEMPAT').map(v => '<option ' + (d.tempat === v ? 'selected' : '') + '>' + esc(v) + '</option>').join('') + '</select>', 1) + fld('Jenis paparan (boleh lebih dari satu)', opts('w.jenisPaparan', M('PAPARAN'), d.jenisPaparan, 'c2', true), 1) + fld('Rincian kejadian', '<textarea data-bind="w" data-n="rincian" placeholder="Ceritakan singkat bagaimana kejadiannya…">' + esc(d.rincian || '') + '</textarea>') + fld('Pertolongan pertama sudah dilakukan?', seg('w.ppDone', d.ppDone) + (d.ppDone === 'YA' ? '<div class="mt">' + txt('ppJam', 'Jam (opsional)', 'time') + '</div>' : ''));
  if (s === 1) h = fld('Jenis cairan (boleh lebih dari satu)', opts('w.cairan', M('CAIRAN'), d.cairan, 'c2', true), 1) + (berdarahQ ? fld('Tampak berdarah?', seg('w.tampakBerdarah', d.tampakBerdarah) + '<span class="hint">Saliva/eksudat hanya dianggap berisiko bila tampak berdarah.</span>') : fld('Cairan/alat tampak berdarah?', seg('w.tampakBerdarah', d.tampakBerdarah))) + fld('Jenis alat', opts('w.alat', M('ALAT'), d.alat, 'c2'), 1) + fld('Keterangan alat (opsional)', txt('detailAlat', 'Mis. merek/ukuran, instrumen bedah yang dipakai')) + fld('APD yang dipakai', opts('w.apd', M('APD'), d.apd, 'c2', true)) + fld('Kedalaman luka', sel('kd', M('KEDALAMAN'), d.kedalaman).replace('<select id="kd"', '<select data-bind="w" data-n="kedalaman"'));
  if (s === 2) h = fld('Asal benda tajam', opts('w.asal', M('ASAL'), d.asal, 'c2'), 1) + fld('Keterangan asal (opsional)', txt('detailAsal')) + fld('Bangsal/departemen asal dapat diidentifikasi?', seg('w.bangsalIdent', d.bangsalIdent) + (d.bangsalIdent === 'YA' ? '<div class="mt">' + txt('ketBangsal', 'Sebutkan bangsal/departemen') + '</div>' : '')) + fld('Pasien sumber diketahui?', seg('w.sumberDiketahui', d.sumberDiketahui)) + (d.sumberDiketahui === 'YA' ? fld('No. RM pasien sumber', txt('sumberRM', ''), 1) + fld('Inisial pasien', txt('sumberInisial', 'Mis. AB'), 1) + fld('Unit/bangsal pasien', txt('sumberUnit', ''), 1) : '<div class="hint">Jika sumber tidak diketahui (mis. jarum di sharp box), RMO akan menilai risiko secara khusus. Jangan menguji jarum.</div>');
  if (s === 3) h = '<div class="alert in" style="margin-bottom:14px">' + ico('info') + '<div>Data ini hanya dipakai untuk menentukan rekomendasi tatalaksana.</div></div>' + fld('Status vaksin hepatitis B Anda', opts('w.vaksinHBV', [{ v: 'BELUM', l: 'Belum divaksin' }, { v: 'TIDAK_LENGKAP', l: 'Vaksin tidak lengkap' }, { v: 'LENGKAP_RESPONDER', l: 'Lengkap — anti-HBs ≥10 terdokumentasi' }, { v: 'LENGKAP_TIDAK_DIKETAHUI', l: 'Lengkap — hasil anti-HBs tidak diketahui' }, { v: 'NONRESPONDER', l: 'Nonresponder (2 seri vaksin)' }], d.vaksinHBV), 1) + fld('Hasil anti-HBs terakhir (opsional)', '<div class="row">' + txt('antiHBsNilai', 'mIU/mL', 'number') + txt('antiHBsTgl', '', 'date') + '</div>') + fld('Sedang hamil/menyusui?', seg('w.hamil', d.hamil)) + fld('PrEP HIV', opts('w.prep', [{ v: 'TIDAK', l: 'Tidak' }, { v: 'ORAL', l: 'PrEP oral' }, { v: 'CABOTEGRAVIR_12BLN', l: 'Suntik cabotegravir (12 bln terakhir)' }], d.prep || 'TIDAK', 'c3')) + fld('Pernah terpapar sebelumnya?', seg('w.pernahTerpapar', d.pernahTerpapar));
  if (s === 4) h = '<div class="stack">' + [['Kejadian', fmtD(d.tgl) + ' ' + esc(d.waktu) + ' · ' + esc(d.tempat)], ['Paparan', esc((d.jenisPaparan || []).join(', '))], ['Cairan', esc((d.cairan || []).join(', '))], ['Alat', esc(d.alat || '')], ['Asal', esc(d.asal || '')], ['Sumber', d.sumberDiketahui === 'YA' ? 'RM ' + esc(d.sumberRM) + ' · ' + esc(d.sumberInisial) : 'Tidak diketahui'], ['Vaksin HBV', esc(d.vaksinHBV || '')]].map(r => '<div class="row sp"><span class="mu sm">' + r[0] + '</span><b class="sm" style="text-align:right">' + r[1] + '</b></div>').join('') + '</div><hr style="border:0;border-top:1px solid var(--bd);margin:14px 0"><label class="opt ' + (d.setuju ? 'on' : '') + '" data-act="w-setuju" style="margin-bottom:14px">' + ico('check') + '<span>Saya menyatakan data di atas benar.</span></label><div class="lbl" style="margin-bottom:6px">Tanda tangan</div>' + sigBox('sg-w') + '<p class="xs mu mt">Dilaporkan oleh <b>' + esc(S.me.nama) + '</b> (' + esc(S.me.nik || '') + ') — waktu dicatat otomatis saat dikirim.</p><div id="werr"></div>';
  el.innerHTML = h; initSigs(el); $('#wsv').style.opacity = 1;
}
Actions['w-setuju'] = a => { W.d.setuju = !W.d.setuju; wSave(); a.classList.toggle('on', W.d.setuju); };   // tidak render ulang: tanda tangan tidak boleh terhapus
Actions['w-prev'] = () => { if (W.step > 0) { W.step--; wSave(); wRender(); window.scrollTo(0, 0); } else go('beranda'); };
function wValid(s) {
  const d = W.d; const need = (c, m) => { if (!c) { toast(m, 'er'); return false; } return true; };
  if (s === 0) return need(d.tgl && d.waktu, 'Isi tanggal dan waktu kejadian.') && need(d.tempat, 'Pilih tempat kejadian.') && need((d.jenisPaparan || []).length, 'Pilih minimal satu jenis paparan.');
  if (s === 1) return need((d.cairan || []).length, 'Pilih jenis cairan.') && need(d.alat, 'Pilih jenis alat.');
  if (s === 2) return need(d.asal, 'Pilih asal benda tajam.') && (d.sumberDiketahui !== 'YA' || need(d.sumberRM && d.sumberInisial && d.sumberUnit, 'Lengkapi data pasien sumber.')) && need(d.sumberDiketahui, 'Pilih apakah pasien sumber diketahui.');
  if (s === 3) return need(d.vaksinHBV, 'Pilih status vaksin hepatitis B.');
  return true;
}
Actions['w-next'] = async a => {
  const s = W.step; if (!wValid(s)) return;
  if (s < 4) { W.step++; wSave(); wRender(); window.scrollTo(0, 0); return; }
  if (!W.d.setuju) return toast('Centang pernyataan bahwa data benar.', 'er');
  const ttd = sigGet('sg-w'); if (!ttd) return toast('Mohon tanda tangan terlebih dahulu.', 'er');
  busy(a, true, 'Mengirim…'); const p = Object.assign({}, W.d, { ttd, tampakBerdarah: W.d.tampakBerdarah || 'TIDAK', prep: W.d.prep || 'TIDAK' }); const r = await api('insiden.create', p); busy(a, false);
  if (!r.success) { $('#werr').innerHTML = '<div class="alert er mt">' + ico('error') + '<div>' + esc(r.message) + '</div></div>'; return; }
  Store.del(uk('draft')); W = null; invalidate('boot'); go('sukses', r.data.id);
};

// ---------- SUKSES ----------
Pages.sukses = { title: 'Laporan Terkirim', roles: ['STAF', 'RMO'], show(el, id) {
  let n = 3; el.innerHTML = '<div class="center" style="max-width:420px;margin:50px auto"><div class="ok-big"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h1 class="mt2">Sukses Submit</h1><p class="mu mt">Laporan berhasil dikirim.</p><div class="row mt" style="justify-content:center"><span class="pill nv2" style="font-family:ui-monospace,monospace">' + esc(id) + '</span><span class="xs mu">' + fmtDT(new Date().toISOString()) + '</span></div><p class="sm mt">RMO dan K3 telah diberi tahu. PDF laporan sedang dibuat.</p><p class="xs mu mt2" id="cd">Mengalihkan ke Status Pemeriksaan dalam 3 detik…</p><button class="btn p mt" data-act="nav-kasus" data-p="' + esc(id) + '">Lanjut sekarang</button></div>';
  const t = setInterval(() => { if (!$('#cd')) return clearInterval(t); if (--n <= 0) { clearInterval(t); go('kasus', id); } else $('#cd').textContent = 'Mengalihkan ke Status Pemeriksaan dalam ' + n + ' detik…'; }, 1000); polls.push(t);
} };

// ---------- STATUS PEMERIKSAAN (komponen bersama) ----------
const GRUP = { HIV: { l: 'HIV', p: ['HIV', 'HIV_NAT'], ic: 'water_drop' }, HBV: { l: 'Hepatitis B', p: ['HBSAG', 'ANTI_HBS'], ic: 'vaccines' }, HCV: { l: 'Hepatitis C', p: ['ANTI_HCV', 'HCV_RNA'], ic: 'biotech' } };
function kartuParam(g, rows) {
  const main = rows[0], st = main ? main.Status : 'Menunggu';
  const pc = st === 'Selesai' ? 'ok' : (st === 'Diproses' || st === 'Diminta' || st === 'Menunggu Validasi') ? 'in' : (st === 'Menunggu' ? 'wn' : '');
  return '<div class="card"><div class="row sp"><div class="row">' + ico(g.ic) + '<div><div class="b">' + g.l + '</div><div class="xs mu">' + (main ? esc(LBL[main.Parameter] || main.Parameter) : '—') + '</div></div></div><span class="pill ' + pc + '">' + esc(st === 'Diminta' || st === 'Menunggu Validasi' ? 'Diproses' : st) + '</span></div><div class="mt">' + rows.map(r => '<div style="margin-top:8px">' + (rows.length > 1 ? '<div class="xs mu">' + esc(LBL[r.Parameter] || r.Parameter) + '</div>' : '') + badgeHasil(r) + (r.DiinputAt ? '<div class="xs mu mt">Diinput oleh ' + esc(r.DiinputOleh) + ' · ' + fmtDT(r.DiinputAt) + (r.DivalidasiAt ? '<br>Divalidasi oleh ' + esc(r.DivalidasiOleh) + ' · ' + fmtDT(r.DivalidasiAt) : '') + '</div>' : '') + '</div>').join('') + '</div></div>';
}
function panelHasil(judul, subjek, hasil) {
  return '<div><div class="b mu xs" style="letter-spacing:.06em;margin-bottom:8px">' + judul + '</div><div class="stack">' + Object.keys(GRUP).map(k => { const g = GRUP[k], rows = hasil.filter(h => h.Subjek === subjek && g.p.indexOf(h.Parameter) > -1); return kartuParam(g, rows.length ? rows : []); }).join('') + '</div></div>';
}
function timelineTL(tl) {
  if (!tl.length) return '<div class="mu sm">Jadwal tindak lanjut muncul setelah RMO menyetujui rekomendasi.</div>'; const first = tl.filter(t => t.Status === 'Menunggu').sort((a, b) => a.JatuhTempo.localeCompare(b.JatuhTempo))[0];
  return '<div class="tl">' + tl.sort((a, b) => a.JatuhTempo.localeCompare(b.JatuhTempo)).map(t => '<div class="it ' + (t.Status === 'Selesai' ? 'ok' : (first && first.TLID === t.TLID ? 'now' : '')) + '"><div class="b sm">' + esc(t.Keterangan) + '</div><div class="xs mu">' + fmtD(t.JatuhTempo) + ' · ' + esc(t.Status) + '</div></div>').join('') + '</div>';
}
Pages.status = { title: 'Status Pemeriksaan', roles: ['STAF'], show(el) {
  const k = ((S.boot && S.boot.kasus) || [])[0]; if (k) return go('kasus', k.ID);
  el.innerHTML = empty('science', 'Belum ada kasus', 'Status pemeriksaan tampil setelah Anda membuat laporan.');
} };
function kasusStaf(el, id) {
  const draw = (d, cached, err) => {
    if (!d) return el.innerHTML = errBox(err, 'kasus'); const i = d.insiden, done = ['Selesai', 'Dibatalkan'].indexOf(i.Status) > -1;
    el.innerHTML = '<div class="stack"><div class="card"><div class="row sp wrap"><div><div class="xs mu">Nomor kasus</div><h2 style="font-family:ui-monospace,monospace">' + esc(i.ID) + '</h2></div><div class="row wrap">' + pillStatus(i.Status) + (done ? '' : chipJam(i.KejadianAt)) + '</div></div><div class="row wrap mt"><button class="btn s sm" data-act="dok" data-id="' + esc(i.ID) + '" data-f="pdf">' + ico('download', 'sm') + ' Unduh PDF</button>' + (d.rekomSetuju ? '<button class="btn p sm" data-act="nav-rekom" data-p="' + esc(i.ID) + '">' + ico('fact_check', 'sm') + ' Lihat Rekomendasi</button>' : '<span class="pill wn">' + ico('lock', 'sm') + ' Rekomendasi menunggu persetujuan RMO</span>') + '</div></div>'
      + (d.hasil.some(h => h.Ditahan) ? '<div class="alert wn">' + ico('lock') + '<div><b>Hasil pemeriksaan tersedia.</b> Silakan temui dokter RMO untuk konseling dan membuka hasil.</div></div>' : '')
      + '<div class="grid g2">' + panelHasil('SUMBER PAPARAN', 'SUMBER', d.hasil) + panelHasil('STAF TERPAPAR', 'STAF', d.hasil) + '</div><div class="card"><h3>Tindak Lanjut</h3><div class="mt">' + timelineTL(d.tl) + '</div></div></div>';
  };
  el.innerHTML = skel(2); swr('k:' + id, 'insiden.get', { id }, draw, { fresh: 15000 }); poll('kasus-' + id, () => swr('k:' + id, 'insiden.get', { id }, draw, { force: true }), 20000, 60000);
}
Pages.kasus = { title: 'Detail Kasus', show(el, id) { (S.me.role === 'STAF' ? kasusStaf : kasusKlinis)(el, id); } };

// ---------- REKOMENDASI ----------
function rekomHtml(isi, opt) {
  opt = opt || {}; if (!isi || !isi.hiv) return empty('hourglass_empty', 'Belum ada draf');
  const kartu = (t, ic, o, extra) => '<details class="card" open style="padding:0"><summary style="padding:14px 16px;cursor:pointer;list-style:none;display:flex;gap:10px;align-items:center;border-left:4px solid var(--navy);border-radius:var(--r)">' + ico(ic) + '<div class="grow"><div class="xs mu">' + t + '</div><div class="b">' + esc(o.judul) + '</div></div>' + ico('expand_more') + '</summary><div style="padding:0 16px 14px 18px"><p class="sm">' + esc(o.ringkas || '') + '</p>' + ((o.langkah || []).length ? '<ul class="sm" style="padding-left:18px;margin:8px 0">' + o.langkah.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' : '') + (extra || '') + '</div></details>';
  return '<div class="stack">' + (isi.peringatan || []).map(p => '<div class="alert wn">' + ico('warning') + '<div>' + esc(p) + '</div></div>').join('') + kartu('HIV', 'water_drop', isi.hiv, (isi.hiv.regimen || []).length ? '<div class="hint mt">' + isi.hiv.regimen.map(esc).join('<br>') + '</div>' + (isi.regimenDipilih ? '<div class="alert in mt">' + ico('medication') + '<div>Regimen ditetapkan RMO: <b>' + esc(isi.regimenDipilih) + '</b></div></div>' : '') : '') + kartu('HEPATITIS B', 'vaccines', isi.hbv) + kartu('HEPATITIS C', 'biotech', isi.hcv) + (isi.catatanRMO ? '<div class="alert in">' + ico('support_agent') + '<div><b>Catatan RMO:</b> ' + esc(isi.catatanRMO) + '</div></div>' : '')
    + '<div class="card"><h3>Langkah Berikutnya</h3><div class="mt">' + ((isi.jadwal || []).length ? '<div class="tl">' + isi.jadwal.map(j => '<div class="it"><div class="b sm">' + esc(j.keterangan) + '</div><div class="xs mu">' + fmtD(j.jatuhTempo) + '</div></div>').join('') + '</div>' : '<div class="mu sm">Tidak ada jadwal tes lanjutan.</div>') + '</div><ul class="sm mu" style="padding-left:18px;margin:12px 0 0">' + (isi.konseling || []).map(k => '<li>' + esc(k) + '</li>').join('') + '</ul></div></div>';
}
Pages.rekom = { title: 'Rekomendasi Tatalaksana', roles: ['STAF'], show(el, id) {
  const draw = (d, c, err) => {
    if (!d) return el.innerHTML = errBox(err, 'rekom'); const r = d.rekomSetuju;
    el.innerHTML = '<div style="max-width:720px;margin:auto" class="stack">' + (r ? '<div class="card"><div class="row sp wrap"><div><span class="pill ok">Disetujui</span> <span class="pill nv2">Pedoman ' + esc(r.VersiAturan) + '</span><div class="sm mt">Disetujui oleh <b>' + esc(r.DisetujuiOleh) + '</b> · ' + fmtDT(r.DisetujuiAt) + '</div></div><button class="btn s sm" data-act="dok" data-id="' + esc(id) + '" data-f="pdf">' + ico('download', 'sm') + ' PDF</button></div></div>' + rekomHtml(r.Isi) : '<div class="card empty">' + ico('lock') + '<div class="b">Menunggu persetujuan RMO</div><div class="sm mt">Rekomendasi akan tampil setelah RMO meninjau dan menyetujui.</div></div>') + '</div>';
  };
  el.innerHTML = skel(2); swr('k:' + id, 'insiden.get', { id }, draw, { fresh: 0 });   // selalu cek server: rekomendasi baru langsung tampil
} };

// ---------- PROFIL ----------
Pages.profil = { title: 'Profil', show(el) {
  const m = S.me; el.innerHTML = '<div class="stack" style="max-width:560px;margin:auto"><div class="card center"><div class="av" style="width:64px;height:64px;font-size:22px;margin:0 auto">' + esc((m.nama || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase()) + '</div><h3 class="mt">' + esc(m.nama) + '</h3><div class="mu sm">' + esc(m.email) + '</div><span class="pill nv2 mt">' + esc(m.role) + '</span></div>'
    + (m.darurat ? '' : '<div class="card"><h3>Data Diri</h3><div class="mt"><div class="fld"><label>Nama lengkap</label><input type="text" id="p-nama" value="' + esc(m.nama) + '"></div><div class="fld"><label>NIK karyawan</label><input type="text" value="' + esc(m.nik || '') + '" disabled></div><div class="fld"><label>Unit</label>' + sel('p-unit', M('UNIT'), m.unit) + '</div><div class="fld"><label>Profesi</label>' + sel('p-prof', M('PROFESI'), m.profesi) + '</div><div class="fld"><label>No. WhatsApp</label><input type="tel" id="p-wa" value="' + esc(m.wa || '') + '"></div><button class="btn n" data-act="profil-simpan">Simpan</button></div></div>')
    + '<div class="card"><h3>Keamanan</h3><p class="mu sm mt">Login memakai Google OAuth 2.0. Keluar dari semua perangkat bila ponsel hilang.</p><div class="row wrap mt"><button class="btn s" data-act="logout-all">Keluar dari semua perangkat</button><button class="btn g" data-act="logout">' + ico('logout', 'sm') + ' Keluar</button></div></div></div>';
} };
Actions['profil-simpan'] = async a => { busy(a, true); const r = await api('profil.simpan', { nama: $('#p-nama').value, unit: $('#p-unit').value, profesi: $('#p-prof').value, wa: $('#p-wa').value }); busy(a, false); if (r.success) { S.me = Object.assign(S.me, r.data.me); Store.set('me', S.me); toast(r.message, 'ok'); } else toast(r.message, 'er'); };
Actions['logout-all'] = async () => { if (!(await confirmBox('Keluar dari semua perangkat?', 'Semua sesi aktif Anda akan berakhir.', 'Keluar semua'))) return; await api('auth.logoutAll'); logout(); };

// ---------- VERIFIKASI QR (publik) ----------
Pages.verifikasi = { show(el, id, v, sig) {
  el.innerHTML = authCard('<div class="center mt"><div class="sk" style="width:60%;margin:auto"></div></div>');
  api('verify.doc', { id, v, sig }).then(r => { const d = r.data || {}, ok = r.success && d.valid; $('.card', el).innerHTML = '<div class="center"><img src="assets/logo.png" width="150" alt="Siloam"></div><h2 class="center mt">Verifikasi Dokumen</h2>' + (ok ? '<div class="center mt2"><div class="rc neg" style="width:72px;height:72px;margin:auto">' + ico('check', 'lg fill') + '</div><h3 class="mt">Dokumen asli</h3></div><dl class="kv mt2"><dt>Nomor kasus</dt><dd>' + esc(d.id) + '</dd><dt>Versi</dt><dd>v' + esc(d.versi) + '</dd><dt>Tanggal laporan</dt><dd>' + esc(d.tanggalLaporan) + '</dd><dt>Dibuat</dt><dd>' + esc(d.dibuat) + '</dd><dt>Status</dt><dd>' + esc(d.status) + '</dd><dt>Instansi</dt><dd>' + esc(d.instansi) + '</dd></dl><p class="xs mu center mt2">Halaman ini tidak menampilkan data klinis.</p>' : '<div class="center mt2"><div class="rc pos" style="width:72px;height:72px;margin:auto">' + ico('priority_high', 'lg') + '</div><h3 class="mt">Dokumen tidak ditemukan</h3><p class="mu sm mt">Tanda verifikasi tidak cocok atau dokumen tidak ada.</p></div>'); });
} };
