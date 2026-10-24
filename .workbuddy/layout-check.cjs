/* 数值化验证：图层面板双栏 + 列表不被吸顶工具条遮挡 */
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

  for (const vw of [1440, 1280, 1024, 900, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width: vw, height: 900, deviceScaleFactor: 1, mobile: vw < 500 });
    await send('Page.navigate', { url: 'http://127.0.0.1:8765/probe5.html?_cb=' + Date.now() });
    for (let i = 0; i < 200; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const r = await send('Runtime.evaluate', { expression: '!!window.__RESULT', returnByValue: true });
      if (r.result.result.value) break;
    }
    await send('Runtime.evaluate', { expression: "var w=document.getElementById('canvasWrapper'); w.style.maxHeight='420px'; window.dispatchEvent(new Event('resize'));", returnByValue: true });
    await new Promise((r) => setTimeout(r, 400));
    await send('Runtime.evaluate', { expression: "document.getElementById('layerPanel').scrollIntoView({block:'start'}); window.scrollBy(0,-40);", returnByValue: true });
    await new Promise((r) => setTimeout(r, 300));
    const r = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: [
        '(function(){',
        '  var l=document.getElementById("layerList"), rail=document.querySelector(".rail"), c=document.getElementById("layerConfig");',
        '  var lr=l.getBoundingClientRect(), rr=rail?rail.getBoundingClientRect():{bottom:0}, cr=c.getBoundingClientRect();',
        '  var px=Math.round(lr.left+lr.width/2), py=Math.round(lr.top+lr.height/2);',
        '  var hit=document.elementFromPoint(px,py);',
        '  var inList = !!(hit && (hit.closest("#layerList")));',
        '  var doc=document.documentElement;',
        '  return JSON.stringify({',
        '    cols:getComputedStyle(document.getElementById("layerPanel")).gridTemplateColumns,',
        '    listTop:Math.round(lr.top), listW:Math.round(lr.width),',
        '    railBottom:Math.round(rr.bottom),',
        '    cfgLeft:Math.round(cr.left),',
        '    listVisible: inList,',
        '    hOverflow: doc.scrollWidth - doc.clientWidth',
        '  });',
        '})()'
      ].join('\n')
    });
    console.log('vw=' + vw, r.result.result.value);
  }
  ws.close();
  process.exit(0);
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
