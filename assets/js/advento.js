/*
 * Reto do Advento 2026 · fichas que se abren cada día e comentarios con foto.
 *
 * As fichas e os comentarios sérveos o Google Apps Script da asociación (folla «Reto do Advento 2026»).
 * O servidor decide que fichas están abertas segundo a data de Galicia: unha ficha pechada
 * non chega nunca ao navegador, así que non se pode espiar mirando o código nin cambiando a data do móbil.
 *
 * Vista previa para a xunta (todas abertas): fichas-advento.html?vista=CHAVE
 * Escrito sen sintaxe moderna para que funcione en móbiles vellos.
 */
(function () {
  'use strict';
  var URL_GOOGLE = 'https://script.google.com/macros/s/AKfycbyAAFP5PR1mtpd6WHLG7H2ZXT-EBzH8bmAsK-81szjdUp3F_pB-BMgaSp4ZxBVz2A_MoQ/exec';
  var CHAVE_CACHE = 'accp-advento-2026';
  var MESES = ['xaneiro', 'febreiro', 'marzo', 'abril', 'maio', 'xuño', 'xullo', 'agosto', 'setembro', 'outubro', 'novembro', 'decembro'];
  var ESPECIAIS = { 'Constitución': 'Día da Constitución', 'ponte': 'Ponte', 'Inmaculada': 'A Inmaculada', 'solsticio': 'Solsticio de inverno', 'Lotería': 'Lotería de Nadal', 'Noiteboa': 'Noiteboa' };

  var $ = function (id) { return document.getElementById(id); };
  var portas = $('adv-portas'), estado = $('adv-estado'), capa = $('adv-capa'), fichaEl = $('adv-ficha');
  var vista = (/[?&]vista=([^&#]+)/.exec(location.search) || [])[1] || '';
  var datos = null, desfase = 0, fichaAberta = null, enviando = false, fotoPreparada = null, cargando = false;

  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function lerLocal(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gardarLocal(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function novoId() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
  function agora() { return Date.now() + desfase; }
  // Medianoite de Galicia dun día de decembro (en decembro, hora peninsular = UTC+1).
  function abertura(dataIso) { return Date.parse(dataIso + 'T00:00:00+01:00'); }
  function dataLonga(f) { var d = Number(f.data.slice(8, 10)); return f.semana + ' ' + d + ' de ' + MESES[Number(f.data.slice(5, 7)) - 1]; }
  function lumes(n) { return n > 0 ? new Array(n + 1).join('🔥') : 'Ningún lume'; }

  function aviso(txt) {
    var a = $('adv-aviso'); a.textContent = txt; a.hidden = false;
    clearTimeout(aviso.t); aviso.t = setTimeout(function () { a.hidden = true; }, 3500);
  }

  /* ---------- Carga dos datos (JSONP: funciona en calquera navegador, sen CORS) ---------- */
  function jsonp(url, ms) {
    return new Promise(function (ok, ko) {
      var nome = '__adv' + Math.random().toString(36).slice(2), s = document.createElement('script'), feito = false;
      function fin() { feito = true; clearTimeout(t); try { delete window[nome]; } catch (e) { window[nome] = undefined; } if (s.parentNode) s.parentNode.removeChild(s); }
      var t = setTimeout(function () { if (!feito) { fin(); ko(new Error('tempo')); } }, ms);
      window[nome] = function (d) { if (!feito) { fin(); ok(d); } };
      s.onerror = function () { if (!feito) { fin(); ko(new Error('rede')); } };
      s.src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'callback=' + nome;
      document.body.appendChild(s);
    });
  }

  function cargar(silencio) {
    if (cargando) return Promise.resolve();
    cargando = true;
    if (!silencio && !datos) estado.textContent = 'Cargando as fichas…';
    var url = URL_GOOGLE + '?accion=advento&t=' + Date.now() + (vista ? '&vista=' + encodeURIComponent(vista) : '');
    var intento = function () { return jsonp(url, 20000); };
    return intento().catch(function () { return new Promise(function (r) { setTimeout(r, 1500); }).then(intento); })
      .then(function (d) {
        cargando = false;
        if (!d || !d.ok) throw new Error((d && d.erro) || 'resposta');
        desfase = Date.parse(d.agora) - Date.now();
        datos = d;
        if (!vista) gardarLocal(CHAVE_CACHE, JSON.stringify(d));
        estado.textContent = '';
        pintar();
      })
      .catch(function () {
        cargando = false;
        if (datos) { estado.textContent = ''; return; }
        estado.innerHTML = 'Non conseguimos cargar as fichas (pode ser a conexión). <button type="button" class="boton adv-reintentar">Tentalo de novo</button>';
        estado.querySelector('button').onclick = function () { cargar(); };
      });
  }

  /* ---------- Portas do calendario ---------- */
  function pintar() {
    if (!datos) return;
    $('adv-previa').hidden = !datos.previa;
    var principais = datos.fichas.filter(function (f) { return /^\d+$/.test(f.dia); });
    var hoxe = datos.hoxe;
    portas.innerHTML = principais.map(function (f) {
      var dia = Number(f.dia), esp = ESPECIAIS[f.especial] || f.especial, ehHoxe = f.data === hoxe;
      var n = (datos.comentarios[f.dia] || []).length;
      if (!f.aberta) {
        return '<button type="button" class="adv-porta adv-porta--pechada" data-dia="' + dia + '" aria-label="Día ' + dia + ', pechada ata o ' + esc(dataLonga(f)) + '">' +
          '<span class="adv-porta-num">' + dia + '</span>' +
          '<svg class="adv-candado" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="4" y="10" width="16" height="11" rx="2.5" fill="currentColor"/><circle cx="12" cy="15.5" r="1.8" fill="#0B2A4A"/></svg>' +
          '<span class="adv-porta-data">' + esc(f.semana) + ' ' + dia + '</span>' +
          (esp ? '<span class="adv-porta-especial">' + esc(esp) + '</span>' : '') + '</button>';
      }
      return '<button type="button" class="adv-porta adv-porta--aberta' + (ehHoxe ? ' adv-porta--hoxe' : '') + '" data-dia="' + dia + '" aria-label="Día ' + dia + ': ' + esc(f.cervexa) + '">' +
        (ehHoxe ? '<span class="adv-porta-hoxe">Hoxe</span>' : '') +
        '<span class="adv-porta-num">' + dia + '</span>' +
        '<span class="adv-porta-nome">' + esc(f.cervexa) + '</span>' +
        '<span class="adv-porta-cerv">' + esc(f.cervexeira) + '</span>' +
        '<span class="adv-porta-pe"><span>' + esc(f.alcohol.replace(/\s*ABV.*/i, '').replace(/\s*\(.*/, '')) + '</span><span>' + (n ? '💬 ' + n : '') + '</span></span></button>';
    }).join('');
    contaAtras();
    var m = /^#dia-(\d+)$/.exec(location.hash);
    if (m && (!fichaAberta || fichaAberta !== m[1])) abrirFicha(m[1], true);
    else if (fichaAberta) pintarComentarios();
  }

  portas.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.adv-porta') : null;
    if (!b) return;
    var f = buscar(b.getAttribute('data-dia'));
    if (f && f.aberta) { location.hash = 'dia-' + f.dia; }
    else if (f) {
      b.classList.remove('adv-treme'); void b.offsetWidth; b.classList.add('adv-treme');
      aviso('Paciencia! Esta ábrese o ' + dataLonga(f) + ' ás 00:00.');
    }
  });

  function buscar(dia) { if (!datos) return null; for (var i = 0; i < datos.fichas.length; i++) if (datos.fichas[i].dia === String(dia)) return datos.fichas[i]; return null; }

  /* ---------- Conta atrás ata a próxima ficha ---------- */
  function contaAtras() {
    var caixa = $('adv-conta'), txt = $('adv-conta-texto'), rel = $('adv-conta-reloxo');
    if (!datos) return;
    var pechadas = datos.fichas.filter(function (f) { return !f.aberta && /^\d+$/.test(f.dia); });
    if (!pechadas.length) {
      caixa.hidden = false; caixa.classList.add('adv-conta--fin');
      txt.textContent = datos.previa ? 'Vista previa: todas as fichas abertas' : 'Calendario completo. Bo Nadal, cervexeiros! 🍺🎄';
      rel.textContent = ''; return;
    }
    var seguinte = pechadas[0], obxectivo = abertura(seguinte.data);
    function tic() {
      var r = obxectivo - agora();
      if (r <= 0) { clearInterval(contaAtras.i); rel.textContent = '00:00:00'; setTimeout(function () { cargar(true); }, 2000 + Math.random() * 3000); return; }
      var d = Math.floor(r / 864e5), h = Math.floor(r / 36e5) % 24, mi = Math.floor(r / 6e4) % 60, s = Math.floor(r / 1e3) % 60;
      var dd = function (x) { return (x < 10 ? '0' : '') + x; };
      txt.textContent = seguinte.dia === '1' ? 'A primeira ficha ábrese en' : 'A ficha do día ' + seguinte.dia + ' ábrese en';
      rel.textContent = (d ? d + (d === 1 ? ' día ' : ' días ') : '') + dd(h) + ':' + dd(mi) + ':' + dd(s);
    }
    caixa.hidden = false; clearInterval(contaAtras.i); tic(); contaAtras.i = setInterval(tic, 1000);
  }

  /* ---------- Ficha ---------- */
  function htmlFicha(f, unica) {
    var esp = ESPECIAIS[f.especial] || f.especial;
    return (unica ? '' : '<p class="adv-ficha-dia">Día ' + esc(f.dia) + ' · ' + esc(dataLonga(f)) + (esp ? ' · <span class="adv-chip">' + esc(esp) + '</span>' : '') + '</p>') +
      '<h2' + (unica ? '' : ' id="adv-ficha-titulo"') + '>' + esc(f.cervexa) + '</h2>' +
      '<p class="adv-ficha-cerv">' + esc(f.cervexeira) + (f.orixe ? ' · ' + esc(f.orixe) : '') + '</p>' +
      (f.nota ? '<p class="adv-ficha-nota">' + esc(f.nota) + '</p>' : '') +
      '<dl class="adv-datos">' +
      '<div><dt>Estilo</dt><dd>' + esc(f.estilo) + '</dd></div>' +
      '<div><dt>Alcohol</dt><dd>' + esc(f.alcohol) + '</dd></div>' +
      '<div><dt>Temperatura</dt><dd>' + esc(f.temperatura) + '</dd></div>' +
      '<div><dt>Copa</dt><dd>' + esc(f.copa) + '</dd></div>' +
      '<div class="adv-datos-perigo"><dt>Nivel de perigo</dt><dd><span class="adv-lumes" aria-label="' + f.lumes + ' de 5">' + lumes(f.lumes) + '</span> ' + esc(f.perigo) + '</dd></div>' +
      '</dl>' +
      '<h3>A historia</h3><p>' + esc(f.historia) + '</p>' +
      '<div class="adv-dous"><div class="adv-maridaxe"><h3>Maridaxe</h3><p>' + esc(f.maridaxe) + '</p></div>' +
      '<div class="adv-sabias"><h3>Sabías que…?</h3><p>' + esc(f.sabias) + '</p></div></div>';
  }

  function abrirFicha(dia, desdeHash) {
    var f = buscar(dia);
    if (!f) return;
    if (!f.aberta) {
      if (!capa.hidden) pecharFicha();
      aviso('Esa ficha aínda está pechada: ábrese o ' + dataLonga(f) + '.');
      if (desdeHash) history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    fichaAberta = f.dia; $('adv-aviso').hidden = true;
    var unica = buscar(f.dia + 'b');
    fichaEl.innerHTML = '<button type="button" class="adv-pechar" data-pechar aria-label="Pechar a ficha">✕</button>' +
      '<div class="adv-ficha-corpo">' + htmlFicha(f) +
      (unica && unica.aberta ? '<details class="adv-unica"><summary>Tocouche a lata única? 🎁 Le a súa ficha</summary>' + htmlFicha(unica, true) + '</details>' : '') +
      '<div class="adv-accions"><button type="button" class="boton boton--pequeno" id="adv-compartir">Compartir esta ficha</button>' +
      navegacion(f) + '</div>' +
      '<section class="adv-coment" aria-labelledby="adv-coment-tit"><h3 id="adv-coment-tit">Que tal está? Os vosos comentarios</h3>' +
      '<div id="adv-lista"></div>' + formulario(f) + '</section></div>';
    capa.hidden = false;
    document.documentElement.classList.add('adv-sen-scroll');
    fichaEl.scrollTop = 0;
    try { fichaEl.focus({ preventScroll: true }); } catch (e) { fichaEl.focus(); }
    pintarComentarios();
    prepararFormulario(f);
    $('adv-compartir').onclick = function () { compartir(f); };
  }

  function navegacion(f) {
    var n = Number(f.dia), ant = buscar(n - 1), seg = buscar(n + 1);
    return '<span class="adv-nav">' +
      (ant && ant.aberta ? '<a href="#dia-' + (n - 1) + '">← Día ' + (n - 1) + '</a>' : '') +
      (seg && seg.aberta ? '<a href="#dia-' + (n + 1) + '">Día ' + (n + 1) + ' →</a>' : '') + '</span>';
  }

  function pecharFicha() {
    capa.hidden = true; fichaAberta = null; fichaEl.innerHTML = '';
    document.documentElement.classList.remove('adv-sen-scroll');
    if (/^#dia-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  }
  capa.addEventListener('click', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-pechar')) pecharFicha(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !capa.hidden) pecharFicha(); });
  window.addEventListener('hashchange', function () {
    var m = /^#dia-(\d+)$/.exec(location.hash);
    if (m) abrirFicha(m[1], true); else if (!capa.hidden) pecharFicha();
  });

  function compartir(f) {
    var url = location.origin + location.pathname + '#dia-' + f.dia;
    var datosC = { title: 'Día ' + f.dia + ': ' + f.cervexa, text: 'A ficha do día ' + f.dia + ' do calendario de Advento cervexeiro', url: url };
    if (navigator.share) { navigator.share(datosC).catch(function () {}); return; }
    var feito = function () { aviso('Ligazón copiada!'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(feito, function () { prompt('Copia esta ligazón:', url); });
    else prompt('Copia esta ligazón:', url);
  }

  /* ---------- Comentarios ---------- */
  function cando(iso) {
    var t = Date.parse(iso); if (isNaN(t)) return '';
    var s = Math.round((agora() - t) / 1000);
    if (s < 60) return 'agora mesmo';
    if (s < 3600) return 'hai ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'hai ' + Math.floor(s / 3600) + ' h';
    var d = new Date(t);
    return d.getDate() + ' de ' + MESES[d.getMonth()] + ', ' + (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  }

  function urlFoto(u, ancho) { return /lh3\.googleusercontent\.com\/d\//.test(u) ? u + '=w' + ancho : u; }

  function pintarComentarios() {
    var lista = $('adv-lista'); if (!lista || !fichaAberta) return;
    var cs = (datos.comentarios[fichaAberta] || []).concat(pendentes[fichaAberta] || []);
    var vistos = {}; cs = cs.filter(function (c) { if (vistos[c.id]) return false; vistos[c.id] = 1; return true; });
    if (!cs.length) { lista.innerHTML = '<p class="adv-baleiro">Aínda ninguén comentou esta. Estrea ti a conversa! 🍻</p>'; return; }
    lista.innerHTML = '<ul class="adv-comentarios">' + cs.map(function (c) {
      return '<li class="adv-comentario' + (c.local ? ' adv-comentario--novo' : '') + '">' +
        '<p class="adv-comentario-cab"><span class="adv-avatar" aria-hidden="true">' + esc(c.nome.trim().charAt(0).toUpperCase()) + '</span><strong>' + esc(c.nome) + '</strong> <time datetime="' + esc(c.data) + '">' + esc(cando(c.data)) + '</time>' + (c.previa ? ' <span class="adv-chip">vista previa</span>' : '') + '</p>' +
        (c.texto ? '<p class="adv-comentario-texto">' + esc(c.texto).replace(/\n/g, '<br>') + '</p>' : '') +
        (c.foto ? '<a class="adv-comentario-foto" href="' + esc(urlFoto(c.foto, 2000)) + '" target="_blank" rel="noopener"><img src="' + esc(urlFoto(c.foto, 900)) + '" alt="Foto de ' + esc(c.nome) + '" loading="lazy" data-id="' + esc((/\/d\/([^=/?]+)/.exec(c.foto) || [])[1] || '') + '"></a>' : '') +
        '</li>';
    }).join('') + '</ul>';
    // Se a vista de Google Drive (lh3) fallase, probamos coa miniatura de Drive.
    Array.prototype.forEach.call(lista.querySelectorAll('img[data-id]'), function (img) {
      img.onerror = function () { var id = img.getAttribute('data-id'); if (id && !img.dataset.alt) { img.dataset.alt = 1; img.src = 'https://drive.google.com/thumbnail?id=' + id + '&sz=w900'; } };
    });
  }
  var pendentes = {};

  function formulario(f) {
    var nome = lerLocal('accp-advento-nome') || '';
    return '<form class="form adv-form" id="adv-form" novalidate>' +
      '<h4>Deixa o teu comentario</h4>' +
      '<div class="campo"><label for="adv-nome">O teu nome</label><input id="adv-nome" type="text" maxlength="60" autocomplete="given-name" value="' + esc(nome) + '" required></div>' +
      '<div class="campo"><label for="adv-texto">Que che pareceu? <span>(opcional se subes foto)</span></label><textarea id="adv-texto" rows="3" maxlength="1500" placeholder="Que tal o lúpulo? Repetirías? Con que a acompañaches?"></textarea></div>' +
      '<div class="campo adv-foto-campo"><label for="adv-foto" class="adv-foto-boton">📷 Engadir unha foto <span>(opcional)</span></label><input id="adv-foto" type="file" accept="image/*">' +
      '<div class="adv-foto-previa" id="adv-foto-previa" hidden><img alt="Foto que vas subir"><button type="button" id="adv-foto-quitar">Quitar foto</button></div></div>' +
      (datos.codigo && !datos.previa ? '<div class="campo"><label for="adv-codigo">Código do reto <span>(pídello á asociación)</span></label><input id="adv-codigo" type="text" autocomplete="off" value="' + esc(lerLocal('accp-advento-codigo') || '') + '"></div>' : '') +
      '<input type="text" class="mel" id="adv-mel" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<label class="aceptar"><input type="checkbox" id="adv-acepto"> Acepto que o meu comentario (e a foto, se a subo) se publiquen nesta páxina. Se aparece alguén máis na foto, está de acordo.</label>' +
      '<p class="form-erro" id="adv-erro" role="alert" hidden></p>' +
      '<button class="boton" type="submit" id="adv-enviar">Publicar</button>' +
      '</form>';
  }

  // Reduce a foto no móbil (máx. 1600 px, JPEG) antes de subila: menos datos e máis rápido.
  function prepararFoto(ficheiro) {
    return new Promise(function (ok, ko) {
      if (!/^image\//.test(ficheiro.type || 'image/')) return ko(new Error('non é unha imaxe'));
      var url = URL.createObjectURL(ficheiro), img = new Image();
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var dataUrl = c.toDataURL('image/jpeg', 0.82);
        ok({ b64: dataUrl.split(',')[1], vista: dataUrl });
      };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error('formato')); };
      img.src = url;
    });
  }

  function prepararFormulario(f) {
    var form = $('adv-form'), erro = $('adv-erro'), b = $('adv-enviar'), inp = $('adv-foto'), previa = $('adv-foto-previa');
    fotoPreparada = null;
    function mal(t, campo) { erro.textContent = t; erro.hidden = false; if (campo) try { campo.focus(); } catch (e) {} }
    inp.onchange = function () {
      erro.hidden = true;
      var fi = inp.files && inp.files[0]; if (!fi) return;
      b.disabled = true; b.textContent = 'Preparando a foto…';
      prepararFoto(fi).then(function (r) {
        fotoPreparada = r; previa.querySelector('img').src = r.vista; previa.hidden = false;
      }, function () {
        inp.value = ''; mal('Non puidemos ler esa foto. Proba con outra (en JPG ou PNG).');
      }).then(function () { b.disabled = false; b.textContent = 'Publicar'; });
    };
    $('adv-foto-quitar').onclick = function () { fotoPreparada = null; inp.value = ''; previa.hidden = true; };

    form.onsubmit = function (e) {
      e.preventDefault();
      if (enviando) return;
      erro.hidden = true;
      var nome = $('adv-nome').value.trim(), texto = $('adv-texto').value.trim(), cod = $('adv-codigo');
      if (!nome) return mal('Escribe o teu nome.', $('adv-nome'));
      if (!texto && !fotoPreparada) return mal('Escribe un comentario ou engade unha foto.', $('adv-texto'));
      if (cod && !cod.value.trim()) return mal('Escribe o código do reto.', cod);
      if (!$('adv-acepto').checked) return mal('Marca a casiña para poder publicar.', $('adv-acepto'));
      gardarLocal('accp-advento-nome', nome);
      if (cod) gardarLocal('accp-advento-codigo', cod.value.trim());
      enviando = true; b.disabled = true; b.textContent = fotoPreparada ? 'Subindo a foto…' : 'Publicando…';
      var corpo = {
        accion: 'comentario', _id: novoId(), dia: f.dia, nome: nome, texto: texto,
        foto: fotoPreparada ? fotoPreparada.b64 : '', codigo: cod ? cod.value.trim() : '', vista: vista,
        _honey: $('adv-mel').value, _navegador: navigator.userAgent
      };
      publicar(corpo).then(function () {
        (pendentes[f.dia] = pendentes[f.dia] || []).push({ id: corpo._id, data: new Date(agora()).toISOString(), nome: nome, texto: texto, foto: fotoPreparada ? fotoPreparada.vista : '', local: true, previa: !!vista });
        form.reset(); $('adv-nome').value = nome; fotoPreparada = null; previa.hidden = true;
        pintarComentarios(); pintar();
        aviso('Publicado! Grazas por compartir 🍻');
        setTimeout(function () { cargar(true); }, 2500);
      }, function () {
        mal('Non se puido publicar' + (cod ? ' (revisa o código do reto)' : '') + '. Comproba a conexión e proba de novo.');
      }).then(function () { enviando = false; b.disabled = false; b.textContent = 'Publicar'; });
    };
  }

  // Google responde cunha redirección só se gardou o comentario; con redirect:'manual' collémola ao momento.
  function publicar(corpo) {
    var conTempo = function (p, ms) { return new Promise(function (ok, ko) { var t = setTimeout(function () { ko(new Error('tempo')); }, ms); p.then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); ko(e); }); }); };
    var un = function (modo) {
      return conTempo(fetch(URL_GOOGLE, { method: 'POST', body: JSON.stringify(corpo), redirect: modo, credentials: 'omit' }).then(function (r) {
        if (r.type === 'opaqueredirect') return true;
        return r.json().then(function (j) { if (!j || j.ok !== true) throw new Error('ko'); return true; });
      }), 45000);
    };
    if (!window.fetch) return Promise.reject(new Error('sen fetch'));
    var inicio = Date.now();
    // Se falla ao momento (navegador sen redirect:'manual' ou rede caída un instante), reintento: Google non duplica.
    return un('manual').catch(function (e) { if (Date.now() - inicio < 4000) return un('follow'); throw e; });
  }

  /* ---------- Arranque ---------- */
  var gardado = !vista && lerLocal(CHAVE_CACHE);
  if (gardado) { try { datos = JSON.parse(gardado); estado.textContent = ''; pintar(); } catch (e) { datos = null; } }
  cargar();
  // Ao volver á pestana (p. ex. ao día seguinte), actualizamos.
  document.addEventListener('visibilitychange', function () { if (!document.hidden) cargar(true); });
})();
