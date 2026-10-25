/**
 * Formularios da web dos Cervexeiros Caseiros de Pontevedra.
 * Recibe os envíos da web (calendario de Advento, Faite socio/a…),
 * gárdaos nunha folla de cálculo e manda un correo á asociación.
 *
 * Despregado como aplicación web: Executar como «Eu», acceso «Calquera».
 * Copia de referencia: _xerador/apps-script/Codigo.gs no repositorio da web.
 */
var CORREO = 'cervexeiroscaseirospontevedra@gmail.com';
var NOME_FOLLA = 'Pedidos e inscricións da web (ACCP)';

/** Executar unha vez a man: crea a folla de cálculo e pide os permisos. */
function configurar() {
  var ss = folla_();
  Logger.log('Folla: ' + ss.getUrl());
  Logger.log('Correos que quedan hoxe: ' + MailApp.getRemainingDailyQuota());
}

function folla_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('FOLLA_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  var ss = SpreadsheetApp.create(NOME_FOLLA);
  props.setProperty('FOLLA_ID', ss.getId());
  return ss;
}

function resposta_(obx) {
  return ContentService.createTextOutput(JSON.stringify(obx)).setMimeType(ContentService.MimeType.JSON);
}

/** Comprobación rápida de que o servizo está vivo (tamén «quenta» o servidor). */
function doGet() {
  return resposta_({ ok: true, servizo: 'accp-formularios' });
}

/*
 * IMPORTANTE: a web considera o envío correcto en canto Google responde coa redirección
 * (o que só pasa se doPost remata sen erro). Por iso, se non se puido gardar NIN enviar
 * o correo, lanzamos un erro: Google devolve entón unha páxina de erro e a web usa o respaldo.
 */
function doPost(e) {
  var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  var id = String(d._id || '').slice(0, 60);
  if (!id) throw new Error('sen id');

  // Trampa para robots: se vén enchido, facemos como que todo vai ben e non gardamos nada.
  if (d._honey) return resposta_({ ok: true, id: id });

  var cache = CacheService.getScriptCache();
  // Se o navegador reintenta o mesmo envío, non duplicamos nin a fila nin o correo.
  if (cache.get('feito_' + id)) return resposta_({ ok: true, id: id, repetido: true });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (cache.get('feito_' + id)) return resposta_({ ok: true, id: id, repetido: true });

    var tipo = String(d._tipo || 'Formulario').slice(0, 60);
    var asunto = String(d._subject || ('Nova mensaxe desde a web: ' + tipo)).slice(0, 200);
    var campos = d.campos || {};
    var nomes = Object.keys(campos);
    var ss = null, sh = null, follaOk = true, correoOk = true, erros = [];

    // 1) Gardar na folla (unha pestana por tipo de formulario).
    try {
      ss = folla_();
      sh = ss.getSheetByName(tipo) || ss.insertSheet(tipo);
      var cab = sh.getLastRow() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
      if (!cab.length) { cab = ['Data', 'ID']; }
      nomes.concat(['Navegador']).forEach(function (n) { if (cab.indexOf(n) < 0) cab.push(n); });
      sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold');
      sh.setFrozenRows(1);
      var fila = cab.map(function (c) {
        if (c === 'Data') return new Date();
        if (c === 'ID') return id;
        if (c === 'Navegador') return String(d._navegador || '').slice(0, 300);
        var v = campos[c] != null ? String(campos[c]).slice(0, 5000) : '';
        return /^[=+\-@]/.test(v) ? "'" + v : v; // «+34…» como texto, e nada de fórmulas
      });
      sh.appendRow(fila);
    } catch (errFolla) { follaOk = false; erros.push('folla: ' + errFolla); }

    // 2) Correo á asociación.
    try {
      var html = '<p>Novo envío desde a web (<b>' + esc_(tipo) + '</b>).</p><table cellpadding="6" style="border-collapse:collapse">' +
        nomes.map(function (n) {
          return '<tr><td style="border:1px solid #ccc;font-weight:bold;vertical-align:top">' + esc_(n) + '</td><td style="border:1px solid #ccc">' + esc_(campos[n]).replace(/\n/g, '<br>') + '</td></tr>';
        }).join('') + '</table><p style="color:#888;font-size:12px">Ref. ' + esc_(id) +
        (ss ? ' · Gardado tamén na folla: <a href="' + ss.getUrl() + '">' + esc_(NOME_FOLLA) + '</a>' : '') + '</p>';
      var opcions = { to: CORREO, subject: asunto, htmlBody: html, name: 'Web Cervexeiros' };
      var email = String(campos.email || '').trim();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) opcions.replyTo = email;
      MailApp.sendEmail(opcions);
    } catch (errCorreo) {
      correoOk = false; erros.push('correo: ' + errCorreo);
      if (sh) try { sh.getRange(sh.getLastRow(), 1).setNote('Non se puido enviar o correo: ' + errCorreo); } catch (e3) {}
    }

    if (!follaOk && !correoOk) throw new Error('Non se gardou nin se enviou: ' + erros.join(' | '));
    cache.put('feito_' + id, '1', 21600);
    return resposta_({ ok: true, id: id, folla: follaOk, correo: correoOk });
  } finally {
    lock.releaseLock();
  }
}

function esc_(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
