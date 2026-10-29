/* ============================================================
   图印工坊 · 相机水印（程序化生成）
   ------------------------------------------------------------
   把「相机 / 手机厂商那种带机型与镜头参数的水印」做成可选素材：
   不打包任何位图，全部用 canvas 按参数现画 —— 好处是任意分辨率都不糊、
   文件体积为零、文字可改、小程序端同一份代码能复用。
   canvas 由调用方通过 makeCanvas 提供（浏览器 document.createElement，
   小程序 wx.createOffscreenCanvas），所以这个文件不碰 DOM。

   ⚠ 商标说明：下列品牌名与配色只是「帮助用户做出同类排版」的默认值，
   品牌与商标归各自厂商所有。文字一律可编辑，商用请替换成自有标识。
   ============================================================ */
(function (root) {
  'use strict';

  var SANS = '"Helvetica Neue", Arial, "Segoe UI", system-ui, sans-serif';
  var SERIF = 'Didot, "Bodoni MT", Georgia, "Times New Roman", serif';

  /* mark: dot 圆标 / square 圆角方块标 / bar 竖条 / none 纯文字
     tracking: 字距（em 倍数）；ink: 文字墨色（不填则跟随 tone） */
  var STYLES = [
    {
      id: 'leica', zh: '徕卡', en: 'Leica', face: SERIF,
      brand: 'Leica', model: 'M11', lens: 'SUMMILUX-M 50mm f/1.4 ASPH',
      mark: 'dot', markColor: '#c8102e', markInk: '#ffffff', markRatio: 0.72
    },
    {
      id: 'leica-xiaomi', zh: '小米 × 徕卡', en: 'Xiaomi × Leica', face: SERIF,
      brand: 'Leica', model: 'XIAOMI 14 ULTRA', lens: '50mm f/1.6 · 1/120 · ISO 100',
      mark: 'dot', markColor: '#c8102e', markInk: '#ffffff', markRatio: 0.68
    },
    {
      id: 'hasselblad', zh: '哈苏', en: 'Hasselblad', face: SANS,
      brand: 'HASSELBLAD', model: 'HASSELBLAD', modelTracking: 0.2,
      lens: 'X2D 100C · XCD 55V f/2.5', mark: 'none'
    },
    {
      id: 'oppo-hasselblad', zh: 'OPPO × 哈苏', en: 'OPPO × Hasselblad', face: SANS,
      brand: 'HASSELBLAD', model: 'HASSELBLAD', modelTracking: 0.18,
      lens: 'OPPO Find X7 Ultra · 23mm f/1.8', mark: 'none'
    },
    {
      id: 'zeiss', zh: '蔡司', en: 'ZEISS', face: SANS,
      brand: 'ZEISS', model: 'Otus', lens: '55mm f/1.4 · ZEISS',
      mark: 'square', markColor: '#004e91', markInk: '#ffffff', markRatio: 0.6
    },
    {
      id: 'vivo-zeiss', zh: 'vivo × 蔡司', en: 'vivo × ZEISS', face: SANS,
      brand: 'ZEISS', model: 'vivo X100 Pro', lens: '50mm f/1.75 · ZEISS',
      mark: 'square', markColor: '#004e91', markInk: '#ffffff', markRatio: 0.58
    },
    {
      id: 'fujifilm', zh: '富士', en: 'FUJIFILM', face: SANS,
      brand: 'FUJIFILM', model: 'FUJIFILM', modelTracking: 0.12, ink: '#00953d',
      lens: 'GFX100 II · GF63mm F2.8 R WR', mark: 'none'
    },
    {
      id: 'nikon', zh: '尼康', en: 'Nikon', face: SANS,
      brand: 'Nikon', model: 'Z 9', lens: 'NIKKOR Z 50mm f/1.2 S',
      mark: 'square', markColor: '#ffd400', markInk: '#111111', markRatio: 0.62
    },
    {
      id: 'canon', zh: '佳能', en: 'Canon', face: SERIF,
      brand: 'Canon', model: 'Canon', ink: '#cc0000', lens: 'EOS R5 · RF50mm F1.2 L USM',
      mark: 'bar', markColor: '#cc0000', markRatio: 0.6
    },
    {
      id: 'sony', zh: '索尼', en: 'SONY', face: SANS,
      brand: 'SONY', model: 'SONY', modelTracking: 0.16, lens: 'α7R V · FE 50mm F1.2 GM',
      mark: 'none'
    },
    {
      id: 'ricoh', zh: '理光 GR', en: 'Ricoh GR', face: SANS,
      brand: 'GR', model: 'GR III', lens: '28mm f/2.8 · RICOH',
      mark: 'bar', markColor: '#111111', markRatio: 0.62
    },
    {
      id: 'kodak', zh: '柯达胶片', en: 'Kodak Film', face: SANS,
      brand: 'Kodak', model: 'Portra 400', lens: '35mm · 2026',
      mark: 'square', markColor: '#f2a100', markInk: '#111111', markRatio: 0.6
    },
    {
      id: 'leica-sl', zh: '徕卡 SL', en: 'Leica SL', face: SERIF,
      brand: 'Leica', model: 'SL3', lens: 'VARIO-ELMARIT 24-70mm f/2.8 ASPH',
      mark: 'dot', markColor: '#c8102e', markInk: '#ffffff', markRatio: 0.68
    },
    {
      id: 'sigma', zh: '适马', en: 'Sigma', face: SANS,
      brand: 'SIGMA', model: 'SIGMA fp L', modelTracking: 0.1, lens: '45mm f/2.8 DG DN',
      mark: 'bar', markColor: '#111111', markRatio: 0.6
    },
    {
      id: 'plain', zh: '纯参数条', en: 'Plain EXIF', face: SANS,
      brand: '', model: '50mm f/1.4', modelTracking: 0.04,
      lens: '1/500 · ISO 200', mark: 'none'
    }
  ];

  var byId = {};
  STYLES.forEach(function (s) { byId[s.id] = s; });

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

  /* opts: { style, brand, model, lens, tone:'dark'|'light', h } */
  function render(opts, makeCanvas) {
    opts = opts || {};
    var s = byId[opts.style] || STYLES[0];
    var H = Math.max(48, opts.h || 400);
    var brand = opts.brand != null ? opts.brand : s.brand;
    var model = opts.model != null ? opts.model : s.model;
    var lens = opts.lens != null ? opts.lens : s.lens;
    var light = opts.tone === 'light';
    var ink = light ? '#ffffff' : (opts.ink || s.ink || '#111111');
    var face = s.face || SANS;

    var probe = makeCanvas(8, 8).getContext('2d');
    var sizeModel = H * (s.mark === 'none' && brand === model ? 0.3 : 0.32);
    var sizeLens = H * 0.155;
    var trModel = (s.modelTracking || 0.03) * sizeModel;
    var trLens = 0.055 * sizeLens;

    probe.font = '600 ' + sizeModel + 'px ' + face;
    var wModel = model ? trackedWidth(probe, model, trModel) : 0;
    probe.font = '400 ' + sizeLens + 'px ' + face;
    var wLens = lens ? trackedWidth(probe, lens, trLens) : 0;
    var wText = Math.max(wModel, wLens);

    /* 徽标 */
    var D = H * (s.markRatio || 0.68);
    var markW = 0;
    if (s.mark === 'dot') markW = D;
    else if (s.mark === 'square') {
      probe.font = '700 ' + D * 0.4 + 'px ' + face;
      markW = Math.max(D * 1.35, trackedWidth(probe, brand, D * 0.05) + D * 0.5);
    } else if (s.mark === 'bar') markW = D * 0.16;
    var gap = (markW && wText) ? H * 0.16 : 0;
    var pad = H * 0.06;
    var W = Math.ceil(pad * 2 + markW + gap + wText);

    var canvas = makeCanvas(W, H);
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';

    var x = pad;
    if (s.mark === 'dot') {
      ctx.fillStyle = s.markColor;
      ctx.beginPath(); ctx.arc(x + D / 2, H / 2, D / 2, 0, Math.PI * 2); ctx.fill();
      if (brand) {
        ctx.fillStyle = s.markInk || '#fff';
        ctx.font = '400 ' + (D * 0.34) + 'px ' + face;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(brand, x + D / 2, H / 2 + D * 0.02);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
      x += D;
    } else if (s.mark === 'square') {
      ctx.fillStyle = s.markColor;
      roundRect(ctx, x, (H - D) / 2, markW, D, D * 0.14); ctx.fill();
      if (brand) {
        ctx.fillStyle = s.markInk || '#fff';
        ctx.font = '700 ' + (D * 0.4) + 'px ' + face;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(brand, x + markW / 2, H / 2);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
      x += markW;
    } else if (s.mark === 'bar') {
      ctx.fillStyle = s.markColor;
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
    if (model && lens) {
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
    render: render
  };
})(typeof window !== 'undefined' ? window : this);
