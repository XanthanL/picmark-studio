/* 图层操作探针：撤销/重做/上下移/复制/删除/预设/存取配置/JPEG */
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const probe = `
<script>
window.__ERR = [];
window.addEventListener('error', function (e) { window.__ERR.push('error: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
window.addEventListener('unhandledrejection', function (e) { window.__ERR.push('reject: ' + (e.reason && e.reason.message)); });

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
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function items() { return document.querySelectorAll('#layerList .layer-item'); }
function names() { return Array.from(document.querySelectorAll('#layerList .layer-name')).map(function (e) { return e.textContent; }); }
function btn(id) { return document.getElementById(id); }
function click(id) { var b = btn(id); b.disabled = false; b.click(); }

window.addEventListener('load', function () {
  setTimeout(async function () {
    var out = [];
    window.__LOG = out;
    var base = await mkFile(600, 800, false, 'base.png');
    setFiles(document.getElementById('templateInput'), base);
    for (var i = 0; i < 80; i++) { await wait(100); if (items().length) break; }
    out.push('start=' + names().join('|'));

    var cv = document.getElementById('previewCanvas');
    // 两个区域图层
    document.querySelector('.mode-btn[data-tool="region"]').click();
    drag(cv, 30, 40, 200, 120); await wait(200);
    drag(cv, 30, 150, 200, 230); await wait(200);
    out.push('after2regions=' + names().join('|'));

    // 撤销 / 重做
    click('layerUndo'); await wait(150);
    out.push('afterUndo=' + names().join('|') + ' undoDisabled=' + btn('layerUndo').disabled);
    click('layerRedo'); await wait(150);
    out.push('afterRedo=' + names().join('|'));

    // 选中中间那个 + 上移 / 下移
    items()[1].click(); await wait(150);
    var before = names().join('|');
    click('layerUp'); await wait(150);
    out.push('up: ' + before + ' -> ' + names().join('|'));
    click('layerDown'); await wait(150);
    out.push('down -> ' + names().join('|'));

    // 复制 / 删除
    click('layerDup'); await wait(150);
    out.push('afterDup=' + names().join('|'));
    click('layerDel'); await wait(150);
    out.push('afterDel=' + names().join('|'));

    // 预设
    var preset = document.getElementById('layerPreset');
    out.push('presetOptions=' + preset.options.length);
    preset.selectedIndex = 1;
    preset.dispatchEvent(new Event('change'));
    await wait(250);
    out.push('afterPreset=' + names().join('|'));

    // 保存配置 → 读取文本
    var saved = null;
    var _create = URL.createObjectURL;
    window.__savedText = null;
    click('layerSave'); await wait(300);
    out.push('saveClicked ok');

    // JPEG 输出
    var fmt = document.getElementById('outputFormat');
    fmt.value = 'jpeg';
    fmt.dispatchEvent(new Event('change'));
    out.push('jpegSelected=' + fmt.value);

    // 缩放
    var zs = document.getElementById('zoomSlider');
    if (zs) {
      zs.value = Math.min(zs.max, Number(zs.value) + 20);
      zs.dispatchEvent(new Event('input'));
      await wait(200);
      out.push('zoom=' + document.getElementById('zoomValue').textContent);
    }

    out.push('ERR=' + JSON.stringify(window.__ERR.slice(0, 6)));
    var d = document.createElement('pre');
    d.textContent = out.join('\\n');
    document.body.appendChild(d);
    window.__RESULT = d.textContent;
  }, 400);
});
<\/script>
`;
html = html.replace('</body>', probe + '</body>');
fs.writeFileSync('probe5.html', html);
console.log('probe5.html written');
