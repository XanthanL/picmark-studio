// Web Worker for image generation
// Receives a cached background image and generates text overlays on demand

let cachedImageBitmap = null;
let cachedWidth = 0;
let cachedHeight = 0;
let cachedOptions = null;
let cachedFontFamily = null;

self.onmessage = async function (e) {
  const { type } = e.data;

  if (type === 'init') {
    cachedImageBitmap = e.data.imageBitmap;
    cachedWidth = e.data.width;
    cachedHeight = e.data.height;
    cachedOptions = e.data.options;
    cachedFontFamily = e.data.fontFamily;

    // Register custom font if provided
    if (e.data.fontBuffer && cachedFontFamily) {
      try {
        const fontFace = new FontFace(cachedFontFamily, e.data.fontBuffer);
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
    const { text, index } = e.data;

    try {
      if (!cachedImageBitmap) {
        throw new Error('Worker not initialized');
      }

      const canvas = new OffscreenCanvas(cachedWidth, cachedHeight);
      const ctx = canvas.getContext('2d');

      // Draw background image
      ctx.drawImage(cachedImageBitmap, 0, 0, cachedWidth, cachedHeight);

      // Text styling
      const options = cachedOptions;
      ctx.fillStyle = options.color;
      ctx.textBaseline = 'top';

      let currentSize = options.fontSize;
      ctx.font = `${options.fontWeight} ${currentSize}px ${options.fontFamily}`;

      // Auto-scale font size to fit max width
      if (options.maxWidth > 0) {
        while (ctx.measureText(text).width > options.maxWidth && currentSize > 12) {
          currentSize -= 2;
          ctx.font = `${options.fontWeight} ${currentSize}px ${options.fontFamily}`;
        }
      }

      const textWidth = ctx.measureText(text).width;
      let x = options.posX;
      if (options.align === 'center') {
        x -= textWidth / 2;
      } else if (options.align === 'right') {
        x -= textWidth;
      }

      ctx.fillText(text, x, options.posY);

      const blob = await canvas.convertToBlob({ type: 'image/png' });

      // Read blob as data URL synchronously in worker
      const reader = new FileReaderSync();
      const dataUrl = reader.readAsDataURL(blob);

      self.postMessage({
        success: true,
        index,
        blob,
        dataUrl,
        text,
        width: cachedWidth,
        height: cachedHeight,
      });
    } catch (err) {
      self.postMessage({
        success: false,
        index,
        error: err.message || 'Worker generation failed',
        text,
      });
    }
  }
};
