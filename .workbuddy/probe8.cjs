/* probe8：真实界面里选开源字体 → 预览变化 → 出图（Worker）也用上同一字形 */
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const probe = `
<script>
window.__LOG = [];
window.addEventListener('error', function (e) { window.__LOG.push('ERR ' + e.message); });
(function () {
  var out = [];
  var origSave = window.saveAs;
  window.saveAs = function (blob, name) { window.__ZIP = { size: blob.size, name: name }; if (origSave) origSave(blob, name); };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function ink() {
    var cv = document.getElementById('previewCanvas');
    if (!cv || !cv.width) return 'no-canvas';
    var c = cv.getContext('2d');
    var d = c.getImageData(0, 0, cv.width, cv.height).data;
    var n = 0, s = 0, colors = {};
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 10) { n++; s += (i % 13); colors[d[i] + ',' + d[i+1] + ',' + d[i+2]] = 1; }
    }
    return n + '/' + s + '/' + Object.keys(colors).length;
  }
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
    var dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  }
  (async function () {
    try {
      setFiles(document.getElementById('templateInput'), await mkFile(600, 800, 'base.png'));
      for (var q = 0; q < 120; q++) {
        await sleep(100);
        if (document.querySelectorAll('#layerList .layer-item').length > 0) break;
      }
      document.getElementById('namesInput').value = '张三\\n李四';
      document.getElementById('namesInput').dispatchEvent(new Event('input', { bubbles: true }));
      out.push('layers=' + document.querySelectorAll('#layerList .layer-item').length);
      await sleep(400);
      var inkA = ink();
      out.push('inkDefault=' + inkA);

      var sel = document.getElementById('fontFamily');
      sel.value = 'web:mashanzheng';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      var st = window.PMGetState();
      for (var j = 0; j < 300; j++) {
        await sleep(200);
        if (st.webFonts && st.webFonts.mashanzheng) break;
      }
      out.push('loaded=' + !!(st.webFonts && st.webFonts.mashanzheng));
      out.push('status=' + (document.getElementById('webFontStatus').textContent || ''));
      await sleep(700);
      out.push('inkMaShan=' + ink());

      /* 图层自己的字体下拉也要能选到 */
      var lsel = document.querySelector('#layerConfig select');
      out.push('layerSelectHasWeb=' + !!(lsel && Array.from(lsel.options).some(function (o) { return o.value === 'web:mashanzheng'; })));

      document.getElementById('generateBtn').click();
      for (var k = 0; k < 400; k++) {
        await sleep(200);
        if (window.__ZIP) break;
      }
      out.push('zip=' + JSON.stringify(window.__ZIP || null));
      out.push('thumbs=' + document.querySelectorAll('#previewList img').length);
      out.push('ERR=' + JSON.stringify(window.__LOG.slice(0, 5)));
    } catch (e) {
      out.push('FATAL ' + e.message);
    }
    window.__RESULT = out.join('\\n');
  })();
})();
</script>
`;
fs.writeFileSync('probe8.html', html.replace('</body>', probe + '</body>'));
console.log('probe8.html written');
