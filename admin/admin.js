// Área privada do blog de Cervexeiros Caseiros Pontevedra
import * as X from '../_xerador/xerador.js';

const $ = id => document.getElementById(id);
const DEMO = new URLSearchParams(location.search).has('demo');
const CHAVE_TOKEN = 'accp-token';

const estado = { cfg: null, posts: [], inicio: '', backend: null, actual: null, orixinal: null, pendentes: {}, slugManual: false, portadaNova: null };

// ---------------- utilidades ----------------
function toast(msg, ms = 3500) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, ms);
}
function aviso(msg, tipo = '') {
  const a = $('aviso'); a.className = 'aviso ' + tipo; a.innerHTML = msg; a.hidden = !msg;
}
function ler(clave) { try { return localStorage.getItem(clave) || sessionStorage.getItem(clave); } catch { return null; } }
function gardarToken(tok, lembrar) {
  try { (lembrar ? localStorage : sessionStorage).setItem(CHAVE_TOKEN, tok); } catch { /* sen almacenamento */ }
}
function borrarToken() { try { localStorage.removeItem(CHAVE_TOKEN); sessionStorage.removeItem(CHAVE_TOKEN); } catch { /* */ } }
function textoABase64(s) {
  const bytes = new TextEncoder().encode(s); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function confirmar(titulo, texto, ok = 'Sí') {
  return new Promise(res => {
    const d = $('d-confirmar'); $('c-titulo').textContent = titulo; $('c-texto').textContent = texto; $('c-ok').textContent = ok;
    d.returnValue = ''; d.showModal();
    d.addEventListener('close', () => res(d.returnValue === 'ok'), { once: true });
  });
}
function mostrar(vista) {
  for (const v of ['acceso', 'lista', 'editor']) $('vista-' + v).hidden = v !== vista;
  $('sair').hidden = vista === 'acceso';
  window.scrollTo(0, 0);
}

// ---------------- conexión con GitHub ----------------
function backendGitHub(token, cfg) {
  const [dono, repo] = cfg.repo.split('/');
  const base = `https://api.github.com/repos/${dono}/${repo}`;
  async function api(ruta, opts = {}) {
    const r = await fetch(base + ruta, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) },
      cache: 'no-store',
    });
    if (!r.ok) {
      let msg = `Error ${r.status}`;
      try { msg += ': ' + (await r.json()).message; } catch { /* */ }
      const e = new Error(msg); e.status = r.status; throw e;
    }
    return opts.raw ? r.text() : r.json();
  }
  return {
    nome: 'GitHub',
    async comprobar() {
      const info = await api('');
      if (!info.permissions || !info.permissions.push) throw new Error('La llave no tiene permiso de escritura en el repositorio.');
    },
    lerTexto: ruta => api(`/contents/${ruta}?ref=${cfg.rama}`, { raw: true, headers: { Accept: 'application/vnd.github.raw+json' } }),
    async listarBlog() {
      try { return (await api(`/contents/_blog?ref=${cfg.rama}`)).map(f => f.name).filter(n => n.endsWith('.json') && n !== 'indice.json'); }
      catch (e) { if (e.status === 404) return []; throw e; }
    },
    // ficheiros: { ruta: {texto} | {base64} | null (borrar) }
    async commit(ficheiros, mensaxe) {
      const ref = await api(`/git/ref/heads/${cfg.rama}`);
      const pai = ref.object.sha;
      const commitPai = await api(`/git/commits/${pai}`);
      const arbore = [];
      for (const [ruta, f] of Object.entries(ficheiros)) {
        if (f === null) { arbore.push({ path: ruta, mode: '100644', type: 'blob', sha: null }); continue; }
        const blob = await api('/git/blobs', { method: 'POST', body: JSON.stringify(f.base64 != null ? { content: f.base64, encoding: 'base64' } : { content: textoABase64(f.texto), encoding: 'base64' }) });
        arbore.push({ path: ruta, mode: '100644', type: 'blob', sha: blob.sha });
      }
      // Non se pode borrar un ficheiro que non existe: filtramos os borrados inexistentes
      const existentes = new Set();
      const borrados = arbore.filter(a => a.sha === null);
      if (borrados.length) {
        const t = await api(`/git/trees/${commitPai.tree.sha}?recursive=1`);
        t.tree.forEach(n => existentes.add(n.path));
      }
      const final = arbore.filter(a => a.sha !== null || existentes.has(a.path));
      const tree = await api('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: commitPai.tree.sha, tree: final }) });
      const commit = await api('/git/commits', { method: 'POST', body: JSON.stringify({ message: mensaxe, tree: tree.sha, parents: [pai] }) });
      await api(`/git/refs/heads/${cfg.rama}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
      return commit.sha;
    },
  };
}

// Modo demostración: le a web pública e garda só en memoria
function backendDemo() {
  const memoria = {};
  window.__demo = memoria;
  return {
    nome: 'demostración',
    async comprobar() { },
    async lerTexto(ruta) {
      if (ruta in memoria) { if (memoria[ruta] === null) throw Object.assign(new Error('404'), { status: 404 }); return memoria[ruta].texto; }
      const r = await fetch('../' + ruta, { cache: 'no-store' }); if (!r.ok) throw Object.assign(new Error('Error ' + r.status), { status: r.status }); return r.text();
    },
    async listarBlog() {
      let lista = [];
      try { lista = JSON.parse(await this.lerTexto('_blog/indice.json')).map(s => s + '.json'); } catch { /* */ }
      return lista.filter(n => !(('_blog/' + n) in memoria && memoria['_blog/' + n] === null));
    },
    async commit(ficheiros, mensaxe) {
      Object.assign(memoria, ficheiros); console.log('[demo] commit:', mensaxe, Object.keys(ficheiros)); return 'demo';
    },
  };
}

// ---------------- carga ----------------
async function cargarDatos() {
  const b = estado.backend;
  estado.cfg = JSON.parse(await b.lerTexto('_datos/config.json'));
  estado.inicio = await b.lerTexto('_xerador/paxinas/inicio.html');
  const nomes = await b.listarBlog();
  estado.posts = await Promise.all(nomes.map(async n => JSON.parse(await b.lerTexto('_blog/' + n))));
}

async function entrar(token, lembrar) {
  const cfgPublica = await (await fetch('../_datos/config.json', { cache: 'no-store' })).json();
  estado.backend = DEMO ? backendDemo() : backendGitHub(token, cfgPublica);
  await estado.backend.comprobar();
  if (!DEMO) gardarToken(token, lembrar);
  await cargarDatos();
  $('estado-sesion').textContent = DEMO ? 'Modo demostración (no se guarda nada)' : 'Conectado';
  pintarLista();
  mostrar('lista');
}

// ---------------- lista ----------------
function pintarLista() {
  const posts = [...estado.posts].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  $('lista').innerHTML = posts.length ? posts.map(p => `
    <div class="item">
      <img src="${X.esc(X.rutaImaxe('../', p.portada || 'assets/img/og-cervexeiros.jpg'))}" alt="">
      <div>
        <h3>${X.esc(p.titulo)}</h3>
        <p><span class="selo ${p.borrador ? 'borrador' : ''}">${p.borrador ? 'Borrador' : 'Publicada'}</span>${X.dataLonga(p.data)} · ${X.esc(p.autor)}</p>
      </div>
      <button class="btn btn-sec" data-editar="${X.esc(p.slug)}">Editar</button>
    </div>`).join('') : '<p>Todavía no hay entradas. ¡Escribe la primera!</p>';
}
$('lista').addEventListener('click', e => {
  const s = e.target.closest('[data-editar]')?.dataset.editar;
  if (s) abrirEditor(estado.posts.find(p => p.slug === s));
});
$('nova').addEventListener('click', () => abrirEditor(null));

// ---------------- limpeza do HTML ----------------
const BLOQUES = { P: 'p', H1: 'h2', H2: 'h2', H3: 'h3', H4: 'h3', H5: 'h3', H6: 'h3', BLOCKQUOTE: 'blockquote', UL: 'ul', OL: 'ol', LI: 'li' };
const INLINE = { STRONG: 'strong', B: 'strong', EM: 'em', I: 'em', U: 'u' };
function corValida(c) {
  const s = new Option().style; s.color = c; return s.color ? c : null;
}
function urlSegura(u) {
  u = (u || '').trim();
  if (/^(https?:|mailto:|tel:|#|@\/|\.\.?\/|\/)/i.test(u)) return u;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return 'https://' + u;
  return null;
}
function limpar(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const saida = document.createElement('div');
  function copiar(orixe, destino) {
    for (const n of [...orixe.childNodes]) {
      if (n.nodeType === 3) { destino.appendChild(document.createTextNode(n.nodeValue)); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName;
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'META', 'LINK', 'TITLE', 'NOSCRIPT', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM', 'SVG'].includes(tag)) continue;
      let el = null;
      if (BLOQUES[tag]) el = document.createElement(BLOQUES[tag]);
      else if (INLINE[tag]) el = document.createElement(INLINE[tag]);
      else if (tag === 'BR') { destino.appendChild(document.createElement('br')); continue; }
      else if (tag === 'A') {
        const u = urlSegura(n.getAttribute('href'));
        if (u) { el = document.createElement('a'); el.setAttribute('href', u); if (/^https?:/i.test(u)) el.setAttribute('rel', 'noopener'); }
      } else if (tag === 'IMG') {
        const src = n.getAttribute('src') || '';
        if (/^(data:image\/|@\/|\.\.\/|https?:)/.test(src)) {
          const img = document.createElement('img'); img.setAttribute('src', src); img.setAttribute('alt', n.getAttribute('alt') || '');
          destino.appendChild(img);
        }
        continue;
      } else if (tag === 'SPAN' || tag === 'FONT') {
        const c = corValida(n.style?.color || n.getAttribute('color') || '');
        if (c) { el = document.createElement('span'); el.style.color = c; }
      } else if (tag === 'DIV' && n.classList.contains('galeria')) {
        el = document.createElement('div'); el.className = 'galeria';
      } else if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'FIGURE' || tag === 'HEADER' || tag === 'FOOTER') {
        // bloque xenérico: se só ten texto/inline convértese en parágrafo
        const temBloques = n.querySelector('p,h1,h2,h3,h4,h5,h6,ul,ol,blockquote,div,img,figure');
        el = temBloques ? null : document.createElement('p');
      }
      if (el) { copiar(n, el); destino.appendChild(el); } else copiar(n, destino);
    }
  }
  copiar(doc.body.firstChild, saida);
  // texto solto no nivel superior → parágrafos
  const final = document.createElement('div'); let p = null;
  for (const n of [...saida.childNodes]) {
    const bloque = n.nodeType === 1 && /^(P|H2|H3|BLOCKQUOTE|UL|OL|DIV|IMG)$/.test(n.tagName);
    if (bloque) { p = null; if (n.tagName === 'IMG') { const pp = document.createElement('p'); pp.appendChild(n); final.appendChild(pp); } else final.appendChild(n); }
    else if (n.nodeType === 3 && !n.nodeValue.trim()) { if (p) p.appendChild(n); }
    else { if (!p) { p = document.createElement('p'); final.appendChild(p); } p.appendChild(n); }
  }
  // limpar baleiros
  final.querySelectorAll('p,h2,h3,strong,em,u,span,a,blockquote,li').forEach(el => {
    if (!el.textContent.trim() && !el.querySelector('img,br')) el.remove();
  });
  return final.innerHTML.replace(/&nbsp;/g, ' ').replace(/(<br>\s*)+<\/p>/g, '</p>').replace(/<p>\s*<\/p>/g, '');
}

// ---------------- imaxes ----------------
function cargarImaxe(ficheiro) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(ficheiro); const img = new Image();
    img.onload = () => { res(img); }; img.onerror = () => rej(new Error('No se pudo leer la imagen.')); img.src = url;
  });
}
function aJPEG(img, { ancho, alto, recortar = false, maximo = 1400, calidade = 0.8, limite = 0 }) {
  let w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0, sw = w, sh = h;
  if (recortar) {
    const ra = ancho / alto;
    if (w / h > ra) { sw = h * ra; sx = (w - sw) / 2; } else { sh = w / ra; sy = (h - sh) / 2; }
    w = ancho; h = alto;
  } else { const k = Math.min(1, maximo / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k); }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  let q = calidade, url = c.toDataURL('image/jpeg', q);
  while (limite && url.length * 0.75 > limite && q > 0.45) { q -= 0.08; url = c.toDataURL('image/jpeg', q); }
  return { url, ancho: w, alto: h };
}
const base64De = dataUrl => dataUrl.split(',')[1];

// ---------------- editor ----------------
const ed = $('f-contido');
const CORES = [['#0B2A4A', 'Azul nocturno'], ['#51893D', 'Verde lúpulo'], ['#96BC4D', 'Verde loro'], ['#B37E00', 'Amarillo cerveza'], ['#C0392B', 'Rojo'], ['#5b6b7a', 'Gris']];
$('cores').innerHTML = CORES.map(([c, n]) => `<button type="button" data-cor="${c}" title="${n}" aria-label="Color ${n}" style="background:${c}"></button>`).join('');
let rango = null;
function gardarSeleccion() { const s = getSelection(); if (s.rangeCount && ed.contains(s.anchorNode)) rango = s.getRangeAt(0).cloneRange(); }
function restaurarSeleccion() { ed.focus(); if (rango) { const s = getSelection(); s.removeAllRanges(); s.addRange(rango); } }
document.addEventListener('selectionchange', () => { gardarSeleccion(); actualizarFerramentas(); });
function cmd(c, v = null) { restaurarSeleccion(); document.execCommand('styleWithCSS', false, c === 'foreColor'); document.execCommand(c, false, v); gardarSeleccion(); cambios(); }
$('ferramentas').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
$('ferramentas').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.cmd) cmd(b.dataset.cmd);
  if (b.dataset.cor) cmd('foreColor', b.dataset.cor);
});
$('cor-libre').addEventListener('input', e => cmd('foreColor', e.target.value));
$('t-bloque').addEventListener('change', e => { cmd('formatBlock', e.target.value === 'blockquote' ? 'blockquote' : e.target.value); });
function actualizarFerramentas() {
  if (!ed.contains(getSelection().anchorNode)) return;
  let n = getSelection().anchorNode; n = n?.nodeType === 3 ? n.parentNode : n;
  const b = n?.closest?.('h2,h3,blockquote,p');
  $('t-bloque').value = b ? b.tagName.toLowerCase() : 'p';
  for (const c of ['bold', 'italic', 'underline']) $('ferramentas').querySelector(`[data-cmd=${c}]`).classList.toggle('activo', document.queryCommandState(c));
}

// Ligazóns
$('t-ligazon').addEventListener('click', () => {
  gardarSeleccion();
  const a = rango && (rango.startContainer.nodeType === 3 ? rango.startContainer.parentNode : rango.startContainer).closest?.('a');
  $('l-url').value = a ? a.getAttribute('href') : '';
  $('l-texto').value = ''; $('l-texto').placeholder = rango && !rango.collapsed ? 'Se usará el texto seleccionado' : 'Texto que se verá';
  $('d-ligazon').returnValue = ''; $('d-ligazon').showModal();
});
function volverAoEditor() {
  // o diálogo devolve o foco ao botón: devolvémolo ao texto, ao final do inserido
  const f = () => { ed.focus(); const sel = getSelection(); if (rango) { sel.removeAllRanges(); sel.addRange(rango); } if (sel.rangeCount) sel.collapseToEnd(); gardarSeleccion(); };
  f(); setTimeout(f, 0);
}
$('d-ligazon').addEventListener('close', () => {
  if ($('d-ligazon').returnValue !== 'ok') { volverAoEditor(); return; }
  let u = $('l-url').value.trim(); if (!u) return;
  if (/^[^@\s/]+@[^@\s]+\.[a-z]{2,}$/i.test(u)) u = 'mailto:' + u;
  u = urlSegura(u); if (!u) { toast('Esa dirección no parece válida.'); return; }
  restaurarSeleccion();
  const texto = $('l-texto').value.trim();
  if (rango && !rango.collapsed && !texto) cmd('createLink', u);
  else cmd('insertHTML', `<a href="${X.esc(u)}">${X.esc(texto || u)}</a>&nbsp;`);
  volverAoEditor();
});

// Imaxes dentro do texto
let imaxePendente = null;
$('t-imaxe').addEventListener('click', () => { gardarSeleccion(); $('ficheiro-imaxe').click(); });
$('ficheiro-imaxe').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const img = await cargarImaxe(f);
    imaxePendente = aJPEG(img, { maximo: 1400, calidade: 0.8, limite: 450000 });
    $('i-previa').src = imaxePendente.url; $('i-alt').value = '';
    $('d-imaxe').returnValue = ''; $('d-imaxe').showModal();
  } catch (err) { toast(err.message); }
});
$('d-imaxe').addEventListener('close', () => {
  if ($('d-imaxe').returnValue !== 'ok' || !imaxePendente) { ed.querySelectorAll('img.seleccionada').forEach(i => i.classList.remove('seleccionada')); volverAoEditor(); return; }
  const alt = $('i-alt').value.trim();
  const sel = ed.querySelector('img.seleccionada');
  if (sel && !imaxePendente.url) { sel.alt = alt; sel.classList.remove('seleccionada'); cambios(); return; }
  cmd('insertHTML', `<p><img src="${imaxePendente.url}" alt="${X.esc(alt)}"></p><p><br></p>`);
  imaxePendente = null;
  volverAoEditor();
});
ed.addEventListener('click', e => {
  ed.querySelectorAll('img.seleccionada').forEach(i => i.classList.remove('seleccionada'));
  if (e.target.tagName === 'IMG') {
    e.target.classList.add('seleccionada');
    imaxePendente = { url: '' }; $('i-previa').src = e.target.src; $('i-alt').value = e.target.alt;
    $('d-imaxe').returnValue = ''; $('d-imaxe').showModal();
  }
});
ed.addEventListener('keydown', e => {
  const sel = ed.querySelector('img.seleccionada');
  if (sel && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); sel.remove(); cambios(); }
});
ed.addEventListener('paste', e => {
  const html = e.clipboardData.getData('text/html');
  const imgs = [...e.clipboardData.files].filter(f => f.type.startsWith('image/'));
  if (imgs.length) { e.preventDefault(); const dt = new DataTransfer(); dt.items.add(imgs[0]); $('ficheiro-imaxe').files = dt.files; $('ficheiro-imaxe').dispatchEvent(new Event('change')); return; }
  e.preventDefault();
  if (html) document.execCommand('insertHTML', false, limpar(html));
  else document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
});
ed.addEventListener('drop', e => { if ([...e.dataTransfer.files].length) e.preventDefault(); });
ed.addEventListener('input', cambios);
document.execCommand('defaultParagraphSeparator', false, 'p');

// ---------------- formulario ----------------
const campos = ['f-titulo', 'f-estado', 'f-data', 'f-autor', 'f-slug', 'f-etiquetas', 'f-portada-alt', 'f-extracto', 'f-clave', 'f-seo-titulo', 'f-seo-desc'];
campos.forEach(id => $(id).addEventListener('input', cambios));
$('f-titulo').addEventListener('input', () => {
  if (!estado.slugManual) $('f-slug').value = X.slugify($('f-titulo').value);
});
$('f-slug').addEventListener('input', () => { estado.slugManual = true; $('f-slug').value = $('f-slug').value.toLowerCase().replace(/[^a-z0-9-]/g, '-'); });
$('f-slug').addEventListener('blur', () => { $('f-slug').value = X.slugify($('f-slug').value); cambios(); });

let modificado = false;
function cambios() { modificado = true; actualizarPrevias(); }
window.addEventListener('beforeunload', e => { if (modificado && !$('vista-editor').hidden) { e.preventDefault(); e.returnValue = ''; } });

function abrirEditor(post) {
  const cfg = estado.cfg;
  estado.orixinal = post ? JSON.parse(JSON.stringify(post)) : null;
  estado.actual = post ? JSON.parse(JSON.stringify(post)) : {
    titulo: '', slug: '', autor: cfg.autores[0], data: new Date().toISOString().slice(0, 10), portada: '', portadaAlt: '',
    extracto: '', seoTitulo: '', seoDescricion: '', etiquetas: [], borrador: false, contido: '', palabraClave: '',
  };
  const p = estado.actual;
  estado.slugManual = !!post; estado.portadaNova = null;
  $('f-titulo').value = p.titulo; $('f-estado').value = p.borrador ? 'borrador' : 'publicada'; $('f-data').value = p.data;
  $('f-autor').value = p.autor; $('f-slug').value = p.slug; $('f-etiquetas').value = (p.etiquetas || []).join(', ');
  $('f-portada-alt').value = p.portadaAlt || ''; $('f-extracto').value = p.extracto || ''; $('f-clave').value = p.palabraClave || '';
  $('f-seo-titulo').value = p.seoTitulo || ''; $('f-seo-desc').value = p.seoDescricion || '';
  $('autores').innerHTML = [...new Set([...cfg.autores, ...estado.posts.map(x => x.autor)])].map(a => `<option value="${X.esc(a)}">`).join('');
  $('slug-base').textContent = cfg.url.replace(/^https?:\/\//, '') + '/blog/';
  ed.innerHTML = (p.contido || '').replace(/(src|href)="@\//g, '$1="../');
  pintarPortada(p.portada ? X.rutaImaxe('../', p.portada) : '');
  $('panel-borrar').hidden = !post;
  aviso('');
  mostrar('editor');
  modificado = false;
  actualizarPrevias();
  if (!post) $('f-titulo').focus();
}
function pintarPortada(src) {
  const d = $('portada-previa');
  d.classList.toggle('vacia', !src);
  d.innerHTML = src ? `<img src="${X.esc(src)}" alt="">` : 'Sin portada';
  $('b-portada').textContent = src ? 'Cambiar portada' : 'Subir portada';
}
$('b-portada').addEventListener('click', () => $('ficheiro-portada').click());
$('ficheiro-portada').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const img = await cargarImaxe(f);
    const portada = aJPEG(img, { maximo: 1400, calidade: 0.8, limite: 450000 });
    const og = aJPEG(img, { recortar: true, ancho: 1200, alto: 630, calidade: 0.82, limite: 280000 });
    estado.portadaNova = { portada, og };
    pintarPortada(og.url); cambios();
  } catch (err) { toast(err.message); }
});
$('volver').addEventListener('click', async () => {
  if (modificado && !(await confirmar('¿Salir sin guardar?', 'Tienes cambios sin guardar en esta entrada.', 'Salir sin guardar'))) return;
  modificado = false; pintarLista(); mostrar('lista');
});

function lerFormulario() {
  const p = { ...estado.actual };
  p.titulo = $('f-titulo').value.trim();
  p.slug = X.slugify($('f-slug').value || p.titulo);
  p.autor = $('f-autor').value.trim();
  p.data = $('f-data').value;
  p.borrador = $('f-estado').value === 'borrador';
  p.etiquetas = $('f-etiquetas').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  p.portadaAlt = $('f-portada-alt').value.trim();
  p.extracto = $('f-extracto').value.trim();
  p.palabraClave = $('f-clave').value.trim();
  p.seoTitulo = $('f-seo-titulo').value.trim();
  p.seoDescricion = $('f-seo-desc').value.trim();
  return p;
}

// ---------------- previas e SEO ----------------
function actualizarPrevias() {
  const p = lerFormulario(); const cfg = estado.cfg; if (!cfg) return;
  const texto = X.textoPlano(ed.innerHTML);
  const palabras = texto ? texto.split(' ').length : 0;
  $('contador-palabras').textContent = `${palabras} palabras · ${Math.max(1, Math.round(palabras / 200))} min de lectura`;
  $('c-extracto').textContent = p.extracto.length;
  $('c-seo-titulo').textContent = (p.seoTitulo || p.titulo).length;
  $('c-seo-desc').textContent = (p.seoDescricion || p.extracto).length;
  const tSeo = p.seoTitulo || p.titulo || 'Título de la entrada';
  const dSeo = p.seoDescricion || p.extracto || 'Escribe un extracto para que aparezca aquí.';
  const url = `${cfg.url}/blog/${p.slug || 'slug'}/`;
  const host = new URL(cfg.url).host;
  $('previa-google').innerHTML = `<div class="g-url">${X.esc(host)} › blog › ${X.esc(p.slug || 'slug')}</div>
    <div class="g-titulo">${X.esc((tSeo + ' · ' + cfg.nome).slice(0, 62))}${(tSeo + ' · ' + cfg.nome).length > 62 ? '…' : ''}</div>
    <div class="g-desc">${X.esc(X.dataLonga(p.data || new Date().toISOString()))} — ${X.esc(dSeo.slice(0, 158))}${dSeo.length > 158 ? '…' : ''}</div>`;
  const ogSrc = estado.portadaNova ? estado.portadaNova.og.url : (p.portada ? X.rutaImaxe('../', X.ogDe(p)) : '');
  $('previa-whatsapp').innerHTML = `<div class="burbulla"><div class="tarxeta-wa">${ogSrc ? `<img src="${X.esc(ogSrc)}" alt="">` : '<img alt="">'}
    <div><div class="wa-titulo">${X.esc(tSeo)}</div><div class="wa-desc">${X.esc(dSeo)}</div><div class="wa-dominio">${X.esc(host)}</div></div></div>
    <div class="wa-ligazon">${X.esc(url)}</div></div>`;
  // checklist
  const clave = p.palabraClave.toLowerCase();
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const primeiro = norm(X.textoPlano(ed.querySelector('p')?.innerHTML || '') + ' ' + p.extracto);
  const imgs = [...ed.querySelectorAll('img')];
  const lt = (p.seoTitulo || p.titulo).length, ld = (p.seoDescricion || p.extracto).length;
  const items = [
    [lt >= 30 && lt <= 60, `Título para Google de 30 a 60 caracteres (ahora ${lt})`],
    [ld >= 70 && ld <= 160, `Descripción de 70 a 160 caracteres (ahora ${ld})`],
    [p.slug && p.slug.length <= 60, 'Slug corto y sin caracteres raros'],
    [!!(estado.portadaNova || p.portada), 'Tiene foto de portada (sale en WhatsApp y redes)'],
    [!!p.portadaAlt, 'La portada tiene descripción (texto alternativo)'],
    [!!ed.querySelector('h2'), 'El texto tiene al menos un «Título de sección»'],
    [palabras >= 300, `Al menos 300 palabras (ahora ${palabras})`],
    [imgs.every(i => i.alt.trim()), 'Todas las fotos del texto tienen descripción'],
    [!!ed.querySelector('a'), 'Incluye al menos un enlace'],
  ];
  if (clave) {
    const c = norm(clave);
    items.push(
      [norm(p.seoTitulo || p.titulo).includes(c), 'La palabra clave está en el título'],
      [norm(p.seoDescricion || p.extracto).includes(c), 'La palabra clave está en la descripción'],
      [p.slug.includes(X.slugify(clave)), 'La palabra clave está en el slug'],
      [primeiro.includes(c), 'La palabra clave aparece al principio del texto o en el extracto'],
    );
  } else items.push([false, 'Elige una palabra clave principal para revisar el SEO']);
  $('checklist').innerHTML = items.map(([ok, t]) => `<li class="${ok ? 'ben' : 'mellorar'}">${X.esc(t)}</li>`).join('');
  $('gardar').textContent = p.borrador ? 'Guardar borrador' : (estado.orixinal && !estado.orixinal.borrador ? 'Guardar cambios' : 'Publicar');
}

// ---------------- vista previa ----------------
$('previa').addEventListener('click', () => {
  const p = lerFormulario();
  p.contido = limpar(ed.innerHTML).replace(/(src|href)="\.\.\//g, '$1="@/');
  if (estado.portadaNova) { p.portada = '__portada__'; p.og = '__og__'; }
  if (!p.portada) p.portada = 'assets/img/og-cervexeiros.jpg';
  p.slug = p.slug || 'vista-previa';
  let html = X.paxinaEntrada({ ...p, borrador: false }, estado.cfg, estado.posts);
  if (estado.portadaNova) html = html.split('../../__portada__').join(estado.portadaNova.portada.url).split('__og__').join('');
  const base = new URL(`../blog/${p.slug}/`, location.href).href;
  html = html.replace('<head>', `<head><base href="${base}">`);
  $('previa-iframe').srcdoc = html;
  $('d-previa').showModal();
});

// ---------------- gardar ----------------
function validar(p) {
  const erros = [];
  if (!p.titulo) erros.push('el título');
  if (!p.slug) erros.push('el slug');
  if (!p.data) erros.push('la fecha');
  if (!p.autor) erros.push('el autor');
  if (!p.borrador) {
    if (!p.portada && !estado.portadaNova) erros.push('la foto de portada');
    if (!p.extracto) erros.push('el extracto');
    if (!X.textoPlano(ed.innerHTML)) erros.push('el contenido');
  }
  const dup = estado.posts.some(x => x.slug === p.slug && (!estado.orixinal || x.slug !== estado.orixinal.slug));
  if (dup) erros.push('un slug distinto (ya hay otra entrada con «' + p.slug + '»)');
  return erros;
}

$('gardar').addEventListener('click', async () => {
  const p = lerFormulario();
  const erros = validar(p);
  if (erros.length) { aviso('Falta ' + erros.join(', ') + '.', 'mal'); return; }
  const cfg = estado.cfg; const ficheiros = {}; const selo = Date.now().toString(36);
  const cartafol = `assets/blog/${p.slug}`;
  // imaxes novas no contido
  const tmp = document.createElement('div'); tmp.innerHTML = limpar(ed.innerHTML);
  let n = 0;
  tmp.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src');
    if (src.startsWith('data:image/')) {
      const ruta = `${cartafol}/foto-${selo}-${++n}.jpg`;
      ficheiros[ruta] = { base64: base64De(src) };
      img.setAttribute('src', '@/' + ruta);
    } else if (src.startsWith('../')) img.setAttribute('src', '@/' + src.slice(3));
  });
  tmp.querySelectorAll('a[href^="../"]').forEach(a => a.setAttribute('href', '@/' + a.getAttribute('href').slice(3)));
  p.contido = tmp.innerHTML;
  // portada
  if (estado.portadaNova) {
    const { portada, og } = estado.portadaNova;
    p.portada = `${cartafol}/portada-${selo}.jpg`; p.og = `${cartafol}/og-${selo}.jpg`;
    p.portadaAncho = portada.ancho; p.portadaAlto = portada.alto; p.portadaCredito = ''; p.portadaCreditoUrl = '';
    ficheiros[p.portada] = { base64: base64De(portada.url) };
    ficheiros[p.og] = { base64: base64De(og.url) };
  }
  p.actualizado = new Date().toISOString();
  // lista nova de entradas
  const vello = estado.orixinal;
  const posts = estado.posts.filter(x => !vello || x.slug !== vello.slug).concat([p]);
  ficheiros[`_blog/${p.slug}.json`] = { texto: JSON.stringify(p, null, 2) + '\n' };
  for (const [ruta, html] of Object.entries(X.ficheirosBlog(posts, cfg, estado.inicio))) ficheiros[ruta] = { texto: html };
  if (vello && vello.slug !== p.slug) {
    ficheiros[`_blog/${vello.slug}.json`] = null;
    ficheiros[`blog/${vello.slug}/index.html`] = vello.borrador ? null : { texto: X.redireccion(`${cfg.url}/blog/${p.slug}/`) };
  }
  if (p.borrador) ficheiros[`blog/${p.slug}/index.html`] = null;
  const accion = p.borrador ? 'garda borrador' : (vello && !vello.borrador ? 'actualiza' : 'publica');
  const boton = $('gardar'); boton.disabled = true; const textoBoton = boton.textContent; boton.textContent = 'Guardando…';
  try {
    await estado.backend.commit(ficheiros, `Blog: ${accion} «${p.titulo}»`);
    estado.posts = posts; estado.orixinal = JSON.parse(JSON.stringify(p)); estado.actual = JSON.parse(JSON.stringify(p));
    estado.portadaNova = null; modificado = false; $('panel-borrar').hidden = false;
    ed.innerHTML = p.contido.replace(/(src|href)="@\//g, '$1="../');
    const enlace = `${cfg.url}/blog/${p.slug}/`;
    aviso(p.borrador ? 'Borrador guardado. No se ve en la web hasta que lo publiques.'
      : `¡Hecho! La entrada estará en la web en 1 o 2 minutos: <a href="${X.esc(enlace)}" target="_blank" rel="noopener">${X.esc(enlace)}</a>`, 'ok');
    toast(DEMO ? 'Guardado (demostración: no se ha cambiado la web)' : 'Guardado');
    actualizarPrevias();
  } catch (e) {
    aviso('No se pudo guardar: ' + X.esc(e.message) + (e.status === 401 ? ' La llave ha caducado o no es válida: cierra sesión y vuelve a entrar.' : ''), 'mal');
  } finally { boton.disabled = false; boton.textContent = textoBoton; actualizarPrevias(); }
});

$('borrar').addEventListener('click', async () => {
  const vello = estado.orixinal; if (!vello) return;
  if (!(await confirmar('¿Eliminar la entrada?', `«${vello.titulo}» desaparecerá de la web.`, 'Eliminar'))) return;
  const posts = estado.posts.filter(x => x.slug !== vello.slug);
  const ficheiros = { [`_blog/${vello.slug}.json`]: null, [`blog/${vello.slug}/index.html`]: null };
  for (const [ruta, html] of Object.entries(X.ficheirosBlog(posts, estado.cfg, estado.inicio))) ficheiros[ruta] = { texto: html };
  try {
    await estado.backend.commit(ficheiros, `Blog: elimina «${vello.titulo}»`);
    estado.posts = posts; modificado = false; toast('Entrada eliminada'); pintarLista(); mostrar('lista');
  } catch (e) { aviso('No se pudo eliminar: ' + X.esc(e.message), 'mal'); }
});

// ---------------- sesión ----------------
$('form-acceso').addEventListener('submit', async e => {
  e.preventDefault();
  const b = e.submitter; b.disabled = true; $('erro-acceso').hidden = true;
  try { await entrar($('token').value.trim(), $('lembrar').checked); $('token').value = ''; }
  catch (err) {
    borrarToken();
    $('erro-acceso').textContent = err.status === 401 ? 'La llave no es válida o ha caducado.' : (err.status === 404 ? 'La llave no tiene acceso al repositorio de la web.' : err.message);
    $('erro-acceso').hidden = false;
  } finally { b.disabled = false; }
});
$('sair').addEventListener('click', () => { borrarToken(); location.href = location.pathname; });

(async () => {
  if (DEMO) { try { await entrar('', false); } catch (e) { toast(e.message); mostrar('acceso'); } return; }
  const t = ler(CHAVE_TOKEN);
  let enLocal = false; try { enLocal = !!localStorage.getItem(CHAVE_TOKEN); } catch { /* */ }
  if (t) { try { await entrar(t, enLocal); return; } catch { borrarToken(); } }
  mostrar('acceso');
})();
