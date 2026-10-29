/* ============================================================
   图印工坊 · 功能冒烟测试 + 出图
   ------------------------------------------------------------
   用 CDP 驱动真实 Chrome（虚拟时钟会跑飞图片解码 / Worker / ZIP），
   按真实用户操作序列走一遍：底图 → 名单 → 区域 → 水印(5 种) →
   字体 → 取色 → 批量生成 → 移动端 → 暗色。
   每一环都留一张截图 + 一条断言，最后汇总成 report.html。
   用法：
     node .workbuddy/smoke.cjs http://127.0.0.1:PORT/index.html
   依赖：本地 HTTP 服务 + Chrome --remote-debugging-port=9222
   ============================================================ */
const fs = require('fs');
const path = require('path');
const http = require('http');

const OUT = path.join(__dirname, 'shots-smoke');
fs.mkdirSync(OUT, { recursive: true });

/* ---------- CDP ---------- */
function getJson(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: 9222, path: p }, (r) => {
      let b = '';
      r.on('data', (d) => (b += d));
      r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

let ws, id = 0;
const pending = new Map();
function send(method, params) {
  return new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
    setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error('timeout ' + method)); } }, 120000);
  });
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) {
    const d = r.result.exceptionDetails;
    throw new Error('EVAL: ' + ((d.exception && d.exception.description) || JSON.stringify(d)));
  }
  return r.result && r.result.result && r.result.result.value;
}

/* ---------- 页面内 helper（只注入一次） ---------- */
const HELPERS = `
window.__ERR = [];
window.addEventListener('error', function (e) { window.__ERR.push('error: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
window.addEventListener('unhandledrejection', function (e) { window.__ERR.push('reject: ' + (e.reason && e.reason.message)); });

window.__S = (function () {
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  function fire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }
  function gid(id) { return document.getElementById(id); }

  /* ---------- 底图：程序化荣誉证书 ---------- */
  function stamp(g, cx, cy, r) {
    g.save();
    g.strokeStyle = '#c0392b'; g.lineWidth = 6;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r - 14, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#c0392b'; g.font = 'bold 34px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('图印', cx, cy - 16); g.fillText('工坊', cx, cy + 24);
    g.restore();
  }

  function cert(g, w, h) {
    var grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#fdfaf3'); grd.addColorStop(1, '#f2e9d8');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b3893a'; g.lineWidth = 10; g.strokeRect(28, 28, w - 56, h - 56);
    g.strokeStyle = '#d8b566'; g.lineWidth = 3; g.strokeRect(50, 50, w - 100, h - 100);
    g.fillStyle = '#b3893a'; g.fillRect(w / 2 - 120, 118, 240, 5);
    g.fillStyle = '#8a1f1f'; g.font = 'bold 76px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText('荣誉证书', w / 2, 250);
    g.fillStyle = '#333'; g.font = '38px "Microsoft YaHei", sans-serif'; g.textAlign = 'left';
    g.fillText('兹有', 110, 430);
    g.fillText('同学在本年度综合测评中表现优异，特此表彰。', 110, 520);
    g.strokeStyle = '#8a1f1f'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(210, 438); g.lineTo(650, 438); g.stroke();
    g.fillStyle = '#666'; g.font = '26px "Microsoft YaHei", sans-serif';
    g.fillText('编号：2026-CN-0001', 110, 900);
    g.textAlign = 'right';
    g.fillText('图印工坊', w - 110, 890);
    g.fillText('2026 年 10 月 26 日', w - 110, 935);
    stamp(g, w - 200, h - 240, 78);
  }

  /* ---------- 5 种水印 ---------- */
  function seal(g, w, h) {
    g.clearRect(0, 0, w, h);
    g.globalAlpha = 0.85;
    g.strokeStyle = '#c0392b'; g.lineWidth = 14;
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 16, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#c0392b'; g.font = 'bold ' + Math.round(w * 0.2) + 'px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('图印工坊', w / 2, h / 2);
    g.globalAlpha = 1;
  }
  function wmtext(g, w, h) {
    g.clearRect(0, 0, w, h);
    g.globalAlpha = 0.32; g.fillStyle = '#111111';
    g.font = 'bold 46px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.translate(w / 2, h / 2); g.rotate(-Math.PI / 6);
    for (var i = -2; i <= 2; i++) g.fillText('CONFIDENTIAL', 0, i * 72);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  }
  function qr(g, w, h) {
    g.clearRect(0, 0, w, h);
    var n = 21, s = w / n, seed = 7;
    var rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    g.fillStyle = '#111111';
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) if (rnd() > 0.55) g.fillRect(i * s, j * s, s, s);
    var corner = function (x, y) {
      g.fillStyle = '#111111'; g.fillRect(x, y, s * 7, s * 7);
      g.fillStyle = '#ffffff'; g.fillRect(x + s, y + s, s * 5, s * 5);
      g.fillStyle = '#111111'; g.fillRect(x + s * 2, y + s * 2, s * 3, s * 3);
    };
    corner(0, 0); corner(w - s * 7, 0); corner(0, h - s * 7);
  }
  function sign(g, w, h) {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#1a3a6b'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(w * 0.08, h * 0.62);
    g.bezierCurveTo(w * 0.2, h * 0.08, w * 0.34, h * 0.92, w * 0.5, h * 0.46);
    g.bezierCurveTo(w * 0.62, h * 0.14, w * 0.76, h * 0.78, w * 0.92, h * 0.36);
    g.stroke();
    g.beginPath(); g.moveTo(w * 0.14, h * 0.84); g.lineTo(w * 0.86, h * 0.74); g.stroke();
  }
  function logo(g, w, h) {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#111111';
    g.beginPath(); g.moveTo(w * 0.5, h * 0.16); g.lineTo(w * 0.88, h * 0.82); g.lineTo(w * 0.12, h * 0.82); g.closePath(); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(w * 0.5, h * 0.64, w * 0.12, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111111'; g.font = 'bold ' + Math.round(w * 0.15) + 'px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('PM', w * 0.5, h * 0.42);
  }
  var DRAWS = { cert: cert, seal: seal, text: wmtext, qr: qr, sign: sign, logo: logo };

  function mkFile(w, h, draw, name) {
    return new Promise(function (res) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      DRAWS[draw](c.getContext('2d'), w, h);
      c.toBlob(function (b) { res(new File([b], name, { type: 'image/png' })); }, 'image/png');
    });
  }

  function put(inputId, file) {
    var dt = new DataTransfer(); dt.items.add(file);
    var el = gid(inputId); el.files = dt.files;
    fire(el, 'change');
  }

  async function uploadTemplate(file) {
    put('templateInput', file);
    for (var i = 0; i < 200 && !PMGetState().sourceImage; i++) await sleep(100);
    return !!PMGetState().sourceImage;
  }

  async function uploadWatermark(file) {
    var before = PMGetState().pendingWatermark;
    put('watermarkInput', file);
    for (var i = 0; i < 200; i++) {
      var k = PMGetState().pendingWatermark;
      if (k && k !== before && PMGetState().images[k]) return k;
      await sleep(100);
    }
    return null;
  }

  /* 图像坐标 → 屏幕坐标（用编辑器自己的 viewScale） */
  function imgPt(ix, iy) {
    var cv = gid('previewCanvas');
    var r = cv.getBoundingClientRect();
    var ed = PMGetState().layerEditor;
    var vs = ed && ed.viewScale ? ed.viewScale : (r.width / PMGetState().sourceImage.width);
    return { x: r.left + ix * vs, y: r.top + iy * vs };
  }

  function dragBox(x1, y1, x2, y2) {
    var cv = gid('previewCanvas');
    var a = imgPt(x1, y1), b = imgPt(x2, y2);
    cv.dispatchEvent(new MouseEvent('mousedown', { clientX: a.x, clientY: a.y, button: 0, bubbles: true }));
    cv.dispatchEvent(new MouseEvent('mousemove', { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2, button: 0, bubbles: true }));
    cv.dispatchEvent(new MouseEvent('mousemove', { clientX: b.x, clientY: b.y, button: 0, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }

  function clickPt(ix, iy) {
    var cv = gid('previewCanvas');
    var p = imgPt(ix, iy);
    cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: p.x, clientY: p.y, button: 0, bubbles: true, cancelable: true }));
  }

  function tool(name) {
    var b = document.querySelector('.mode-btn[data-tool="' + name + '"]');
    if (b) b.click();
    return PMGetState().tool;
  }

  function setFont(v) {
    var el = gid('fontFamily'); el.value = v;
    fire(el, 'change'); fire(el, 'input');
  }

  function setNames(t) {
    var el = gid('namesInput'); el.value = t; fire(el, 'input');
  }

  function layers() { return PMGetState().layers; }
  function lastLayer(type) {
    var ls = layers();
    for (var i = ls.length - 1; i >= 0; i--) if (!type || ls[i].type === type) return ls[i];
    return null;
  }

  /* 画布上取某点像素（位图坐标 = 图像坐标 * drawScale） */
  function sample(ix, iy) {
    var cv = gid('previewCanvas');
    var s = PMGetState().drawScale || 1;
    var c = cv.getContext('2d');
    var d = c.getImageData(Math.round(ix * s), Math.round(iy * s), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }

  /* 图层框内的墨迹指纹 —— 判断「字体/样式到底有没有落到画布上」的唯一可靠判据
     （CJK 全角 measureText 恒等于字号，量不出来；只数墨迹像素也会被
      「两款字体笔画粗细相近」骗过去，所以再叠一层 32×12 网格占位指纹） */
  function ink(l) {
    var cv = gid('previewCanvas');
    var s = PMGetState().drawScale || 1;
    var c = cv.getContext('2d');
    var x = Math.max(0, Math.round(l.x * s)), y = Math.max(0, Math.round(l.y * s));
    var w = Math.min(cv.width - x, Math.round(l.w * s)), h = Math.min(cv.height - y, Math.round(l.h * s));
    if (w <= 0 || h <= 0) return { n: 0, bits: [] };
    var d = c.getImageData(x, y, w, h).data;
    var COLS = 32, ROWS = 12, cells = new Array(COLS * ROWS), n = 0;
    for (var k = 0; k < cells.length; k++) cells[k] = 0;
    for (var yy = 0; yy < h; yy++) {
      for (var xx = 0; xx < w; xx++) {
        var i = (yy * w + xx) * 4;
        var lum = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
        if (lum < 110) { n++; cells[Math.floor(yy / h * ROWS) * COLS + Math.floor(xx / w * COLS)]++; }
      }
    }
    var bits = cells.map(function (v) { return v > 0 ? 1 : 0; });
    return { n: n, bits: bits };
  }

  /* 两份指纹的差异率：不同格子数 / 有墨格子总数 */
  function inkDiff(a, b) {
    if (!a || !b || !a.bits.length || a.bits.length !== b.bits.length) return 0;
    var diff = 0, union = 0;
    for (var i = 0; i < a.bits.length; i++) {
      if (a.bits[i] !== b.bits[i]) diff++;
      if (a.bits[i] || b.bits[i]) union++;
    }
    return union ? diff / union : 0;
  }

  return {
    sleep: sleep, fire: fire, mkFile: mkFile, uploadTemplate: uploadTemplate,
    uploadWatermark: uploadWatermark, imgPt: imgPt, dragBox: dragBox, clickPt: clickPt,
    tool: tool, setFont: setFont, setNames: setNames, layers: layers, lastLayer: lastLayer,
    sample: sample, ink: ink, inkDiff: inkDiff, gid: gid
  };
})();
`;

/* ---------- 截图 ---------- */
async function shotViewport(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'));
}
async function shotEl(name, selector, pad = 8) {
  /* 用页面绝对坐标 + captureBeyondViewport：scrollIntoView 在某些容器里
     不生效，视口相对坐标会截到黑块 */
  const rect = await evaluate(`(function(){
    var el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX - ${pad}, y: r.top + window.scrollY - ${pad},
             width: r.width + ${pad} * 2, height: r.height + ${pad} * 2 };
  })()`);
  if (!rect) throw new Error('元素未找到: ' + selector);
  const clip = {
    x: Math.max(0, rect.x), y: Math.max(0, rect.y),
    width: rect.width, height: rect.height,
    scale: 1
  };
  const r = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'));
}

/* ---------- 场景收集 ---------- */
const report = [];
async function step(title, expr, shotName, shotSel, assertFn) {
  let value = null, err = null;
  try { value = await evaluate(`(async () => { ${expr} })()`); }
  catch (e) { err = e.message; }
  let ok = false, note = '';
  try { const a = assertFn ? assertFn(value) : [true, '']; ok = a[0]; note = a[1] || ''; }
  catch (e) { note = '断言异常: ' + e.message; }
  if (!shotName) {
    shotName = ('step-' + (report.length + 1)).replace(/\s/g, '');
  }
  try {
    if (shotSel) await shotEl(shotName, shotSel);
    else await shotViewport(shotName);
  } catch (e) { note += ' | 截图失败: ' + e.message; }
  report.push({ title, ok, note, shot: shotName, err, data: value });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${title}${note ? ' — ' + note : ''}${err ? ' | ' + err : ''}`);
}

(async () => {
  const url = process.argv[2];
  if (!url) { console.error('用法: node .workbuddy/smoke.cjs <http-url>'); process.exit(1); }

  const list = await getJson('/json/list');
  const target = list.find((t) => t.type === 'page');
  if (!target) throw new Error('no page target');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise((res) => ws.addEventListener('open', res));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: url + '?_smoke=' + Date.now() });
  await new Promise((r) => setTimeout(r, 2000));
  await evaluate(HELPERS);
  await evaluate(`try { localStorage.removeItem('picmark-onboarded'); } catch (e) {}`);

  /* 1. 底图 + 名单 */
  await step('上传底图（程序化荣誉证书 800×1000）', `
    var f = await __S.mkFile(800, 1000, 'cert', 'certificate.png');
    var ok = await __S.uploadTemplate(f);
    __S.setNames('张三\\n欧阳司徒诸葛上官\\nAlice Zhang\\n王小美\\n李');
    await __S.sleep(600);
    return { ok: ok, w: PMGetState().sourceImage.width, h: PMGetState().sourceImage.height, layers: __S.layers().length, cols: PMGetState().nameColumns.length };
  `, '01-overview.png', null,
    (v) => [v && v.ok && v.w === 800 && v.layers >= 1, v ? `底图 ${v.w}×${v.h}，默认图层 ${v.layers} 个` : '无返回']);

  /* 2. 区域：画姓名框 */
  await step('区域功能：拖框放置姓名（框内自适应字号）', `
    __S.tool('region');
    await __S.sleep(200);
    __S.dragBox(210, 390, 650, 470);
    await __S.sleep(400);
    var l = __S.lastLayer('text');
    /* 拖框的左上角必须落在起拖点上：旧版把 rect.x 当中心又减了半个框，
       图层会整体往左上跑半框，这里钉死回归 */
    return { mode: l && l.mode, x: l && l.x, y: l && l.y, w: l && l.w, h: l && l.h,
             autoFit: l && l.autoFit, size: l && l.fontSize };
  `, '02-region.png', '.canvas-wrapper',
    (v) => [v && v.mode === 'region' && v.autoFit === true && Math.abs(v.x - 210) <= 2 && Math.abs(v.y - 390) <= 2,
      v ? `区域 ${v.w}×${v.h} 落在 (${v.x},${v.y})，autoFit=${v.autoFit}` : '']);

  /* 3a. 区域自适应：短名 */
  await step('区域自适应 A：短名「李」（字号顶到上限）', `
    var l = __S.layers().filter(function (x) { return x.mode === 'region'; })[0];
    var ta = __S.gid('namesInput');
    window.__origNames = ta.value;
    ta.value = '李'; __S.fire(ta, 'input'); await __S.sleep(500);
    var c = __S.gid('previewCanvas').getContext('2d');
    window.__fitShort = PMLayers.fitFontSize(c, l, '李');
    l.fontSize = window.__fitShort; PMRenderPreview(); await __S.sleep(300);
    return { fit: window.__fitShort };
  `, '03a-region-short.png', '.canvas-wrapper',
    (v) => [v && v.fit > 0, v ? `自适应字号 ${v.fit}px` : '']);

  /* 3b. 区域自适应：长名 */
  await step('区域自适应 B：长名「欧阳司徒诸葛上官」自动缩小', `
    var l = __S.layers().filter(function (x) { return x.mode === 'region'; })[0];
    var ta = __S.gid('namesInput');
    ta.value = '欧阳司徒诸葛上官'; __S.fire(ta, 'input'); await __S.sleep(500);
    var c = __S.gid('previewCanvas').getContext('2d');
    var long = PMLayers.fitFontSize(c, l, '欧阳司徒诸葛上官');
    l.fontSize = long; PMRenderPreview(); await __S.sleep(300);
    return { short: window.__fitShort, long: long };
  `, '03b-region-long.png', '.canvas-wrapper',
    (v) => [v && v.short && v.long && v.short > v.long, v ? `${v.short}px → ${v.long}px（长名自动缩小）` : '']);

  /* 恢复完整名单（水印与生成步骤要用 5 个名字） */
  await evaluate(`(async () => {
    var ta = __S.gid('namesInput');
    ta.value = window.__origNames; __S.fire(ta, 'input');
    await __S.sleep(400);
  })()`);

  /* 4-8. 五种水印 */
  /* 每个水印放到画布不同角落，最后一张能看到 5 个共存 */
  const WM = [
    ['seal', '红色圆形印章（半透明）', 300, 300, 560, 700, 720, 860],
    ['text', '斜向 CONFIDENTIAL 密级文字', 400, 300, 180, 560, 620, 700],
    ['qr', '伪二维码方块', 260, 260, 90, 800, 250, 960],
    ['sign', '手写签名（贝塞尔曲线）', 420, 200, 470, 860, 700, 970],
    ['logo', '几何 LOGO（三角 + PM）', 300, 300, 70, 120, 230, 280]
  ];
  for (let i = 0; i < WM.length; i++) {
    const [draw, desc, w, h, x1, y1, x2, y2] = WM[i];
    await step(`水印 ${i + 1}/5：${desc}`, `
      var f = await __S.mkFile(${w}, ${h}, '${draw}', 'wm-${draw}.png');
      var key = await __S.uploadWatermark(f);
      if (!key) return { key: null };
      await __S.sleep(200);
      __S.dragBox(${x1}, ${y1}, ${x2}, ${y2});
      await __S.sleep(400);
      var l = __S.lastLayer('image');
      return { key: key, id: l && l.id, name: l && l.name, w: l && l.w, h: l && l.h,
               iw: (PMGetState().imageMeta[key] || {}).w, ih: (PMGetState().imageMeta[key] || {}).h,
               px: __S.sample(${Math.round((x1 + x2) / 2)}, ${Math.round((y1 + y2) / 2)}) };
    `, `04-watermark-${i + 1}-${draw}.png`, '.canvas-wrapper',
      (v) => [v && v.key && v.id && v.w > 0, v && v.iw ? `水印原图 ${v.iw}×${v.ih} → 框内 ${v.w}×${v.h}` : '水印未加载']);
  }

  /* 9. 多水印共存 + 旋转 / 透明度 / 翻转 */
  await step('水印叠加：不同大小 / 旋转 / 透明度 / 水平翻转', `
    var ls = __S.layers().filter(function (l) { return l.type === 'image'; });
    ls.forEach(function (l, i) {
      l.rotation = [0, -18, 12, -6, 24][i % 5];
      l.opacity = [1, 0.45, 0.8, 0.65, 0.9][i % 5];
      l.flipH = (i === 2);
      var k = 0.6 + i * 0.12;
      l.w = Math.round(l.w * k); l.h = Math.round(l.h * k);
    });
    PMRenderPreview();
    await __S.sleep(400);
    return { count: ls.length, rots: ls.map(function (l) { return l.rotation; }), ops: ls.map(function (l) { return l.opacity; }) };
  `, '05-watermark-multi.png', '.canvas-wrapper',
    (v) => [v && v.count >= 5, v ? `${v.count} 个水印共存，旋转 ${v.rots.join('/')}，透明度 ${v.ops.join('/')}` : '']);

  /* 10-12. 字体 */
  const FONTS = [
    ['KaiTi, Kaiti SC, serif', '系统 · 楷体'],
    ['SimSun, Songti SC, serif', '系统 · 宋体'],
    ['STXingkai, Xingkai SC, cursive', '系统 · 华文行楷']
  ];
  for (let i = 0; i < FONTS.length; i++) {
    const [val, desc] = FONTS[i];
    await step(`字体：${desc}`, `
      /* 工具条改的是「当前选中图层」，先把区域文字设为选中态再改字体 */
      var l = __S.layers().filter(function (x) { return x.mode === 'region'; })[0] || __S.layers()[0];
    PMGetState().layerEditor.setActive(l.id);
    await __S.sleep(200);
    var before = __S.ink(l);
    __S.setFont(${JSON.stringify(val)});
    await __S.sleep(500);
    var after = __S.ink(l);
    var shape = __S.inkDiff(before, after);
    return { font: l.fontFamily, size: l.fontSize, want: ${JSON.stringify(val)},
             before: before.n, after: after.n, shape: Math.round(shape * 1000) / 1000 };
  `, `06-font-${i + 1}.png`, '.canvas-wrapper',
    (v) => [!!(v && String(v.font).indexOf(FONTS[i][0].split(',')[0]) >= 0 && v.shape >= 0.05),
      v ? `图层字体 = ${v.font}｜墨迹 ${v.before} → ${v.after} px，字形差异 ${Math.round(v.shape * 100)}%` : '']);
  }

  /* 13. 网络字体（马善政毛笔楷书，需 CDN）
     断言不看 fontFamily 字符串 —— 那只能证明「存进去了」；
     看的是区域框内的墨迹像素分布（字形指纹）是否真的变了。 */
  await step('网络字体：马善政毛笔楷书（jsDelivr 懒加载）', `
    var l = __S.layers().filter(function (x) { return x.mode === 'region'; })[0] || __S.layers()[0];
    function inkOf(l) { return __S.ink(l); }
    PMGetState().layerEditor.setActive(l.id);
    await __S.sleep(200);
    var before = inkOf(l);
    __S.setFont('web:mashanzheng');
    var ok = false, status = '';
    for (var i = 0; i < 120; i++) {
      await __S.sleep(500);
      status = (__S.gid('webFontStatus') || {}).textContent || '';
      if (window.PMWebFonts && PMGetState().webFonts && PMGetState().webFonts['mashanzheng']) { ok = true; break; }
      if (/失败|unavailable|回退/.test(status) && i > 8) break;
    }
    PMRenderPreview(); await __S.sleep(600);
    var after = inkOf(l);
    var shape = __S.inkDiff(before, after);
    var diff = before.n ? Math.abs(after.n - before.n) / before.n : 0;
    return { ok: ok, status: status, font: l.fontFamily, before: before, after: after,
             shape: Math.round(shape * 1000) / 1000, diff: Math.round(diff * 1000) / 1000,
             registered: !!(PMGetState().webFonts && PMGetState().webFonts['mashanzheng']) };
  `, '07-font-web-mashanzheng.png', '.canvas-wrapper',
    (v) => [!!(v && v.registered && v.shape >= 0.05),
      !v ? '' : (v.registered
        ? '已加载注册（' + v.font + '），字形差异 ' + Math.round(v.shape * 100) + '%（墨迹 ' + v.before.n + ' → ' + v.after.n + ' px）'
        : 'CDN 不可达，已回退系统字体：' + (v.status || '无提示'))]);

  /* 13b. 字体对比拼图：同一段文字 × 各款字体，字形差异一眼可见
     （截图里小字号看不出毛笔味，这里用真实 family 直接渲染大字号） */
  {
    const dataUrl = await evaluate(`(async () => {
      var W = window.PMWebFonts;
      var rows = [
        ['Microsoft YaHei, sans-serif', '系统 · 微软雅黑', null],
        ['KaiTi, Kaiti SC, serif', '系统 · 楷体', null],
        ['SimSun, Songti SC, serif', '系统 · 宋体', null],
        ['STXingkai, Xingkai SC, cursive', '系统 · 华文行楷', null],
        [null, '网络 · 马善政毛笔楷书', 'mashanzheng'],
        [null, '网络 · 志莽行书', 'zhimangxing']
      ];
      for (var i = 0; i < rows.length; i++) {
        if (rows[i][2]) { try { await W.ensure(rows[i][2]); } catch (e) {} }
      }
      var WIDTH = 1100, RH = 132, PAD = 28;
      var c = document.createElement('canvas');
      c.width = WIDTH; c.height = rows.length * RH + PAD * 2;
      var g = c.getContext('2d');
      g.fillStyle = '#f5f3ef'; g.fillRect(0, 0, c.width, c.height);
      g.textBaseline = 'middle';
      for (var r = 0; r < rows.length; r++) {
        var fam = rows[r][0] || (W.isReady(rows[r][2]) ? W.familyOf(rows[r][2]) : W.fallbackOf(rows[r][2]));
        var ready = rows[r][2] ? W.isReady(rows[r][2]) : true;
        var y = PAD + r * RH;
        g.fillStyle = '#111111'; g.font = '64px ' + fam;
        g.fillText('张三 荣誉证书', PAD, y + 46);
        g.fillStyle = '#8a8a8a'; g.font = '20px "Microsoft YaHei", sans-serif';
        g.fillText(rows[r][1] + (ready ? '' : '（未加载，已回退系统字体）'), PAD, y + RH - 24);
        g.strokeStyle = '#dcd7cf'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(PAD, y + RH - 6); g.lineTo(WIDTH - PAD, y + RH - 6); g.stroke();
      }
      return c.toDataURL('image/png');
    })()`);
    if (dataUrl && dataUrl.indexOf('base64,') > 0) {
      fs.writeFileSync(path.join(OUT, '07b-font-compare.png'), Buffer.from(dataUrl.split('base64,')[1], 'base64'));
      report.push({
        title: '字体对比拼图（同一段文字 × 6 款字体）', ok: true,
        note: '系统 4 款 + 网络 2 款（马善政毛笔楷书 / 志莽行书），用真实 family 渲染，非截图拼接',
        shot: '07b-font-compare.png', err: null, data: null
      });
      console.log('PASS  字体对比拼图 — 07b-font-compare.png');
    }
  }

  /* 13c. 相机水印：程序化生成 → 放进画布（走和上传水印同一条路） */
  await step('相机水印库：程序化生成 + 放置画布', `
    var btn = __S.gid('camWmBtn'); btn.click();
    await __S.sleep(400);
    var mask = __S.gid('camMask');
    var opened = !mask.hidden;
    var items = document.querySelectorAll('#camGrid .cam-item');
    /* 选第 2 款（小米 × 徕卡）：验证切换样式会重填机型/参数 */
    if (items[1]) items[1].click();
    await __S.sleep(300);
    var model = __S.gid('camModel').value;
    var lens = __S.gid('camLens').value;
    var keyBefore = PMGetState().pendingWatermark;
    __S.gid('camAdd').click();
    /* toBlob 是异步的，等水印真的进了库再继续（旧值是上一张 300×300 的水印） */
    var key = null, meta = null;
    for (var i = 0; i < 60; i++) {
      await __S.sleep(200);
      var k = PMGetState().pendingWatermark;
      if (k && k !== keyBefore) {
        key = k;
        meta = PMGetState().imageMeta[k];
        if (meta && meta.w > 800) break;
      }
    }
    var tool = PMGetState().tool;
    var closed = mask.hidden;
    __S.dragBox(95, 330, 405, 412);
    await __S.sleep(500);
    var l = __S.lastLayer('image');
    /* 客观验证「红标真的画上去了」：统计框内品牌红像素 */
    var s = PMGetState().drawScale || 1;
    var cv2 = __S.gid('previewCanvas');
    var d = cv2.getContext('2d').getImageData(
      Math.round(l.x * s), Math.round(l.y * s), Math.round(l.w * s), Math.round(l.h * s)).data;
    var red = 0, ink = 0;
    for (var j = 0; j < d.length; j += 4) {
      if (d[j] > 140 && d[j + 1] < 90 && d[j + 2] < 90) red++;
      if (d[j] < 110 && d[j + 1] < 110 && d[j + 2] < 110) ink++;
    }
    return { opened: opened, closed: closed, styles: items.length, model: model, lens: lens,
             key: key, tool: tool, w: meta && meta.w, h: meta && meta.h, red: red, ink: ink,
             id: l && l.id, lx: l && l.x, ly: l && l.y,
             lw: l && Math.round(l.w), lh: l && Math.round(l.h) };
  `, '07d-camera-mark.png', '.canvas-wrapper',
    (v) => [v && v.opened && v.closed && v.styles >= 10 && v.key && v.id && v.lw > 0 && v.w > 800
      && v.red > 50 && Math.abs(v.lx - 95) <= 2 && Math.abs(v.ly - 330) <= 2,
      v ? `样式 ${v.styles} 款，机型「${v.model}」，生成 ${v.w}×${v.h} PNG → 框内 ${v.lw}×${v.lh} @(${v.lx},${v.ly})（品牌红标 ${v.red} px / 墨迹 ${v.ink} px）` : '']);

  /* 13d. 相机水印全家福：15 款并排渲染，一眼看完 */
  {
    const dataUrl = await evaluate(`(async () => {
      var W = window.PMCameraWm;
      if (!W) return null;
      var H = 104, PAD = 26, CW = 900;
      var c = document.createElement('canvas');
      c.width = CW;
      c.height = W.styles.length * (H + 44) + PAD * 2;
      var g = c.getContext('2d');
      g.fillStyle = '#f3f1ec'; g.fillRect(0, 0, c.width, c.height);
      var y = PAD;
      W.styles.forEach(function (s) {
        var r = W.render({ style: s.id, h: H * 2 }, function (w, h) {
          var cc = document.createElement('canvas'); cc.width = w; cc.height = h; return cc;
        });
        var k = H / r.h;
        g.drawImage(r.canvas, PAD, y, r.w * k, H);
        g.fillStyle = '#7a7a7a';
        g.font = '15px "Microsoft YaHei", sans-serif';
        g.textBaseline = 'alphabetic';
        g.fillText(s.zh + '  ·  ' + s.en + '  ·  ' + s.model, PAD, y + H + 26);
        y += H + 44;
      });
      return c.toDataURL('image/png');
    })()`);
    if (dataUrl && dataUrl.indexOf('base64,') > 0) {
      fs.writeFileSync(path.join(OUT, '07c-camera-marks.png'), Buffer.from(dataUrl.split('base64,')[1], 'base64'));
      report.push({
        title: '相机水印全家福（15 款 · 程序化生成）', ok: true,
        note: '徕卡 / 哈苏 / 蔡司 / 富士 / 尼康 / 佳能 / 索尼 / 理光 / 柯达 / 手机联名等，纯 canvas 现画，无素材依赖',
        shot: '07c-camera-marks.png', err: null, data: null
      });
      console.log('PASS  相机水印全家福 — 07c-camera-marks.png');
    }
  }

  /* 14. 取色 */
  await step('取色：点底图右下红色印章 → 文字变色', `
    /* 工具条改的是「当前选中图层」，取色同样写回它；
       上一步刚插入的是水印图层，这里显式切回文字图层再取色 */
    var l = __S.layers().filter(function (x) { return x.type === 'text'; })[0];
    PMGetState().layerEditor.setActive(l.id);
    await __S.sleep(200);
    var before = l.color;
    __S.tool('pick');
    await __S.sleep(200);
    __S.clickPt(600, 682);   // 印章圆环上，红色
    await __S.sleep(500);
    return { before: before, after: l.color, input: __S.gid('fontColor').value,
             badge: __S.gid('colorValue').textContent, hint: __S.gid('modeHint').textContent };
  `, '08-pick-color.png', '.stage',
    (v) => [v && v.after && v.after.toLowerCase() !== String(v.before).toLowerCase() && v.input === v.after,
      v ? `${v.before} → ${v.after}（${v.hint}）` : '']);

  /* 15. 批量生成 */
  await step('批量生成 5 张 + ZIP 打包', `
    var btn = __S.gid('generateBtn');
    btn.click();
    var n = 0;
    for (var i = 0; i < 300; i++) {
      await __S.sleep(400);
      n = document.querySelectorAll('#previewList img').length;
      if (n >= 5 && !PMGetState().isGenerating) break;
    }
    var zip = (__S.gid('downloadZip') || {}).textContent || '';
    return { thumbs: n, generating: PMGetState().isGenerating, err: window.__ERR.slice(0, 4) };
  `, '09-generate-results.png', '#cardResult',
    (v) => [v && v.thumbs >= 5 && !v.generating && (!v.err || !v.err.length), v ? `缩略图 ${v.thumbs} 张，错误 ${JSON.stringify(v.err)}` : '']);

  /* 16. 移动端 */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise((r) => setTimeout(r, 800));
  await step('移动端 390×844：无横向溢出', `
    await __S.sleep(600);
    window.scrollTo(0, 0);
    var de = document.documentElement;
    var cw = de.clientWidth, bad = [];
    document.querySelectorAll('body *').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width === 0) return;
      if (r.right > cw + 1) {
        bad.push((el.id || String(el.className).split(' ')[0] || el.tagName) + ' →right ' + Math.round(r.right));
      }
    });
    return { scrollW: de.scrollWidth, clientW: cw, overflow: bad.slice(0, 8),
             canvasTop: Math.round(__S.gid('previewCanvas').getBoundingClientRect().top) };
  `, '10-mobile.png', null,
    (v) => [v && v.scrollW <= v.clientW + 1, v ? `scrollWidth ${v.scrollW} / clientWidth ${v.clientW}，画布 top ${v.canvasTop}px${v.overflow.length ? '｜溢出元素: ' + v.overflow.join('; ') : ''}` : '']);

  /* 17. 暗色 */
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await new Promise((r) => setTimeout(r, 500));
  await step('暗色主题', `
    var t = __S.gid('themeToggle');
    if (document.documentElement.getAttribute('data-theme') !== 'dark') t.click();
    await __S.sleep(600);
    PMRenderPreview();
    await __S.sleep(300);
    return { theme: document.documentElement.getAttribute('data-theme'),
             bg: getComputedStyle(document.body).backgroundColor };
  `, '11-dark.png', null,
    (v) => [v && v.theme === 'dark', v ? `data-theme=${v.theme}，body 背景 ${v.bg}` : '']);

  /* 收尾：页面错误汇总 */
  const errs = await evaluate(`window.__ERR.slice(0, 10)`);
  report.push({ title: '运行期 JS 错误', ok: !errs || !errs.length, note: errs && errs.length ? JSON.stringify(errs) : '零报错', shot: null, err: null, data: null });
  console.log(`${(!errs || !errs.length) ? 'PASS' : 'FAIL'}  运行期 JS 错误 — ${(!errs || !errs.length) ? '零报错' : JSON.stringify(errs)}`);

  /* ---------- 报告 ---------- */
  const pass = report.filter((r) => r.ok).length;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>图印工坊 · 冒烟测试报告 ${new Date().toISOString().slice(0, 10)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; padding:32px; background:#141414; color:#eaeaea; font:14px/1.7 "Microsoft YaHei",system-ui,sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; }
  .sub { color:#8c8c8c; margin-bottom:24px; font-size:13px; }
  .sum { display:inline-block; padding:4px 12px; border-radius:999px; background:#1e1e1e; border:1px solid #333; margin-bottom:24px; }
  .item { border-top:1px solid #262626; padding:18px 0; display:flex; gap:20px; flex-wrap:wrap; }
  .meta { flex:1 1 320px; min-width:280px; }
  .tag { display:inline-block; font-size:12px; padding:2px 9px; border-radius:4px; margin-right:8px; }
  .ok { background:#12351f; color:#5ddc8a; border:1px solid #235c37; }
  .no { background:#3a1618; color:#ff8a8a; border:1px solid #6b2626; }
  .title { font-weight:600; margin:6px 0; }
  .note { color:#9a9a9a; font-size:13px; }
  img { max-width:560px; width:100%; border:1px solid #2c2c2c; border-radius:6px; background:#1a1a1a; }
  .shotbox { flex:0 0 auto; }
  code { color:#c8b48a; }
</style></head><body>
<h1>图印工坊 · 功能冒烟测试</h1>
<div class="sub">真实 Chrome（CDP）· 底图 / 区域 / 5 种水印 / 字体 / 取色 / 批量生成 / 移动端 / 暗色</div>
<div class="sum">${pass} / ${report.length} 项通过</div>
${report.map((r) => `<div class="item">
  <div class="meta">
    <span class="tag ${r.ok ? 'ok' : 'no'}">${r.ok ? 'PASS' : 'FAIL'}</span>
    <div class="title">${r.title}</div>
    <div class="note">${r.note || ''}${r.err ? '<br><code>' + String(r.err).slice(0, 300) + '</code>' : ''}</div>
  </div>
  <div class="shotbox">${r.shot ? `<img src="${r.shot}" alt="${r.title}">` : ''}</div>
</div>`).join('\n')}
</body></html>`;
  fs.writeFileSync(path.join(OUT, 'report.html'), html);

  console.log(`\n${pass}/${report.length} 项通过 · 报告 ${path.join(OUT, 'report.html')}`);
  ws.close();
  process.exit(0);
})().catch((e) => { console.error('SMOKE FAIL:', e.message); process.exit(1); });
