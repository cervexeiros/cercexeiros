// Formularios que se envían ao correo da asociación a través de FormSubmit.
// Uso: <form class="form-correo" data-asunto="Texto do asunto" data-ok="id-do-bloque-de-grazas" action="https://formsubmit.co/CORREO">
(() => {
  const MENSAXES = {
    email: 'Escribe un correo electrónico válido.',
    tel: 'Escribe un teléfono válido (polo menos 9 números).',
    checkbox: 'Tes que marcar esta casiña para continuar.',
  };
  document.querySelectorAll('form.form-correo').forEach(f => {
    const ok = document.getElementById(f.dataset.ok);
    const erro = f.querySelector('.form-erro');
    const amosarOk = () => { f.hidden = true; ok.hidden = false; ok.scrollIntoView({ block: 'center' }); };
    if (location.hash === '#' + f.dataset.ok) amosarOk();
    f.addEventListener('submit', async e => {
      e.preventDefault(); erro.hidden = true;
      const mal = [...f.querySelectorAll('[required]')].find(c => !c.checkValidity());
      if (mal) {
        erro.textContent = mal.dataset.erro || MENSAXES[mal.type] || 'Enche este campo: ' + (f.querySelector(`label[for="${mal.id}"]`)?.firstChild?.textContent.trim() || 'campo obrigatorio') + '.';
        erro.hidden = false; mal.focus(); return;
      }
      const b = f.querySelector('button[type=submit]'); const texto = b.textContent;
      b.disabled = true; b.textContent = 'Enviando…';
      const datos = new FormData(f);
      const nome = datos.get('Nome') || '';
      datos.set('_subject', (f.dataset.asunto || 'Nova mensaxe desde a web') + (nome ? ': ' + nome : ''));
      if (datos.get('email')) datos.set('_replyto', datos.get('email'));
      try {
        const r = await fetch(f.action.replace('formsubmit.co/', 'formsubmit.co/ajax/'), { method: 'POST', body: datos, headers: { Accept: 'application/json' } });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || String(j.success) === 'false') throw new Error(j.message || 'Erro ' + r.status);
        amosarOk();
      } catch {
        erro.innerHTML = 'Non puidemos enviar o formulario. Proba de novo ou escríbenos a <a href="mailto:cervexeiroscaseirospontevedra@gmail.com">cervexeiroscaseirospontevedra@gmail.com</a>.';
        erro.hidden = false; b.disabled = false; b.textContent = texto;
      }
    });
  });
  // Botóns que levan ao formulario e poñen o cursor no primeiro campo
  document.querySelectorAll('[data-ir-formulario]').forEach(a => a.addEventListener('click', e => {
    const dest = document.getElementById(a.dataset.irFormulario); if (!dest) return;
    e.preventDefault(); dest.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => dest.querySelector('input:not([type=hidden]):not(.mel)')?.focus({ preventScroll: true }), 500);
  }));
})();
