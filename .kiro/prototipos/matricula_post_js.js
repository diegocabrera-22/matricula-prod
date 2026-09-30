// JavaScript que SIMPLE ejecuta en el formulario de firma de matrícula (campo tipo "javascript").
// Dispara el POST a la Edge Function sync-matricula al presionar "Firmar y enviar".
// Lee campos del formulario (algunos autocompletados por Clave Única) y arma el body.
//
// NOTA: la ANON key y el token van embebidos aquí porque SIMPLE lo ejecuta en el navegador.
// El token real (x-simple-token) debe coincidir con el secret SIMPLE_API_TOKEN de la función.

(function ($) {
  var URL_FN = 'https://gyhihuovussdauehmeuk.supabase.co/functions/v1/sync-matricula';
  var ANON = 'REEMPLAZAR_CON_ANON_KEY';
  var TOKEN = 'REEMPLAZAR_CON_SIMPLE_API_TOKEN';
  var enviado = false;

  function val(name) {
    var $c = $('[name="' + name + '"], [name="data[' + name + ']"]').first();
    if (!$c.length) { return ''; }
    if ($c.attr('type') === 'radio' || $c.attr('type') === 'checkbox') {
      var $sel = $('[name="' + name + '"]:checked, [name="data[' + name + ']"]:checked').first();
      return $sel.length ? $sel.val() : '';
    }
    var v = $c.val();
    return (v === null || v === undefined || v === 'null') ? '' : v;
  }
  function interpolado(valor) {
    if (valor === null || valor === undefined) return '';
    var s = String(valor);
    if (s.indexOf('@!') === 0 || s.indexOf('@@') === 0) return '';
    return s;
  }
  var TRAMITE_ID = interpolado('@!tramite_id');
  var RUT_FALLBACK = interpolado('@!rut');
  var NOMBRES_FALLBACK = interpolado('@!nombres');
  var APELLIDOS_FALLBACK = interpolado('@!apellidos');
  var EMAIL_FALLBACK = interpolado('@!email');
  function primerNoVacio() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (v !== null && v !== undefined && String(v).trim() !== '') { return String(v).trim(); }
    }
    return '';
  }
  function armarBody() {
    return {
      evento: 'firma',
      simple_tramite_id: TRAMITE_ID,
      rut_alumno: val('rut_alumno'),
      anio_escolar: val('anio_escolar'),
      rut_firmante: primerNoVacio(val('rut_firmante_cu'), RUT_FALLBACK),
      nombres: primerNoVacio(val('nombres_firmante'), NOMBRES_FALLBACK),
      apellidos: primerNoVacio(val('apellidos_firmante'), APELLIDOS_FALLBACK),
      email: primerNoVacio(val('email_firmante'), EMAIL_FALLBACK),
      religion: val('opcion_religion'),
      acepta_acta: val('acepta_acta'),
      autoriza_entrevista: val('autoriza_entrevista'),
      autoriza_imagenes: val('autoriza_imagenes'),
      url_pdf_firmado: val('url_pdf')
    };
  }
  function postSync() {
    if (enviado) { return; }
    enviado = true;
    $.ajax({
      url: URL_FN, type: 'POST', contentType: 'application/json',
      headers: { 'apikey': ANON, 'Authorization': 'Bearer ' + ANON, 'x-simple-token': TOKEN },
      data: JSON.stringify(armarBody()), timeout: 10000
    }).done(function (res) { console.log('[matricula] sync OK', res); })
      .fail(function (xhr, ts) { console.log('[matricula] sync ERROR', ts, xhr && xhr.status); enviado = false; });
  }
  $(document).off('click.matriculaSync').on('click.matriculaSync',
    '[name="firmar_enviar"], button[type="submit"], .btn-siguiente, #btn_siguiente',
    function () { postSync(); });
})(jQuery);
