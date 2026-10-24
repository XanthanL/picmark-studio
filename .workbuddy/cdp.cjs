/* 用 CDP 真实等待页面异步完成，再取结果 —— 虚拟时钟会跑飞真异步，不能用 --virtual-time-budget */
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

const url = process.argv[2];
const expr = process.argv[3];

(async () => {
  // /json/new 在新版 Chrome 需要 PUT，直接复用已存在的页面 target 更省事
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

  // 等 load
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const r = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
    if (r.result && r.result.result && r.result.result.value === 'complete') break;
  }

  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) {
    console.log('EXCEPTION:', JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails));
  } else {
    console.log(r.result && r.result.result && r.result.result.value);
  }
  ws.close();
  process.exit(0);
})().catch((e) => { console.error('CDP FAIL:', e.message); process.exit(1); });
