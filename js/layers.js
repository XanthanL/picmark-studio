/* ============================================================
   图印工坊 · 图层渲染内核
   ------------------------------------------------------------
   定位文字 / 区域文字 / PNG 水印 三种图层统一成一份数据结构，
   由 renderAll() 一次性画完。页面预览、主线程出图、Worker 出图
   必须都调这一个函数——这是「预览 ≠ 成品」这类 bug 的根治办法。

   本文件被页面 <script> 引入，也被 worker importScripts() 引入，
   因此只依赖 ctx，不碰 DOM；图片资源通过 env.images[key] 注入。
   字间距一律手动推进光标（不使用 ctx.letterSpacing），因为
   OffscreenCanvas 对该 API 支持不一致，会导致测量与绘制不一致。
   ============================================================ */
(function (root) {
  'use strict';

  var TS = root.PMTextStyle;

  function uid(prefix) {
    return (prefix || 'L') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  var TEXT_DEFAULTS = {
    id: '',
    type: 'text',
    name: '文字',
    visible: true,
    mode: 'point',            // point = 锚点定位 | region = 框内自适应
    x: 0, y: 0, w: 400, h: 120,
    rotation: 0,
    opacity: 1,
    source: 'name',           // name = 名单列 | fixed = 固定文本
    column: '',
    fixedText: '',
    fontFamily: 'Microsoft YaHei, sans-serif',
    fontWeight: 400,
    italic: false,
    underline: false,
    fontSize: 60,
    color: '#111111',
    letterSpacing: 0,
    lineHeight: 1.2,
    align: 'center',          // left | center | right
    valign: 'middle',         // top | middle | bottom（region 模式）
    maxWidth: 0,
    autoFit: true,            // region 模式下自适应字号
    minFont: 12,
    maxFont: 300,
    wrap: true,
    stroke: false,
    strokeWidth: 3,
    strokeColor: '#FFFFFF',
    shadow: false,
    shadowBlur: 12,
    shadowColor: 'rgba(0, 0, 0, 0.38)'
  };

  var IMAGE_DEFAULTS = {
    id: '',
    type: 'image',
    name: '水印',
    visible: true,
    x: 0, y: 0, w: 200, h: 200,
    rotation: 0,
    opacity: 1,
    imageKey: '',
    fit: 'contain',           // contain | cover | stretch
    flipH: false,
    flipV: false
  };

  function create(type, patch) {
    var base = type === 'image' ? IMAGE_DEFAULTS : TEXT_DEFAULTS;
    var layer = {};
    Object.keys(base).forEach(function (k) { layer[k] = base[k]; });
    layer.id = uid(type === 'image' ? 'IMG' : 'TXT');
    if (patch) Object.keys(patch).forEach(function (k) { layer[k] = patch[k]; });
    return layer;
  }

  function cloneLayer(layer) {
    return JSON.parse(JSON.stringify(layer));
  }

  /* ===== 文本取值 ===== */
  function resolveText(layer, env) {
    if (layer.source === 'fixed') return String(layer.fixedText || '');
    var col = layer.column || (env.columns && env.columns[0]) || '';
    var v = env.row ? env.row[col] : '';
    return v == null ? '' : String(v);
  }

  /* ===== 颜色：hex + opacity → rgba ===== */
  function hexToRgba(hex, alpha) {
    var h = String(hex || '#000000').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.substr(0, 2), 16) || 0;
    var g = parseInt(h.substr(2, 2), 16) || 0;
    var b = parseInt(h.substr(4, 2), 16) || 0;
    var a = alpha == null ? 1 : Math.max(0, Math.min(1, alpha));
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ===== 测量：字间距手动计入（不使用 ctx.letterSpacing）===== */
  function measureLine(ctx, text, spacing) {
    var n = Array.from(String(text)).length;
    return ctx.measureText(text).width + Math.max(0, n - 1) * (spacing || 0);
  }

  function drawLine(ctx, text, x, y, o, size, color) {
    var spacing = o.letterSpacing || 0;
    if (!spacing) {
      TS.drawStyledText(ctx, text, x, y, o, size, color);
      return;
    }
    var cursor = x;
    var chars = Array.from(String(text));
    for (var i = 0; i < chars.length; i++) {
      TS.drawStyledText(ctx, chars[i], cursor, y, o, size, color);
      cursor += ctx.measureText(chars[i]).width + spacing;
    }
  }

  /* 换行：先按显式换行切段，再按可用宽度逐字折行 */
  function wrapText(ctx, text, maxWidth, spacing) {
    var out = [];
    String(text).split('\n').forEach(function (para) {
      if (para === '') { out.push(''); return; }
      if (!(maxWidth > 0)) { out.push(para); return; }
      var chars = Array.from(para);
      var cur = '';
      for (var i = 0; i < chars.length; i++) {
        var test = cur + chars[i];
        if (cur !== '' && measureLine(ctx, test, spacing) > maxWidth) {
          out.push(cur);
          cur = chars[i];
        } else {
          cur = test;
        }
      }
      out.push(cur);
    });
    return out;
  }

  function fontOf(layer, size) {
    return TS.buildFont({
      italic: layer.italic,
      fontStyle: layer.italic ? 'italic' : 'normal',
      fontWeight: layer.fontWeight,
      fontFamily: layer.fontFamily
    }, size);
  }

  /* 旋转后的轴对齐包围盒——区域自适应字号必须考虑旋转，
     否则 45°/90° 的文字会溢出框外（旧版的已知缺陷） */
  function rotatedBox(w, h, deg) {
    var a = (deg || 0) * Math.PI / 180;
    var c = Math.abs(Math.cos(a));
    var s = Math.abs(Math.sin(a));
    return { w: w * c + h * s, h: w * s + h * c };
  }

  /* ===== 区域模式：二分求最大可用字号 ===== */
  function fitFontSize(ctx, layer, text) {
    var availW = Math.max(8, layer.w);
    var availH = Math.max(8, layer.h);
    var low = Math.max(1, layer.minFont || 8);
    var high = Math.max(low, layer.maxFont || 300);
    var spacing = layer.letterSpacing || 0;
    var best = low;

    while (low <= high) {
      var mid = Math.floor((low + high) / 2);
      ctx.font = fontOf(layer, mid);
      var lines = layer.wrap === false ? [text] : wrapText(ctx, text, availW, spacing);
      var lh = mid * (layer.lineHeight || 1.2);
      var th = lines.length * lh;
      var tw = 0;
      for (var i = 0; i < lines.length; i++) tw = Math.max(tw, measureLine(ctx, lines[i], spacing));
      var box = rotatedBox(tw, th, layer.rotation);
      if (box.w <= availW && box.h <= availH) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return best;
  }

  /* ===== 文本图层 ===== */
  function drawTextLayer(ctx, layer, env) {
    var text = resolveText(layer, env);
    if (!text) return;

    var spacing = layer.letterSpacing || 0;
    var color = hexToRgba(layer.color, layer.opacity);
    var o = {
      fontFamily: layer.fontFamily,
      fontWeight: layer.fontWeight,
      italic: !!layer.italic,
      underline: !!layer.underline,
      stroke: !!layer.stroke,
      strokeWidth: layer.strokeWidth || 0,
      strokeColor: layer.strokeColor,
      shadow: !!layer.shadow,
      shadowBlur: (layer.shadow && layer.shadowBlur) || 0,
      shadowOffsetX: 0,
      shadowOffsetY: layer.shadow && layer.shadowBlur ? Math.max(1, Math.round(layer.shadowBlur * 0.18)) : 0,
      shadowColor: layer.shadowColor,
      color: color
    };

    var size = layer.fontSize || 60;
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.font = fontOf(layer, size);

    if (layer.mode === 'region') {
      /* —— 框内自适应 —— */
      if (layer.autoFit) {
        size = fitFontSize(ctx, layer, text);
        ctx.font = fontOf(layer, size);
      }
      var lines = layer.wrap === false ? [text] : wrapText(ctx, text, Math.max(8, layer.w), spacing);
      var lh = size * (layer.lineHeight || 1.2);
      var totalH = lines.length * lh;
      var startY = layer.y;
      if (layer.valign === 'middle') startY = layer.y + (layer.h - totalH) / 2;
      else if (layer.valign === 'bottom') startY = layer.y + layer.h - totalH;

      var cx = layer.x + layer.w / 2;
      var cy = layer.y + layer.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((layer.rotation || 0) * Math.PI / 180);
      ctx.translate(-cx, -cy);

      for (var i = 0; i < lines.length; i++) {
        var lw = measureLine(ctx, lines[i], spacing);
        var lx = layer.x;
        if (layer.align === 'center') lx = layer.x + (layer.w - lw) / 2;
        else if (layer.align === 'right') lx = layer.x + layer.w - lw;
        drawLine(ctx, lines[i], lx, startY + i * lh, o, size, color);
      }
    } else {
      /* —— 锚点定位 —— */
      var raw = text.split('\n');
      if (layer.maxWidth > 0) {
        while (size > 8) {
          ctx.font = fontOf(layer, size);
          var widest = 0;
          for (var k = 0; k < raw.length; k++) widest = Math.max(widest, measureLine(ctx, raw[k], spacing));
          if (widest <= layer.maxWidth) break;
          size -= 2;
        }
      }
      ctx.font = fontOf(layer, size);
      var lh2 = size * (layer.lineHeight || 1.2);
      var ax = layer.x;
      var ay = layer.y;
      ctx.translate(ax, ay);
      ctx.rotate((layer.rotation || 0) * Math.PI / 180);
      for (var j = 0; j < raw.length; j++) {
        var w2 = measureLine(ctx, raw[j], spacing);
        var x2 = 0;
        if (layer.align === 'center') x2 = -w2 / 2;
        else if (layer.align === 'right') x2 = -w2;
        drawLine(ctx, raw[j], x2, j * lh2, o, size, color);
      }
    }
    ctx.restore();
  }

  /* ===== 图片（PNG 水印）图层 ===== */
  function drawImageLayer(ctx, layer, env) {
    var img = env.images && env.images[layer.imageKey];
    if (!img) return;
    var iw = img.naturalWidth || img.width || 0;
    var ih = img.naturalHeight || img.height || 0;
    if (!iw || !ih) return;

    var dw = layer.w;
    var dh = layer.h;
    var sx = 0, sy = 0, sw = iw, sh = ih;

    if (layer.fit === 'cover') {
      var scale = Math.max(dw / iw, dh / ih);
      sw = dw / scale;
      sh = dh / scale;
      sx = (iw - sw) / 2;
      sy = (ih - sh) / 2;
    } else if (layer.fit === 'contain') {
      var s2 = Math.min(dw / iw, dh / ih);
      var vw = iw * s2;
      var vh = ih * s2;
      // 保持比例并居中，绘制区域收缩到实际占位
      dw = vw;
      dh = vh;
    }

    var cx = layer.x + layer.w / 2;
    var cy = layer.y + layer.h / 2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity == null ? 1 : layer.opacity));
    ctx.translate(cx, cy);
    ctx.rotate((layer.rotation || 0) * Math.PI / 180);
    if (layer.flipH || layer.flipV) ctx.scale(layer.flipH ? -1 : 1, layer.flipV ? -1 : 1);
    ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  function renderLayer(ctx, layer, env) {
    if (!layer || layer.visible === false) return;
    if (layer.type === 'image') drawImageLayer(ctx, layer, env);
    else drawTextLayer(ctx, layer, env);
  }

  /* 图层按数组顺序绘制：后面的盖在前面的上面 */
  function renderAll(ctx, layers, env) {
    var list = layers || [];
    var e = env || {};
    for (var i = 0; i < list.length; i++) {
      ctx.save();
      try {
        renderLayer(ctx, list[i], e);
      } catch (err) {
        // 单个图层画失败不能让整张图报废
        if (typeof console !== 'undefined') console.warn('[PicMark] layer render failed:', err);
      }
      ctx.restore();
    }
  }

  /* 预览用：没有名单时给个样例文本，避免画布空空如也 */
  function sampleEnv(layers, env) {
    var e = env || {};
    if (!e.row) {
      e.row = {};
      (e.columns || ['姓名']).forEach(function (c) { e.row[c] = '示例'; });
    }
    return e;
  }

  root.PMLayers = {
    uid: uid,
    create: create,
    clone: cloneLayer,
    TEXT_DEFAULTS: TEXT_DEFAULTS,
    IMAGE_DEFAULTS: IMAGE_DEFAULTS,
    render: renderLayer,
    renderAll: renderAll,
    resolveText: resolveText,
    wrapText: wrapText,
    measureLine: measureLine,
    fitFontSize: fitFontSize,
    hexToRgba: hexToRgba,
    rotatedBox: rotatedBox,
    sampleEnv: sampleEnv
  };
})(typeof self !== 'undefined' ? self : this);
