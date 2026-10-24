const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const probe = `
<script>
window.addEventListener('load', function () {
  setTimeout(function () {
    var out = [];
    function m(sel) { var e = document.querySelector(sel); if (!e) return null; var r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top), l: Math.round(r.left) }; }
    out.push('vw=' + window.innerWidth + ' vh=' + window.innerHeight);
    out.push('docScrollW=' + document.documentElement.scrollWidth);
    ['.topbar', '.rail', '.stage', '.console', '#cardNames', '#cardGenerate', '.canvas-wrapper', '.results'].forEach(function (s) {
      var r = m(s); out.push(s + '=' + (r ? r.w + 'x' + r.h + '@' + r.l + ',' + r.t : 'MISSING'));
    });
    var cw = document.getElementById('canvasWrapper');
    var cs = getComputedStyle(cw);
    out.push('wrapper.maxHeight=' + cs.maxHeight + ' padding=' + cs.paddingTop + '/' + cs.paddingBottom);
    out.push('rail.position=' + getComputedStyle(document.querySelector('.rail')).position);
    out.push('rail.scrollH=' + document.querySelector('.rail').scrollHeight);
    out.push('cus-count=' + document.querySelectorAll('.cus-select').length);
    // 黑白校验：所有可见元素的 color / background-color 是否只含中性灰
    var bad = [];
    document.querySelectorAll('*').forEach(function (el) {
      var s = getComputedStyle(el);
      [['color', s.color], ['bg', s.backgroundColor], ['shadow', s.boxShadow]].forEach(function (p) {
        var v = p[1];
        var mm = v.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/g) || [];
        mm.forEach(function (c) {
          var n = c.match(/\\d+/g).map(Number);
          if (n[0] !== n[1] || n[1] !== n[2]) bad.push(el.className + '|' + p[0] + '|' + c);
        });
      });
    });
    out.push('nonNeutral=' + bad.length + ' ' + JSON.stringify(bad.slice(0, 8)));
    var d = document.createElement('pre');
    d.id = 'PROBE';
    d.textContent = out.join('\\n');
    document.body.appendChild(d);
  }, 400);
});
<\/script>
`;
html = html.replace('</body>', probe + '</body>');
fs.writeFileSync('probe.html', html);
console.log('probe.html written');
