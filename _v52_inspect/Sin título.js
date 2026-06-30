function _findScriptTag() {
  var html = buildHtml();
  // Buscar </script> que NO sea el cierre legítimo del final
  var count = (html.match(/<\/script>/gi) || []).length;
  Logger.log('Cantidad de </script> en el HTML: ' + count);
  // Mostrar contexto de cada uno
  var idx = 0, n = 0;
  while ((idx = html.indexOf('</script>', idx)) >= 0 && n < 10) {
    Logger.log('#' + n + ' en pos ' + idx + ': ...' + html.substring(idx-50, idx+12) + '...');
    idx += 9; n++;
  }
}