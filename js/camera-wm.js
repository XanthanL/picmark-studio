/* ============================================================
   图印工坊 · 相机水印（程序化生成）
   ------------------------------------------------------------
   把「相机 / 手机厂商那种带机型与镜头参数的水印」做成可选素材：
   不打包任何位图，全部用 canvas 按参数现画 —— 好处是任意分辨率都不糊、
   文件体积为零、文字可改、小程序端同一份代码能复用。
   canvas 由调用方通过 makeCanvas 提供（浏览器 document.createElement，
   小程序 wx.createOffscreenCanvas），所以这个文件不碰 DOM。

   模板只提供「中立排版」：圆标 / 方块标 / 竖条 / 纯字标 四种几何形态 ×
   衬线 / 无衬线 / 等宽 × 三档字距。不含任何品牌名、品牌色或品牌字标 ——
   商标归各自厂商，要复刻官方样式请自行上传 PNG，或把颜色字段改成你的品牌色。
   ============================================================ */
(function (root) {
  'use strict';

  var SANS = '"Helvetica Neue", Arial, "Segoe UI", system-ui, sans-serif';
  var SERIF = 'Didot, "Bodoni MT", Georgia, "Times New Roman", serif';
  var MONO = '"SF Mono", "Roboto Mono", Menlo, Consolas, "Courier New", monospace';

  /* 中性占位：明摆着是让你改的，不是任何人的商标 */
  var PH_BRAND = '';
  var PH_MODEL = 'MY CAMERA';
  var PH_LENS = '50mm f/1.4 · 1/500 · ISO 200';

  /* mark: dot 圆标 / square 圆角方块标 / bar 竖条 / none 纯文字
     tracking: 字距（em 倍数）；ratio: 徽标直径或块高（画布高的倍数）
     barW: bar 形态下竖条粗细（画布高的倍数） */
  var STYLES = [
    { id: 'dot-serif', zh: '圆标 · 衬线', en: 'Dot · Serif', face: SERIF,
      mark: 'dot', ratio: 0.72, tracking: 0.03 },
    { id: 'dot-sans', zh: '圆标 · 无衬线', en: 'Dot · Sans', face: SANS,
      mark: 'dot', ratio: 0.72, tracking: 0.04 },
    { id: 'dot-wide', zh: '圆标 · 宽字距', en: 'Dot · Wide', face: SANS,
      mark: 'dot', ratio: 0.68, tracking: 0.18 },
    { id: 'dot-mini', zh: '小圆点 · 紧凑', en: 'Mini Dot', face: SANS,
      mark: 'dot', ratio: 0.4, tracking: 0.06 },
    { id: 'block-bold', zh: '方块 · 粗体', en: 'Block · Bold', face: SANS,
      mark: 'square', ratio: 0.6, tracking: 0.03 },
    { id: 'block-serif', zh: '方块 · 衬线', en: 'Block · Serif', face: SERIF,
      mark: 'square', ratio: 0.6, tracking: 0.03 },
    { id: 'block-wide', zh: '方块 · 宽字距', en: 'Block · Wide', face: SANS,
      mark: 'square', ratio: 0.58, tracking: 0.14 },
    { id: 'bar-serif', zh: '竖条 · 衬线', en: 'Bar · Serif', face: SERIF,
      mark: 'bar', barW: 0.07, tracking: 0.03 },
    { id: 'bar-sans', zh: '竖条 · 无衬线', en: 'Bar · Sans', face: SANS,
      mark: 'bar', barW: 0.06, tracking: 0.06 },
    { id: 'bar-hair', zh: '细竖线 · 精致', en: 'Hairline', face: SANS,
      mark: 'bar', barW: 0.022, tracking: 0.12 },
    { id: 'word-wide', zh: '字标 · 超宽', en: 'Wordmark · Wide', face: SANS,
      mark: 'none', tracking: 0.2 },
    { id: 'word-mid', zh: '字标 · 中等', en: 'Wordmark · Mid', face: SANS,
      mark: 'none', tracking: 0.12 },
    { id: 'word-serif', zh: '字标 · 衬线', en: 'Wordmark · Serif', face: SERIF,
      mark: 'none', tracking: 0.04 },
    { id: 'word-mono', zh: '字标 · 等宽', en: 'Wordmark · Mono', face: MONO,
      mark: 'none', tracking: 0.08 },
    { id: 'plain', zh: '纯参数条', en: 'Plain EXIF', face: SANS,
      mark: 'none', tracking: 0.04 }
  ];

  var byId = {};
  STYLES.forEach(function (s) { byId[s.id] = s; });

  function defaults() {
    return { brand: PH_BRAND, model: PH_MODEL, lens: PH_LENS };
  }

  /* 手动推进光标实现字距 —— canvas 的 letterSpacing 在
     OffscreenCanvas / 小程序里支持不一致，会导致测量与绘制错位 */
  function trackedWidth(ctx, text, tracking) {
    var w = 0;
    for (var i = 0; i < text.length; i++) w += ctx.measureText(text[i]).width + tracking;
    return w - (text.length ? tracking : 0);
  }
  function drawTracked(ctx, text, x, y, tracking) {
    var cx = x;
    for (var i = 0; i < text.length; i++) {
      ctx.fillText(text[i], cx, y);
      cx += ctx.measureText(text[i]).width + tracking;
    }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  /* 徽标里的文字按可用宽度收缩，填多长的品牌名都不会顶破标 */
  function fitFont(ctx, text, size, weight, face, max) {
    var fs = size;
    ctx.font = weight + ' ' + fs + 'px ' + face;
    var w = ctx.measureText(text).width;
    if (w > max && w > 0) {
      fs = fs * max / w;
      ctx.font = weight + ' ' + fs + 'px ' + face;
    }
    return fs;
  }
  /* 徽标底色可自定义，墨色按亮度自动翻转，填亮黄也不会糊成一片 */
  function inkOn(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return '#ffffff';
    var n = parseInt(m[1], 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#111111' : '#ffffff';
  }

  /* opts: { style, brand, model, lens, tone:'dark'|'light', markColor, h } */
  function render(opts, makeCanvas) {
    opts = opts || {};
    var s = byId[opts.style] || STYLES[0];
    var H = Math.max(48, opts.h || 400);
    var d = defaults();
    var brand = opts.brand != null ? opts.brand : d.brand;
    var model = opts.model != null ? opts.model : d.model;
    var lens = opts.lens != null ? opts.lens : d.lens;
    var light = opts.tone === 'light';
    var ink = light ? '#ffffff' : (opts.ink || s.ink || '#111111');
    var face = s.face || SANS;
    /* 徽标默认与文字同色（永远协调）；填了颜色就用填的 */
    var mc = opts.markColor || s.markColor || ink;

    var probe = makeCanvas(8, 8).getContext('2d');
    var sizeModel = H * 0.32;
    var sizeLens = H * 0.155;
    var sizeBrand = H * 0.16;
    var trModel = (s.tracking || 0.03) * sizeModel;
    var trLens = 0.055 * sizeLens;
    var trBrand = 0.14 * sizeBrand;
    /* 竖条 / 纯字标没有放品牌的容器，这时把品牌名提到文字块上方单独一行 */
    var three = !!brand && (s.mark === 'bar' || s.mark === 'none');

    probe.font = '600 ' + sizeModel + 'px ' + face;
    var wModel = model ? trackedWidth(probe, model, trModel) : 0;
    probe.font = '400 ' + sizeLens + 'px ' + face;
    var wLens = lens ? trackedWidth(probe, lens, trLens) : 0;
    probe.font = '500 ' + sizeBrand + 'px ' + face;
    var wBrand = three ? trackedWidth(probe, brand, trBrand) : 0;
    var wText = Math.max(wModel, wLens, wBrand);

    /* 徽标 */
    var D = H * (s.ratio || 0.68);
    var markW = 0;
    if (s.mark === 'dot') markW = D;
    else if (s.mark === 'square') {
      probe.font = '700 ' + D * 0.4 + 'px ' + face;
      markW = Math.max(D * 1.35, brand ? trackedWidth(probe, brand, D * 0.05) + D * 0.5 : 0);
    } else if (s.mark === 'bar') markW = H * (s.barW || 0.06);
    var gap = (markW && wText) ? H * 0.16 : 0;
    var pad = H * 0.06;
    var W = Math.ceil(pad * 2 + markW + gap + wText);

    var canvas = makeCanvas(W, H);
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';

    var x = pad;
    if (s.mark === 'dot') {
      ctx.fillStyle = mc;
      ctx.beginPath(); ctx.arc(x + D / 2, H / 2, D / 2, 0, Math.PI * 2); ctx.fill();
      if (brand) {
        ctx.fillStyle = inkOn(mc);
        fitFont(ctx, brand, D * 0.34, '400', face, D * 0.78);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(brand, x + D / 2, H / 2 + D * 0.02);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
      x += D;
    } else if (s.mark === 'square') {
      ctx.fillStyle = mc;
      roundRect(ctx, x, (H - D) / 2, markW, D, D * 0.14); ctx.fill();
      if (brand) {
        ctx.fillStyle = inkOn(mc);
        fitFont(ctx, brand, D * 0.4, '700', face, markW * 0.84);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(brand, x + markW / 2, H / 2);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
      x += markW;
    } else if (s.mark === 'bar') {
      ctx.fillStyle = mc;
      ctx.fillRect(x, H * 0.16, markW, H * 0.68);
      x += markW;
    }

    /* 文字两行：机型在上，参数在下；只有一行时垂直居中 */
    if (light) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = H * 0.05;
      ctx.shadowOffsetY = H * 0.015;
    }
    var tx = x + gap;
    if (three) {
      ctx.fillStyle = ink;
      ctx.font = '500 ' + sizeBrand + 'px ' + face;
      drawTracked(ctx, brand, tx, H * 0.32, trBrand);
      if (model) {
        ctx.font = '600 ' + sizeModel + 'px ' + face;
        drawTracked(ctx, model, tx, H * 0.66, trModel);
      }
      if (lens) {
        ctx.font = '400 ' + sizeLens + 'px ' + face;
        drawTracked(ctx, lens, tx, H * 0.9, trLens);
      }
    } else if (model && lens) {
      ctx.fillStyle = ink;
      ctx.font = '600 ' + sizeModel + 'px ' + face;
      drawTracked(ctx, model, tx, H * 0.53, trModel);
      ctx.font = '400 ' + sizeLens + 'px ' + face;
      drawTracked(ctx, lens, tx, H * 0.84, trLens);
    } else {
      var one = model || lens || '';
      var isModel = !!model;
      ctx.fillStyle = ink;
      ctx.font = (isModel ? '600 ' : '400 ') + (isModel ? sizeModel : sizeLens) + 'px ' + face;
      drawTracked(ctx, one, tx, H * 0.68, isModel ? trModel : trLens);
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    return { canvas: canvas, w: W, h: H };
  }

  root.PMCameraWm = {
    styles: STYLES,
    byId: function (id) { return byId[id] || null; },
    defaults: defaults,
    render: render
  };
})(typeof window !== 'undefined' ? window : this);
