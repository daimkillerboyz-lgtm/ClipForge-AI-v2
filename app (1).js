/* ClipForge AI – frontend logic. No fake AI: server features report "not connected". */
'use strict';

// Set to your backend URL (e.g. "https://api.example.com") once it exists. Never put secret keys here.
const API_BASE = '';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const state = { file: null, url: null, ratio: '9/16', style: 'pop', yt: null, dur: 0 };

/* ---------- Helpers ---------- */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove('show'), 2600);
}
function confirmBox(text) {
  return new Promise((res) => {
    const d = $('#dlg'); $('#dlgText').textContent = text; d.showModal();
    const done = (v) => { d.close(); res(v); };
    $('#dlgYes').onclick = () => done(true); $('#dlgNo').onclick = () => done(false);
  });
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const size = (b) => b > 1e9 ? (b / 1e9).toFixed(2) + ' GB' : (b / 1e6).toFixed(1) + ' MB';

/* ---------- Navigation ---------- */
function show(view) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  window.scrollTo({ top: 0 });
}
$$('.nav-btn').forEach((b) => b.onclick = () => show(b.dataset.view));
$$('[data-go]').forEach((b) => b.onclick = () => show(b.dataset.go));

/* ---------- Upload ---------- */
const fileIn = $('#file');
fileIn.onchange = () => { if (fileIn.files[0]) loadFile(fileIn.files[0]); };
$('#replaceBtn').onclick = () => fileIn.click();
function loadFile(f) {
  if (!f.type.startsWith('video/')) return toast('That file is not a video. Choose an MP4, MOV or WEBM.');
  if (state.url) URL.revokeObjectURL(state.url);
  state.file = f; state.url = URL.createObjectURL(f);
  const v = $('#preview'); v.src = state.url;
  v.onloadedmetadata = () => {
    state.dur = v.duration;
    $('#fileInfo').textContent = `${f.name} · ${size(f.size)} · ${fmt(v.duration)} · ${v.videoWidth}×${v.videoHeight}`;
    setupEditor();
  };
  v.onerror = () => { toast('Your browser cannot play this format. Try MP4 (H.264) or WEBM.'); clearVideo(true); };
  $('#drop').hidden = true; $('#fileBox').hidden = false;
  $('#statusText').textContent = 'Video loaded locally. Not uploaded or processed.';
  $('#recent').textContent = f.name + ' (local, unsaved)';
  toast('Video added.');
}
function clearVideo(silent) {
  if (state.url) URL.revokeObjectURL(state.url);
  Object.assign(state, { file: null, url: null, dur: 0 }); fileIn.value = '';
  $('#preview').removeAttribute('src'); $('#edVideo').removeAttribute('src');
  $('#drop').hidden = false; $('#fileBox').hidden = true;
  $('#edEmpty').hidden = false; $('#edBox').hidden = true;
  $('#statusText').textContent = 'No video loaded.'; $('#recent').textContent = 'No projects yet. Upload a video to begin.';
  if (!silent) toast('Video removed.');
}
$('#removeBtn').onclick = async () => { if (await confirmBox('Remove this video? Your trim and caption edits will be lost.')) clearVideo(); };
$('#drop').ondragover = (e) => e.preventDefault();
$('#drop').ondrop = (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); };

/* ---------- Tabs + YouTube validation ---------- */
$$('.tab').forEach((t) => t.onclick = () => {
  $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
  $('#tab-upload').hidden = t.dataset.tab !== 'upload'; $('#tab-yt').hidden = t.dataset.tab !== 'yt';
});
function parseYouTube(u) {
  let url; try { url = new URL(u.trim()); } catch { return null; }
  const h = url.hostname.replace(/^(www\.|m\.)/, ''); let id = null;
  if (h === 'youtu.be') id = url.pathname.slice(1);
  else if (h === 'youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else { const m = url.pathname.match(/^\/(shorts|embed)\/([^/?]+)/); if (m) id = m[2]; }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
$('#ytBtn').onclick = () => {
  const m = $('#ytMsg'), id = parseYouTube($('#ytUrl').value);
  if (!id) { m.className = 'err'; m.textContent = 'Not a valid YouTube link. Use a watch, Shorts or youtu.be link.'; return; }
  state.yt = id; m.className = 'ok';
  m.textContent = `Link format is valid (ID ${id}). The video is NOT imported: server-side import is not connected, and you must have rights to the content.`;
};

/* ---------- Aspect ratio ---------- */
$$('#ratios .chip').forEach((c) => c.onclick = () => {
  $$('#ratios .chip').forEach((x) => x.classList.toggle('active', x === c));
  state.ratio = c.dataset.ratio; applyRatio();
});
function applyRatio() {
  const f = $('#frame'), [w, h] = state.ratio.split('/').map(Number), r = w / h;
  f.style.aspectRatio = state.ratio;
  f.style.height = r > 1 ? 'auto' : '55vh'; f.style.width = r > 1 ? '100%' : 'auto';
  f.style.maxWidth = r > 1 ? '720px' : '100%';
  $('#expSummary').textContent = `Format: ${w}:${h}, style: ${$('#styles .active')?.textContent.trim() || ''}`;
}

/* ---------- Caption styles ---------- */
const STYLES = [
  ['pop', 'Word Pop', 'This is <span class="hl">epic</span>', 'Highlights words one at a time'],
  ['bold', 'Bold Viral', 'Big and bold', 'Large social captions'],
  ['karaoke', 'Karaoke', 'Sing <span class="hl">along</span> now', 'Word-by-word sync'],
  ['min', 'Minimal', 'Clean subtitles', 'Simple and quiet'],
  ['cine', 'Cinematic', 'Elegant and calm', 'Film-style subtitles'],
  ['imp', 'Impact', 'Hit hard', 'High-contrast emphasis'],
];
$('#styles').innerHTML = STYLES.map(([k, n, ex]) =>
  `<button class="chip${k === 'pop' ? ' active' : ''}" data-style="${k}"><span class="cs s-${k}">${ex}</span>${n}</button>`).join('');
$$('#styles .chip').forEach((c) => c.onclick = () => {
  $$('#styles .chip').forEach((x) => x.classList.toggle('active', x === c));
  state.style = c.dataset.style; $('#cap').className = 'cap s-' + state.style; applyRatio();
  toast(c.textContent.trim() + ' selected. Preview only; rendering needs the backend.');
});
$('#cap').className = 'cap s-pop';

/* ---------- Editor: real trim + caption preview ---------- */
const ed = $('#edVideo');
function setupEditor() {
  ed.src = state.url; $('#edEmpty').hidden = true; $('#edBox').hidden = false;
  ['#start', '#end'].forEach((s) => { $(s).max = state.dur; });
  $('#start').value = 0; $('#end').value = Math.min(state.dur, +$('#clipDur').value);
  updateSel(); applyRatio();
}
function updateSel() {
  let s = +$('#start').value, e = +$('#end').value;
  if (e <= s) { e = Math.min(state.dur, s + 0.5); $('#end').value = e; }
  $('#sv').textContent = s.toFixed(1) + 's'; $('#ev').textContent = e.toFixed(1) + 's';
  const sel = $('#sel'); sel.style.left = (s / state.dur * 100) + '%'; sel.style.width = ((e - s) / state.dur * 100) + '%';
}
$('#start').oninput = () => { updateSel(); ed.currentTime = +$('#start').value; };
$('#end').oninput = updateSel;
$('#playSeg').onclick = () => { ed.currentTime = +$('#start').value; ed.play(); };
$('#pauseBtn').onclick = () => ed.pause();
ed.ontimeupdate = () => {
  const e = +$('#end').value; $('#time').textContent = `${fmt(ed.currentTime)} / ${fmt(state.dur)}`;
  if (ed.currentTime >= e) ed.pause();
};
$('#capText').oninput = (e) => $('#cap').textContent = e.target.value;
$('#capPos').oninput = (e) => $('#cap').style.top = e.target.value + '%';

/* ---------- AI + export: honest backend checks ---------- */
$('#genBtn').onclick = () => toast(API_BASE ? 'Backend URL is set, but clip generation is not implemented yet.' : 'AI clip generation is not connected. Set up a backend first.');
$('#expBtn').onclick = () => {
  if (!state.file) return toast('Add a video first.');
  const m = $('#expMsg'), bar = $('#bar');
  bar.style.width = '0';
  m.textContent = API_BASE ? 'Backend URL is set, but the export endpoint is not implemented yet.' : 'Export failed: no rendering backend connected. Nothing was exported.';
};
$('#backendBadge').textContent = API_BASE ? 'Backend URL set (untested)' : 'Backend not connected';

/* ---------- Feature status list ---------- */
const FEATURES = [
  ['Video upload and preview', 1], ['Remove / replace video', 1], ['YouTube URL validation', 1],
  ['Aspect ratio selection', 1], ['Caption style preview', 1], ['Trim start/end preview', 1], ['Caption text and position preview', 1],
  ['YouTube import', 0], ['Speech recognition and word timestamps', 0], ['Highlight and hook detection', 0],
  ['Smart reframing, face tracking, silence removal', 0], ['Caption rendering and MP4 export', 0],
];
$('#features').innerHTML = FEATURES.map(([n, ok]) =>
  `<li>${n}<span class="badge ${ok ? 'on' : 'off'}">${ok ? 'Working' : 'Needs backend'}</span></li>`).join('');
applyRatio();
