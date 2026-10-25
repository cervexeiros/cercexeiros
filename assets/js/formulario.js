// Formularios que se envían ao correo da asociación a través de FormSubmit.
// Uso: <form class="form-correo" data-asunto="Texto do asunto" data-ok="id-do-bloque-de-grazas" action="https://formsubmit.co/CORREO">
(() => {
  const MENSAXES = {
    email: 'Escribe un correo electrónico válido.',
    tel: 'Escribe un teléfono válido (polo menos 9 números).',
    checkbox: 'Tes que marcar esta casiña para continuar.',
  };
  const telValido = v => (v.match(/\d/g) || []).length >= 9 && /^[\d\s+().-]+$/.test(v.trim());

  document.querySelectorAll('form.form-correo').forEach(f => {
    const ok = document.getElementById(f.dataset.ok);
    const erro = f.querySelector('.form-erro');
    const b = f.querySelector('button[type=submit]'); const textoBoton = b.textContent;
    const amosarOk = () => { f.hidden = true; ok.hidden = false; setTimeout(() => ok.scrollIntoView({ block: 'center' }), 50); };
    const restaurar = () => { b.disabled = false; b.textContent = textoBoton; };
    // Ao volver de FormSubmit (envío clásico) chegamos con ?enviado=… ou #id-de-grazas.
    const params = new URLSearchParams(location.search);
    if (params.has('enviado') || location.hash === '#' + f.dataset.ok) {
      amosarOk();
      if (params.has('enviado') && history.replaceState) history.replaceState(null, '', location.pathname + '#' + f.dataset.ok);
    }
    window.addEventListener('hashchange', () => { if (location.hash === '#' + f.dataset.ok) amosarOk(); });
    // Se o navegador restaura a páxina da caché (botón atrás), o botón non debe quedar en «Enviando…».
    window.addEventListener('pageshow', e => { if (e.persisted) restaurar(); });

    function campoMal() {
      for (const c of f.querySelectorAll('[required]')) {
        let valido = true;
        try { valido = c.checkValidity(); } catch (e2) { valido = !!(c.type === 'checkbox' ? c.checked : c.value.trim()); }
        if (valido && c.dataset.tel && !telValido(c.value)) valido = false;
        if (!valido) return c;
      }
      return null;
    }

    f.addEventListener('submit', async e => {
      e.preventDefault(); erro.hidden = true;
      const mal = campoMal();
      if (mal) {
        erro.textContent = mal.dataset.erro || MENSAXES[mal.type] || 'Enche este campo: ' + (((f.querySelector('label[for="' + mal.id + '"]') || {}).firstChild || {}).textContent || 'campo obrigatorio').trim() + '.';
        erro.hidden = false; mal.focus(); return;
      }
      b.disabled = true; b.textContent = 'Enviando…';
      const nome = (f.querySelector('[name="Nome"]') || {}).value || '';
      const asunto = (f.dataset.asunto || 'Nova mensaxe desde a web') + (nome ? ': ' + nome : '');
      const pon = (n, v) => { let i = f.querySelector('input[type=hidden][name="' + n + '"]'); if (!i) { i = document.createElement('input'); i.type = 'hidden'; i.name = n; f.appendChild(i); } i.value = v; };
      pon('_subject', asunto);
      const em = (f.querySelector('[name="email"]') || {}).value; if (em) pon('_replyto', em);
      // URL de volta distinta da actual (con ?enviado=…) para que o móbil recargue de verdade e amose as grazas.
      pon('_next', location.origin + location.pathname + '?enviado=' + Date.now() + '#' + f.dataset.ok);
      const mel = f.querySelector('.mel'); if (mel) mel.value = ''; // por se o autocompletado do móbil enche o campo trampa

      const envioClasico = () => HTMLFormElement.prototype.submit.call(f);
      // 1º intento: envío en segundo plano (rápido e sen saír da páxina). Se falla ou tarda, envío clásico.
      let rematado = false;
      const plan_b = setTimeout(() => { if (!rematado) { rematado = true; envioClasico(); } }, 12000);
      try {
        const r = await fetch(f.action.replace('formsubmit.co/', 'formsubmit.co/ajax/'), { method: 'POST', body: new FormData(f), headers: { Accept: 'application/json' } });
        const j = await r.json().catch(() => ({}));
        if (rematado) return;
        if (r.ok && String(j.success) === 'true') { rematado = true; clearTimeout(plan_b); restaurar(); amosarOk(); return; }
        throw new Error(j.message || 'Erro ' + r.status);
      } catch (err) {
        if (rematado) return;
        rematado = true; clearTimeout(plan_b); envioClasico();
      }
      // Rede de seguridade: se en 25 s seguimos aquí, deixamos volver tentalo.
      setTimeout(() => { if (!f.hidden) { restaurar(); erro.innerHTML = 'Parece que a conexión vai lenta. Se non recibes confirmación, proba de novo ou escríbenos a <a href="mailto:cervexeiroscaseirospontevedra@gmail.com">cervexeiroscaseirospontevedra@gmail.com</a>.'; erro.hidden = false; } }, 25000);
    });
  });

  document.querySelectorAll('[data-ir-formulario]').forEach(a => a.addEventListener('click', e => {
    const dest = document.getElementById(a.dataset.irFormulario); if (!dest) return;
    e.preventDefault(); dest.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => { const i = dest.querySelector('input:not([type=hidden]):not(.mel)'); if (i) i.focus({ preventScroll: true }); }, 500);
  }));
})();
