/* probe9：确认「网络字形数据真的随 init 消息进了 Worker」+ 图层级字体下拉也有这些选项 */
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const probe = `
<script>
window.__LOG = [];
window.addEventListener('error', function (e) { window.__LOG.push('ERR ' + e.message); });
(function () {
  var out = [];
  var captured = [];
  var OP = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function (msg) {
    try {
      if (msg && msg.type === 'init') {
        captured.push({ fonts: (msg.fonts || []).map(function (f) { return f.family + ':' + (f.buffer ? f.buffer.byteLength : 0); }) });
      }
    } catch (e) {}
    return OP.apply(this, arguments);
  };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function mkFile(w, h, name) {
    return new Promise(function (res) {
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var x = c.getContext('2d');
      x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffffff'; x.fillRect(20, 20, w - 40, h - 40);
      c.toBlob(function (b) { res(new File([b], name, { type: 'image/png' })); }, 'image/png');
    });
  }
  function setFiles(input, file) {
    var dt = new DataTransfer(); dt.items.add(file);
    input.files = dt.files; input.dispatchEvent(new Event('change'));
  }
  (async function () {
    try {
      setFiles(document.getElementById('templateInput'), await mkFile(600, 800, 'base.png'));
      for (var q = 0; q < 120; q++) {
        await sleep(100);
        if (document.querySelectorAll('#layerList .layer-item').length > 0) break;
      }
      var ni = document.getElementById('namesInput');
      ni.value = '张三'; ni.dispatchEvent(new Event('input', { bubbles: true }));

      var sel = document.getElementById('fontFamily');
      sel.value = 'web:mashanzheng';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      var st = window.PMGetState();
      for (var j = 0; j < 300; j++) {
        await sleep(200);
        if (st.webFonts && st.webFonts.mashanzheng) break;
      }
      out.push('loaded=' + !!(st.webFonts && st.webFonts.mashanzheng));

      /* 图层配置区里所有下拉中，是否至少有一个带 web: 选项 */
      var sels = Array.from(document.querySelectorAll('#layerConfig select'));
      var hits = sels.filter(function (s) {
        return Array.from(s.options).some(function (o) { return o.value.indexOf('web:') === 0; });
      });
      out.push('layerConfigSelects=' + sels.length + ' withWebOptions=' + hits.length);

      window.saveAs = function (blob, name) { window.__ZIP = { size: blob.size }; };
      document.getElementById('generateBtn').click();
      for (var k = 0; k < 400; k++) {
        await sleep(200);
        if (window.__ZIP) break;
      }
      out.push('zip=' + JSON.stringify(window.__ZIP || null));
      out.push('workerInitFonts=' + JSON.stringify(captured));
      out.push('thumbs=' + document.querySelectorAll('#previewList img').length);
      out.push('ERR=' + JSON.stringify(window.__LOG.slice(0, 4)));
    } catch (e) { out.push('FATAL ' + e.message); }
    window.__RESULT = out.join('\\n');
  })();
})();
</script>
`;
fs.writeFileSync('probe9.html', html.replace('</body>', probe + '</body>'));
console.log('probe9.html written');
