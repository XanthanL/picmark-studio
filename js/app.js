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
    regionEditor: null,
    nameColumns: ['姓名'],
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
    pointControls: document.getElementById('pointControls'),
    regionControls: document.getElementById('regionControls'),
    regionPreset: document.getElementById('regionPreset'),
    regionCreate: document.getElementById('regionCreate'),
    regionDelete: document.getElementById('regionDelete'),
    regionUndo: document.getElementById('regionUndo'),
    regionRedo: document.getElementById('regionRedo'),
    regionSave: document.getElementById('regionSave'),
    regionLoad: document.getElementById('regionLoad'),
    regionConfigInput: document.getElementById('regionConfigInput'),
    regionList: document.getElementById('regionList'),
    regionConfig: document.getElementById('regionConfig'),
    regionTextSource: document.getElementById('regionTextSource'),
    regionDataColumn: document.getElementById('regionDataColumn'),
    regionDataColumnRow: document.getElementById('regionDataColumnRow'),
    regionFixedTextRow: document.getElementById('regionFixedTextRow'),
    regionFixedText: document.getElementById('regionFixedText'),
    regionFontFamily: document.getElementById('regionFontFamily'),
    regionColor: document.getElementById('regionColor'),
    regionOpacity: document.getElementById('regionOpacity'),
    regionRotation: document.getElementById('regionRotation'),
    regionAlignH: document.getElementById('regionAlignH'),
    regionAlignV: document.getElementById('regionAlignV'),
    regionFontWeight: document.getElementById('regionFontWeight'),
    regionFontStyle: document.getElementById('regionFontStyle'),
    regionLineHeight: document.getElementById('regionLineHeight'),
    regionLetterSpacing: document.getElementById('regionLetterSpacing'),
    regionMinFont: document.getElementById('regionMinFont'),
    regionMaxFont: document.getElementById('regionMaxFont'),
    regionAutoFit: document.getElementById('regionAutoFit'),
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
    const map = { original: I18n.t('quality.label.original'), high: I18n.t('quality.label.high'), medium: I18n.t('quality.label.medium'), low: I18n.t('quality.label.low') };
    return map[quality] || I18n.t('quality.label.high');
  }

  // ===== Performance Monitor =====
  function updatePerfMonitor() {
    if (!els.perfPanel) return;

    els.outputSize.textContent = `${state.outputWidth} × ${state.outputHeight}`;
    els.perfMode.textContent = state.perf.workerSupported ? I18n.t('perf.mode.worker') : I18n.t('perf.mode.main');

    if (performance.memory) {
      const used = (performance.memory.usedJSHeapSize / 1048576).toFixed(1);
      const limit = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(0);
      els.memValue.textContent = `${used} / ${limit} MB`;

      if (performance.memory.usedJSHeapSize > 0.75 * performance.memory.jsHeapSizeLimit) {
        els.perfWarning.textContent = I18n.t('perf.memoryWarning');
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
        reject(new Error(I18n.t('error.imageLoad')));
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
        els.imageInfo.textContent = I18n.t('imageInfo.template', { name: file.name, ow: result.originalWidth, oh: result.originalHeight, w: result.width, h: result.height, q: getQualityLabel(quality) });
        renderPreview();
        updateGenerateBtn();
        startPerfMonitor();
        // 若当前处于区域模式，上传底图后初始化区域编辑器并更新提示
        if (state.mode === 'region') {
          initRegionEditor();
          if (state.regionEditor) els.modeHint.textContent = I18n.t('modeHint.region');
        }
      };
      img.src = url;
    } catch (err) {
      alert(I18n.t('error.imageProcess', { msg: err.message }));
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

    if (state.regionEditor) {
      state.regionEditor.setScale(scale);
      state.regionEditor.setSize(img.width, img.height);
      state.regionEditor.draw();

      // Draw text preview inside regions
      if (state.mode === 'region') {
        const active = state.regionEditor.getActiveRegion();
        const sample = active ? getRegionPreviewText(active) : I18n.t('preview.text');
        state.regionEditor.getRegions().forEach((region) => {
          const text = getRegionPreviewText(region) || sample;
          state.regionEditor.fitAndRender(ctx, text, region);
        });
      }
    }

    if (state.mode === 'position') {
      drawPointPreview(ctx, getPreviewText(), getGenerationOptions());
    }

    updateMarker();
  }

  // 解析名单：支持纯文本（每行一个名字）和 CSV（首行表头，逗号分隔）
  function parseNameData() {
    var raw = els.namesInput.value.trim();
    if (!raw) return { rows: [], columns: ['姓名'] };

    var lines = raw.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
    if (lines.length === 0) return { rows: [], columns: ['姓名'] };

    var delim = lines[0].indexOf('\t') >= 0 ? '\t' : (lines[0].indexOf(',') >= 0 ? ',' : null);

    var isCSV = false;
    if (delim && lines.length >= 2) {
      var colCount1 = lines[0].split(delim).length;
      var colCount2 = lines[1].split(delim).length;
      if (colCount1 >= 2 && colCount1 === colCount2) isCSV = true;
    }

    if (!isCSV) {
      return {
        rows: lines.map(function (l) { return { '姓名': l.trim() }; }),
        columns: ['姓名']
      };
    }

    var headers = lines[0].split(delim).map(function (h) { return h.trim(); });
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var values = lines[i].split(delim);
      var row = {};
      headers.forEach(function (h, idx) { row[h] = (values[idx] || '').trim(); });
      rows.push(row);
    }
    return { rows: rows, columns: headers };
  }

  function getPreviewText() {
    var data = parseNameData();
    if (data.rows.length === 0) return I18n.t('marker.text');
    var firstCol = data.columns[0];
    return data.rows[0][firstCol] || I18n.t('marker.text');
  }

  function getRegionPreviewText(region) {
    if (!region.config.useNameList) return region.config.fixedText || '';
    var data = parseNameData();
    if (data.rows.length === 0) return I18n.t('preview.text');
    var col = region.config.dataColumn || data.columns[0];
    return data.rows[0][col] || '';
  }

  window.addEventListener('resize', () => {
    renderPreview();
  });

  // ===== Mode Switch =====
  function setMode(mode) {
    state.mode = mode;
    els.modeBtns.forEach((b) => b.classList.remove('active'));
    document.querySelector(`.mode-btn[data-mode="${mode}"]`)?.classList.add('active');

    if (mode === 'pick') {
      els.modeHint.textContent = I18n.t('modeHint.pick');
      els.canvas.classList.add('pick-mode');
      els.pointControls.style.display = 'flex';
      els.regionControls.style.display = 'none';
      els.marker.style.display = 'none';
      if (state.regionEditor) state.regionEditor.setMode('select');
    } else if (mode === 'region') {
      els.canvas.classList.remove('pick-mode');
      els.pointControls.style.display = 'none';
      els.regionControls.style.display = 'block';
      els.marker.style.display = 'none';
      initRegionEditor();
      els.modeHint.textContent = state.regionEditor ? I18n.t('modeHint.region') : I18n.t('region.needImage');
    } else {
      els.modeHint.textContent = I18n.t('modeHint.position');
      els.canvas.classList.remove('pick-mode');
      els.pointControls.style.display = 'flex';
      els.regionControls.style.display = 'none';
      els.marker.style.display = 'none';
      if (state.regionEditor) state.regionEditor.setMode('select');
    }
    renderPreview();
  }

  els.modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  // ===== Canvas Click =====
  els.canvas.addEventListener('click', (e) => {
    if (!state.sourceImage) return;
    if (state.mode === 'region') return; // region editor handles its own pointer events

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
      renderPreview();
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
  function getWeightLabel(value) {
    if (value <= 100) return I18n.t('weight.100');
    if (value <= 200) return I18n.t('weight.200');
    if (value <= 300) return I18n.t('weight.300');
    if (value <= 400) return I18n.t('weight.400');
    if (value <= 500) return I18n.t('weight.500');
    if (value <= 600) return I18n.t('weight.600');
    if (value <= 700) return I18n.t('weight.700');
    if (value <= 800) return I18n.t('weight.800');
    return I18n.t('weight.900');
  }

  function checkWeightSupport(value, fontFamily) {
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.check) {
      return true;
    }
    try {
      const firstFamily = fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
      return document.fonts.check(`${value} 16px "${firstFamily}"`);
    } catch (e) {
      return true;
    }
  }

  function updateFontWeightStatus() {
    const value = validateFontWeight();
    const statusEl = els.fontWeightStatus;
    const hintEl = els.fontWeightHint;

    statusEl.textContent = `${value} · ${getWeightLabel(value)}`;

    const family = getFontFamily();
    const supported = checkWeightSupport(value, family);

    if (!supported) {
      hintEl.textContent = I18n.t('weight.hint', { value: value });
    } else {
      hintEl.textContent = '';
    }
  }

  function validateFontWeight() {
    return parseInt(els.fontWeight.value, 10) || 400;
  }

  // ===== Marker =====
  function updateMarker() {
    if (!state.sourceImage) return;
    const color = els.fontColor.value;

    els.marker.style.display = 'none';
    els.pickedColor.style.backgroundColor = color;
    els.colorValue.textContent = color.toUpperCase();
    updateFontWeightStatus();
  }

  function refreshTextPreview() {
    if (state.sourceImage) renderPreview();
    else updateFontWeightStatus();
  }

  els.posX.addEventListener('input', refreshTextPreview);
  els.posY.addEventListener('input', refreshTextPreview);
  els.fontSize.addEventListener('input', refreshTextPreview);
  els.fontColor.addEventListener('input', refreshTextPreview);
  els.textAlign.addEventListener('change', refreshTextPreview);
  els.maxWidth.addEventListener('input', refreshTextPreview);
  els.fontFamily.addEventListener('change', () => {
    refreshTextPreview();
    updateFontWeightStatus();
  });
  els.fontWeight.addEventListener('change', () => {
    refreshTextPreview();
    updateFontWeightStatus();
  });

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
        els.fontName.textContent = I18n.t('font.loaded', { name: file.name });
        if (state.sourceImage) renderPreview();
      } catch (err) {
        alert(I18n.t('font.loadFail', { msg: err.message }));
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
      els.namesInput.value = ev.target.result;
      updateGenerateBtn();
      refreshNameColumns();
      if (state.sourceImage) renderPreview();
    };
    reader.readAsText(file);
  });

  els.namesInput.addEventListener('input', () => {
    updateGenerateBtn();
    refreshNameColumns();
    if (state.sourceImage) renderPreview();
  });

  // 刷新数据列下拉选项
  function refreshNameColumns() {
    var data = parseNameData();
    state.nameColumns = data.columns;
    var sel = els.regionDataColumn;
    var current = sel.value;
    sel.innerHTML = '';
    data.columns.forEach(function (col) {
      var opt = document.createElement('option');
      opt.value = col;
      opt.textContent = col;
      sel.appendChild(opt);
    });
    if (data.columns.indexOf(current) >= 0) sel.value = current;
  }

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

  function drawPointText(c, text, options) {
    c.fillStyle = options.color;
    c.textBaseline = 'top';

    let currentSize = options.fontSize;
    c.font = `${options.fontWeight} ${currentSize}px ${options.fontFamily}`;

    if (options.maxWidth > 0) {
      while (c.measureText(text).width > options.maxWidth && currentSize > 12) {
        currentSize -= 2;
        c.font = `${options.fontWeight} ${currentSize}px ${options.fontFamily}`;
      }
    }

    const textWidth = c.measureText(text).width;
    let x = options.posX;
    if (options.align === 'center') x -= textWidth / 2;
    else if (options.align === 'right') x -= textWidth;

    c.fillText(text, x, options.posY);
  }

  function drawPointPreview(c, text, options) {
    c.save();
    c.scale(state.previewScale, state.previewScale);
    drawPointText(c, text, options);
    c.restore();
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

  function drawRegions(c, row) {
    if (!state.regionEditor) return;
    var data = parseNameData();
    state.regionEditor.getRegions().forEach((region) => {
      var text;
      if (region.config.useNameList) {
        var col = region.config.dataColumn || data.columns[0];
        text = row[col] || '';
      } else {
        text = region.config.fixedText || '';
      }
      if (text) state.regionEditor.fitAndRender(c, text, region);
    });
  }

  // ===== Main Thread Fallback =====
  async function generateOneMainThread(row, nameText, options) {
    return new Promise((resolve) => {
      // Yield to main thread to keep UI responsive, even when tab is backgrounded
      setTimeout(() => {
        const canvas = document.createElement('canvas');
        canvas.width = state.outputWidth;
        canvas.height = state.outputHeight;
        const c = canvas.getContext('2d');

        c.drawImage(state.workBitmap, 0, 0, state.outputWidth, state.outputHeight);

        if (state.regionEditor && state.regionEditor.getRegions().length > 0) {
          drawRegions(c, row);
        } else {
          drawPointText(c, nameText, options);
        }

        canvas.toBlob((blob) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({ blob, dataUrl: reader.result, text: nameText, width: state.outputWidth, height: state.outputHeight });
          };
          reader.readAsDataURL(blob);
        }, 'image/png');
      }, 0);
    });
  }

  // ===== Batch Generate =====
  els.generateBtn.addEventListener('click', async () => {
    if (state.isGenerating) return;

    const nameData = parseNameData();
    const rows = nameData.rows;

    if (rows.length === 0) return;

    // 更新列信息供区域配置使用
    state.nameColumns = nameData.columns;

    // Memory safety check
    const estimatedBytes = state.outputWidth * state.outputHeight * 4 * rows.length;
    if (estimatedBytes > 1.5 * 1024 * 1024 * 1024) {
      const confirmMsg = I18n.t('confirm.memory', { mb: (estimatedBytes / 1024 / 1024).toFixed(0) });
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
      const total = rows.length;
      const options = getGenerationOptions();
      const firstCol = nameData.columns[0];

      console.log('[PicMark] Generation options:', options);
      console.log('[PicMark] Output size:', state.outputWidth, 'x', state.outputHeight, 'Worker supported:', state.perf.workerSupported, 'Low power:', state.perf.lowPowerMode);

      // Use worker if supported and no region text (region rendering is done on main thread)
      const hasRegions = state.regionEditor && state.regionEditor.getRegions().length > 0;
      const useWorker = state.perf.workerSupported && !state.perf.lowPowerMode && !hasRegions;
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
        const row = rows[i];
        const nameText = row[firstCol] || ('row_' + (i + 1));
        let result;

        try {
          if (workerInstance) {
            result = await generateOneWithWorker(workerInstance, nameText, i);
          } else {
            result = await generateOneMainThread(row, nameText, options);
          }
        } catch (err) {
          console.error('[PicMark] Generation error for', nameText, ':', err.message);
          // Fallback to main thread on worker error
          result = await generateOneMainThread(row, nameText, options);
        }

        const safeName = nameText.replace(/[\\/:*?"<>|]/g, '_');
        zip.file(`${safeName}.png`, result.blob);

        if (i < 9) {
          const thumb = document.createElement('img');
          thumb.src = result.dataUrl;
          thumb.alt = nameText;
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
      saveAs(content, I18n.t('generate.zipName', { timestamp: timestamp }) + '.zip');

      const elapsed = ((performance.now() - state.perf.startTime) / 1000).toFixed(1);
      els.perfWarning.textContent = I18n.t('generate.complete', { sec: elapsed });
      console.log('[PicMark] Generation completed in', elapsed, 'seconds');
    } catch (err) {
      console.error('[PicMark] Batch generation failed:', err);
      alert(I18n.t('error.generate', { msg: err.message }));
      els.perfWarning.textContent = I18n.t('error.generate', { msg: err.message });
      terminateWorker();
    }

    state.isGenerating = false;
    els.generateBtn.textContent = I18n.t('generate.btn.again');
    updateGenerateBtn();
    updatePerfMonitor();
  });

  // ===== Region Editor Integration =====
  function initRegionEditor() {
    if (!state.sourceImage) return;
    if (state.regionEditor) {
      state.regionEditor.setScale(state.previewScale);
      state.regionEditor.setSize(state.sourceImage.width, state.sourceImage.height);
      renderRegionList();
      return;
    }

    state.regionEditor = new RegionEditor({
      canvas: els.canvas,
      ctx: ctx,
      scale: state.previewScale,
      width: state.sourceImage.width,
      height: state.sourceImage.height,
      onChange: () => {
        renderRegionList();
        renderPreview();
      },
      onActiveChange: (region) => {
        renderRegionList();
        if (region) {
          syncRegionConfigToUI(region);
          els.regionConfig.style.display = 'block';
        } else {
          els.regionConfig.style.display = 'none';
        }
      },
    });

    renderRegionList();
  }

  function renderRegionList() {
    if (!state.regionEditor) return;
    els.regionList.innerHTML = '';
    const regions = state.regionEditor.getRegions();
    regions.forEach((r, idx) => {
      const item = document.createElement('div');
      item.className = 'region-item' + (r.id === state.regionEditor.activeId ? ' active' : '');
      item.innerHTML = `<span>${I18n.t('region.label')} ${idx + 1} · ${r.width}×${r.height}</span><span>${r.config.useNameList ? (r.config.dataColumn || state.nameColumns[0] || I18n.t('region.label')) : I18n.t('region.fixed')}</span>`;
      item.addEventListener('click', () => state.regionEditor.setActive(r.id));
      els.regionList.appendChild(item);
    });

    els.regionUndo.disabled = !state.regionEditor.canUndo();
    els.regionRedo.disabled = !state.regionEditor.canRedo();
    els.regionDelete.disabled = !state.regionEditor.getActiveRegion();
  }

  function syncRegionConfigToUI(region) {
    if (!region) return;
    const cfg = region.config;
    els.regionTextSource.value = cfg.useNameList ? 'name' : 'fixed';
    els.regionDataColumnRow.style.display = cfg.useNameList ? 'flex' : 'none';
    els.regionFixedTextRow.style.display = cfg.useNameList ? 'none' : 'flex';
    if (cfg.useNameList) {
      var cols = state.nameColumns;
      els.regionDataColumn.innerHTML = '';
      cols.forEach(function (col) {
        var opt = document.createElement('option');
        opt.value = col;
        opt.textContent = col;
        els.regionDataColumn.appendChild(opt);
      });
      els.regionDataColumn.value = cfg.dataColumn && cols.indexOf(cfg.dataColumn) >= 0 ? cfg.dataColumn : cols[0];
    }
    els.regionFixedText.value = cfg.fixedText || '';
    els.regionFontFamily.value = cfg.fontFamily;
    els.regionColor.value = cfg.color;
    els.regionOpacity.value = cfg.opacity;
    els.regionRotation.value = cfg.rotation;
    els.regionAlignH.value = cfg.alignH;
    els.regionAlignV.value = cfg.alignV;
    els.regionFontWeight.value = cfg.fontWeight;
    els.regionFontStyle.value = cfg.fontStyle;
    els.regionLineHeight.value = cfg.lineHeight;
    els.regionLetterSpacing.value = cfg.letterSpacing;
    els.regionMinFont.value = cfg.minFontSize;
    els.regionMaxFont.value = cfg.maxFontSize;
    els.regionAutoFit.checked = cfg.autoFit;
  }

  function bindRegionConfigEvents() {
    // 填充预设下拉（仅保留首项占位，避免重复填充）
    var presets = RegionEditor.getPresets();
    while (els.regionPreset.options.length > 1) {
      els.regionPreset.remove(1);
    }
    presets.forEach(function (p, idx) {
      var opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = p.name + ' · ' + p.desc;
      els.regionPreset.appendChild(opt);
    });

    els.regionPreset.addEventListener('change', function () {
      if (!state.regionEditor) { els.modeHint.textContent = I18n.t('region.needImage'); els.regionPreset.value = ''; return; }
      var idx = parseInt(els.regionPreset.value, 10);
      if (isNaN(idx)) return;
      var preset = presets[idx];
      state.regionEditor.applyPreset(preset);
      els.modeHint.textContent = I18n.t('modeHint.preset', { name: preset.name });
      els.regionPreset.value = '';
      renderPreview();
    });

    els.regionCreate.addEventListener('click', () => {
      if (!state.regionEditor) { els.modeHint.textContent = I18n.t('region.needImage'); return; }
      state.regionEditor.setMode('create');
      els.modeHint.textContent = I18n.t('modeHint.create');
    });

    els.regionDelete.addEventListener('click', () => {
      if (!state.regionEditor) return;
      const active = state.regionEditor.getActiveRegion();
      if (active) state.regionEditor.deleteRegion(active.id);
    });

    els.regionUndo.addEventListener('click', () => { if (state.regionEditor) state.regionEditor.undo(); });
    els.regionRedo.addEventListener('click', () => { if (state.regionEditor) state.regionEditor.redo(); });

    els.regionSave.addEventListener('click', () => {
      if (!state.regionEditor) return;
      const blob = new Blob([state.regionEditor.exportConfig()], { type: 'application/json' });
      saveAs(blob, 'picmark-region-config.json');
    });

    els.regionLoad.addEventListener('click', () => {
      if (!state.regionEditor) { els.modeHint.textContent = I18n.t('region.needImage'); return; }
      els.regionConfigInput.click();
    });
    els.regionConfigInput.addEventListener('change', (e) => {
      if (!state.regionEditor) return;
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        state.regionEditor.loadConfig(ev.target.result);
        renderPreview();
      };
      reader.readAsText(file);
    });

    const configMap = [
      { el: els.regionTextSource, key: 'useNameList', type: 'map', map: { name: true, fixed: false } },
      { el: els.regionDataColumn, key: 'dataColumn', type: 'string' },
      { el: els.regionFixedText, key: 'fixedText', type: 'string' },
      { el: els.regionFontFamily, key: 'fontFamily', type: 'string' },
      { el: els.regionColor, key: 'color', type: 'string' },
      { el: els.regionOpacity, key: 'opacity', type: 'number' },
      { el: els.regionRotation, key: 'rotation', type: 'number' },
      { el: els.regionAlignH, key: 'alignH', type: 'string' },
      { el: els.regionAlignV, key: 'alignV', type: 'string' },
      { el: els.regionFontWeight, key: 'fontWeight', type: 'number' },
      { el: els.regionFontStyle, key: 'fontStyle', type: 'string' },
      { el: els.regionLineHeight, key: 'lineHeight', type: 'number' },
      { el: els.regionLetterSpacing, key: 'letterSpacing', type: 'number' },
      { el: els.regionMinFont, key: 'minFontSize', type: 'number' },
      { el: els.regionMaxFont, key: 'maxFontSize', type: 'number' },
      { el: els.regionAutoFit, key: 'autoFit', type: 'boolean' },
    ];

    configMap.forEach((item) => {
      const event = (item.el.type === 'checkbox' || item.el.tagName === 'SELECT') ? 'change' : 'input';
      item.el.addEventListener(event, () => {
        if (!state.regionEditor) return;
        const region = state.regionEditor.getActiveRegion();
        if (!region) return;
        let value;
        if (item.type === 'boolean') value = item.el.checked;
        else if (item.type === 'map') value = item.map[item.el.value];
        else if (item.type === 'number') value = parseFloat(item.el.value);
        else value = item.el.value;
        state.regionEditor.updateRegion(region.id, { config: { [item.key]: value } });

        if (item.key === 'useNameList') {
          els.regionDataColumnRow.style.display = value ? 'flex' : 'none';
          els.regionFixedTextRow.style.display = value ? 'none' : 'flex';
        }
        renderPreview();
      });
    });
  }

  // ===== Initial state =====
  I18n.apply();
  updatePerfMonitor();
  bindRegionConfigEvents();
  setMode('position');

  // 语言切换后重新渲染预览
  document.querySelector('.lang-toggle')?.addEventListener('click', function () {
    setTimeout(function () {
      if (state.sourceImage) renderPreview();
      if (state.regionEditor) renderRegionList();
    }, 50);
  });
})();
