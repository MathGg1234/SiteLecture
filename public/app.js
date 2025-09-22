// /public/app.js
const API_URL = location.origin.replace(/\/public$/, '') + '/api/index.php';
const $ = s => document.querySelector(s);

const state = { data: { schemaVersion: 1, updatedAt: null, items: [] }, token: null };

init();

async function init() {
  state.token = localStorage.getItem('LECTURES_TOKEN') || null;
  bindUI();
  await refresh();
}

function bindUI() {
  $('#btnAdd').onclick = () => openDialog();
  $('#btnCancel').onclick = () => $('#dlg').close();
  $('#search').oninput = render;
  $('#filterType').onchange = render;
  $('#onlyFav').onchange = render;
  $('#btnExport').onclick = onExport;
  $('#btnImport').onclick = () => $('#fileInput').click();
  $('#fileInput').addEventListener('change', onImportFile);
}

async function refresh() {
  setSync('Chargement…');
  try {
    const res = await fetch(API_URL);
    const json = await res.json();
    state.data = json;
    setSync('À jour : ' + new Date(json.updatedAt).toLocaleString());
    render();
  } catch (e) {
    console.error(e);
    setSync('Hors-ligne — affichage local');
    render();
  }
}

function setSync(t) { $('#syncInfo').textContent = t; }

function render() {
  const q = ($('#search').value || '').toLowerCase();
  const type = $('#filterType').value;
  const onlyFav = $('#onlyFav').checked;

  const list = $('#list');
  list.innerHTML = '';

  state.data.items
    .filter(it => !type || (it.type||'').toLowerCase() === type.toLowerCase())
    .filter(it => !onlyFav || !!it.favorite)
    .filter(it => {
      if (!q) return true;
      const hay = [it.title, it.id, it.type, it.notes, (it.tags||[]).join(' ')].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    })
    .sort((a,b)=> (b.lastReadAt||'').localeCompare(a.lastReadAt||'')) // récents d'abord
    .forEach(it => list.appendChild(card(it)));
}

function card(it) {
  const li = document.createElement('li'); li.className = 'card';

  if (it.cover?.url) {
    const img = document.createElement('img');
    img.className = 'cover';
    img.src = it.cover.url; img.alt = it.cover.alt || it.title || it.id;
    li.appendChild(img);
  }

  const title = document.createElement('div'); title.className = 'title';
  const span = document.createElement('span'); span.textContent = it.title || it.id;
  title.appendChild(span);
  if (it.sourceUrl) {
    const a = document.createElement('a'); a.href = it.sourceUrl; a.target='_blank'; a.rel='noopener';
    a.textContent = 'Ouvrir';
    title.appendChild(a);
  }
  li.appendChild(title);

  const meta = document.createElement('div');
  const ch = it?.progress?.chapter ?? '-';
  const pg = it?.progress?.page ?? '-';
  const pct = it?.progress?.percent;
  let txt = `Chapitre ${ch}  ·  Page ${pg}`;
  if (pct !== null && pct !== undefined) txt += `  ·  ${pct}%`;
  if (it.max && (it.max.chapter || it.max.page)) {
    const mc = it.max.chapter ? `/${it.max.chapter}` : '';
    const mp = it.max.page ? ` p${it.max.page}` : '';
    txt += `  (max ${mc}${mp})`;
  }
  if (it.lastReadAt) txt += `  ·  Dernière lecture: ${new Date(it.lastReadAt).toLocaleString()}`;
  meta.textContent = txt;
  li.appendChild(meta);

  if (it.notes) {
    const notes = document.createElement('div');
    notes.style.opacity = .85;
    notes.textContent = it.notes;
    li.appendChild(notes);
  }

  const badges = document.createElement('div'); badges.className='badges';
  if (it.type) badges.appendChild(tag(it.type));
  if (it.favorite) badges.appendChild(tag('★ favori'));
  li.appendChild(badges);

  const menu = document.createElement('menu');
  const bPlus = btn('+1 chapitre', async () => {
    const cur = (it.progress?.chapter ?? 0) + 1;
    await upsert({ ...it, progress: { chapter: cur, page: 1, percent: it.progress?.percent ?? null } });
  });
  const bEdit = btn('Éditer', () => openDialog(it));
  const bDel  = btn('Supprimer', async () => { if (confirm(`Supprimer "${it.title || it.id}" ?`)) { await api('delete', { id: it.id }); await refresh(); } });
  menu.append(bPlus, bEdit, bDel);
  li.appendChild(menu);

  return li;
}

function tag(t) { const s=document.createElement('span'); s.className='badge'; s.textContent=t; return s; }
function btn(label, on){ const b=document.createElement('button'); b.textContent=label; b.onclick=on; return b; }

function openDialog(it={}) {
  const dlg = $('#dlg'); const f = $('#frm');
  f.reset();
  f.elements.id.value = it.id || '';
  f.elements.title.value = it.title || '';
  f.elements.type.value = it.type || '';
  f.elements.sourceUrl.value = it.sourceUrl || '';
  f.elements.coverUrl.value = it.cover?.url || '';
  f.elements.coverAlt.value = it.cover?.alt || '';
  f.elements.chapter.value = it.progress?.chapter ?? '';
  f.elements.page.value = it.progress?.page ?? '';
  f.elements.percent.value = it.progress?.percent ?? '';
  f.elements.maxChapter.value = it.max?.chapter ?? '';
  f.elements.maxPage.value = it.max?.page ?? '';
  f.elements.tags.value = (it.tags||[]).join(', ');
  f.elements.notes.value = it.notes || '';
  f.elements.favorite.checked = !!it.favorite;

  f.onsubmit = async (e) => {
    e.preventDefault();
    const item = {
      id: f.elements.id.value.trim(),
      title: f.elements.title.value.trim(),
      type: (f.elements.type.value||'').trim() || 'autre',
      sourceUrl: (f.elements.sourceUrl.value||'').trim() || null,
      progress: {
        chapter: numOrNull(f.elements.chapter.value),
        page: numOrNull(f.elements.page.value),
        percent: numOrNull(f.elements.percent.value)
      },
      max: {
        chapter: numOrNull(f.elements.maxChapter.value),
        page: numOrNull(f.elements.maxPage.value)
      },
      notes: (f.elements.notes.value||'').trim() || null,
      favorite: !!f.elements.favorite.checked,
      cover: {
        url: (f.elements.coverUrl.value||'').trim() || null,
        alt: (f.elements.coverAlt.value||'').trim() || null
      },
      lastReadAt: new Date().toISOString()
    };
    await upsert(item);
    dlg.close();
  };

  dlg.showModal();
}

function numOrNull(v){ const n=Number(v); return Number.isFinite(n)?n:null; }

async function upsert(item){ await api('upsert', { item }); await refresh(); }

async function api(action, payload) {
  if (!state.token) {
    const t = prompt('Entre ton token (une fois)');
    if (!t) throw new Error('TOKEN requis');
    localStorage.setItem('LECTURES_TOKEN', t); state.token = t;
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'X-Auth': state.token },
    body: JSON.stringify({ action, ...payload })
  });
  if (!res.ok) {
    if (res.status === 401) { localStorage.removeItem('LECTURES_TOKEN'); state.token=null; alert('Token invalide.'); }
    throw new Error('API error '+res.status);
  }
  return await res.json();
}

function onExport(){
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'lectures-data.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function onImportFile(e){
  const file = e.target.files[0]; if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    if (!json || typeof json !== 'object' || !Array.isArray(json.items)) throw new Error('Fichier invalide');
    await api('bulkReplace', { items: json.items });
    await refresh();
    alert('Import réussi');
  } catch (err) {
    alert('Échec import: ' + err.message);
  } finally {
    e.target.value = '';
  }
}
