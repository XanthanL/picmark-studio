/* 引导教学截图：① 首访空态（引导卡 + 下一步横条 + Tour 气泡）
   ② 点「用示例试试」之后（底图 + 图层 + 横条推进） */
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
const URL = 'http://127.0.0.1:8766/index.html';

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
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.result.value;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  await new Promise((r) => ws.addEventListener('open', r));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1080, deviceScaleFactor: 1, mobile: false });

  /* ① 首访：清掉「已看过」标记再看空态 + tour */
  await send('Page.navigate', { url: URL + '?_cb=' + Date.now() });
  await wait(1200);
  await ev("try{localStorage.removeItem('picmark-onboarded')}catch(e){}");
  await send('Page.navigate', { url: URL + '?_cb=' + Date.now() });
  await wait(2400);
  let s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('.workbuddy/shot-guide-1.png', Buffer.from(s.result.data, 'base64'));
  console.log('shot 1: tour=' + (await ev("!document.getElementById('tourBubble').hidden")));

  /* 关掉 tour，截一张纯空态（引导卡 + 横条） */
  await ev("window.PMOnboard.endTour()");
  await wait(400);
  s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('.workbuddy/shot-guide-2.png', Buffer.from(s.result.data, 'base64'));
  console.log('shot 2: empty state');

  /* ② 跑示例 */
  await ev("document.getElementById('guideSample').click()");
  await wait(3500);
  await ev("window.scrollTo(0,0)");
  await wait(600);
  s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('.workbuddy/shot-guide-3.png', Buffer.from(s.result.data, 'base64'));
  console.log('shot 3: sample loaded, next=' + (await ev("document.querySelector('.next-step-text').textContent")));

  ws.close();
  process.exit(0);
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
