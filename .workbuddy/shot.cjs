/* CDP 截图：等页面标记 ready（window.__RESULT）后再拍，避免拍到加载中 */
const http = require('http');
const fs = require('fs');

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
const outFile = process.argv[3];
const w = parseInt(process.argv[4] || '1440', 10);
const h = parseInt(process.argv[5] || '900', 10);

(async () => {
  const list = await getJson('/json/list');
  const target = list.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params) => new Promise((res) => {
    const i = ++id; pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  await new Promise((res) => ws.addEventListener('open', res));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
  await send('Page.navigate', { url: url + (url.includes('?') ? '&' : '?') + '_cb=' + Date.now() });

  for (let i = 0; i < 300; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const r = await send('Runtime.evaluate', { expression: '!!window.__RESULT', returnByValue: true });
    if (r.result && r.result.result && r.result.result.value) break;
  }
  await new Promise((r) => setTimeout(r, 600));
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(outFile, Buffer.from(shot.result.data, 'base64'));
  console.log('shot ->', outFile);
  ws.close();
  process.exit(0);
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
