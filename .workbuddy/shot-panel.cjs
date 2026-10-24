/* 压低画布后截取图层面板（验证桌面双栏布局） */
const http = require('http');
const fs = require('fs');
function getJson(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: 9222, path: p }, (r) => {
      let b = '';
      r.on('data', (d) => (b += d));
      r.on('end', () => res(JSON.parse(b)));
    }).on('error', rej);
  });
}
(async () => {
  const list = await getJson('/json/list');
  const t = list.find((x) => x.type === 'page');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0;
  const P = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && P.has(m.id)) { P.get(m.id)(m); P.delete(m.id); }
  });
  const send = (me, pa) => new Promise((r) => { const i = ++id; P.set(i, r); ws.send(JSON.stringify({ id: i, method: me, params: pa || {} })); });
  await new Promise((r) => ws.addEventListener('open', r));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1600, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:8766/probe5.html?_cb=' + Date.now() });
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const r = await send('Runtime.evaluate', { expression: '!!window.__RESULT', returnByValue: true });
    if (r.result.result.value) break;
  }
  const shrink = "var w=document.getElementById('canvasWrapper'); w.style.maxHeight='520px'; window.dispatchEvent(new Event('resize'));";
  await send('Runtime.evaluate', { expression: shrink, returnByValue: true });
  await new Promise((r) => setTimeout(r, 600));
  const scroll = "var p=document.getElementById('layerPanel'); p.scrollIntoView({block:'start'}); window.scrollBy(0,-70);";
  await send('Runtime.evaluate', { expression: scroll, returnByValue: true });
  await new Promise((r) => setTimeout(r, 400));
  const chk = await send('Runtime.evaluate', {
    expression: "JSON.stringify((function(){var p=document.getElementById('layerPanel');var l=document.getElementById('layerList');var c=document.getElementById('layerConfig');var cs=getComputedStyle(p);return {vw:innerWidth,display:cs.display,cols:cs.gridTemplateColumns,listX:Math.round(l.getBoundingClientRect().left),cfgX:Math.round(c.getBoundingClientRect().left),items:l.children.length};})())",
    returnByValue: true
  });
  console.log('layout:', chk.result.result.value);
  const s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('.workbuddy/shot-panel.png', Buffer.from(s.result.data, 'base64'));
  console.log('ok');
  ws.close();
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
