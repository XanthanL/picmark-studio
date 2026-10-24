/* ============================================================
   图印工坊 · 文字样式渲染内核
   ------------------------------------------------------------
   预览（app.js）、区域文字（region-editor.js）、最终生成（worker.js）
   三处必须用同一套绘制逻辑，否则又会出现"预览好看、成品没有"。
   这个文件被页面以 <script> 引入，也被 worker 用 importScripts() 引入，
   因此只依赖 ctx，不碰 DOM。
   支持的样式：字体 / 字重 / 斜体 / 字间距 / 颜色 / 描边 / 阴影 / 下划线
   ============================================================ */
(function (root) {
  'use strict';

  /* 构造 font 字符串：斜体优先取自 options.italic（定位模式），
     区域模式用自己的 cfg.fontStyle，两者都能落在 style 上 */
  function buildFont(o, size) {
    var style = o.italic ? 'italic' : (o.fontStyle || 'normal');
    if (!style || style === 'normal') style = ''; else style += ' ';
    return style + (o.fontWeight || 400) + ' ' + size + 'px ' + o.fontFamily;
  }

  /* canvas 的 letterSpacing 是较新的 API，不支持的浏览器静默跳过
     （measureText 与 fillText 会一致地忽略，不会错位） */
  function setSpacing(ctx, px) {
    try {
      if ('letterSpacing' in ctx) ctx.letterSpacing = (px || 0) + 'px';
    } catch (e) { /* 不支持则忽略 */ }
  }

  function clearShadow(ctx) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  function applyShadow(ctx, o) {
    if (!o.shadow) return false;
    var blur = o.shadowBlur || 0;
    var dx = o.shadowOffsetX || 0;
    var dy = o.shadowOffsetY || 0;
    if (!blur && !dx && !dy) return false;
    ctx.shadowColor = o.shadowColor || 'rgba(0, 0, 0, 0.38)';
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = dx;
    ctx.shadowOffsetY = dy;
    return true;
  }

  /* 描边在下、填充在上；阴影只由最底层带出一次，避免描边和填充各投一次影子 */
  function drawStyledText(ctx, text, x, y, o, size, colorOverride) {
    var hasStroke = !!(o.stroke && o.strokeWidth > 0);
    applyShadow(ctx, o);
    if (hasStroke) {
      ctx.lineWidth = o.strokeWidth;
      ctx.strokeStyle = o.strokeColor || '#ffffff';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(text, x, y);
      clearShadow(ctx);
    }
    ctx.fillStyle = colorOverride || o.color;
    ctx.fillText(text, x, y);
    clearShadow(ctx);

    if (o.underline) {
      var w = ctx.measureText(text).width;
      var th = Math.max(1, size * 0.06);
      ctx.fillStyle = colorOverride || o.color;
      ctx.fillRect(x, y + size * 1.02, w, th);
    }
  }

  root.PMTextStyle = {
    buildFont: buildFont,
    setSpacing: setSpacing,
    clearShadow: clearShadow,
    drawStyledText: drawStyledText
  };
})(typeof self !== 'undefined' ? self : this);
