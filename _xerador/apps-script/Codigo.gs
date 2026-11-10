/**
 * Formularios da web dos Cervexeiros Caseiros de Pontevedra.
 * Recibe os envíos da web (calendario de Advento, Faite socio/a…),
 * gárdaos nunha folla de cálculo e manda un correo á asociación.
 *
 * Tamén serve o Reto do Advento: fichas que se abren cada día, comentarios e fotos.
 *
 * Despregado como aplicación web: Executar como «Eu», acceso «Calquera».
 * Copia de referencia: _xerador/apps-script/Codigo.gs no repositorio da web.
 */
var CORREO = 'cervexeiroscaseirospontevedra@gmail.com';
var NOME_FOLLA = 'Pedidos e inscricións da web (ACCP)';
var URL_APP = 'https://script.google.com/macros/s/AKfycbyAAFP5PR1mtpd6WHLG7H2ZXT-EBzH8bmAsK-81szjdUp3F_pB-BMgaSp4ZxBVz2A_MoQ/exec';
var URL_FICHAS = 'https://cervexeiros.github.io/cercexeiros/fichas-advento.html';
var ADV = {
  NOME: 'Reto do Advento 2026 · fichas e comentarios (ACCP)',
  CARTAFOL: 'Reto do Advento 2026 · fotos dos comentarios',
  ZONA: 'Europe/Madrid',
  CAB_FICHAS: ['Día', 'Data', 'Día da semana', 'Data especial', 'Cervexa', 'Cervexeira', 'Orixe', 'Estilo', 'Alcohol',
    'Lumes (0-5)', 'Nivel de perigo', 'Temperatura', 'Copa', 'A historia', 'Maridaxe', 'Sabías que…?', 'Nota'],
  CAB_COM: ['Data', 'ID', 'Día', 'Nome', 'Comentario', 'Foto', 'Foto ID', 'Estado', 'Navegador']
};

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

/**
 * GET:
 *  ?accion=advento&callback=fn[&vista=CHAVE]  → fichas abertas ata hoxe e os seus comentarios (JSONP)
 *  ?accion=ocultar|mostrar&id=…&t=…          → moderación desde a ligazón do correo
 *  (sen accion)                              → comprobación rápida de que o servizo está vivo
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.accion === 'advento') {
    try { return jsonp_(p.callback, datosAdvento_(eVistaPrevia_(p.vista))); }
    catch (err) { return jsonp_(p.callback, { ok: false, erro: String(err) }); }
  }
  if (p.accion === 'ocultar' || p.accion === 'mostrar') return moderar_(p);
  return resposta_({ ok: true, servizo: 'accp-formularios' });
}

function jsonp_(cb, obx) {
  var json = JSON.stringify(obx);
  if (cb && /^[A-Za-z_$][\w$]{0,60}$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return resposta_(obx);
}

/*
 * IMPORTANTE: a web considera o envío correcto en canto Google responde coa redirección
 * (o que só pasa se doPost remata sen erro). Por iso, se non se puido gardar NIN enviar
 * o correo, lanzamos un erro: Google devolve entón unha páxina de erro e a web usa o respaldo.
 */
function doPost(e) {
  var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  if (d.accion === 'comentario') return comentario_(d);
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


/* ===================== RETO DO ADVENTO ===================== */

/** Executar unha vez a man: crea a folla do reto, o cartafol das fotos e as chaves. */
function configurarAdvento() {
  var props = PropertiesService.getScriptProperties();
  var ss = advento_();
  var cf = cartafol_();
  if (!props.getProperty('ADVENTO_VISTA')) props.setProperty('ADVENTO_VISTA', Utilities.getUuid().replace(/-/g, '').slice(0, 10));
  if (!props.getProperty('ADVENTO_SEGREDO')) props.setProperty('ADVENTO_SEGREDO', Utilities.getUuid());
  Logger.log('Folla do reto: ' + ss.getUrl());
  Logger.log('Cartafol das fotos: ' + cf.getUrl());
  Logger.log('Vista previa (todas as fichas abertas): ' + URL_FICHAS + '?vista=' + props.getProperty('ADVENTO_VISTA'));
}

/** Opcional: código para poder comentar (baleiro = sen código). Exemplo: ponerCodigo('LORO2026') */
function ponerCodigo(codigo) {
  PropertiesService.getScriptProperties().setProperty('ADVENTO_CODIGO', String(codigo || '').trim());
  CacheService.getScriptCache().removeAll(['adv_' + hoxe_(), 'adv_' + hoxe_() + '_p']);
}

function advento_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('ADVENTO_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  var ss = SpreadsheetApp.create(ADV.NOME);
  ss.setSpreadsheetTimeZone(ADV.ZONA);
  var f = ss.getSheets()[0].setName('Fichas');
  f.getRange(1, 1, 1, ADV.CAB_FICHAS.length).setValues([ADV.CAB_FICHAS]).setFontWeight('bold').setBackground('#0B2A4A').setFontColor('#ffffff');
  f.setFrozenRows(1); f.setFrozenColumns(1);
  f.getRange('B1').setNote('Data en que se abre a ficha (00:00, hora de Galicia). Formato 2026-12-01.');
  f.getRange('J1').setNote('Número de lumes 🔥 (de 0 a 5).');
  f.getRange('A1').setNote('O «13b» é a ficha da lata única do día 13.');
  [70, 95, 95, 110, 170, 170, 170, 170, 110, 70, 260, 110, 130, 420, 220, 260, 220].forEach(function (w, i) { f.setColumnWidth(i + 1, w); });
  var c = ss.insertSheet('Comentarios');
  c.getRange(1, 1, 1, ADV.CAB_COM.length).setValues([ADV.CAB_COM]).setFontWeight('bold').setBackground('#0B2A4A').setFontColor('#ffffff');
  c.setFrozenRows(1);
  c.getRange('H1').setNote('Escribe «Oculto» (ou calquera cousa que conteña «ocult») para agochar un comentario da web; bórrao para volver amosalo. «Vista previa» = probas que só se ven coa ligazón de vista previa.');
  [140, 150, 50, 150, 420, 260, 120, 100, 260].forEach(function (w, i) { c.setColumnWidth(i + 1, w); });
  props.setProperty('ADVENTO_ID', ss.getId());
  return ss;
}

function cartafol_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('ADVENTO_CARTAFOL');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var cf = DriveApp.createFolder(ADV.CARTAFOL);
  props.setProperty('ADVENTO_CARTAFOL', cf.getId());
  return cf;
}

/** Garda (ou substitúe) as fichas na folla. Úsase desde unha función temporal coa lista de fichas. */
function cargarFichas_(lista) {
  var sh = advento_().getSheetByName('Fichas');
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, ADV.CAB_FICHAS.length).clearContent();
  var filas = lista.map(function (x) {
    return ["'" + x.dia, "'" + x.data, x.semana, x.especial, x.cervexa, x.cervexeira, x.orixe, x.estilo, x.alcohol,
      x.lumes, x.perigo, x.temperatura, x.copa, x.historia, x.maridaxe, x.sabias, x.nota];
  });
  sh.getRange(2, 1, filas.length, ADV.CAB_FICHAS.length).setValues(filas).setVerticalAlignment('top');
  sh.getRange(2, 14, filas.length, 3).setWrap(true);
  CacheService.getScriptCache().removeAll(['adv_' + hoxe_(), 'adv_' + hoxe_() + '_p']);
  return filas.length;
}

function hoxe_() { return Utilities.formatDate(new Date(), ADV.ZONA, 'yyyy-MM-dd'); }
function dataTexto_(v) { return v instanceof Date ? Utilities.formatDate(v, ADV.ZONA, 'yyyy-MM-dd') : String(v || '').trim().slice(0, 10); }
function eVistaPrevia_(chave) {
  var k = PropertiesService.getScriptProperties().getProperty('ADVENTO_VISTA');
  return !!(chave && k && String(chave) === k);
}
function textoFolla_(v) { v = String(v == null ? '' : v); return /^[=+\-@]/.test(v) ? "'" + v : v; }

/** Fichas (só o contido das xa abertas) e comentarios visibles. A data decídea o servidor, non o móbil. */
function datosAdvento_(previa) {
  var hoxe = hoxe_();
  var cache = CacheService.getScriptCache();
  var k = 'adv_' + hoxe + (previa ? '_p' : '');
  var gardado = cache.get(k);
  if (gardado) { var o = JSON.parse(gardado); o.agora = new Date().toISOString(); return o; }

  var ss = advento_();
  var fv = ss.getSheetByName('Fichas').getDataRange().getValues();
  var cab = fv.shift();
  var col = function (n) { return cab.indexOf(n); };
  var abertos = {};
  var fichas = fv.filter(function (r) { return String(r[0]).trim() !== ''; }).map(function (r) {
    var dia = String(r[col('Día')]).trim();
    var data = dataTexto_(r[col('Data')]);
    var aberta = previa || data <= hoxe;
    var x = { dia: dia, data: data, semana: String(r[col('Día da semana')]), especial: String(r[col('Data especial')]), aberta: aberta };
    if (!aberta) return x; // pechada: nin nome nin nada
    abertos[dia.replace(/\D/g, '')] = true;
    x.cervexa = String(r[col('Cervexa')]); x.cervexeira = String(r[col('Cervexeira')]); x.orixe = String(r[col('Orixe')]);
    x.estilo = String(r[col('Estilo')]); x.alcohol = String(r[col('Alcohol')]); x.lumes = Number(r[col('Lumes (0-5)')]) || 0;
    x.perigo = String(r[col('Nivel de perigo')]); x.temperatura = String(r[col('Temperatura')]); x.copa = String(r[col('Copa')]);
    x.historia = String(r[col('A historia')]); x.maridaxe = String(r[col('Maridaxe')]); x.sabias = String(r[col('Sabías que…?')]);
    x.nota = String(r[col('Nota')]);
    return x;
  });

  var cv = ss.getSheetByName('Comentarios').getDataRange().getValues();
  cv.shift();
  var comentarios = {};
  cv.forEach(function (r) {
    var dia = String(r[2]).replace(/\D/g, ''), estado = String(r[7] || '').trim().toLowerCase();
    if (!abertos[dia] || estado.indexOf('ocult') >= 0) return; // «Oculto», «oculta», «OCULTO »… todo agocha
    if (estado === 'vista previa' && !previa) return;
    (comentarios[dia] = comentarios[dia] || []).push({
      id: String(r[1]), data: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
      nome: String(r[3]), texto: String(r[4]), foto: String(r[5] || ''), previa: estado === 'vista previa'
    });
  });

  var out = { ok: true, hoxe: hoxe, agora: new Date().toISOString(), previa: !!previa,
    codigo: !!PropertiesService.getScriptProperties().getProperty('ADVENTO_CODIGO'), fichas: fichas, comentarios: comentarios };
  try { cache.put(k, JSON.stringify(out), 60); } catch (e) {}
  return out;
}

/** Novo comentario (con foto opcional). Lanza erro se non se pode gardar: a web amósao como fallo. */
function comentario_(d) {
  var id = String(d._id || '').slice(0, 60);
  if (!id) throw new Error('sen id');
  if (d._honey) return resposta_({ ok: true, id: id });
  var props = PropertiesService.getScriptProperties();
  var previa = eVistaPrevia_(d.vista);
  var codigo = props.getProperty('ADVENTO_CODIGO');
  if (codigo && !previa && String(d.codigo || '').trim().toLowerCase() !== codigo.toLowerCase()) throw new Error('código incorrecto');
  var dia = String(d.dia || '').replace(/\D/g, '');
  var nome = String(d.nome || '').trim().slice(0, 60);
  var texto = String(d.texto || '').trim().slice(0, 1500);
  if (!dia || !nome || (!texto && !d.foto)) throw new Error('faltan datos');

  var cache = CacheService.getScriptCache();
  if (cache.get('com_' + id)) return resposta_({ ok: true, id: id, repetido: true });

  var ss = advento_();
  var fv = ss.getSheetByName('Fichas').getDataRange().getValues();
  var cab = fv.shift();
  var ficha = fv.filter(function (r) { return String(r[0]).trim() === dia; })[0];
  if (!ficha) throw new Error('non existe ese día');
  if (!previa && dataTexto_(ficha[cab.indexOf('Data')]) > hoxe_()) throw new Error('a ficha aínda está pechada');

  var foto = '', fotoId = '';
  if (d.foto) {
    var b64 = String(d.foto);
    if (b64.length > 8000000) throw new Error('foto demasiado grande');
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', 'dia' + ('0' + dia).slice(-2) + '-' + id + '.jpg');
    var ficheiro = cartafol_().createFile(blob);
    ficheiro.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    fotoId = ficheiro.getId();
    foto = 'https://lh3.googleusercontent.com/d/' + fotoId;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (cache.get('com_' + id)) return resposta_({ ok: true, id: id, repetido: true });
    ss.getSheetByName('Comentarios').appendRow([new Date(), id, Number(dia), textoFolla_(nome), textoFolla_(texto), foto, fotoId,
      previa ? 'Vista previa' : '', String(d._navegador || '').slice(0, 300)]);
    cache.put('com_' + id, '1', 21600);
    cache.removeAll(['adv_' + hoxe_(), 'adv_' + hoxe_() + '_p']);
  } finally {
    lock.releaseLock();
  }

  // Aviso á asociación, con ligazón para ocultalo dun clic (se falla o correo, o comentario xa está gardado).
  if (!previa) {
    try {
      var cervexa = String(ficha[cab.indexOf('Cervexa')]);
      var t = selo_(id);
      MailApp.sendEmail({
        to: CORREO, name: 'Web Cervexeiros', subject: 'Comentario no día ' + dia + ' (' + cervexa + '): ' + nome,
        htmlBody: '<p><b>' + esc_(nome) + '</b> comentou na ficha do día ' + esc_(dia) + ' (' + esc_(cervexa) + '):</p>' +
          '<blockquote style="border-left:4px solid #96BC4D;margin:0;padding:6px 12px">' + esc_(texto).replace(/\n/g, '<br>') + '</blockquote>' +
          (foto ? '<p><a href="' + foto + '"><img src="' + foto + '=w400" alt="foto" style="max-width:300px;border-radius:8px"></a></p>' : '') +
          '<p><a href="' + URL_FICHAS + '#dia-' + dia + '">Ver na web</a> · <a href="' + URL_APP + '?accion=ocultar&id=' + encodeURIComponent(id) + '&t=' + t + '">Ocultar este comentario</a></p>' +
          '<p style="color:#888;font-size:12px">Tamén podes ocultalo escribindo «Oculto» na columna Estado da folla <a href="' + ss.getUrl() + '">' + esc_(ADV.NOME) + '</a>.</p>'
      });
    } catch (e) {}
  }
  return resposta_({ ok: true, id: id, foto: foto });
}

function selo_(id) {
  var s = PropertiesService.getScriptProperties().getProperty('ADVENTO_SEGREDO') || '';
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(id), s)).replace(/=+$/, '').slice(0, 22);
}

function moderar_(p) {
  var ok = p.id && p.t && p.t === selo_(p.id);
  var msx = 'Ligazón non válida.';
  if (ok) {
    var sh = advento_().getSheetByName('Comentarios');
    var ids = sh.getRange(1, 2, sh.getLastRow(), 1).getValues();
    for (var i = 1; i < ids.length; i++) {
      if (String(ids[i][0]) === String(p.id)) {
        var ocultar = p.accion === 'ocultar';
        sh.getRange(i + 1, 8).setValue(ocultar ? 'Oculto' : '');
        CacheService.getScriptCache().removeAll(['adv_' + hoxe_(), 'adv_' + hoxe_() + '_p']);
        msx = ocultar
          ? 'Feito: o comentario xa non se ve na web. <a href="' + URL_APP + '?accion=mostrar&id=' + encodeURIComponent(p.id) + '&t=' + p.t + '">Desfacer</a>'
          : 'Feito: o comentario volve verse na web.';
        break;
      }
      if (i === ids.length - 1) msx = 'Non atopei ese comentario.';
    }
  }
  return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;padding:24px;font-size:18px">' + msx + '</div>').setTitle('Moderación · Reto do Advento');
}

function esc_(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
