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
    const amosarOk = () => { f.hidden = true; ok.hidden = false; ok.scrollIntoView({ block: 'center' }); };
    if (location.hash === '#' + f.dataset.ok) amosarOk();

    function campoMal() {
      for (const c of f.querySelectorAll('[required]')) {
        let valido = true;
        try { valido = c.checkValidity(); } catch { valido = !!(c.type === 'checkbox' ? c.checked : c.value.trim()); }
        if (valido && c.dataset.tel && !telValido(c.value)) valido = false;
        if (!valido) return c;
      }
      return null;
    }

    f.addEventListener('submit', async e => {
      e.preventDefault(); erro.hidden = true;
      const mal = campoMal();
      if (mal) {
        erro.textContent = mal.dataset.erro || MENSAXES[mal.type] || 'Enche este campo: ' + (f.querySelector(`label[for="${mal.id}"]`)?.firstChild?.textContent.trim() || 'campo obrigatorio') + '.';
        erro.hidden = false; mal.focus(); return;
      }
      b.disabled = true; b.textContent = 'Enviando…';
      const nome = f.querySelector('[name="Nome"]')?.value || '';
      const asunto = (f.dataset.asunto || 'Nova mensaxe desde a web') + (nome ? ': ' + nome : '');
      const datos = new FormData(f);
      datos.set('_subject', asunto);
      if (datos.get('email')) datos.set('_replyto', datos.get('email'));
      const ctrl = new AbortController(); const temporizador = setTimeout(() => ctrl.abort(), 15000);
      try {
        const r = await fetch(f.action.replace('formsubmit.co/', 'formsubmit.co/ajax/'), { method: 'POST', body: datos, headers: { Accept: 'application/json' }, signal: ctrl.signal });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || String(j.success) !== 'true') throw new Error(j.message || 'Erro ' + r.status);
        clearTimeout(temporizador); b.textContent = textoBoton; b.disabled = false;
        amosarOk();
      } catch (err) {
        clearTimeout(temporizador);
        // Plan B: envío clásico do formulario (FormSubmit redirixe de volta á páxina de grazas)
        const sub = f.querySelector('[name="_subject"]') || Object.assign(document.createElement('input'), { type: 'hidden', name: '_subject' });
        sub.value = asunto; if (!sub.parentNode) f.appendChild(sub);
        try { HTMLFormElement.prototype.submit.call(f); }
        catch {
          erro.innerHTML = 'Non puidemos enviar o formulario. Proba de novo ou escríbenos a <a href="mailto:cervexeiroscaseirospontevedra@gmail.com">cervexeiroscaseirospontevedra@gmail.com</a>.';
          erro.hidden = false; b.disabled = false; b.textContent = textoBoton;
        }
      }
    });
  });

  document.querySelectorAll('[data-ir-formulario]').forEach(a => a.addEventListener('click', e => {
    const dest = document.getElementById(a.dataset.irFormulario); if (!dest) return;
    e.preventDefault(); dest.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => dest.querySelector('input:not([type=hidden]):not(.mel)')?.focus({ preventScroll: true }), 500);
  }));
})();
