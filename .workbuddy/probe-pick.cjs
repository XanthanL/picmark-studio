/* 取色端到端探针：造一张已知颜色的底图 → 切取色工具 → 在指定图像坐标派发 pointerdown，
   断言取到的 hex 与预期一致，且颜色真的写进了文字图层。
   用 CDP 真实等待（虚拟时钟会跑飞图片解码）。用法：
     node .workbuddy/probe-pick.cjs http://127.0.0.1:8765/index.html
   依赖：本地 HTTP 服务 + Chrome --remote-debugging-port=9222 */
const http = require('http');

function getJson(path) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: 9222, path }, (r) => {
      let b = '';
      r.on('data', (d) => (b += d));
      r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

const EXPR = `(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const out = { steps: [] };

  /* 400x300：左半红 / 右半蓝 / 底部一条绿 */
  const c = document.createElement('canvas');
  c.width = 400; c.height = 300;
  const g = c.getContext('2d');
  g.fillStyle = '#e30613'; g.fillRect(0, 0, 200, 300);
  g.fillStyle = '#0b5cd5'; g.fillRect(200, 0, 200, 300);
  g.fillStyle = '#00a86b'; g.fillRect(0, 270, 400, 30);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], 'probe.png', { type: 'image/png' });
  const dt = new DataTransfer();
  dt.items.add(file);
  const input = document.getElementById('templateInput');
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));

  for (let i = 0; i < 100 && !PMGetState().sourceImage; i++) await sleep(100);
  const st = PMGetState();
  out.hasImage = !!st.sourceImage;
  out.imgSize = st.sourceImage ? [st.sourceImage.width, st.sourceImage.height] : null;
  if (!out.hasImage) return out;

  document.querySelector('.mode-btn[data-tool="pick"]').click();
  const cv = document.getElementById('previewCanvas');

  function pickAt(ix, iy) {
    const r = cv.getBoundingClientRect();
    const vs = r.width / st.sourceImage.width;
    cv.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: r.left + ix * vs, clientY: r.top + iy * vs,
      button: 0, buttons: 1, bubbles: true, cancelable: true
    }));
    return document.getElementById('fontColor').value;
  }

  const before = JSON.parse(JSON.stringify(PMGetState().layers.map(l => ({ id: l.id, x: l.x, y: l.y }))));
  const activeBefore = PMGetState().layerEditor ? PMGetState().layerEditor.activeId : null;

  out.pickRed = pickAt(100, 100);
  out.layerColorAfterRed = (PMGetState().layers.find(l => l.type === 'text') || {}).color;
  out.pickBlue = pickAt(300, 100);
  out.pickGreen = pickAt(200, 285);
  out.hint = document.getElementById('modeHint').textContent;
  out.badge = document.getElementById('colorValue').textContent;

  /* 放大到 200% 后再取一次：CSS 拉伸下坐标不能漂 */
  const zr = document.getElementById('zoomRange');
  zr.value = String(zr.max);
  zr.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(400);
  out.zoom = document.getElementById('zoomValue').textContent;
  out.drawScale = PMGetState().drawScale;
  out.previewScale = PMGetState().previewScale;
  out.pickRedZoomed = pickAt(100, 100);
  out.pickGreenZoomed = pickAt(200, 285);

  const after = PMGetState().layers.map(l => ({ id: l.id, x: l.x, y: l.y }));
  out.layersMoved = JSON.stringify(after) !== JSON.stringify(before);
  const activeAfter = PMGetState().layerEditor ? PMGetState().layerEditor.activeId : null;
  out.selectionChanged = activeBefore !== activeAfter;

  /* 回归：切回「选择」后，拖动仍能移动文字图层（取色模式不能污染正常编辑） */
  document.querySelector('.mode-btn[data-tool="select"]').click();
  zr.value = String(Math.round((Number(zr.min) + Number(zr.max)) / 2));
  zr.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(300);
  const l0 = PMGetState().layers.find(x => x.type === 'text');
  /* 用编辑器自己的换算与包围盒中心，避免探针自己算的缩放与 viewScale 有浮点差 */
  const ed0 = PMGetState().layerEditor;
  const box0 = ed0.boxOf(l0);
  const r2 = cv.getBoundingClientRect();
  const vs2 = ed0.viewScale;
  const sx = r2.left + (box0.x + box0.w / 2) * vs2;
  const sy = r2.top + (box0.y + box0.h / 2) * vs2;
  out.dragBefore = [l0.x, l0.y];
  const ed = PMGetState().layerEditor;
  out.diag = {
    mode: ed.getMode(),
    viewScale: ed.viewScale,
    drawScale: ed.drawScale,
    box: ed.boxOf(l0),
    hit: JSON.stringify(ed._hitTest({ x: l0.x, y: l0.y })),
    rect: [Math.round(r2.left), Math.round(r2.top), Math.round(r2.width), Math.round(r2.height)],
    vs2: vs2,
    at: [Math.round(sx), Math.round(sy)],
    edSize: [ed.width, ed.height]
  };
  cv.dispatchEvent(new MouseEvent('mousedown', { clientX: sx, clientY: sy, button: 0, bubbles: true }));
  out.dragAfterDown = JSON.stringify(ed.drag && { type: ed.drag.type, id: ed.drag.id, start: ed.drag.start });
  cv.dispatchEvent(new MouseEvent('mousemove', { clientX: sx + 40, clientY: sy + 30, button: 0, bubbles: true }));
  out.afterMove = [PMGetState().layers.find(x => x.type === 'text').x, PMGetState().layers.find(x => x.type === 'text').y];
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  await sleep(200);
  const l1 = PMGetState().layers.find(x => x.type === 'text');
  out.dragAfter = [l1.x, l1.y];
  return out;
})()`;

(async () => {
  const url = process.argv[2];
  const list = await getJson('/json/list');
  const target = list.find((t) => t.type === 'page');
  if (!target) throw new Error('no page target');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params) => new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  });

  await new Promise((res) => ws.addEventListener('open', res));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: url + (url.includes('?') ? '&' : '?') + '_cb=' + Date.now() });
  await new Promise((r) => setTimeout(r, 1500));

  const r = await send('Runtime.evaluate', { expression: EXPR, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) {
    console.log('EXCEPTION:', JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails));
  } else {
    const v = r.result && r.result.result && r.result.result.value;
    console.log(JSON.stringify(v, null, 2));
    const ok = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
    const checks = [
      ['底图已加载', v.hasImage === true],
      ['取红 #e30613', ok(v.pickRed, '#e30613')],
      ['取蓝 #0b5cd5', ok(v.pickBlue, '#0b5cd5')],
      ['取绿 #00a86b', ok(v.pickGreen, '#00a86b')],
      ['颜色写进文字图层', ok(v.layerColorAfterRed, '#e30613')],
      ['色值 badge 同步', ok(v.badge, '#00A86B')],
      ['放大后仍能取红', ok(v.pickRedZoomed, '#e30613')],
      ['放大后仍能取绿', ok(v.pickGreenZoomed, '#00a86b')],
      ['取色不移动图层', v.layersMoved === false],
      ['取色不改选中态', v.selectionChanged === false],
      ['回归：选择模式仍可拖动', Array.isArray(v.dragAfter) && v.dragAfter[0] > v.dragBefore[0]]
    ];
    let bad = 0;
    checks.forEach(([n, p]) => { if (!p) bad++; console.log((p ? 'PASS ' : 'FAIL ') + n); });
    console.log(bad ? `\n${bad} 项失败` : '\n全部通过');
  }
  ws.close();
  process.exit(0);
})().catch((e) => { console.error('CDP FAIL:', e.message); process.exit(1); });
