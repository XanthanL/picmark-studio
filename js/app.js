(function () {
  // ===== State =====
  const state = {
    sourceFile: null,          // original File object
    sourceImage: null,         // original Image (for preview scale calc)
    workBlob: null,            // compressed image blob
    workBitmap: null,          // compressed ImageBitmap (preview / fallback)
    outputWidth: 0,
    outputHeight: 0,
    originalWidth: 0,
    originalHeight: 0,
    outputScale: 1,            // output / original
    previewScale: 1,           // preview canvas / output (work image)
    customFontFace: null,
    customFontBuffer: null,
    mode: 'position',
    isGenerating: false,
    perf: {
      startTime: 0,
      lowPowerMode: false,
      workerSupported: false,
      maxCanvasSize: 16384,
    },
  };

  // ===== DOM =====
  const els = {
    templateInput: document.getElementById('templateInput'),
    imageInfo: document.getElementById('imageInfo'),
    canvasWrapper: document.getElementById('canvasWrapper'),
    canvas: document.getElementById('previewCanvas'),
    marker: document.getElementById('marker'),
    posX: document.getElementById('posX'),
    posY: document.getElementById('posY'),
    fontSize: document.getElementById('fontSize'),
    fontColor: document.getElementById('fontColor'),
    textAlign: document.getElementById('textAlign'),
    maxWidth: document.getElementById('maxWidth'),
    fontFamily: document.getElementById('fontFamily'),
    fontWeight: document.getElementById('fontWeight'),
    fontWeightError: document.getElementById('fontWeightError'),
    quality: document.getElementById('quality'),
    fontInput: document.getElementById('fontInput'),
    fontName: document.getElementById('fontName'),
    namesInput: document.getElementById('namesInput'),
    namesFileInput: document.getElementById('namesFileInput'),
    generateBtn: document.getElementById('generateBtn'),
    progressBox: document.getElementById('progressBox'),
    progressBarFill: document.getElementById('progressBarFill'),
    progressText: document.getElementById('progressText'),
    previewList: document.getElementById('previewList'),
    modeBtns: document.querySelectorAll('.mode-btn'),
    modeHint: document.getElementById('modeHint'),
    pickedColor: document.getElementById('pickedColor'),
    colorValue: document.getElementById('colorValue'),
    dropZone: document.getElementById('dropZone'),
    perfPanel: document.getElementById('perfPanel'),
    outputSize: document.getElementById('outputSize'),
    memValue: document.getElementById('memValue'),
    perfMode: document.getElementById('perfMode'),
    perfWarning: document.getElementById('perfWarning'),
  };

  const ctx = els.canvas.getContext('2d');

  // ===== Capability Detection =====
  function detectCapabilities() {
    const canvas = document.createElement('canvas');
    const c = canvas.getContext('2d');

    // Detect max canvas size by binary search
    let low = 512;
    let high = 32768;
    let best = low;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      try {
        canvas.width = mid;
        canvas.height = mid;
        c.fillStyle = '#000';
        c.fillRect(0, 0, 1, 1);
        best = mid;
        low = mid + 1;
      } catch (e) {
        high = mid - 1;
      }
    }
    state.perf.maxCanvasSize = best;

    // Detect Worker + OffscreenCanvas support
    state.perf.workerSupported =
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      typeof OffscreenCanvas.prototype.convertToBlob === 'function' &&
      typeof createImageBitmap !== 'undefined';

    // Low power mode: mobile or no worker
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    state.perf.lowPowerMode = !state.perf.workerSupported || isMobile || state.perf.maxCanvasSize < 4096;

    canvas.width = 0;
    canvas.height = 0;
  }

  detectCapabilities();

  // ===== Utilities =====
  function pad(n) {
    return n.toString().padStart(2, '0');
  }

  function formatTimestamp(date) {
    return (
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      '_' +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function hexToRgb(hex) {
    const c = hex.replace('#', '');
    return `rgb(${parseInt(c.substr(0, 2), 16)},${parseInt(c.substr(2, 2), 16)},${parseInt(c.substr(4, 2), 16)})`;
  }

  function getMaxSizeForQuality(quality) {
    switch (quality) {
      case 'original':
        return Infinity;
      case 'high':
        return 2048;
      case 'medium':
        return 1280;
      case 'low':
        return 800;
      default:
        return 2048;
    }
  }

  function getQualityLabel(quality) {
    const map = { original: '原图', high: '高清', medium: '标准', low: '快速' };
    return map[quality] || '高清';
  }

  // ===== Performance Monitor =====
  function updatePerfMonitor() {
    if (!els.perfPanel) return;

    els.outputSize.textContent = `${state.outputWidth} × ${state.outputHeight}`;
    els.perfMode.textContent = state.perf.workerSupported ? 'Worker 异步' : '主线程分帧';

    if (performance.memory) {
      const used = (performance.memory.usedJSHeapSize / 1048576).toFixed(1);
      const limit = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(0);
      els.memValue.textContent = `${used} / ${limit} MB`;

      if (performance.memory.usedJSHeapSize > 0.75 * performance.memory.jsHeapSizeLimit) {
        els.perfWarning.textContent = '内存占用较高，建议降低输出质量或减少名单数量';
      } else {
        els.perfWarning.textContent = '';
      }
    } else {
      els.memValue.textContent = 'N/A';
    }
  }

  function startPerfMonitor() {
    if (!els.perfPanel) return;
    els.perfPanel.style.display = 'flex';
    updatePerfMonitor();
  }

  function stopPerfMonitor() {
    if (!els.perfPanel) return;
    // keep visible to show final stats
  }

  // ===== Image Compression =====
  async function compressImage(file, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = async () => {
        let targetW = img.width;
        let targetH = img.height;
        const maxSize = getMaxSizeForQuality(quality);

        // Apply quality scaling
        if (maxSize && Math.max(targetW, targetH) > maxSize) {
          const ratio = maxSize / Math.max(targetW, targetH);
          targetW = Math.round(targetW * ratio);
          targetH = Math.round(targetH * ratio);
        }

        // Enforce browser canvas limit
        if (targetW > state.perf.maxCanvasSize || targetH > state.perf.maxCanvasSize) {
          const ratio = state.perf.maxCanvasSize / Math.max(targetW, targetH);
          targetW = Math.floor(targetW * ratio);
          targetH = Math.floor(targetH * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const c = canvas.getContext('2d');
        c.drawImage(img, 0, 0, targetW, targetH);

        // Preserve transparency: use PNG for compression to avoid alpha loss
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            resolve({
              blob,
              width: targetW,
              height: targetH,
              originalWidth: img.width,
              originalHeight: img.height,
            });
          },
          'image/png'
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('图片加载失败'));
      };

      img.src = url;
    });
  }

  // ===== Load Template =====
  async function loadTemplate(file) {
    if (!file || !file.type.startsWith('image/')) return;

    // Release previous resources
    releaseImageResources();

    state.sourceFile = file;
    const quality = els.quality ? els.quality.value : 'high';

    try {
      const result = await compressImage(file, quality);
      state.workBlob = result.blob;
      state.outputWidth = result.width;
      state.outputHeight = result.height;
      state.originalWidth = result.originalWidth;
      state.originalHeight = result.originalHeight;
      state.outputScale = result.width / result.originalWidth;

      const url = URL.createObjectURL(result.blob);
      const img = new Image();
      img.onload = async () => {
        state.sourceImage = img;
        state.workBitmap = await createImageBitmap(result.blob);
        els.imageInfo.textContent = `${file.name} · 原图 ${result.originalWidth} × ${result.originalHeight} · 输出 ${result.width} × ${result.height} · ${getQualityLabel(quality)}`;
        renderPreview();
        updateGenerateBtn();
        startPerfMonitor();
      };
      img.src = url;
    } catch (err) {
      alert('图片处理失败: ' + err.message);
    }
  }

  function releaseImageResources() {
    if (state.workBitmap) {
      state.workBitmap.close();
      state.workBitmap = null;
    }
    if (state.sourceImage && state.sourceImage.src) {
      URL.revokeObjectURL(state.sourceImage.src);
    }
    state.sourceImage = null;
    state.workBlob = null;
    state.outputWidth = 0;
    state.outputHeight = 0;
    state.originalWidth = 0;
    state.originalHeight = 0;
    state.outputScale = 1;
  }

  els.templateInput.addEventListener('change', (e) => {
    loadTemplate(e.target.files[0]);
  });

  // ===== Drag & Drop =====
  if (els.dropZone) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
      els.dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    ['dragenter', 'dragover'].forEach((evt) => {
      els.dropZone.addEventListener(evt, () => {
        els.dropZone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      els.dropZone.addEventListener(evt, () => {
        els.dropZone.classList.remove('drag-over');
      });
    });
    els.dropZone.addEventListener('drop', (e) => {
      loadTemplate(e.dataTransfer.files[0]);
    });
  }

  // ===== Render Preview =====
  function renderPreview() {
    const img = state.sourceImage;
    if (!img) return;

    const wrapperW = els.canvasWrapper.clientWidth;
    const scale = wrapperW / img.width;
    state.previewScale = scale;
    const canvasW = Math.floor(img.width * scale);
    const canvasH = Math.floor(img.height * scale);

    els.canvas.width = canvasW;
    els.canvas.height = canvasH;
    ctx.drawImage(img, 0, 0, canvasW, canvasH);

    updateMarker();
  }

  window.addEventListener('resize', () => {
    renderPreview();
  });

  // ===== Mode Switch =====
  els.modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      els.modeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (state.mode === 'pick') {
        els.modeHint.textContent = '点击图片任意位置，即可提取该位置颜色并应用到文字';
        els.canvas.classList.add('pick-mode');
      } else {
        els.modeHint.textContent = '点击图片，"定位位置"文字即为最终文字左对齐起始位置的实时预览';
        els.canvas.classList.remove('pick-mode');
      }
    });
  });

  // ===== Canvas Click =====
  els.canvas.addEventListener('click', (e) => {
    if (!state.sourceImage) return;
    const rect = els.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert preview canvas coordinate to work image coordinate (compressed image)
    const workX = Math.max(0, Math.min(Math.round(x / state.previewScale), state.sourceImage.width));
    const workY = Math.max(0, Math.min(Math.round(y / state.previewScale), state.sourceImage.height));

    if (state.mode === 'pick') {
      pickColor(x, y);
    } else {
      els.posX.value = workX;
      els.posY.value = workY;
      updateMarker();
    }
  });

  // ===== Color Picker =====
  function pickColor(canvasX, canvasY) {
    const ix = Math.max(0, Math.min(Math.round(canvasX), els.canvas.width - 1));
    const iy = Math.max(0, Math.min(Math.round(canvasY), els.canvas.height - 1));
    const pixel = ctx.getImageData(ix, iy, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    els.fontColor.value = hex;
    updateMarker();
  }

  // ===== Font Weight Validation =====
  function validateFontWeight() {
    const raw = els.fontWeight.value.trim();
    const errorEl = els.fontWeightError;
    const inputEl = els.fontWeight;

    if (raw === '') {
      errorEl.textContent = '';
      inputEl.classList.remove('invalid');
      return 100;
    }

    const value = parseInt(raw, 10);

    if (isNaN(value) || raw !== String(value)) {
      errorEl.textContent = '请输入整数';
      inputEl.classList.add('invalid');
      return 100;
    }

    if (value < 10 || value > 900) {
      errorEl.textContent = '字重需在 10 到 900 之间';
      inputEl.classList.add('invalid');
      return 100;
    }

    errorEl.textContent = '';
    inputEl.classList.remove('invalid');
    return value;
  }

  // ===== Marker =====
  function updateMarker() {
    if (!state.sourceImage) return;
    // posX/posY are stored in work image coordinates (compressed image)
    // Convert directly to preview canvas coordinate via previewScale
    const x = parseInt(els.posX.value, 10) * state.previewScale;
    const y = parseInt(els.posY.value, 10) * state.previewScale;
    const fontSize = parseInt(els.fontSize.value, 10);
    const color = els.fontColor.value;
    const fontFamily = getFontFamily();
    const fontWeight = validateFontWeight();

    els.marker.style.display = 'block';
    els.marker.style.left = x + 'px';
    els.marker.style.top = y + 'px';
    els.marker.style.fontSize = Math.max(12, fontSize * state.previewScale) + 'px';
    els.marker.style.color = color;
    els.marker.style.fontFamily = fontFamily;
    els.marker.style.fontWeight = fontWeight;
    els.pickedColor.style.backgroundColor = color;
    els.colorValue.textContent = color.toUpperCase();
  }

  els.posX.addEventListener('input', updateMarker);
  els.posY.addEventListener('input', updateMarker);
  els.fontSize.addEventListener('input', updateMarker);
  els.fontColor.addEventListener('input', updateMarker);
  els.fontFamily.addEventListener('change', updateMarker);
  els.fontWeight.addEventListener('input', updateMarker);

  // ===== Quality change re-process =====
  if (els.quality) {
    els.quality.addEventListener('change', () => {
      if (state.sourceFile) {
        loadTemplate(state.sourceFile);
      }
    });
  }

  // ===== Custom Font =====
  els.fontFamily.addEventListener('change', () => {
    const isCustom = els.fontFamily.value === 'custom';
    document.querySelector('.custom-font').style.display = isCustom ? 'flex' : 'none';
  });

  els.fontInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const buffer = ev.target.result;
      const fontFamily = 'CustomFont' + Date.now();
      try {
        const fontFace = new FontFace(fontFamily, buffer);
        await fontFace.load();
        document.fonts.add(fontFace);
        state.customFontFace = fontFamily;
        state.customFontBuffer = buffer;
        els.fontName.textContent = `已加载: ${file.name}`;
      } catch (err) {
        alert('字体加载失败: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  });

  // ===== Names Input =====
  els.namesFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      if (file.name.toLowerCase().endsWith('.csv')) {
        els.namesInput.value = text
          .split(/\r?\n/)
          .map((line) => line.split(',')[0].trim())
          .filter(Boolean)
          .join('\n');
      } else {
        els.namesInput.value = text;
      }
      updateGenerateBtn();
    };
    reader.readAsText(file);
  });

  els.namesInput.addEventListener('input', updateGenerateBtn);

  function updateGenerateBtn() {
    const hasImage = !!state.sourceImage;
    const hasNames = els.namesInput.value.trim().length > 0;
    els.generateBtn.disabled = !(hasImage && hasNames) || state.isGenerating;
  }

  function getFontFamily() {
    const val = els.fontFamily.value;
    if (val === 'custom') return state.customFontFace || 'sans-serif';
    return val;
  }

  // ===== Generation Options =====
  function getGenerationOptions() {
    // WYSIWYG based on the compressed work image:
    // the coordinate and font size shown in the UI are exactly what will be used
    // in the final generated image.
    return {
      fontSize: Math.max(12, parseInt(els.fontSize.value, 10)),
      color: hexToRgb(els.fontColor.value),
      align: els.textAlign.value,
      maxWidth: parseInt(els.maxWidth.value, 10) || 0,
      fontFamily: getFontFamily(),
      fontWeight: validateFontWeight(),
      posX: parseInt(els.posX.value, 10),
      posY: parseInt(els.posY.value, 10),
    };
  }

  // ===== Worker =====
  let worker = null;

  function initWorker() {
    if (!state.perf.workerSupported) return null;
    if (worker) return worker;
    try {
      worker = new Worker('js/worker.js');
      return worker;
    } catch (e) {
      state.perf.workerSupported = false;
      return null;
    }
  }

  function terminateWorker() {
    if (worker) {
      worker.terminate();
      worker = null;
    }
  }

  async function initWorkerWithImage(options) {
    const w = initWorker();
    if (!w) return null;

    const imageBitmap = await createImageBitmap(state.workBlob);

    return new Promise((resolve, reject) => {
      let settled = false;

      const handler = (e) => {
        if (e.data.type === 'init') {
          settled = true;
          clearTimeout(timeout);
          w.removeEventListener('message', handler);
          if (e.data.success) {
            console.log('[PicMark] Worker initialized successfully');
            resolve(w);
          } else {
            w.terminate();
            worker = null;
            reject(new Error('Worker init failed'));
          }
        }
      };

      // Timeout fallback: if worker does not respond in 3s, use main thread
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          w.removeEventListener('message', handler);
          w.terminate();
          worker = null;
          console.warn('[PicMark] Worker init timeout, falling back to main thread');
          reject(new Error('Worker init timeout'));
        }
      }, 3000);

      w.addEventListener('message', handler);
      w.postMessage(
        {
          type: 'init',
          imageBitmap,
          width: state.outputWidth,
          height: state.outputHeight,
          options,
          fontBuffer: state.customFontBuffer,
          fontFamily: state.customFontFace,
        },
        [imageBitmap]
      );
    });
  }

  function generateOneWithWorker(w, name, index) {
    return new Promise((resolve, reject) => {
      const handler = (e) => {
        if (e.data.index !== index) return;
        w.removeEventListener('message', handler);
        if (e.data.success) {
          resolve(e.data);
        } else {
          reject(new Error(e.data.error));
        }
      };

      w.addEventListener('message', handler);
      w.postMessage({ type: 'generate', text: name, index });
    });
  }

  // ===== Main Thread Fallback =====
  async function generateOneMainThread(name, options) {
    return new Promise((resolve) => {
      // Yield to main thread to keep UI responsive, even when tab is backgrounded
      setTimeout(() => {
        const canvas = document.createElement('canvas');
        canvas.width = state.outputWidth;
        canvas.height = state.outputHeight;
        const c = canvas.getContext('2d');

        c.drawImage(state.workBitmap, 0, 0, state.outputWidth, state.outputHeight);

        c.fillStyle = options.color;
        c.textBaseline = 'top';

        let currentSize = options.fontSize;
        c.font = `${options.fontWeight} ${currentSize}px ${options.fontFamily}`;

        if (options.maxWidth > 0) {
          while (c.measureText(name).width > options.maxWidth && currentSize > 12) {
            currentSize -= 2;
            c.font = `${options.fontWeight} ${currentSize}px ${options.fontFamily}`;
          }
        }

        const textWidth = c.measureText(name).width;
        let x = options.posX;
        if (options.align === 'center') x -= textWidth / 2;
        else if (options.align === 'right') x -= textWidth;

        c.fillText(name, x, options.posY);

        canvas.toBlob((blob) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({ blob, dataUrl: reader.result, text: name, width: state.outputWidth, height: state.outputHeight });
          };
          reader.readAsDataURL(blob);
        }, 'image/png');
      });
    });
  }

  // ===== Batch Generate =====
  els.generateBtn.addEventListener('click', async () => {
    if (state.isGenerating) return;

    const names = els.namesInput.value
      .split(/\r?\n/)
      .map((n) => n.trim())
      .filter(Boolean);

    if (names.length === 0) return;

    // Memory safety check
    const estimatedBytes = state.outputWidth * state.outputHeight * 4 * names.length;
    if (estimatedBytes > 1.5 * 1024 * 1024 * 1024) {
      const confirmMsg = `预计内存占用较大（约 ${(estimatedBytes / 1024 / 1024).toFixed(0)} MB），建议降低输出质量或减少名单数量。是否继续？`;
      if (!confirm(confirmMsg)) return;
    }

    state.isGenerating = true;
    updateGenerateBtn();

    if (state.customFontFace) {
      await document.fonts.ready;
    }

    els.progressBox.style.display = 'flex';
    els.previewList.innerHTML = '';
    state.perf.startTime = performance.now();

    try {
      const zip = new JSZip();
      const total = names.length;
      const options = getGenerationOptions();

      console.log('[PicMark] Generation options:', options);
      console.log('[PicMark] Output size:', state.outputWidth, 'x', state.outputHeight, 'Worker supported:', state.perf.workerSupported, 'Low power:', state.perf.lowPowerMode);

      // Use worker if supported, otherwise fallback to main thread
      const useWorker = state.perf.workerSupported && !state.perf.lowPowerMode;
      let workerInstance = null;

      if (useWorker) {
        try {
          workerInstance = await initWorkerWithImage(options);
        } catch (err) {
          console.warn('[PicMark] Worker init failed:', err.message);
          workerInstance = null;
        }
      }

      for (let i = 0; i < total; i++) {
        const name = names[i];
        let result;

        try {
          if (workerInstance) {
            result = await generateOneWithWorker(workerInstance, name, i);
          } else {
            result = await generateOneMainThread(name, options);
          }
        } catch (err) {
          console.error('[PicMark] Generation error for', name, ':', err.message);
          // Fallback to main thread on worker error
          result = await generateOneMainThread(name, options);
        }

        const safeName = name.replace(/[\\/:*?"<>|]/g, '_');
        zip.file(`${safeName}.png`, result.blob);

        if (i < 9) {
          const thumb = document.createElement('img');
          thumb.src = result.dataUrl;
          thumb.alt = name;
          els.previewList.appendChild(thumb);
        }

        const pct = Math.round(((i + 1) / total) * 100);
        els.progressBarFill.style.width = pct + '%';
        els.progressText.textContent = pct + '%';

        if (i % 3 === 0) {
          updatePerfMonitor();
        }
      }

      terminateWorker();

      const content = await zip.generateAsync({ type: 'blob' });
      const timestamp = formatTimestamp(new Date());
      saveAs(content, `图印工坊_批量生成_${timestamp}.zip`);

      const elapsed = ((performance.now() - state.perf.startTime) / 1000).toFixed(1);
      els.perfWarning.textContent = `生成完成，耗时 ${elapsed} 秒`;
      console.log('[PicMark] Generation completed in', elapsed, 'seconds');
    } catch (err) {
      console.error('[PicMark] Batch generation failed:', err);
      alert('生成失败: ' + err.message);
      els.perfWarning.textContent = '生成失败: ' + err.message;
      terminateWorker();
    }

    state.isGenerating = false;
    els.generateBtn.textContent = '重新生成并下载';
    updateGenerateBtn();
    updatePerfMonitor();
  });

  // ===== Initial state =====
  updatePerfMonitor();
})();
