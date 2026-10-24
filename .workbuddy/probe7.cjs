/* 生成 probe7.html：实测开源字体 CDN 是否可达 + FontFace 是否真能用。
   用法：node .workbuddy/probe7.cjs 然后 cdp.cjs http://127.0.0.1:8767/probe7.html */
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const probe = `
<script>
window.__LOG = [];
window.addEventListener('error', function (e) { window.__LOG.push('ERR ' + e.message); });
(function () {
  var out = [];
  var W = window.PMWebFonts;
  out.push('PMWebFonts=' + (typeof W));
  var list = (W && W.list) || [];
  out.push('count=' + list.length);
  var cv = document.createElement('canvas');
  var c = cv.getContext('2d');
  function width(family, text) {
    c.font = '40px ' + family;
    return Math.round(c.measureText(text).width);
  }
  (async function () {
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      var t0 = performance.now();
      var got = null;
      try { got = await W.ensure(f.id); } catch (e) { got = null; }
      var ms = Math.round(performance.now() - t0);
      var wFallback = width(f.fallback, '张');
      var wReal = width(f.family, '张');
      out.push(f.id + ': ok=' + !!got + ' ms=' + ms +
        ' wFont=' + wReal + ' wFallback=' + wFallback +
        ' distinct=' + (wReal !== wFallback) +
        ' check=' + (document.fonts ? document.fonts.check('40px ' + f.family) : 'n/a'));
    }
    /* 界面接线：下拉里有没有这些选项 */
    var sel = document.getElementById('fontFamily');
    var vals = Array.from(sel.querySelectorAll('option')).map(function (o) { return o.value; });
    out.push('webOptions=' + vals.filter(function (v) { return v.indexOf('web:') === 0; }).join(','));
    out.push('groups=' + Array.from(sel.querySelectorAll('optgroup')).map(function (g) { return g.label; }).join('|'));
    window.__RESULT = out.join('\\n');
  })();
})();
</script>
`;
const withProbe = html.replace('</body>', probe + '</body>');
fs.writeFileSync('probe7.html', withProbe);
console.log('probe7.html written');
