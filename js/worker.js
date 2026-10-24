// Web Worker for image generation
// 与页面共用 text-style.js / layers.js：预览与成品走同一套绘制代码

importScripts('text-style.js');
importScripts('layers.js');

var cachedImageBitmap = null;
var cachedWidth = 0;
var cachedHeight = 0;
var cachedLayers = [];
var cachedImages = {};
var cachedFormat = 'image/png';

self.onerror = function (e) {
  self.postMessage({ type: 'init', success: false, error: e.message || 'Worker runtime error' });
};

self.onmessage = async function (e) {
  const { type } = e.data;

  if (type === 'init') {
    cachedImageBitmap = e.data.imageBitmap;
    cachedWidth = e.data.width;
    cachedHeight = e.data.height;
    cachedLayers = e.data.layers || [];
    cachedFormat = e.data.format || 'image/png';

    // 水印位图：主线程 transfer 过来的 ImageBitmap，按 key 索引
    cachedImages = {};
    (e.data.images || []).forEach(function (item) {
      if (item && item.key && item.bitmap) cachedImages[item.key] = item.bitmap;
    });

    // Register custom / open-source web fonts (ArrayBuffer → FontFace)
    // 可能有多款：自定义上传的 + 若干开源网络字体，逐个注册后才能和预览同字形
    var fontList = e.data.fonts || [];
    if (!fontList.length && e.data.fontBuffer && e.data.fontFamily) {
      fontList = [{ family: e.data.fontFamily, buffer: e.data.fontBuffer }];
    }
    for (var fi = 0; fi < fontList.length; fi++) {
      try {
        const fontFace = new FontFace(fontList[fi].family, fontList[fi].buffer);
        await fontFace.load();
        self.fonts.add(fontFace);
      } catch (fontErr) {
        // Continue with fallback font
      }
    }

    self.postMessage({ type: 'init', success: true });
    return;
  }

  if (type === 'generate') {
    const { row, columns, index } = e.data;

    try {
      if (!cachedImageBitmap) {
        throw new Error('Worker not initialized');
      }

      const canvas = new OffscreenCanvas(cachedWidth, cachedHeight);
      const ctx = canvas.getContext('2d');

      ctx.drawImage(cachedImageBitmap, 0, 0, cachedWidth, cachedHeight);

      if (cachedFormat === 'image/jpeg') {
        // JPG 无透明通道：在已有像素之下补一层白底
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cachedWidth, cachedHeight);
        ctx.restore();
      }

      PMLayers.renderAll(ctx, cachedLayers, {
        row: row || {},
        columns: columns || [],
        images: cachedImages
      });

      const blob = await canvas.convertToBlob({ type: cachedFormat, quality: 0.92 });
      const firstCol = (columns && columns[0]) || '';

      self.postMessage({
        success: true,
        index,
        blob,
        text: (row && firstCol && row[firstCol]) || ('row_' + (index + 1)),
        width: cachedWidth,
        height: cachedHeight,
      });
    } catch (err) {
      self.postMessage({
        success: false,
        index,
        error: err.message || 'Worker generation failed',
      });
    }
  }
};
