/* 引导教学的多视口数值断言：
   无横向溢出 / 空态卡可见 / 「下一步」横条可见 / Tour 气泡落在视口内 */
const http = require('http');
function getJson(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: 9222, path: p }, (r) => {
      let b = '';
      r.on('data', (d) => (b += d));
      r.on('end', () => res(JSON.parse(b)));
    }).on('error', rej);
  });
}

const EXPR = `(function(){
  var doc = document.documentElement;
  var card = document.getElementById('guideCard');
  var ns = document.getElementById('nextStep');
  var bb = document.getElementById('tourBubble');
  var cr = card.getBoundingClientRect(), nr = ns.getBoundingClientRect(), br = bb.getBoundingClientRect();
  function inView(r) {
    return r.width > 0 && r.height > 0 &&
      r.left >= -1 && r.top >= -1 &&
      r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1;
  }
  return JSON.stringify({
    hOverflow: doc.scrollWidth - doc.clientWidth,
    cardShown: !card.hidden && cr.height > 4,
    cardH: Math.round(cr.height),
    nextShown: !ns.hidden && nr.height > 4,
    nextH: Math.round(nr.height),
    nextBtns: ns.querySelectorAll('.next-btn').length,
    tourShown: !bb.hidden,
    tourInView: inView(br),
    tourBox: [Math.round(br.left), Math.round(br.top), Math.round(br.width), Math.round(br.height)]
  });
})()`;

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

  for (const vw of [1440, 1024, 768, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width: vw, height: vw < 500 ? 844 : 900, deviceScaleFactor: 1, mobile: vw < 500 });
    await send('Page.navigate', { url: 'http://127.0.0.1:8766/index.html?_cb=' + Date.now() });
    await new Promise((r) => setTimeout(r, 1600));
    /* 首次访问标记可能已存在，手动唤起 tour 以验证气泡定位 */
    await send('Runtime.evaluate', { expression: 'window.PMOnboard && window.PMOnboard.startTour()', returnByValue: true });
    await new Promise((r) => setTimeout(r, 900));
    const r = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true });
    console.log('vw=' + vw, r.result.result.value);
    await send('Runtime.evaluate', { expression: 'window.PMOnboard && window.PMOnboard.endTour()', returnByValue: true });
  }
  ws.close();
  process.exit(0);
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
