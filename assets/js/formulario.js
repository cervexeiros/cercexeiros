/*
 * Formularios da web (calendario de Advento, Faite socio/a…).
 *
 * Como se envían, de máis a menos preferido:
 *   1. Google (Apps Script da conta da asociación): garda na folla de cálculo e manda correo.
 *      Cada envío leva un identificador: se se reintenta, Google non o duplica.
 *   2. Respaldo: FormSubmit, nun iframe oculto (sen saír da páxina e sen depender de fetch).
 *   3. Se todo falla: mensaxe clara con botón para mandalo por correo. Nunca se queda en «Enviando…».
 *
 * Escrito sen sintaxe moderna (?. ?? catch sen variable…) para que funcione en móbiles vellos.
 * Uso: <form class="form-correo" data-tipo="…" data-asunto="…" data-ok="id-bloque-grazas" action="https://formsubmit.co/CORREO">
 */
(function () {
  'use strict';
  var URL_GOOGLE = 'https://script.google.com/macros/s/AKfycbyAAFP5PR1mtpd6WHLG7H2ZXT-EBzH8bmAsK-81szjdUp3F_pB-BMgaSp4ZxBVz2A_MoQ/exec';
  var CORREO = 'cervexeiroscaseirospontevedra@gmail.com';
  var T_GOOGLE = 9000;       // tempo máximo por intento con Google (adoita tardar 1-3 s)
  var T_RESPALDO = 12000;    // tempo máximo do respaldo
  var T_TOTAL = 30000;       // vixilante: pase o que pase, aos 30 s o botón volve funcionar
  var T_AVISO_LENTO = 5000;  // aos 5 s avisamos de que a conexión vai lenta

  var MENSAXES = {
    email: 'Escribe un correo electrónico válido.',
    tel: 'Escribe un teléfono válido (polo menos 9 números).',
    checkbox: 'Tes que marcar esta casiña para continuar.'
  };
  function telValido(v) { return (v.match(/\d/g) || []).length >= 9 && /^[\d\s+().\-]+$/.test(v.trim()); }
  function emailValido(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); }
  function novoId() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }

  // Promesa con tempo límite (non depende de AbortController, que falta en navegadores vellos).
  function conTempo(promesa, ms) {
    return new Promise(function (ok, ko) {
      var t = setTimeout(function () { ko(new Error('tempo esgotado')); }, ms);
      promesa.then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); ko(e); });
    });
  }

  // Google só responde coa redirección (302) cando xa gardou e enviou o correo; se algo vai mal
  // responde cunha páxina de erro. Con redirect:'manual' collemos esa 302 ao momento, sen esperar
  // ao segundo salto (googleusercontent.com), que é lento e ás veces falla desde algunhas redes.
  function enviarGoogle(datos, modo) {
    if (!window.fetch || URL_GOOGLE.indexOf('__ID_GOOGLE__') >= 0) return Promise.reject(new Error('sen fetch'));
    // Corpo en texto plano: petición «simple», sen consulta CORS previa.
    var p = fetch(URL_GOOGLE, { method: 'POST', body: JSON.stringify(datos), redirect: modo || 'manual', credentials: 'omit' })
      .then(function (r) {
        if (r.type === 'opaqueredirect') return { ok: true };
        return r.json().then(function (j) { if (!j || j.ok !== true) throw new Error((j && j.erro) || 'resposta non válida'); return j; });
      });
    return conTempo(p, T_GOOGLE);
  }

  // Respaldo: envío clásico do formulario a FormSubmit dentro dun iframe oculto.
  // FormSubmit redirixe a enviado.html (na nosa web), que avisa a esta páxina con postMessage.
  function enviarRespaldo(f, id) {
    return new Promise(function (ok, ko) {
      var nome = 'envio-' + id;
      var ifr = document.createElement('iframe');
      ifr.name = nome; ifr.title = 'envío'; ifr.setAttribute('aria-hidden', 'true'); ifr.tabIndex = -1;
      ifr.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;border:0;';
      document.body.appendChild(ifr);
      var feito = false;
      function fin(bo, e) {
        if (feito) return; feito = true;
        window.removeEventListener('message', escoita);
        clearTimeout(t);
        setTimeout(function () { if (ifr.parentNode) ifr.parentNode.removeChild(ifr); }, 1000);
        if (bo) ok(); else ko(e || new Error('respaldo'));
      }
      function escoita(ev) { if (ev.data === 'accp-enviado:' + id) fin(true); }
      window.addEventListener('message', escoita);
      var t = setTimeout(function () { fin(false, new Error('tempo esgotado no respaldo')); }, T_RESPALDO);
      var base = location.href.split('#')[0].split('?')[0].replace(/[^\/]*$/, '');
      pon(f, '_next', base + 'enviado.html?id=' + encodeURIComponent(id));
      pon(f, 'Ref', id);
      var antes = f.getAttribute('target');
      f.setAttribute('target', nome);
      try { HTMLFormElement.prototype.submit.call(f); } catch (e) { fin(false, e); }
      if (antes) f.setAttribute('target', antes); else f.removeAttribute('target');
    });
  }

  function pon(f, n, v) {
    var i = f.querySelector('input[type=hidden][name="' + n + '"]');
    if (!i) { i = document.createElement('input'); i.type = 'hidden'; i.name = n; f.appendChild(i); }
    i.value = v;
  }

  // Campos visibles (sen os de control que empezan por «_» nin a trampa para robots).
  function lerCampos(f) {
    var campos = {};
    var els = f.elements;
    for (var k = 0; k < els.length; k++) {
      var c = els[k];
      if (!c.name || c.disabled || c.name.charAt(0) === '_' || c.name === 'Ref') continue;
      if ((c.type === 'checkbox' || c.type === 'radio') && !c.checked) continue;
      if (c.type === 'submit' || c.type === 'button') continue;
      var v = String(c.value || '').trim();
      campos[c.name] = campos[c.name] ? campos[c.name] + ', ' + v : v;
    }
    return campos;
  }

  function enlaceCorreo(asunto, campos) {
    var corpo = Object.keys(campos).map(function (k) { return k + ': ' + campos[k]; }).join('\n');
    return 'mailto:' + CORREO + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(corpo);
  }

  var formularios = document.querySelectorAll('form.form-correo');
  Array.prototype.forEach.call(formularios, function (f) {
    var ok = document.getElementById(f.dataset.ok);
    var erro = f.querySelector('.form-erro');
    var b = f.querySelector('button[type=submit]');
    var textoBoton = b.textContent;
    var enviando = false, enviado = false;

    function amosarOk() {
      f.hidden = true; f.style.display = 'none'; // por se unha folla de estilos vella ignora «hidden»
      ok.hidden = false; ok.style.display = 'block';
      setTimeout(function () { try { ok.scrollIntoView({ block: 'center' }); } catch (e) { ok.scrollIntoView(); } }, 60);
    }
    function restaurar() { enviando = false; b.disabled = false; b.textContent = textoBoton; }
    function amosarErro(html) { erro.innerHTML = html; erro.hidden = false; }

    if (location.hash === '#' + f.dataset.ok || /[?&]enviado=/.test(location.search)) amosarOk();
    window.addEventListener('pageshow', function (e) { if (e.persisted && !f.hidden) restaurar(); });

    function campoMal() {
      var req = f.querySelectorAll('[required]');
      for (var k = 0; k < req.length; k++) {
        var c = req[k], valido;
        if (c.type === 'checkbox') valido = c.checked;
        else if (c.type === 'email') valido = emailValido(c.value);
        else valido = !!c.value.trim();
        if (valido && c.dataset.tel && !telValido(c.value)) valido = false;
        if (!valido) return c;
      }
      return null;
    }

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (enviando || enviado) return; // nada de dobres envíos (dobre toque, botón atrás…)
      erro.hidden = true;
      var mal = campoMal();
      if (mal) {
        var etiqueta = f.querySelector('label[for="' + mal.id + '"]');
        var nomeCampo = etiqueta && etiqueta.firstChild ? String(etiqueta.firstChild.textContent).trim() : 'campo obrigatorio';
        erro.textContent = mal.dataset.erro || MENSAXES[mal.type] || ('Enche este campo: ' + nomeCampo + '.');
        erro.hidden = false;
        try { mal.scrollIntoView({ block: 'center' }); } catch (e2) { mal.scrollIntoView(); }
        try { mal.focus({ preventScroll: true }); } catch (e3) { mal.focus(); }
        return;
      }

      enviando = true; b.disabled = true; b.textContent = 'Enviando…';
      var id = novoId();
      if (!window.Promise) {
        // Navegador moi antigo: envío clásico de toda a vida (FormSubmit leva a enviado.html).
        var base0 = location.href.split('#')[0].split('?')[0].replace(/[^\/]*$/, '');
        pon(f, '_next', base0 + 'enviado.html');
        HTMLFormElement.prototype.submit.call(f);
        return;
      }
      var campos = lerCampos(f);
      var nome = campos.Nome || '';
      var asunto = (f.dataset.asunto || 'Nova mensaxe desde a web') + (nome ? ': ' + nome : '');
      var mel = f.querySelector('.mel');
      if (mel) mel.value = ''; // o autocompletado do móbil ás veces enche o campo trampa
      pon(f, '_subject', asunto);
      if (campos.email) pon(f, '_replyto', campos.email);

      var rematado = false;
      function exito() { if (rematado) return; rematado = true; enviado = true; clearTimeout(vixilante); clearTimeout(lento); b.textContent = textoBoton; amosarOk(); }
      function fracaso() {
        if (rematado) return; rematado = true; clearTimeout(vixilante); clearTimeout(lento); restaurar();
        amosarErro('Vaia, non conseguimos enviar o formulario (pode ser a conexión). Proba de novo en uns segundos ou ' +
          '<a href="' + enlaceCorreo(asunto, campos) + '">mándanolo por correo cos teus datos xa escritos</a>.');
      }
      var vixilante = setTimeout(fracaso, T_TOTAL);
      var lento = setTimeout(function () { if (!rematado) b.textContent = 'Enviando… (un momentiño)'; }, T_AVISO_LENTO);

      var datos = {
        _id: id,
        _tipo: f.dataset.tipo || 'Formulario',
        _subject: asunto,
        _navegador: navigator.userAgent,
        campos: campos
      };
      var inicio = Date.now();
      enviarGoogle(datos)
        .catch(function (err) {
          // Un erro rápido (rede caída un instante, ou navegador que non admite redirect:'manual'):
          // un reintento con Google seguindo a redirección. Google non duplica o mesmo envío.
          if (Date.now() - inicio < 4000) return enviarGoogle(datos, 'follow');
          throw err;
        })
        .then(exito, function () {
          if (rematado) return;
          return enviarRespaldo(f, id).then(exito, fracaso);
        });
    });
  });

  var ligazons = document.querySelectorAll('[data-ir-formulario]');
  Array.prototype.forEach.call(ligazons, function (a) {
    a.addEventListener('click', function (e) {
      var dest = document.getElementById(a.dataset.irFormulario);
      if (!dest) return;
      e.preventDefault();
      try { dest.scrollIntoView({ behavior: 'smooth' }); } catch (e2) { dest.scrollIntoView(); }
      setTimeout(function () {
        var i = dest.querySelector('input:not([type=hidden]):not(.mel)');
        if (i) { try { i.focus({ preventScroll: true }); } catch (e3) { i.focus(); } }
      }, 500);
    });
  });
})();
