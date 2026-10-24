/* ============================================================
   引导教学 · PMOnboard
   ------------------------------------------------------------
   设计原则：不教功能，只回答「我现在该干什么」。
   四层，从轻到重：
     ① 顶栏步骤条 —— 进度语义（已完成 ✓ / 当前 / 未开始）
     ② 画布空态引导卡 —— 没底图时直接给出第一步该做的事
     ③ 常驻「下一步」横条 —— 状态变了就变文案与按钮
     ④ 首次访问 4 步 Tour —— 只走一遍，localStorage 记住
   黑白风格：强调一律用反相实体，不引入任何彩色。
   ============================================================ */
(function () {
  'use strict';

  var ONBOARD_KEY = 'picmark-onboarded';

  function t(k, f) { return window.I18n ? window.I18n.t(k, f) : k; }
  function $(s) { return document.querySelector(s); }
  function byId(s) { return document.getElementById(s); }

  /* ---------- 状态 ---------- */
  function status() {
    var st = window.PMGetState ? window.PMGetState() : {};
    var layers = st.layerEditor ? st.layerEditor.getLayers() : [];
    var names = byId('namesInput');
    return {
      hasImage: !!st.sourceImage,
      hasLayers: layers.length > 0,
      hasNames: !!(names && names.value.trim()),
      touched: !!st.layerTouched,
      hasResult: document.querySelectorAll('#previewList img').length > 0
    };
  }

  /* ---------- ① 顶栏步骤条 ---------- */
  function renderSteps(s) {
    var doneMap = { cardCanvas: s.hasImage, cardNames: s.hasNames, cardGenerate: s.hasResult };
    var cur = !s.hasImage ? 'cardCanvas' : (!s.hasNames ? 'cardNames' : 'cardGenerate');
    var nodes = document.querySelectorAll('.steps .step');
    for (var i = 0; i < nodes.length; i++) {
      var b = nodes[i];
      var key = b.getAttribute('data-target');
      var done = !!doneMap[key];
      b.classList.toggle('is-done', done);
      b.classList.toggle('is-active', key === cur && !s.hasResult);
      var num = b.querySelector('i');
      if (num) num.textContent = done ? '\u2713' : (b.getAttribute('data-step') || '');
    }
  }

  /* ---------- ② 画布空态引导卡 ---------- */
  function renderCard(s) {
    var card = byId('guideCard');
    var canvas = byId('previewCanvas');
    if (!card) return;
    var show = !s.hasImage;
    card.hidden = !show;
    if (canvas) canvas.style.display = show ? 'none' : '';
    var mk = byId('marker');
    if (mk) mk.style.display = 'none';
  }

  /* ---------- ③ 常驻「下一步」横条 ---------- */
  function renderNext(s) {
    var box = byId('nextStep');
    if (!box) return;
    if (s.hasResult) { box.hidden = true; return; }
    box.hidden = false;

    var n, key, btns;
    if (!s.hasImage) {
      n = '01'; key = 'guide.next.1';
      btns = [{ k: 'guide.btn.upload', fn: pickImage }, { k: 'guide.btn.sample', fn: loadSample, ghost: true }];
    } else if (!s.touched && !s.hasNames) {
      n = '02'; key = 'guide.next.2';
      btns = [{ k: 'guide.btn.region', fn: useRegion }];
    } else if (!s.hasNames) {
      n = '03'; key = 'guide.next.3';
      btns = [{ k: 'guide.btn.names', fn: gotoNames }];
    } else {
      n = '03';
      /* 名单齐了就能出图；没手动定过位置时，顺带提醒默认位置可拖 */
      key = s.touched ? 'guide.next.4' : 'guide.next.4b';
      btns = [{ k: 'guide.btn.generate', fn: doGenerate }];
    }

    var numEl = box.querySelector('.next-step-n');
    var textEl = box.querySelector('.next-step-text');
    var actEl = box.querySelector('.next-step-actions');
    if (numEl) numEl.textContent = n;
    if (textEl) textEl.textContent = t(key);
    if (!actEl) return;
    actEl.innerHTML = '';
    btns.forEach(function (b) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = b.ghost ? 'next-btn is-ghost' : 'next-btn';
      el.textContent = t(b.k);
      el.addEventListener('click', b.fn);
      actEl.appendChild(el);
    });
  }

  function refresh() {
    var s = status();
    renderSteps(s);
    renderCard(s);
    renderNext(s);
  }

  /* ---------- 动作 ---------- */
  function pickImage() { var i = byId('templateInput'); if (i) i.click(); }

  function useRegion() {
    var btn = document.querySelector('.mode-btn[data-tool="region"]');
    if (btn) btn.click();
    goto('cardCanvas');
  }

  function gotoNames() {
    goto('cardNames');
    var n = byId('namesInput');
    if (n) setTimeout(function () { n.focus(); }, 320);
  }

  function doGenerate() {
    goto('cardGenerate');
    var g = byId('generateBtn');
    if (g && !g.disabled) g.click();
  }

  function goto(id) {
    var el = byId(id);
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.scrollY - stickyOffset();
    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  /* 吸顶条高度由 JS 实测写入 --rail-sticky-top，这里直接复用 */
  function stickyOffset() {
    var cs = getComputedStyle(document.documentElement);
    var v = parseFloat(cs.getPropertyValue('--rail-sticky-top'));
    if (isFinite(v) && v > 0) return v + 16;
    return 90;
  }

  /* ---------- 示例：一键跑通全流程 ---------- */
  function sampleNames() {
    var en = document.documentElement.lang === 'en';
    return en ? 'Alice\nBob\nCarol' : '张三\n李四\n王五';
  }

  function makeSampleFile() {
    var W = 800, H = 1000;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var f = '"Microsoft YaHei", sans-serif';

    g.fillStyle = '#f3f1ec'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#1b1b1b'; g.lineWidth = 6;
    g.strokeRect(40, 40, W - 80, H - 80);
    g.lineWidth = 1.5; g.strokeRect(56, 56, W - 112, H - 112);

    g.textAlign = 'center';
    g.fillStyle = '#777'; g.font = '500 20px ' + f;
    g.fillText('PICMARK STUDIO', W / 2, 132);
    g.fillStyle = '#111'; g.font = '700 74px ' + f;
    g.fillText(t('guide.sample.title', '荣誉证书'), W / 2, 262);
    g.fillStyle = '#999'; g.font = '400 18px ' + f;
    g.fillText('CERTIFICATE OF HONOR', W / 2, 312);
    g.fillStyle = '#3a3a3a'; g.font = '400 30px ' + f;
    g.fillText(t('guide.sample.award', '兹 颁 发 给'), W / 2, 470);

    /* 姓名落位提示线：默认图层会被摆到这条线上方 */
    g.strokeStyle = '#c6c1b8'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(190, 648); g.lineTo(610, 648); g.stroke();

    g.fillStyle = '#3a3a3a'; g.font = '400 26px ' + f;
    g.fillText(t('guide.sample.sign', '图印工坊 · 示例'), W / 2, 838);
    g.fillStyle = '#9a9a9a'; g.font = '400 18px ' + f;
    g.fillText('2026', W / 2, 878);

    return new Promise(function (res) {
      c.toBlob(function (b) {
        res(new File([b], 'sample-certificate.png', { type: 'image/png' }));
      }, 'image/png');
    });
  }

  function loadSample() {
    var btn = byId('guideSample');
    if (btn) { btn.disabled = true; btn.textContent = t('guide.sample.loading', '生成中…'); }

    makeSampleFile().then(function (file) {
      var input = byId('templateInput');
      if (input) {
        try {
          var dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event('change'));
        } catch (e) {
          /* 少数环境不允许直接写 input.files，退化：至少把名单填好 */
          if (window.console) console.warn('[PMOnboard] cannot set input.files:', e && e.message);
        }
      }
      var names = byId('namesInput');
      if (names) {
        names.value = sampleNames();
        names.dispatchEvent(new Event('input'));
      }
      afterImage(function (st) {
        tuneSampleLayer(st);
        if (btn) { btn.disabled = false; btn.textContent = t('guide.card.sample'); }
      });
    });
  }

  function afterImage(cb) {
    var n = 0;
    (function wait() {
      var st = window.PMGetState ? window.PMGetState() : {};
      if (st.sourceImage && st.layerEditor) return cb(st);
      if (++n > 200) return;
      setTimeout(wait, 50);
    })();
  }

  /* 把示例的第一个文字图层摆到证书姓名线上，让效果一眼可见 */
  function tuneSampleLayer(st) {
    var ls = st.layerEditor.getLayers();
    if (!ls.length) return;
    var l = ls[0];
    var W = st.sourceImage.width;
    var H = st.sourceImage.height;
    var k = H / 1000; /* 示例图按 1000 高设计，等比换算 */
    l.name = t('guide.sample.layer', '姓名');
    l.mode = 'point';
    l.x = Math.round(W / 2);
    l.y = Math.round(540 * k);
    l.align = 'center';
    l.fontSize = Math.max(24, Math.round(64 * k));
    if (st.layerEditor.setActive) st.layerEditor.setActive(l.id);
    if (window.PMPanelRender) window.PMPanelRender();
    if (window.PMRenderPreview) window.PMRenderPreview();
    refresh();
  }

  /* ---------- ④ 首次访问 Tour ---------- */
  var TOUR = [
    { sel: '#dropZone', key: 'guide.tour.1' },
    { sel: '.mode-switch', key: 'guide.tour.2' },
    { sel: '#namesInput', key: 'guide.tour.3' },
    { sel: '#generateBtn', key: 'guide.tour.4' }
  ];
  var tourIdx = -1;
  var tourOn = false;

  function tourBubble() { return byId('tourBubble'); }

  function startTour() {
    tourOn = true;
    tourIdx = 0;
    var b = tourBubble();
    if (b) b.hidden = false;
    showStep();
  }

  function endTour(remember) {
    tourOn = false;
    var b = tourBubble();
    if (b) b.hidden = true;
    clearHl();
    if (remember !== false) {
      try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (e) {}
    }
  }

  function clearHl() {
    var hl = document.querySelectorAll('.tour-hl');
    for (var i = 0; i < hl.length; i++) hl[i].classList.remove('tour-hl');
  }

  function showStep() {
    var step = TOUR[tourIdx];
    if (!step) return endTour();
    var target = $(step.sel);
    var b = tourBubble();
    if (!target || !b) return endTour();

    clearHl();
    target.classList.add('tour-hl');
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });

    var text = b.querySelector('.tour-text');
    var count = b.querySelector('.tour-count');
    var next = b.querySelector('.tour-next');
    if (text) text.textContent = t(step.key);
    if (count) count.textContent = t('guide.tour.count', { i: tourIdx + 1, n: TOUR.length });
    if (next) next.textContent = (tourIdx === TOUR.length - 1) ? t('guide.tour.done') : t('guide.tour.next');

    setTimeout(function () { placeBubble(target); }, 340);
    setTimeout(function () { if (tourOn) placeBubble(target); }, 700);
  }

  function placeBubble(target) {
    var b = tourBubble();
    if (!b || !target) return;
    var r = target.getBoundingClientRect();
    var bw = b.offsetWidth, bh = b.offsetHeight;
    var top = r.bottom + 14;
    if (top + bh > window.innerHeight - 12) top = Math.max(12, r.top - bh - 14);
    var left = r.left + r.width / 2 - bw / 2;
    left = Math.min(Math.max(12, left), Math.max(12, window.innerWidth - bw - 12));
    b.style.top = Math.round(top) + 'px';
    b.style.left = Math.round(left) + 'px';
  }

  function tourNext() {
    if (tourIdx >= TOUR.length - 1) return endTour();
    tourIdx++;
    showStep();
  }

  function seen() {
    try { return localStorage.getItem(ONBOARD_KEY) === '1'; } catch (e) { return false; }
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    var up = byId('guideUpload');
    if (up) up.addEventListener('click', pickImage);
    var sm = byId('guideSample');
    if (sm) sm.addEventListener('click', loadSample);

    var gb = byId('guideBtn');
    if (gb) gb.addEventListener('click', function () { startTour(); });

    var b = tourBubble();
    if (b) {
      var nx = b.querySelector('.tour-next');
      var sk = b.querySelector('.tour-skip');
      if (nx) nx.addEventListener('click', tourNext);
      if (sk) sk.addEventListener('click', function () { endTour(); });
    }

    /* 点画布任意处（非引导控件）时收掉 tour，避免挡住操作 */
    document.addEventListener('pointerdown', function (e) {
      if (!tourOn) return;
      if (b && b.contains(e.target)) return;
      endTour();
    }, true);

    /* 语言切换后重刷文案（引导条文字是 JS 生成的，不在 data-i18n 上） */
    window.addEventListener('i18n:change', function () {
      refresh();
      if (tourOn && tourIdx >= 0) showStep();
    });
    window.addEventListener('scroll', function () {
      if (tourOn && tourIdx >= 0) {
        var tg = $(TOUR[tourIdx].sel);
        if (tg) placeBubble(tg);
      }
    }, { passive: true });
  }

  function init() {
    bind();
    refresh();
    if (!seen()) setTimeout(startTour, 700);
  }

  window.PMOnboard = {
    init: init,
    refresh: refresh,
    startTour: startTour,
    endTour: endTour,
    reset: function () { try { localStorage.removeItem(ONBOARD_KEY); } catch (e) {} }
  };

  /* 自启动：本脚本排在 app.js 之后，app 已初始化完毕（PMGetState 等已就绪）。
     反过来让 app.js 调 init 是行不通的——它执行时本脚本还没加载。 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
