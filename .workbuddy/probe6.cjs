/* 生成 probe6.html：引导教学端到端探针
   断言链：空态引导卡 → 步骤条进度 → 示例一键跑通 → 动图层 → 出图 → 引导条收起 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const probe = `
<script>
window.__ERR = [];
window.addEventListener('error', function (e) { window.__ERR.push('error: ' + e.message); });
window.addEventListener('unhandledrejection', function (e) { window.__ERR.push('reject: ' + (e.reason && e.reason.message)); });
window.__ZIP = null;
window.saveAs = function (blob, name) { window.__ZIP = { size: blob.size, name: name }; };

(async function () {
  var out = [];
  window.__LOG = out;
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var $ = function (s) { return document.querySelector(s); };

  function snap(tag) {
    var steps = Array.from(document.querySelectorAll('.steps .step')).map(function (b) {
      return b.getAttribute('data-step') + ':' + (b.classList.contains('is-done') ? 'done' : (b.classList.contains('is-active') ? 'ACTIVE' : 'todo'));
    }).join(' ');
    var ns = document.getElementById('nextStep');
    var act = ns ? Array.from(ns.querySelectorAll('.next-btn')).map(function (b) { return b.textContent; }).join('/') : '';
    out.push(tag + ' :: card=' + (document.getElementById('guideCard').hidden ? 'hidden' : 'SHOWN')
      + ' :: next=' + (ns.hidden ? 'hidden' : (ns.querySelector('.next-step-n').textContent + ' | ' + ns.querySelector('.next-step-text').textContent + ' | [' + act + ']'))
      + ' :: steps=' + steps);
  }

  await sleep(1400);
  snap('01-init');

  /* Tour：首次访问应自动出现；若环境里已看过，手动唤起一次同样要能用 */
  var bubble = document.getElementById('tourBubble');
  out.push('02-tourAuto=' + (bubble.hidden ? 'no' : 'YES'));
  if (bubble.hidden) { window.PMOnboard.startTour(); await sleep(500); }
  out.push('03-tourShown=' + (bubble.hidden ? 'no' : 'YES')
    + ' :: text=' + ($('.tour-text') && $('.tour-text').textContent.slice(0, 18))
    + ' :: count=' + ($('.tour-count') && $('.tour-count').textContent)
    + ' :: hl=' + document.querySelectorAll('.tour-hl').length);
  $('.tour-next').click();
  await sleep(500);
  out.push('04-tourStep2 :: count=' + $('.tour-count').textContent + ' :: hl=' + ($('.tour-hl') && $('.tour-hl').id ? $('.tour-hl').id : $('.tour-hl') && $('.tour-hl').className));
  $('.tour-skip').click();
  await sleep(300);
  out.push('05-tourClosed=' + (bubble.hidden ? 'YES' : 'no') + ' :: hlLeft=' + document.querySelectorAll('.tour-hl').length);

  /* 示例一键跑通 */
  document.getElementById('guideSample').click();
  for (var i = 0; i < 150; i++) {
    await sleep(100);
    if (document.getElementById('guideCard').hidden) break;
  }
  await sleep(600);
  snap('06-afterSample');
  var ti = document.getElementById('templateInput');
  out.push('06b-files=' + (ti && ti.files ? ti.files.length : -1)
    + ' :: imageInfo=' + (document.getElementById('imageInfo').textContent || '(empty)')
    + ' :: canvasW=' + document.getElementById('previewCanvas').width
    + ' :: err=' + JSON.stringify(window.__ERR.slice(0, 3)));
  var st = window.PMGetState();
  out.push('07-img=' + (st.sourceImage ? st.sourceImage.width + 'x' + st.sourceImage.height : 'none')
    + ' :: layers=' + (st.layerEditor ? st.layerEditor.getLayers().length : 0)
    + ' :: namesLen=' + document.getElementById('namesInput').value.trim().length
    + ' :: touched=' + !!st.layerTouched);

  /* 清空名单：应当回落到「第 2 步 · 框出名字位置」（默认图层不算动过） */
  var ni = document.getElementById('namesInput');
  ni.value = '';
  ni.dispatchEvent(new Event('input'));
  await sleep(250);
  snap('07b-namesCleared');

  ni.value = '张三\\n李四';
  ni.dispatchEvent(new Event('input'));
  await sleep(250);
  snap('07c-namesBack');

  /* 模拟用户真的动过图层（走 app.js 的 onChange 路径） */
  var ed = st.layerEditor;
  var l = ed.getLayers()[0];
  l.x += 12;
  ed.onChange(ed.layers);
  await sleep(200);
  snap('08-afterTouch');
  out.push('08b-touched=' + !!window.PMGetState().layerTouched);

  /* 出图 */
  document.getElementById('generateBtn').click();
  for (var j = 0; j < 200; j++) {
    await sleep(100);
    if (window.__ZIP) break;
  }
  await sleep(400);
  snap('09-afterGenerate');
  out.push('10-zip=' + (window.__ZIP ? window.__ZIP.size + 'B ' + window.__ZIP.name : 'NONE')
    + ' :: thumbs=' + document.querySelectorAll('#previewList img').length);

  /* 顶栏问号能重新唤起 */
  window.PMOnboard.startTour();
  await sleep(400);
  out.push('11-restart=' + (bubble.hidden ? 'no' : 'YES'));
  window.PMOnboard.endTour();

  out.push('ERR=' + JSON.stringify(window.__ERR.slice(0, 5)));
  window.__RESULT = out.join('\\n');
})();
</script>
`;

fs.writeFileSync(path.join(__dirname, '..', 'probe6.html'), html.replace('</body>', probe + '\n</body>'), 'utf8');
console.log('probe6.html written');
