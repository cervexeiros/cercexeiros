// Rexenera toda a web: node _xerador/build.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as X from './xerador.js';

const R = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = p => readFileSync(join(R, p), 'utf8');
const escribir = (p, c) => { mkdirSync(dirname(join(R, p)), { recursive: true }); writeFileSync(join(R, p), c); };

const cfg = JSON.parse(ler('_datos/config.json'));
const posts = readdirSync(join(R, '_blog')).filter(f => f.endsWith('.json') && f !== 'indice.json').map(f => JSON.parse(ler('_blog/' + f)));
const frag = n => ler(`_xerador/paxinas/${n}.html`);

for (const [ruta, html] of Object.entries(X.ficheirosBlog(posts, cfg, frag('inicio')))) escribir(ruta, html);
for (const def of X.PAXINAS.slice(1)) escribir(def.ficheiro, X.paxinaEstatica(def, frag(def.fragmento), cfg, posts));
escribir('404.html', X.paxina404(cfg));
escribir('robots.txt', X.robots(cfg));
// URLs antigas
const base = cfg.url.replace(/\/$/, '') + '/';
escribir('actividades.html', X.redireccion(base + 'blog/'));
escribir('novidades/feira-petin-2025.html', X.redireccion(base + 'blog/feira-petin-2025/'));
escribir('novidades/obradoiros-fermentados.html', X.redireccion(base + 'blog/obradoiros-fermentados/'));
console.log('Xerado:', posts.length, 'entradas');
