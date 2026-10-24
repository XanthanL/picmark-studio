const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const probe = `
<script>
window.__ERR = [];
window.addEventListener('error', function (e) { window.__ERR.push('error: ' + e.message); });
window.addEventListener('unhandledrejection', function (e) { window.__ERR.push('reject: ' + (e.reason && e.reason.message)); });
var _ce = console.error; console.error = function () { window.__ERR.push('console: ' + Array.from(arguments).join(' ')); _ce.apply(console, arguments); };

function mkFile(w, h, alpha, name) {
  return new Promise(function (res) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    if (alpha) { x.clearRect(0, 0, w, h); } else { x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, w, h); }
    x.fillStyle = alpha ? 'rgba(17,17,17,0.85)' : '#333333';
    x.fillRect(10, 10, w - 20, h / 2);
    c.toBlob(function (b) { res(new File([b], name, { type: 'image/png' })); }, 'image/png');
  });
}

function setFiles(input, file) {
  var dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change'));
}

function drag(canvas, x0, y0, x1, y1) {
  var r = canvas.getBoundingClientRect();
  function ev(type, cx, cy) {
    var e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy });
    canvas.dispatchEvent(e);
  }
  function pev(type, cx, cy) {
    var e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy });
    (type === 'mouseup' ? window : canvas).dispatchEvent(e);
  }
  pev('mousedown', r.left + x0, r.top + y0);
  pev('mousemove', r.left + (x0 + x1) / 2, r.top + (y0 + y1) / 2);
  pev('mousemove', r.left + x1, r.top + y1);
  pev('mouseup', r.left + x1, r.top + y1);
}

window.addEventListener('load', function () {
  setTimeout(async function () {
    var out = [];
    out.push('globals: PMLayers=' + !!window.PMLayers + ' LayerEditor=' + !!window.LayerEditor + ' Panel=' + !!window.PMLayerPanel + ' Presets=' + ((window.PMLayerPresets || []).length));

    var base = await mkFile(600, 800, false, 'base.png');
    setFiles(document.getElementById('templateInput'), base);
    for (var i = 0; i < 150; i++) {
      await new Promise(function (r) { setTimeout(r, 100); });
      if (document.querySelectorAll('#layerList .layer-item').length > 0) break;
    }
    out.push('waitedMs=' + (i * 100));
    out.push('imageInfo=' + (document.getElementById('imageInfo').textContent || '').slice(0, 60));
    out.push('canvas=' + document.getElementById('previewCanvas').width + 'x' + document.getElementById('previewCanvas').height);

    var ta = document.getElementById('namesInput');
    ta.value = '张三\\n李四\\n王五';
    ta.dispatchEvent(new Event('input'));
    await new Promise(function (r) { setTimeout(r, 200); });
    out.push('layersAfterLoad=' + document.querySelectorAll('#layerList .layer-item').length);
    out.push('configSections=' + document.querySelectorAll('#layerConfig .layer-section').length);

    // 区域工具：拖一个框
    document.querySelector('.mode-btn[data-tool="region"]').click();
    out.push('toolAfterClick=' + document.body.dataset.tool);
    var cv = document.getElementById('previewCanvas');
    out.push('canvasRect=' + Math.round(cv.getBoundingClientRect().width) + 'x' + Math.round(cv.getBoundingClientRect().height));
    drag(cv, 40, 60, 200, 140);
    await new Promise(function (r) { setTimeout(r, 300); });
    out.push('layersAfterRegion=' + document.querySelectorAll('#layerList .layer-item').length);

    // 水印：选图 + 拖框
    var wm = await mkFile(120, 120, true, 'mark.png');
    document.querySelector('.mode-btn[data-tool="image"]');
    setFiles(document.getElementById('watermarkInput'), wm);
    await new Promise(function (r) { setTimeout(r, 400); });
    drag(cv, 220, 300, 300, 380);
    await new Promise(function (r) { setTimeout(r, 300); });
    out.push('layersAfterWatermark=' + document.querySelectorAll('#layerList .layer-item').length);
    out.push('layerNames=' + Array.from(document.querySelectorAll('#layerList .layer-name')).map(function (e) { return e.textContent; }).join('|'));
    out.push('badges=' + Array.from(document.querySelectorAll('#layerList .layer-badge')).map(function (e) { return e.textContent; }).join('|'));

    // 逐个选中，检查配置区按类型切换字段
    var items = Array.from(document.querySelectorAll('#layerList .layer-item'));
    for (var k = 0; k < items.length; k++) {
      items[k].click();
      await new Promise(function (r) { setTimeout(r, 150); });
      var secs = Array.from(document.querySelectorAll('#layerConfig .layer-section-title')).map(function (e) { return e.textContent; });
      out.push('cfg[' + k + ']=' + secs.join('/') + ' fields=' + document.querySelectorAll('#layerConfig .field').length);
    }

    // 画布上是否真的画出了东西（对比纯底图的像素）
    out.push('genBtnDisabled=' + document.getElementById('generateBtn').disabled);
    out.push('formatOptions=' + Array.from(document.querySelectorAll('#outputFormat option')).map(function (o) { return o.value; }).join(','));
    out.push('ERR=' + JSON.stringify(window.__ERR.slice(0, 6)));

    var d = document.createElement('pre');
    d.id = 'PROBE';
    d.textContent = out.join('\\n');
    document.body.appendChild(d);
  }, 300);
});
<\/script>
`;
html = html.replace('</body>', probe + '</body>');
fs.writeFileSync('probe2.html', html);
console.log('probe2.html written');
