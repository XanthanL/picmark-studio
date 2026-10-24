/* 端到端出图探针：走 HTTP，验证 Worker 路径能正确渲染图层（区域文字 + PNG 水印） */
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const probe = `
<script>
window.__ERR = [];
window.addEventListener('error', function (e) { window.__ERR.push('error: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
window.addEventListener('unhandledrejection', function (e) { window.__ERR.push('reject: ' + (e.reason && e.reason.message)); });
var _ce = console.error; console.error = function () { window.__ERR.push('console: ' + Array.from(arguments).join(' ')); _ce.apply(console, arguments); };

function mkFile(w, h, alpha, name) {
  return new Promise(function (res) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    if (alpha) { x.clearRect(0, 0, w, h); } else { x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, w, h); }
    x.fillStyle = alpha ? 'rgba(17,17,17,0.85)' : '#ffffff';
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
    var out = []; window.__LOG = out;
    window.saveAs = function (blob, name) { window.__ZIP = { name: name, size: blob.size, type: blob.type }; };

    var base = await mkFile(600, 800, false, 'base.png');
    setFiles(document.getElementById('templateInput'), base);
    for (var i = 0; i < 80; i++) {
      await new Promise(function (r) { setTimeout(r, 100); });
      if (document.querySelectorAll('#layerList .layer-item').length > 0) break;
    }
    out.push('loadMs=' + (i * 100) + ' canvas=' + document.getElementById('previewCanvas').width + 'x' + document.getElementById('previewCanvas').height);

    var ta = document.getElementById('namesInput');
    ta.value = '张三\\n李四';
    ta.dispatchEvent(new Event('input'));
    await new Promise(function (r) { setTimeout(r, 200); });

    // 区域框
    var cv = document.getElementById('previewCanvas');
    document.querySelector('.mode-btn[data-tool="region"]').click();
    drag(cv, 30, 40, 200, 120);
    await new Promise(function (r) { setTimeout(r, 250); });
    // 水印
    var wm = await mkFile(120, 120, true, 'mark.png');
    setFiles(document.getElementById('watermarkInput'), wm);
    await new Promise(function (r) { setTimeout(r, 400); });
    drag(cv, 60, 200, 160, 300);
    await new Promise(function (r) { setTimeout(r, 300); });
    out.push('layers=' + document.querySelectorAll('#layerList .layer-item').length);
    out.push('workerSupported=' + (document.getElementById('perfWarning') ? '' : ''));

    var _al = window.alert; window.alert = function (m) { window.__ERR.push('alert: ' + m); };

    // 触发生成
    out.push('preClick disabled=' + document.getElementById('generateBtn').disabled + ' names=' + JSON.stringify(document.getElementById('namesInput').value));
    document.getElementById('generateBtn').click();
    for (var j = 0; j < 150; j++) {
      await new Promise(function (r) { setTimeout(r, 100); });
      if (window.__ZIP) break;
    }
    out.push('genMs=' + (j * 100));
    out.push('progressBoxDisplay=' + document.getElementById('progressBox').style.display);
    out.push('zip=' + JSON.stringify(window.__ZIP));
    out.push('thumbs=' + document.querySelectorAll('#previewList img').length);
    out.push('progress=' + document.getElementById('progressText').textContent);
    out.push('perfMsg=' + (document.getElementById('perfWarning').textContent || '').slice(0, 80));

    // 抽样缩略图像素，确认文字/水印真的画上去了
    var t0 = document.querySelector('#previewList img');
    if (t0) {
      await new Promise(function (r) { t0.complete ? r() : (t0.onload = r); });
      var pc = document.createElement('canvas');
      pc.width = t0.naturalWidth; pc.height = t0.naturalHeight;
      var px = pc.getContext('2d');
      px.drawImage(t0, 0, 0);
      var d = px.getImageData(0, 0, pc.width, pc.height).data;
      var seen = {};
      for (var p = 0; p < d.length; p += 4) {
        seen[d[p] + ',' + d[p + 1] + ',' + d[p + 2]] = 1;
      }
      out.push('thumbSize=' + pc.width + 'x' + pc.height + ' distinctColors=' + Object.keys(seen).length);
    }

    out.push('ERR=' + JSON.stringify(window.__ERR.slice(0, 6)));
    var d2 = document.createElement('pre');
    d2.id = 'PROBE';
    d2.textContent = out.join('\\n');
    document.body.appendChild(d2);
    window.__RESULT = d2.textContent;
  }, 400);
});
<\/script>
`;
html = html.replace('</body>', probe + '</body>');
fs.writeFileSync('probe3.html', html);
console.log('probe3.html written');
