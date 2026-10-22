// Xerador da web de Cervexeiros Caseiros Pontevedra.
// Úsase igual no navegador (área privada) e en Node (_xerador/build.mjs).

export const MESES = ['xaneiro', 'febreiro', 'marzo', 'abril', 'maio', 'xuño', 'xullo', 'agosto', 'setembro', 'outubro', 'novembro', 'decembro'];

export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function dataLonga(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

export function slugify(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/ñ/g, 'n').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '');
}

export function textoPlano(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

export function minutosLectura(html) {
  const palabras = textoPlano(html).split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(palabras / 200));
}

// Ordena e filtra entradas publicadas (máis recentes primeiro)
export function publicadas(posts) {
  return posts.filter(p => !p.borrador).sort((a, b) => (b.data + (b.slug || '')).localeCompare(a.data + (a.slug || '')));
}

const abs = (cfg, ruta) => /^https?:\/\//.test(ruta) ? ruta : cfg.url.replace(/\/$/, '') + '/' + String(ruta || '').replace(/^\//, '');
// As imaxes poden estar no repositorio (ruta relativa) ou noutro sitio (URL completa)
export const rutaImaxe = (raiz, r) => /^https?:\/\//.test(r) ? r : raiz + r;

// Cambia o prefixo "@/" das imaxes e ligazóns internas polo camiño relativo á raíz
export const ogDe = p => p.og || String(p.portada).replace(/portada([^/]*)\.jpg$/, 'og$1.jpg');

export function resolverContido(html, raiz) {
  return String(html || '')
    .replace(/(src|href)="@\//g, `$1="${raiz}`)
    .replace(/<img (?![^>]*loading=)/g, '<img loading="lazy" ');
}

const MENU = [
  ['', 'Inicio'], ['quen-somos.html', 'Quen somos'], ['blog/', 'Blog'], ['contacto.html', 'Contacto'], ['faite-socio.html', 'Faite socio/a'],
];

export function layout({ cfg, raiz, actual, titulo, descricion, canonica, imaxe, imaxeAncho = 1200, imaxeAlto = 630, tipo = 'website', cabeceiraExtra = '', corpo, indexar = true }) {
  const t = actual === '' ? cfg.nome : `${titulo} · ${cfg.nome}`;
  const img = abs(cfg, imaxe || cfg.imaxeSocial);
  const menu = MENU.map(([h, n]) => {
    const cur = h === actual ? ' aria-current="page"' : '';
    const dest = h === 'faite-socio.html' && h !== actual ? ' class="destacado"' : '';
    return `<li><a href="${raiz}${h || './'}"${cur}${dest}>${n}</a></li>`;
  }).join('');
  return `<!doctype html>
<html lang="gl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t)}</title>
<meta name="description" content="${esc(descricion)}">
${indexar ? '' : '<meta name="robots" content="noindex">\n'}<link rel="canonical" href="${esc(canonica)}">
<meta property="og:site_name" content="${esc(cfg.nome)}">
<meta property="og:locale" content="gl_ES">
<meta property="og:type" content="${tipo}">
<meta property="og:title" content="${esc(titulo || cfg.nome)}">
<meta property="og:description" content="${esc(descricion)}">
<meta property="og:url" content="${esc(canonica)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:secure_url" content="${esc(img)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="${imaxeAncho}">
<meta property="og:image:height" content="${imaxeAlto}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titulo || cfg.nome)}">
<meta name="twitter:description" content="${esc(descricion)}">
<meta name="twitter:image" content="${esc(img)}">
<meta name="theme-color" content="#0B2A4A">
<link rel="icon" href="${raiz}favicon.png">
<link rel="apple-touch-icon" href="${raiz}apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="Blog de ${esc(cfg.nome)}" href="${raiz}feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,700..800&family=Figtree:ital,wght@0,400;0,600;0,800;0,900;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${raiz}assets/css/estilo.css">
${cabeceiraExtra}</head>
<body>
<a class="saltar" href="#contido">Saltar ao contido</a>
<header class="cabeceira">
  <div class="envoltorio">
    <a class="marca" href="${raiz}./">
      <img src="${raiz}assets/img/logo-accp.webp" alt="" width="56" height="56">
      <span>Cervexeiros Caseiros<small>Pontevedra</small></span>
    </a>
    <button class="menu-boton" aria-expanded="false" aria-controls="menu">☰ Menú</button>
    <nav class="menu" id="menu" aria-label="Menú principal"><ul>${menu}</ul></nav>
  </div>
</header>
<main id="contido">
${corpo}
</main>
<footer class="pe">
  <div class="envoltorio">
    <img src="${raiz}assets/img/logo-accp.webp" alt="Logo de Cervexeiros Caseiros Pontevedra" width="84" height="84">
    <div>
      <p class="lema-pe">Feito con amor, lúpulo e un chisquiño de canallada.</p>
      <p>Correo: <a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a></p>
      <p>Instagram: <a href="${esc(cfg.instagram)}" rel="noopener">@cervexeiros</a></p>
    </div>
    <a class="boton" href="${raiz}faite-socio.html">Faite socio/a</a>
    <p class="legal">© ${new Date().getFullYear()} ${esc(cfg.nomeLegal)} (ACCP) · Asociación sen ánimo de lucro · Pontevedra, Galicia</p>
  </div>
</footer>
<script>
  const b = document.querySelector('.menu-boton'), m = document.getElementById('menu');
  b.addEventListener('click', () => { const a = m.classList.toggle('aberto'); b.setAttribute('aria-expanded', a); });
</script>
</body>
</html>
`;
}

export function tarxetas(posts, raiz, n = Infinity) {
  return publicadas(posts).slice(0, n).map(p => `<a class="nova" href="${raiz}blog/${p.slug}/">
  <img src="${esc(rutaImaxe(raiz, p.portada))}" alt="" loading="lazy" width="${p.portadaAncho || 1200}" height="${p.portadaAlto || 900}">
  <div><time datetime="${p.data}">${dataLonga(p.data)}</time><h3>${esc(p.titulo)}</h3><p>${esc(p.extracto)}</p></div>
</a>`).join('\n');
}

const garabatos = '<div class="garabatos" role="presentation"></div>';

function organizacion(cfg) {
  return { '@type': 'Organization', name: cfg.nomeLegal, url: abs(cfg, ''), logo: { '@type': 'ImageObject', url: abs(cfg, 'assets/img/logo-accp.png') }, sameAs: [cfg.instagram] };
}
const ld = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>\n`;

export function paxinaEntrada(post, cfg, todos) {
  const raiz = '../../';
  const url = abs(cfg, `blog/${post.slug}/`);
  const outras = publicadas(todos).filter(p => p.slug !== post.slug).slice(0, 2);
  const etiquetas = (post.etiquetas || []).length
    ? `<ul class="etiquetas">${post.etiquetas.map(e => `<li>#${esc(e)}</li>`).join('')}</ul>` : '';
  const jsonld = ld({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting', headline: post.titulo, description: post.seoDescricion || post.extracto,
        image: [abs(cfg, ogDe(post)), abs(cfg, post.portada)],
        datePublished: post.data, dateModified: post.actualizado || post.data,
        author: { '@type': 'Person', name: post.autor }, publisher: organizacion(cfg),
        mainEntityOfPage: url, inLanguage: 'gl', keywords: (post.etiquetas || []).join(', '),
      },
      {
        '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: abs(cfg, '') },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: abs(cfg, 'blog/') },
          { '@type': 'ListItem', position: 3, name: post.titulo, item: url },
        ],
      },
    ],
  });
  const extra = `<meta property="article:published_time" content="${post.data}">
<meta property="article:modified_time" content="${esc(post.actualizado || post.data)}">
<meta property="article:author" content="${esc(post.autor)}">
${(post.etiquetas || []).map(e => `<meta property="article:tag" content="${esc(e)}">`).join('\n')}
${jsonld}`;
  const corpo = `
<article>
<header class="cabeza-paxina cabeza-entrada">
  <div class="envoltorio">
    <nav class="migas" aria-label="Estás en"><a href="${raiz}./">Inicio</a> › <a href="${raiz}blog/">Blog</a></nav>
    <h1>${esc(post.titulo)}</h1>
    <p class="meta-entrada"><time datetime="${post.data}">${dataLonga(post.data)}</time> · Por ${esc(post.autor)} · ${minutosLectura(post.contido)} min de lectura</p>
  </div>
  ${garabatos}
</header>
<div class="bloque">
  <div class="envoltorio artigo">
    <figure class="foto portada-entrada"><img src="${esc(rutaImaxe(raiz, post.portada))}" alt="${esc(post.portadaAlt || post.titulo)}" width="${post.portadaAncho || 1200}" height="${post.portadaAlto || 900}" fetchpriority="high">${post.portadaCredito ? `<figcaption class="credito">Foto: ${post.portadaCreditoUrl ? `<a href="${esc(post.portadaCreditoUrl)}" rel="noopener">${esc(post.portadaCredito)}</a>` : esc(post.portadaCredito)}</figcaption>` : ''}</figure>
    <p class="entradilla">${esc(post.extracto)}</p>
    <div class="contido-entrada">
${resolverContido(post.contido, raiz)}
    </div>
    ${etiquetas}
    <div class="compartir">
      <p><strong>Compárteo:</strong></p>
      <a class="boton" href="https://wa.me/?text=${encodeURIComponent(post.titulo + ' ' + url)}" rel="noopener">WhatsApp</a>
      <a class="boton boton--claro" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" rel="noopener">Facebook</a>
    </div>
    <a class="volver" href="${raiz}blog/">← Todas as entradas do blog</a>
  </div>
</div>
</article>
${outras.length ? `<section class="bloque bloque--branco"><div class="envoltorio"><h2>Máis do blog</h2><div class="novas">${tarxetas(outras, raiz)}</div></div></section>` : ''}
<section class="bloque bloque--loro destaque">
  <div class="envoltorio">
    <h2>Queres vir á próxima?</h2>
    <p>Faite socio/a por 20 € ao ano e non perdas ningún obradoiro, cata nin elaboración conxunta.</p>
    <div class="botons"><a class="boton" href="${raiz}faite-socio.html">Faite socio/a</a></div>
  </div>
</section>`;
  return layout({
    cfg, raiz, actual: 'blog/', titulo: post.seoTitulo || post.titulo, descricion: post.seoDescricion || post.extracto,
    canonica: url, imaxe: ogDe(post), tipo: 'article', cabeceiraExtra: extra, corpo,
  });
}

export function paxinaBlog(posts, cfg) {
  const raiz = '../';
  const lista = publicadas(posts);
  const jsonld = ld({
    '@context': 'https://schema.org', '@type': 'Blog', name: `Blog de ${cfg.nome}`, url: abs(cfg, 'blog/'), inLanguage: 'gl',
    publisher: organizacion(cfg),
    blogPost: lista.map(p => ({ '@type': 'BlogPosting', headline: p.titulo, url: abs(cfg, `blog/${p.slug}/`), datePublished: p.data })),
  });
  const corpo = `
<section class="cabeza-paxina">
  <div class="envoltorio">
    <p class="antetitulo">Blog</p>
    <h1>Que andamos a facer</h1>
    <p>Obradoiros, catas, feiras, elaboracións e receitas: todo o que se coce (e fermenta) na asociación.</p>
  </div>
  ${garabatos}
</section>
<section class="bloque">
  <div class="envoltorio">
    ${lista.length ? `<div class="novas">\n${tarxetas(lista, raiz)}\n</div>` : '<p>Aínda non hai entradas. Volve pronto!</p>'}
    <p style="margin-top:2em">Para o día a día, síguenos en <a href="${esc(cfg.instagram)}" rel="noopener">Instagram</a> ou subscríbete ao <a href="${raiz}feed.xml">RSS do blog</a>.</p>
  </div>
</section>`;
  return layout({
    cfg, raiz, actual: 'blog/', titulo: 'Blog', descricion: `Blog da ${cfg.nomeLegal}: obradoiros, catas, feiras e receitas de cervexa caseira en Pontevedra.`,
    canonica: abs(cfg, 'blog/'), cabeceiraExtra: jsonld, corpo,
  });
}

export const PAXINAS = [
  { ficheiro: 'index.html', fragmento: 'inicio', actual: '', titulo: '', descricion: null },
  { ficheiro: 'quen-somos.html', fragmento: 'quen-somos', actual: 'quen-somos.html', titulo: 'Quen somos', descricion: 'Quen somos: a Asociación de Cervexeiros Caseiros de Pontevedra, a nosa misión, visión e valores.' },
  { ficheiro: 'faite-socio.html', fragmento: 'faite-socio', actual: 'faite-socio.html', titulo: 'Faite socio/a', descricion: 'Faite socio/a da Asociación de Cervexeiros Caseiros de Pontevedra por 20 € ao ano: obradoiros, catas, elaboracións e compras conxuntas.' },
  { ficheiro: 'calendario-advento.html', fragmento: 'calendario-advento', actual: null, titulo: 'Calendario de Advento cervexeiro 2026', descricion: '24 portiñas, 24 birras: encarga o calendario de Advento cervexeiro 2026 da Asociación de Cervexeiros Caseiros de Pontevedra.', imaxe: 'assets/advento/og-calendario-2026.jpg' },
  { ficheiro: 'contacto.html', fragmento: 'contacto', actual: 'contacto.html', titulo: 'Contacto', descricion: 'Contacta coa Asociación de Cervexeiros Caseiros de Pontevedra por correo ou Instagram.' },
];

export function paxinaEstatica(def, fragmento, cfg, posts) {
  let corpo = fragmento.split('__URL__').join(cfg.url.replace(/\/$/, ''));
  if (def.fragmento === 'inicio') corpo = corpo.replace('<!--NOVIDADES-->', tarxetas(posts, '', 3));
  const extra = def.fragmento === 'inicio' ? ld({ '@context': 'https://schema.org', ...organizacion(cfg), '@type': 'NGO', email: cfg.email, address: { '@type': 'PostalAddress', addressLocality: 'Pontevedra', addressRegion: 'Galicia', addressCountry: 'ES' } }) : '';
  return layout({
    cfg, raiz: '', actual: def.actual, titulo: def.titulo, descricion: def.descricion || cfg.descricion,
    canonica: abs(cfg, def.ficheiro === 'index.html' ? '' : def.ficheiro), imaxe: def.imaxe, cabeceiraExtra: extra, corpo,
  });
}

export function paxina404(cfg) {
  const raiz = cfg.url.replace(/\/$/, '') + '/';
  return layout({
    cfg, raiz, actual: null, titulo: 'Páxina non atopada', descricion: 'Páxina non atopada.', canonica: raiz, indexar: false, corpo: `
<section class="bloque destaque">
  <div class="envoltorio">
    <img class="decoracion" src="${raiz}assets/img/xerra.webp" alt="" width="120" height="120">
    <h1>Ups! Esta páxina fermentou de máis</h1>
    <p>Non atopamos o que buscabas. Igual xa nola bebemos.</p>
    <div class="botons"><a class="boton" href="${raiz}">Volver ao inicio</a> <a class="boton" href="${raiz}blog/">Ir ao blog</a></div>
  </div>
</section>` });
}

// Páxina que redirixe unha URL antiga a outra nova
export function redireccion(destinoAbs) {
  return `<!doctype html><html lang="gl"><head><meta charset="utf-8"><title>Redirixindo…</title>
<link rel="canonical" href="${esc(destinoAbs)}"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=${esc(destinoAbs)}">
</head><body><p>Esta páxina mudouse a <a href="${esc(destinoAbs)}">${esc(destinoAbs)}</a>.</p></body></html>\n`;
}

export function sitemap(posts, cfg) {
  const hoxe = new Date().toISOString().slice(0, 10);
  const urls = [
    ['', hoxe, '1.0'], ['quen-somos.html', null, '0.7'], ['faite-socio.html', null, '0.8'], ['contacto.html', null, '0.5'], ['calendario-advento.html', hoxe, '0.9'], ['blog/', hoxe, '0.9'],
    ...publicadas(posts).map(p => [`blog/${p.slug}/`, String(p.actualizado || p.data).slice(0, 10), '0.8']),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d, pr]) => `  <url><loc>${esc(abs(cfg, u))}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}<priority>${pr}</priority></url>`).join('\n')}
</urlset>
`;
}

export function feed(posts, cfg) {
  const lista = publicadas(posts).slice(0, 20);
  const rfc = d => new Date(String(d).slice(0, 10) + 'T12:00:00Z').toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Blog de ${esc(cfg.nome)}</title>
  <link>${esc(abs(cfg, 'blog/'))}</link>
  <atom:link href="${esc(abs(cfg, 'feed.xml'))}" rel="self" type="application/rss+xml"/>
  <description>${esc(cfg.descricion)}</description>
  <language>gl</language>
${lista.map(p => `  <item>
    <title>${esc(p.titulo)}</title>
    <link>${esc(abs(cfg, `blog/${p.slug}/`))}</link>
    <guid>${esc(abs(cfg, `blog/${p.slug}/`))}</guid>
    <pubDate>${rfc(p.data)}</pubDate>
    <description>${esc(p.extracto)}</description>
  </item>`).join('\n')}
</channel>
</rss>
`;
}

export function robots(cfg) {
  return `User-agent: *\nDisallow: /admin/\nDisallow: /_blog/\nDisallow: /_datos/\nDisallow: /_xerador/\n\nSitemap: ${abs(cfg, 'sitemap.xml')}\n`;
}

// Todos os ficheiros que dependen do listado do blog (para gardar dunha vez)
export function ficheirosBlog(posts, cfg, fragmentoInicio) {
  const f = {
    'blog/index.html': paxinaBlog(posts, cfg),
    'index.html': paxinaEstatica(PAXINAS[0], fragmentoInicio, cfg, posts),
    'sitemap.xml': sitemap(posts, cfg),
    'feed.xml': feed(posts, cfg),
    '_blog/indice.json': JSON.stringify(posts.map(p => p.slug).sort(), null, 2) + '\n',
  };
  for (const p of publicadas(posts)) f[`blog/${p.slug}/index.html`] = paxinaEntrada(p, cfg, posts);
  return f;
}
