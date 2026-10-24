/* 开源网络字体（按需懒加载）
 * ------------------------------------------------------------------
 * 中文字体动辄 2–10 MB，不能打进静态包，也不能在页面加载时全部拉取。
 * 这里的策略：用户选中某一款时才 fetch 它的 woff2，用 FontFace 注册到
 * 主线程（供预览），同时把 ArrayBuffer 留着——出图时按现有「自定义字体」
 * 的做法一并传给 Worker，保证预览与成品用同一份字形数据。
 *
 * 全部来自 Google Fonts 的开源字体（SIL OFL 1.1，可商用），
 * 经 jsDelivr 的 @fontsource 镜像分发，无需自建 CDN。
 *
 * 断网 / CDN 不可达时不能让界面卡住：ensure() 返回 null，调用方退回到
 * 该字体对应的系统字体栈，并提示用户。
 */
(function (root) {
  'use strict';

  var BASE = 'https://cdn.jsdelivr.net/npm/@fontsource/';
  var TIMEOUT_MS = 25000;

  /* family 一律用无空格的 PM* 前缀，避免进 ctx.font 时还要处理引号 */
  var LIST = [
    {
      id: 'mashanzheng', pkg: 'ma-shan-zheng', family: 'PMMaShanZheng',
      zh: '马善政毛笔楷书', en: 'Ma Shan Zheng brush kai',
      hint: '毛笔楷书', fallback: 'KaiTi, Kaiti SC, STKaiti, serif'
    },
    {
      id: 'zhimangxing', pkg: 'zhi-mang-xing', family: 'PMZhiMangXing',
      zh: '志莽行书', en: 'Zhi Mang Xing',
      hint: '毛笔行书', fallback: 'STXingkai, Xingkai SC, cursive'
    },
    {
      id: 'liujianmaocao', pkg: 'liu-jian-mao-cao', family: 'PMLiuJianMaoCao',
      zh: '柳建草书', en: 'Liu Jian Mao Cao',
      hint: '草书', fallback: 'STXingkai, Xingkai SC, cursive'
    },
    {
      id: 'longcang', pkg: 'long-cang', family: 'PMLongCang',
      zh: '龙藏体', en: 'Long Cang',
      hint: '硬笔手写', fallback: 'KaiTi, Kaiti SC, serif'
    },
    {
      id: 'zcoolxiaowei', pkg: 'zcool-xiaowei', family: 'PMZcoolXiaowei',
      zh: '站酷小薇', en: 'ZCOOL XiaoWei',
      hint: '宋味标题', fallback: 'SimSun, Songti SC, serif'
    },
    {
      id: 'zcoolqingke', pkg: 'zcool-qingke-huangyou', family: 'PMZcoolQingke',
      zh: '站酷庆科黄油体', en: 'ZCOOL QingKe HuangYou',
      hint: '圆润标题', fallback: 'YouYuan, Yuanti SC, sans-serif'
    },
    {
      id: 'notoserifsc', pkg: 'noto-serif-sc', family: 'PMNotoSerifSC',
      zh: '思源宋体', en: 'Noto Serif SC',
      hint: '宋体 · 文件较大', fallback: 'SimSun, Songti SC, serif'
    }
  ];

  var byId = {};
  LIST.forEach(function (f) {
    f.url = BASE + f.pkg + '/files/' + f.pkg + '-chinese-simplified-400-normal.woff2';
    byId[f.id] = f;
  });

  var cache = {};      /* id → { family, buffer } */
  var pending = {};    /* id → Promise */
  var failed = {};     /* id → true */
  var registered = {}; /* id → true，已加进 document.fonts */

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
      promise.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }

  function fetchFont(f) {
    if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch'));
    return withTimeout(fetch(f.url, { mode: 'cors', cache: 'force-cache' }), TIMEOUT_MS)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.arrayBuffer();
      });
  }

  /* 注意：不能用 document.fonts.check() 当「是否已注册」的判据——
     Chrome 对没注册过的字体名也返回 true（它会把系统兜底算进去），
     用它做守卫会导致 add() 永远不执行，字形成了「下载了但没生效」。
     这里自己记一笔 registered。 */
  function register(f, buffer) {
    if (typeof FontFace !== 'function') return Promise.resolve();
    if (registered[f.id]) return Promise.resolve();
    var face = new FontFace(f.family, buffer);
    return face.load().then(function () {
      try {
        if (root.document && root.document.fonts) root.document.fonts.add(face);
        registered[f.id] = true;
      } catch (e) { /* 同名同描述符已存在，忽略 */ }
    });
  }

  function ensure(id) {
    if (cache[id]) return Promise.resolve(cache[id]);
    var f = byId[id];
    if (!f) return Promise.resolve(null);
    if (failed[id]) return Promise.resolve(null);
    if (!pending[id]) {
      pending[id] = fetchFont(f)
        .then(function (buffer) { return register(f, buffer).then(function () { return buffer; }); })
        .then(function (buffer) {
          cache[id] = { family: f.family, buffer: buffer, id: id };
          delete pending[id];
          return cache[id];
        })
        .catch(function (err) {
          delete pending[id];
          failed[id] = true;
          console.warn('[PicMark] web font load failed:', id, err && err.message);
          return null;
        });
    }
    return pending[id];
  }

  root.PMWebFonts = {
    list: LIST,
    isWebValue: function (v) { return typeof v === 'string' && v.indexOf('web:') === 0; },
    idOf: function (v) { return this.isWebValue(v) ? v.slice(4) : null; },
    valueOf: function (id) { return 'web:' + id; },
    byId: function (id) { return byId[id] || null; },
    labelOf: function (id, lang) {
      var f = byId[id];
      if (!f) return id;
      return (lang === 'en' ? f.en : f.zh) || id;
    },
    /* 已加载 → 真实 family；未加载 → 系统兜底栈（保证任何时刻都有可用字体） */
    familyOf: function (id) {
      if (cache[id]) return cache[id].family;
      var f = byId[id];
      return f ? f.fallback : 'sans-serif';
    },
    fallbackOf: function (id) {
      var f = byId[id];
      return f ? f.fallback : 'sans-serif';
    },
    isReady: function (id) { return !!cache[id]; },
    didFail: function (id) { return !!failed[id]; },
    /* 出图用：把「正在使用的」网络字体字形数据交给 Worker */
    payload: function (ids) {
      var out = [];
      (ids || []).forEach(function (id) {
        if (cache[id]) out.push({ family: cache[id].family, buffer: cache[id].buffer });
      });
      return out;
    },
    ensure: ensure,
    ensureAll: function (ids) {
      return Promise.all((ids || []).map(ensure));
    }
  };
})(typeof window !== 'undefined' ? window : this);
