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
    drawScale: 1,              // 位图 / 图像（放大时 < previewScale，CSS 负责拉伸）
    zoom: 1,                   // 用户缩放倍率，1 = 适应窗口
    customFontFace: null,
    customFontBuffer: null,
    webFonts: {},              // 网络字体 id → { family, buffer }（懒加载后缓存，出图要传给 Worker）
    /* 图层是唯一的内容模型：文字（锚点 / 区域）与 PNG 水印都在这里，
       预览与出图共用 PMLayers.renderAll，不再有「全局文字样式」这份平行状态 */
    layers: [],
    images: {},              // imageKey → HTMLImageElement（水印位图）
    imageMeta: {},           // imageKey → { name, blob, w, h }
    pendingWatermark: null,  // 刚选好、等待拖框放置的水印 key
    pendingTargetLayer: null,// 从图层配置里替换图片时指向的图层 id
    tool: 'select',          // select | point | region | image | pick
    layerEditor: null,
    syncing: false,          // 工具条 ↔ 图层 双向同步时的防回环标记
    cancelRequested: false,
    nameColumns: [I18n.t('column.default')],
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
    cardCanvas: document.getElementById('cardCanvas'),
    imageInfo: document.getElementById('imageInfo'),
    canvasWrapper: document.getElementById('canvasWrapper'),
    canvas: document.getElementById('previewCanvas'),
    marker: document.getElementById('marker'),
    resultCard: document.getElementById('cardResult'),
    fontSize: document.getElementById('fontSize'),
    fontColor: document.getElementById('fontColor'),
    textAlign: document.getElementById('textAlign'),
    textItalic: document.getElementById('textItalic'),
    textUnderline: document.getElementById('textUnderline'),
    textLetterSpacing: document.getElementById('textLetterSpacing'),
    strokeEnabled: document.getElementById('strokeEnabled'),
    strokeWidth: document.getElementById('strokeWidth'),
    strokeColor: document.getElementById('strokeColor'),
    shadowEnabled: document.getElementById('shadowEnabled'),
    shadowBlur: document.getElementById('shadowBlur'),
    maxWidth: document.getElementById('maxWidth'),
    fontFamily: document.getElementById('fontFamily'),
    fontWeight: document.getElementById('fontWeight'),
    fontWeightError: document.getElementById('fontWeightError'),
    fontWeightStatus: document.getElementById('fontWeightStatus'),
    fontWeightHint: document.getElementById('fontWeightHint'),
    quality: document.getElementById('quality'),
    fontInput: document.getElementById('fontInput'),
    fontName: document.getElementById('fontName'),
    webFontStatus: document.getElementById('webFontStatus'),
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
    outputFormat: document.getElementById('outputFormat'),
    cancelBtn: document.getElementById('cancelBtn'),
    layerPanel: document.getElementById('layerPanel'),
    layerList: document.getElementById('layerList'),
    layerConfig: document.getElementById('layerConfig'),
    layerPreset: document.getElementById('layerPreset'),
    layerUp: document.getElementById('layerUp'),
    layerDown: document.getElementById('layerDown'),
    layerDup: document.getElementById('layerDup'),
    layerDel: document.getElementById('layerDel'),
    layerUndo: document.getElementById('layerUndo'),
    layerRedo: document.getElementById('layerRedo'),
    layerSave: document.getElementById('layerSave'),
    layerLoad: document.getElementById('layerLoad'),
    layerConfigInput: document.getElementById('layerConfigInput'),
    watermarkInput: document.getElementById('watermarkInput'),
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
        /* 底图就绪后立刻建画布图层编辑器（没有图层时会自动补一个默认文字图层） */
        ensureLayerEditor();
        setTool(state.tool);
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
    /* 拖拽绑定在整个画布卡上：拖图到卡内任意位置都能上传，
       高亮落在上传按钮上 */
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
      els.cardCanvas.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    ['dragenter', 'dragover'].forEach((evt) => {
      els.cardCanvas.addEventListener(evt, () => {
        els.dropZone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      els.cardCanvas.addEventListener(evt, (e) => {
        if (evt === 'dragleave' && els.cardCanvas.contains(e.relatedTarget)) return;
        els.dropZone.classList.remove('drag-over');
      });
    });
    els.cardCanvas.addEventListener('drop', (e) => {
      loadTemplate(e.dataTransfer.files[0]);
    });
  }

  // ===== Render Preview =====
  function renderPreview() {
    const img = state.sourceImage;
    if (!img) return;

    const wrapperW = els.canvasWrapper.clientWidth;
    /* 画布常驻（sticky）后高度受视口约束，scale 必须同时满足宽、高两个约束。
       只按宽度算的话，CSS 会把 canvas 二次缩小，而 previewScale 仍是旧值，
       区域编辑的鼠标坐标换算就会整体错位（框画不出来 / 点不中已有区域）。
       高度上限从 CSS 变量读，与样式保持单一数据源。 */
    /* 高度上限取 wrapper 已计算好的 max-height（calc 在这里会被解析成 px），
       再减掉它自己的上下 padding。注意：自定义属性里的 calc() 不会被
       getComputedStyle 计算，直接读 --canvas-max-h 只会拿到 NaN。 */
    const cs = getComputedStyle(els.canvasWrapper);
    const wrapperMaxH = parseFloat(cs.maxHeight);
    const padV = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const maxH = isFinite(wrapperMaxH) ? wrapperMaxH - padV : Infinity;
    /* 适应比例：同时满足宽、高两个约束（画布常驻后高度受视口限制） */
    const fit = isFinite(maxH) && maxH > 0
      ? Math.min(wrapperW / img.width, maxH / img.height)
      : wrapperW / img.width;

    /* 用户缩放：zoom=1 即"适应"。内部位图最多取到原图 1:1，超出的部分
       交给 CSS 拉伸显示——否则放大 3 倍时 canvas 位图会吃掉几百 MB 内存。
       previewScale 始终等于「实际显示宽 / 原图宽」，区域坐标才不会错位。 */
    const zoom = state.zoom || 1;
    const target = fit * zoom;
    const canvasScale = Math.min(target, 1);
    const canvasW = Math.max(1, Math.floor(img.width * canvasScale));
    const canvasH = Math.max(1, Math.floor(img.height * canvasScale));

    els.canvas.width = canvasW;
    els.canvas.height = canvasH;
    if (target > canvasScale) {
      /* 放大超过 1:1：用 CSS 拉伸，并解除 max-width 限制，让画布区可以滚动查看 */
      els.canvas.style.width = Math.round(img.width * target) + 'px';
      els.canvas.style.height = 'auto';
      els.canvas.style.maxWidth = 'none';
    } else {
      els.canvas.style.width = '';
      els.canvas.style.height = '';
      els.canvas.style.maxWidth = '';
    }
    ctx.drawImage(img, 0, 0, canvasW, canvasH);

    state.previewScale = target;
    const scale = target;
    /* 位图坐标系里实际用的是 canvasScale（放大时 target > canvasScale，
       CSS 负责拉伸）。旧版这里误用 target，导致放大后图层整体错位。 */
    const drawScale = canvasScale;
    /* 取色要把「图像坐标」换算成位图坐标，用的正是这个系数 */
    state.drawScale = canvasScale;

    if (state.layerEditor) {
      state.layerEditor.setScale(drawScale, scale);
      state.layerEditor.setSize(img.width, img.height);
    }

    /* 预览与出图走同一条渲染链，只有缩放系数不同 —— 这是 WYSIWYG 的保证 */
    ctx.save();
    ctx.scale(drawScale, drawScale);
    PMLayers.renderAll(ctx, state.layers, previewEnv());
    ctx.restore();

    if (state.layerEditor) state.layerEditor.draw();

    updateMarker();
  }

  /* 预览环境：取名单第一行；没有名单时每列都填占位文本，画布不至于空着 */
  function previewEnv() {
    var data = parseNameData();
    var row = data.rows.length ? data.rows[0] : null;
    if (!row) {
      row = {};
      (data.columns && data.columns.length ? data.columns : [I18n.t('column.default')]).forEach(function (c) {
        row[c] = I18n.t('preview.text');
      });
    }
    return { row: row, columns: data.columns, images: state.images, preview: true };
  }

  // 按分隔符切分一行，支持双引号包裹的字段（字段内可含分隔符与转义引号 ""）
  function splitLine(line, delim) {
    var out = [];
    var cur = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"' && cur === '') {
        inQuotes = true;
      } else if (ch === delim) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  // 解析名单：支持纯文本（每行一个名字）和 CSV（首行表头，逗号分隔）
  function parseNameData() {
    var raw = els.namesInput.value.trim();
    if (!raw) return { rows: [], columns: [I18n.t('column.default')] };

    var lines = raw.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
    if (lines.length === 0) return { rows: [], columns: [I18n.t('column.default')] };

    var delim = lines[0].indexOf('\t') >= 0 ? '\t' : (lines[0].indexOf(',') >= 0 ? ',' : null);

    var isCSV = false;
    if (delim && lines.length >= 2) {
      var colCount1 = splitLine(lines[0], delim).length;
      var colCount2 = splitLine(lines[1], delim).length;
      if (colCount1 >= 2 && colCount1 === colCount2) isCSV = true;
    }

    if (!isCSV) {
      return {
        rows: lines.map(function (l) { var o = {}; o[I18n.t('column.default')] = l.trim(); return o; }),
        columns: [I18n.t('column.default')]
      };
    }

    var headers = splitLine(lines[0], delim).map(function (h) { return h.trim(); });
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var values = splitLine(lines[i], delim);
      var row = {};
      headers.forEach(function (h, idx) { row[h] = (values[idx] || '').trim(); });
      rows.push(row);
    }
    return { rows: rows, columns: headers };
  }

  /* 顶栏和工具条都是吸顶的，图层列表若用 sticky 必须避开它们的实际高度。
     高度随工具条内容（换行数）变化，所以这里实测后写进 CSS 变量 */
  function syncStickyOffset() {
    var railEl = document.querySelector('.rail');
    if (!railEl) return;
    var topbarEl = document.querySelector('.topbar');
    var h = (topbarEl ? topbarEl.offsetHeight : 62) + railEl.offsetHeight + 14;
    document.documentElement.style.setProperty('--rail-sticky-top', Math.round(h) + 'px');
  }

  window.addEventListener('resize', () => {
    syncStickyOffset();
    renderPreview();
  });

  (function watchRailHeight() {
    var railEl = document.querySelector('.rail');
    if (!railEl) return;
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(syncStickyOffset).observe(railEl);
    }
    syncStickyOffset();
  })();

  // ===== 工具切换 =====
  // select 选择/移动 · point 放置文字 · region 框出区域文字 · image 放置水印 · pick 取色
  function setTool(tool) {
    state.tool = tool;
    document.body.dataset.tool = tool;
    els.modeBtns.forEach((b) => b.classList.remove('active'));
    document.querySelector(`.mode-btn[data-tool="${tool}"]`)?.classList.add('active');

    els.canvas.classList.toggle('pick-mode', tool === 'pick');
    els.marker.style.display = 'none';

    if (state.layerEditor) {
      /* pick 模式下编辑器不接管指针（不选中、不拖动），别的按工具切绘制模式 */
      var createMode = tool === 'pick' ? 'pick'
        : (tool === 'region' ? 'create-region' : (tool === 'image' ? 'create-image' : 'select'));
      state.layerEditor.setMode(createMode);
    }
    els.modeHint.textContent = I18n.t('modeHint.' + tool);
    renderPreview();
  }

  els.modeBtns.forEach((btn) => {
    var tool = btn.dataset.tool;
    btn.addEventListener('click', () => {
      if (tool === 'image') {
        /* 水印必须先有图：直接开文件选择，选完再进入拖框状态 */
        if (!state.sourceImage) { els.modeHint.textContent = I18n.t('region.needImage'); return; }
        els.watermarkInput.click();
        return;
      }
      setTool(tool);
    });
  });

  // ===== Color Picker =====
  /* 取色一律走「底图坐标」，不走预览画布坐标：
     · 预览画布上已经画了我们的文字，点在文字上会取到自己刚画的颜色（等于没取）
     · 放大到 >100% 时 CSS 会拉伸画布，clientX 与位图像素不再是 1:1
     所以先换算成图像坐标，再用 1×1 离屏画布从底图取样 —— 与缩放、与已画内容都无关。 */
  var pickCanvas = null;
  var pickCtx = null;

  function pickColor(imgX, imgY) {
    const img = state.sourceImage;
    if (!img) return null;
    if (!pickCanvas) {
      pickCanvas = document.createElement('canvas');
      pickCanvas.width = 1;
      pickCanvas.height = 1;
      pickCtx = pickCanvas.getContext('2d', { willReadFrequently: true });
    }
    const x = Math.max(0, Math.min(Math.round(imgX), img.width - 1));
    const y = Math.max(0, Math.min(Math.round(imgY), img.height - 1));
    pickCtx.clearRect(0, 0, 1, 1);
    try {
      pickCtx.drawImage(img, x, y, 1, 1, 0, 0, 1, 1);
    } catch (err) {
      return null;
    }
    const pixel = pickCtx.getImageData(0, 0, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    els.fontColor.value = hex;
    /* 触发 input：同步色卡高亮 + 把颜色写回当前文字图层 + 重绘预览 */
    fire(els.fontColor, 'input');
    updateMarker();
    els.modeHint.textContent = activeTextLayer()
      ? I18n.t('modeHint.picked', { hex: hex.toUpperCase() })
      : I18n.t('modeHint.pickedNoLayer', { hex: hex.toUpperCase() });
    return hex;
  }

  /* 取色模式下点画布任何位置都只取色，不选中也不拖动图层。
     capture 抢在图层编辑器前面，并阻止它继续处理这次按下。
     用 pointerdown 而非 click：触屏上 touchstart 被 preventDefault 后不会合成 click。 */
  els.canvas.addEventListener('pointerdown', (e) => {
    if (!state.sourceImage || state.tool !== 'pick') return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = els.canvas.getBoundingClientRect();
    const img = state.sourceImage;
    /* 实测显示宽度反推缩放：CSS 可能二次压缩（max-width:100%），
       比直接用 previewScale 更贴近眼睛看到的位置 */
    const vs = (rect.width > 0 && img.width) ? rect.width / img.width : state.previewScale;
    pickColor((e.clientX - rect.left) / vs, (e.clientY - rect.top) / vs);
  }, true);

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

  /* 工具条上的控件编辑的是「当前选中的文字图层」。
     没有选中文字图层时退回第一个文字图层，一个都没有就只更新状态提示。 */
  function activeTextLayer() {
    var ed = state.layerEditor;
    if (!ed) return null;
    var l = ed.active();
    if (l && l.type === 'text') return l;
    return ed.getLayers().find(function (x) { return x.type === 'text'; }) || null;
  }

  /* 工具条 → 图层（可指定目标；不指定时写当前选中的文字图层）*/
  function railToLayer(target) {
    var l = target || activeTextLayer();
    if (!l) return;
    l.fontSize = parseInt(els.fontSize.value, 10) || 60;
    l.fontFamily = getFontFamily();
    l.fontWeight = validateFontWeight();
    l.color = els.fontColor.value;
    l.align = els.textAlign.value;
    l.italic = !!(els.textItalic && els.textItalic.checked);
    l.underline = !!(els.textUnderline && els.textUnderline.checked);
    l.letterSpacing = parseInt(els.textLetterSpacing ? els.textLetterSpacing.value : 0, 10) || 0;
    l.maxWidth = parseInt(els.maxWidth.value, 10) || 0;
    l.stroke = !!(els.strokeEnabled && els.strokeEnabled.checked);
    l.strokeWidth = parseInt(els.strokeWidth ? els.strokeWidth.value : 0, 10) || 0;
    l.strokeColor = els.strokeColor ? els.strokeColor.value : '#ffffff';
    l.shadow = !!(els.shadowEnabled && els.shadowEnabled.checked);
    l.shadowBlur = parseInt(els.shadowBlur ? els.shadowBlur.value : 0, 10) || 0;
    l.shadowColor = 'rgba(0, 0, 0, 0.38)';
  }

  function fire(el, type) {
    if (el) el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  /* 图层 → 工具条（切换图层时把样式灌回工具条，避免"看着 A 改到 B"）*/
  function layerToRail(l) {
    if (!l) return;
    state.syncing = true;
    els.fontSize.value = l.fontSize || 60; fire(els.fontSize, 'input');
    els.fontFamily.value = l.fontFamily; fire(els.fontFamily, 'change');
    els.fontWeight.value = l.fontWeight || 400; fire(els.fontWeight, 'change');
    els.fontColor.value = l.color || '#111111'; fire(els.fontColor, 'input');
    els.textAlign.value = l.align || 'center'; fire(els.textAlign, 'change');
    if (els.textItalic) { els.textItalic.checked = !!l.italic; fire(els.textItalic, 'change'); }
    if (els.textUnderline) { els.textUnderline.checked = !!l.underline; fire(els.textUnderline, 'change'); }
    if (els.textLetterSpacing) { els.textLetterSpacing.value = l.letterSpacing || 0; fire(els.textLetterSpacing, 'input'); }
    els.maxWidth.value = l.maxWidth || 0; fire(els.maxWidth, 'input');
    if (els.strokeEnabled) { els.strokeEnabled.checked = !!l.stroke; fire(els.strokeEnabled, 'change'); }
    if (els.strokeWidth) { els.strokeWidth.value = l.strokeWidth || 3; fire(els.strokeWidth, 'input'); }
    if (els.strokeColor) { els.strokeColor.value = l.strokeColor || '#ffffff'; fire(els.strokeColor, 'input'); }
    if (els.shadowEnabled) { els.shadowEnabled.checked = !!l.shadow; fire(els.shadowEnabled, 'change'); }
    if (els.shadowBlur) { els.shadowBlur.value = l.shadowBlur || 12; fire(els.shadowBlur, 'input'); }
    state.syncing = false;
  }

  function refreshTextPreview() {
    if (!state.syncing) railToLayer();
    updateFontWeightStatus();
    if (state.sourceImage) renderPreview();
  }

  els.fontSize.addEventListener('input', refreshTextPreview);
  els.fontColor.addEventListener('input', refreshTextPreview);
  els.textAlign.addEventListener('change', refreshTextPreview);
  els.maxWidth.addEventListener('input', refreshTextPreview);
  els.fontFamily.addEventListener('change', () => {
    ensureWebFonts();
    refreshTextPreview();
    updateFontWeightStatus();
  });
  els.fontWeight.addEventListener('change', () => {
    refreshTextPreview();
    updateFontWeightStatus();
  });

  /* 新增样式项（斜体 / 下划线 / 字间距 / 描边 / 投影）：
     checkbox 与 number 都用 change，range 用 input，两条都挂上最省心 */
  ['textItalic', 'textUnderline', 'textLetterSpacing', 'strokeEnabled',
    'strokeWidth', 'strokeColor', 'shadowEnabled', 'shadowBlur'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', refreshTextPreview);
    el.addEventListener('change', refreshTextPreview);
  });

  // ===== Quality change re-process =====
  if (els.quality) {
    els.quality.addEventListener('change', () => {
      if (state.sourceFile) {
        loadTemplate(state.sourceFile);
      }
    });
  }

  // ===== 开源网络字体（按需懒加载）=====
  const WEB_PREFIX = 'web:';

  function webFontIdsInUse() {
    const ids = [];
    const collect = (v) => {
      if (typeof v === 'string' && v.indexOf(WEB_PREFIX) === 0) {
        const id = v.slice(WEB_PREFIX.length);
        if (ids.indexOf(id) < 0) ids.push(id);
      }
    };
    collect(els.fontFamily.value);
    (state.layers || []).forEach((l) => collect(l.fontFamily));
    return ids;
  }

  function setWebFontStatus(text) {
    if (els.webFontStatus) els.webFontStatus.textContent = text || '';
  }

  /* 选中网络字体后真正去取字形数据；失败则退回系统字体栈并如实提示，
     绝不让界面停在一个「选了但没反应」的状态 */
  async function ensureWebFonts() {
    if (!window.PMWebFonts) return;
    const ids = webFontIdsInUse();
    if (!ids.length) { setWebFontStatus(''); return; }
    const W = window.PMWebFonts;
    const lang = window.I18n && I18n.current ? I18n.current() : 'zh-CN';
    let changed = false;
    for (const id of ids) {
      if (state.webFonts[id]) continue;
      const name = W.labelOf(id, lang === 'en' ? 'en' : 'zh');
      setWebFontStatus(I18n.t('font.web.loading', { name: name }));
      const got = await W.ensure(id);
      if (got) {
        state.webFonts[id] = got;
        changed = true;
        setWebFontStatus(I18n.t('font.web.ready', { name: name }));
      } else {
        setWebFontStatus(I18n.t('font.web.fail', { name: name }));
      }
    }
    if (!changed) return;
    /* 字形到位后才真正生效：选中的那一刻字体还没下载完，图层里写的是
       同风格的系统兜底栈。这里把真正的 family 回写进当前图层并重绘，
       否则「选了马善政、画布还是楷体」会一直维持到用户下次动工具条。
       下载期间如果用户切了别的图层，下拉值已被灌回那个图层的字体，
       这时下拉不再是 web: —— 就不该再写，避免把字体落到错误的图层上。 */
    const val = els.fontFamily.value;
    if (val.indexOf(WEB_PREFIX) === 0) {
      const idNow = val.slice(WEB_PREFIX.length);
      if (state.webFonts[idNow] && !state.syncing) railToLayer();
    }
    if (state.sourceImage) renderPreview();
  }

  /* 出图时把「用得到的」字形数据交给 Worker（自定义字体 + 网络字体） */
  function fontPayloadForWorker() {
    const out = [];
    if (state.customFontFace && state.customFontBuffer) {
      out.push({ family: state.customFontFace, buffer: state.customFontBuffer });
    }
    webFontIdsInUse().forEach((id) => {
      const f = state.webFonts[id];
      if (f) out.push({ family: f.family, buffer: f.buffer });
    });
    return out;
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

  /* 数据列下拉由图层面板在渲染时按需生成（列随名单变化），
     这里只需同步 state 并重画一次面板即可 */
  function refreshNameColumns() {
    var data = parseNameData();
    var changed = state.nameColumns.join('') !== data.columns.join('');
    state.nameColumns = data.columns;
    if (changed && state.layerEditor) panelRender();
  }

  function updateGenerateBtn() {
    const hasImage = !!state.sourceImage;
    const hasNames = els.namesInput.value.trim().length > 0;
    els.generateBtn.disabled = !(hasImage && hasNames) || state.isGenerating;
    /* 引导条随状态走：底图 / 名单 / 产出 任一变化都要重算「现在该干什么」 */
    if (window.PMOnboard) window.PMOnboard.refresh();
  }

  function getFontFamily() {
    const val = els.fontFamily.value;
    if (val === 'custom') return state.customFontFace || 'sans-serif';
    if (val.indexOf(WEB_PREFIX) === 0) {
      const id = val.slice(WEB_PREFIX.length);
      const loaded = state.webFonts[id];
      if (loaded) return loaded.family;
      /* 还没下载完（或下载失败）：先用同风格的系统字体顶着，不留空 */
      return window.PMWebFonts ? PMWebFonts.fallbackOf(id) : 'sans-serif';
    }
    return val;
  }

  /* 出图：底图 + 图层，与预览完全同一条渲染链（PMLayers.renderAll） */
  function paintOutput(c, env) {
    c.drawImage(state.workBitmap, 0, 0, state.outputWidth, state.outputHeight);
    if (els.outputFormat && els.outputFormat.value === 'jpeg') {
      /* JPG 不支持透明：先铺一层白底，否则透明区会变黑 */
      c.save();
      c.globalCompositeOperation = 'destination-over';
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, state.outputWidth, state.outputHeight);
      c.restore();
    }
    PMLayers.renderAll(c, state.layers, env);
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

  async function initWorkerWithImage() {
    const w = initWorker();
    if (!w) return null;

    const imageBitmap = await createImageBitmap(state.workBlob);
    const transfer = [imageBitmap];

    /* 水印位图：每个 key 单独 createImageBitmap 一份给 worker，
       transfer 之后主线程那份（HTMLImageElement）仍可用于预览 */
    const workerImages = [];
    for (const key of Object.keys(state.images)) {
      const meta = state.imageMeta[key];
      if (!meta || !meta.blob) continue;
      try {
        const bmp = await createImageBitmap(meta.blob);
        workerImages.push({ key: key, bitmap: bmp });
        transfer.push(bmp);
      } catch (e) {
        console.warn('[PicMark] watermark bitmap failed:', key, e.message);
      }
    }

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
          /* 图层是纯数据，可以安全结构化克隆；水印位图单独 transfer */
          layers: JSON.parse(JSON.stringify(state.layers)),
          images: workerImages,
          format: outputMime(),
          /* 字形数据：自定义上传的 + 所有已加载的开源网络字体，
             Worker 里逐个 FontFace 注册，保证出图与预览同字形 */
          fonts: fontPayloadForWorker(),
        },
        transfer
      );
    });
  }

  function generateOneWithWorker(w, row, columns, index) {
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
      w.postMessage({ type: 'generate', row: row, columns: columns, index: index });
    });
  }

  function outputMime() {
    return els.outputFormat && els.outputFormat.value === 'jpeg' ? 'image/jpeg' : 'image/png';
  }

  function outputExt() {
    return els.outputFormat && els.outputFormat.value === 'jpeg' ? 'jpg' : 'png';
  }

  // ===== Main Thread Fallback =====
  async function generateOneMainThread(row, nameText, columns) {
    return new Promise((resolve) => {
      // Yield to main thread to keep UI responsive, even when tab is backgrounded
      setTimeout(() => {
        const canvas = document.createElement('canvas');
        canvas.width = state.outputWidth;
        canvas.height = state.outputHeight;
        const c = canvas.getContext('2d');

        paintOutput(c, { row: row, columns: columns, images: state.images });

        canvas.toBlob((blob) => {
          resolve({ blob: blob, text: nameText, width: state.outputWidth, height: state.outputHeight });
        }, outputMime(), 0.92);
      }, 0);
    });
  }

  // ===== Batch Generate =====
  // 缩略图使用 Object URL，下一次生成前需释放
  let thumbUrls = [];

  function clearThumbnails() {
    thumbUrls.forEach((u) => URL.revokeObjectURL(u));
    thumbUrls = [];
    els.previewList.innerHTML = '';
    els.resultCard.style.display = 'none';
  }

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
    state.cancelRequested = false;
    updateGenerateBtn();
    els.cancelBtn.style.display = '';

    /* 出图前把用到的开源网络字体全部拉齐，否则成品会退回系统字体 */
    await ensureWebFonts();
    if (state.customFontFace || webFontIdsInUse().length) {
      await document.fonts.ready;
    }

    els.progressBox.style.display = 'flex';
    els.progressBarFill.style.width = '0%';
    els.progressText.textContent = '0%';
    els.perfWarning.textContent = '';
    clearThumbnails();
    els.resultCard.style.display = '';
    state.perf.startTime = performance.now();

    try {
      const zip = new JSZip();
      const total = rows.length;
      const columns = nameData.columns;
      const firstCol = columns[0];
      const usedNames = Object.create(null);
      const ext = outputExt();

      console.log('[PicMark] Layers:', state.layers.length, 'Output size:', state.outputWidth, 'x', state.outputHeight, 'Worker supported:', state.perf.workerSupported, 'Low power:', state.perf.lowPowerMode);

      /* 图层模型下 Worker 也能完整渲染（区域文字 / 水印都进了内核），
         不再像旧版那样「有区域就退回主线程」 */
      const useWorker = state.perf.workerSupported && !state.perf.lowPowerMode;
      let workerInstance = null;

      if (useWorker) {
        try {
          workerInstance = await initWorkerWithImage();
        } catch (err) {
          console.warn('[PicMark] Worker init failed:', err.message);
          workerInstance = null;
        }
      }

      for (let i = 0; i < total; i++) {
        if (state.cancelRequested) {
          els.perfWarning.textContent = I18n.t('generate.cancelled', { n: i });
          break;
        }
        const row = rows[i];
        const nameText = row[firstCol] || ('row_' + (i + 1));
        let result;

        try {
          if (workerInstance) {
            result = await generateOneWithWorker(workerInstance, row, columns, i);
          } else {
            result = await generateOneMainThread(row, nameText, columns);
          }
        } catch (err) {
          console.error('[PicMark] Generation error for', nameText, ':', err.message);
          // Fallback to main thread on worker error
          result = await generateOneMainThread(row, nameText, columns);
        }

        // 重名时追加序号，避免 ZIP 内同名文件互相覆盖
        let safeName = nameText.replace(/[\\/:*?"<>|]/g, '_');
        if (usedNames[safeName]) {
          usedNames[safeName]++;
          safeName = safeName + '_' + usedNames[safeName];
        } else {
          usedNames[safeName] = 1;
        }
        zip.file(`${safeName}.${ext}`, result.blob);

        if (i < 9) {
          const thumbUrl = URL.createObjectURL(result.blob);
          thumbUrls.push(thumbUrl);
          const thumb = document.createElement('img');
          thumb.src = thumbUrl;
          thumb.alt = nameText;
          els.previewList.appendChild(thumb);
        }

        const pct = Math.round(((i + 1) / total) * 100);
        els.progressBarFill.style.width = pct + '%';
        els.progressText.textContent = `${i + 1}/${total} · ${pct}%`;

        if (i % 3 === 0) {
          updatePerfMonitor();
        }
      }

      terminateWorker();

      if (!state.cancelRequested) {
        // PNG / JPG 本身已是压缩格式，再次 deflate 收益微小且耗时，直接存储可大幅提速打包
        const content = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
        const timestamp = formatTimestamp(new Date());
        saveAs(content, I18n.t('generate.zipName', { timestamp: timestamp }) + '.zip');

        const elapsed = ((performance.now() - state.perf.startTime) / 1000).toFixed(1);
        els.perfWarning.textContent = I18n.t('generate.complete', { sec: elapsed });
        console.log('[PicMark] Generation completed in', elapsed, 'seconds');
      }
    } catch (err) {
      console.error('[PicMark] Batch generation failed:', err);
      alert(I18n.t('error.generate', { msg: err.message }));
      els.perfWarning.textContent = I18n.t('error.generate', { msg: err.message });
      terminateWorker();
    }

    state.isGenerating = false;
    state.cancelRequested = false;
    els.cancelBtn.style.display = 'none';
    els.generateBtn.textContent = I18n.t('generate.btn.again');
    updateGenerateBtn();
    updatePerfMonitor();
  });

  els.cancelBtn.addEventListener('click', () => {
    if (!state.isGenerating) return;
    state.cancelRequested = true;
    terminateWorker();
  });

  // ===== 图层系统 =====
  function panelRender() {
    PMLayerPanel.render();
    var ed = state.layerEditor;
    var has = !!ed;
    var act = has && !!ed.active();
    els.layerUp.disabled = !act;
    els.layerDown.disabled = !act;
    els.layerDup.disabled = !act;
    els.layerDel.disabled = !act;
    els.layerUndo.disabled = !(has && ed.canUndo());
    els.layerRedo.disabled = !(has && ed.canRedo());
  }

  function ensureLayerEditor() {
    if (!state.sourceImage) return null;
    if (state.layerEditor) {
      state.layerEditor.setSize(state.sourceImage.width, state.sourceImage.height);
      return state.layerEditor;
    }

    state.layerEditor = new LayerEditor({
      canvas: els.canvas,
      ctx: ctx,
      layers: state.layers,
      width: state.sourceImage.width,
      height: state.sourceImage.height,
      drawScale: state.previewScale,
      viewScale: state.previewScale,
      onChange: function () {
        /* 用户真的动过图层（移动/缩放/旋转/改属性）才算走完「第 2 步」；
           系统自动补的默认图层不算，否则这条引导永远不会出现 */
        if (!state.suppressTouch) state.layerTouched = true;
        panelRender();
        /* 图层可以单独选字体，这里也要兜住网络字体的懒加载 */
        ensureWebFonts();
        if (state.sourceImage) renderPreview();
        /* 动了图层 = 第 2 步完成，引导条要立刻跟着变 */
        if (window.PMOnboard) window.PMOnboard.refresh();
      },
      onSelect: function (l) {
        if (l && l.type === 'text') layerToRail(l);
        panelRender();
      },
      onBackground: function (p) { handleBackground(p); },
      onCreate: function (rect) { createLayerFromRect(rect); }
    });
    PMLayerPanel.setEditor(state.layerEditor);

    /* 首次有底图时给一个默认文字图层，位置和旧版定位模式一致：
       水平居中、纵向 60%，这样一上来点名单就能看到效果 */
    if (!state.layers.length) {
      var W = state.sourceImage.width;
      var H = state.sourceImage.height;
      var def = PMLayers.create('text', {
        mode: 'point',
        name: I18n.t('layer.text', '文字') + ' 1',
        x: Math.round(W / 2),
        y: Math.round(H * 0.6),
        align: 'center'
      });
      railToLayer(def);
      /* 这一层是系统补的，不该让「第 2 步」引导直接判定完成 */
      state.suppressTouch = true;
      state.layerEditor.addLayer(def);
      state.suppressTouch = false;
    }
    panelRender();
    return state.layerEditor;
  }

  /* 画布空白处的点击：按当前工具决定做什么 */
  function handleBackground(p) {
    if (state.tool === 'pick') {
      pickColor(p.x, p.y);
      return;
    }
    if (state.tool === 'point') {
      var l = state.layerEditor && state.layerEditor.active();
      if (l && l.type === 'text' && l.mode !== 'region') {
        l.x = Math.round(p.x);
        l.y = Math.round(p.y);
        state.layerEditor._pushHistory();
      } else {
        var nl = PMLayers.create('text', {
          mode: 'point',
          name: I18n.t('layer.text', '文字') + ' ' + (state.layers.length + 1),
          x: Math.round(p.x),
          y: Math.round(p.y)
        });
        railToLayer(nl);
        state.layerEditor.addLayer(nl);
      }
      panelRender();
      renderPreview();
      return;
    }
    // select：点空白 = 取消选中
    if (state.layerEditor) {
      state.layerEditor.activeId = null;
      panelRender();
      state.layerEditor.draw();
    }
  }

  /* 拖框结束（或单击）后建图层 */
  function createLayerFromRect(rect) {
    var W = state.sourceImage.width;
    var H = state.sourceImage.height;
    var layer;

    if (state.tool === 'image') {
      var key = state.pendingWatermark;
      if (!key || !state.images[key]) {
        els.modeHint.textContent = I18n.t('watermark.need', '请先选择一张 PNG 图片作为水印');
        setTool('select');
        return;
      }
      var meta = state.imageMeta[key] || { w: 100, h: 100 };
      var tw, th;
      if (rect.w > 0 && rect.h > 0) {
        tw = rect.w; th = rect.h;
      } else {
        tw = W * 0.3;
        th = tw * (meta.h / Math.max(1, meta.w));
      }
      layer = PMLayers.create('image', {
        name: (meta.name || I18n.t('layer.watermark', '水印')).replace(/\.[a-z]+$/i, ''),
        imageKey: key,
        x: Math.round(rect.x - tw / 2),
        y: Math.round(rect.y - th / 2),
        w: Math.round(tw),
        h: Math.round(th)
      });
    } else {
      var rw = rect.w > 0 ? rect.w : W * 0.4;
      var rh = rect.h > 0 ? rect.h : H * 0.15;
      layer = PMLayers.create('text', {
        mode: 'region',
        name: I18n.t('layer.region', '区域') + ' ' + (state.layers.length + 1),
        x: Math.round(rect.x - rw / 2),
        y: Math.round(rect.y - rh / 2),
        w: Math.round(rw),
        h: Math.round(rh),
        autoFit: true
      });
      railToLayer(layer);
    }

    state.layerEditor.addLayer(layer);
    /* 工具保持激活：名单类模板往往要连画几个框（姓名/编号/日期），
       画完又跳回选择工具反而多两次点击。命中已有图层时仍是拖动它，不冲突 */
    panelRender();
    renderPreview();
  }

  /* 水印图片：页面用 HTMLImageElement 预览，另转一份 ImageBitmap 给 Worker */
  els.watermarkInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    els.watermarkInput.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      const key = PMLayers.uid('WM');
      state.images[key] = img;
      state.imageMeta[key] = { name: file.name, blob: file, w: img.naturalWidth, h: img.naturalHeight };

      /* 从图层配置里的「选择图片」进来：直接替换该图层的图，不新建图层 */
      const targetId = state.pendingTargetLayer;
      const target = targetId && state.layerEditor
        ? state.layerEditor.getLayers().find((l) => l.id === targetId)
        : null;
      state.pendingTargetLayer = null;
      if (target && target.type === 'image') {
        target.imageKey = key;
        target.name = file.name.replace(/\.[a-z]+$/i, '') || I18n.t('layer.watermark', '水印');
        state.layerEditor._pushHistory();
        panelRender();
        renderPreview();
        return;
      }

      state.pendingWatermark = key;
      els.modeHint.textContent = I18n.t('modeHint.image');
      setTool('image');
      renderPreview();
    };
    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  });

  /* ===== 图层面板按钮 ===== */
  function bindLayerToolbar() {
    var presets = window.PMLayerPresets || [];
    while (els.layerPreset.options.length > 1) els.layerPreset.remove(1);
    presets.forEach(function (p, idx) {
      var opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = p.name + ' · ' + p.desc;
      els.layerPreset.appendChild(opt);
    });

    els.layerPreset.addEventListener('change', function () {
      if (!state.layerEditor) { els.modeHint.textContent = I18n.t('region.needImage'); els.layerPreset.value = ''; return; }
      var idx = parseInt(els.layerPreset.value, 10);
      if (isNaN(idx)) return;
      var preset = presets[idx];
      var W = state.sourceImage.width;
      var H = state.sourceImage.height;
      state.layers = preset.regions.map(function (r, i) {
        var cfg = Object.assign({}, r.config);
        var name = cfg.name || (I18n.t('layer.region', '区域') + ' ' + (i + 1));
        delete cfg.name;
        var l = PMLayers.create('text', Object.assign({
          mode: 'region',
          name: name,
          x: Math.round(r.rx * W),
          y: Math.round(r.ry * H),
          w: Math.max(16, Math.round(r.rw * W)),
          h: Math.max(16, Math.round(r.rh * H)),
          autoFit: true
        }, cfg));
        return l;
      });
      state.layerEditor.setLayers(state.layers);
      state.layerEditor.activeId = state.layers.length ? state.layers[0].id : null;
      state.layerEditor._pushHistory();
      els.modeHint.textContent = I18n.t('modeHint.preset', { name: preset.name });
      els.layerPreset.value = '';
      panelRender();
      renderPreview();
    });

    els.layerUp.addEventListener('click', () => {
      if (state.layerEditor && state.layerEditor.activeId) state.layerEditor.moveLayer(state.layerEditor.activeId, 1);
    });
    els.layerDown.addEventListener('click', () => {
      if (state.layerEditor && state.layerEditor.activeId) state.layerEditor.moveLayer(state.layerEditor.activeId, -1);
    });
    els.layerDup.addEventListener('click', () => { if (state.layerEditor) state.layerEditor.duplicateActive(); });
    els.layerDel.addEventListener('click', () => { if (state.layerEditor) state.layerEditor.deleteActive(); });

    els.layerUndo.addEventListener('click', () => { if (state.layerEditor) state.layerEditor.undo(); });
    els.layerRedo.addEventListener('click', () => { if (state.layerEditor) state.layerEditor.redo(); });

    els.layerSave.addEventListener('click', () => {
      if (!state.layerEditor) return;
      var blob = new Blob([JSON.stringify({ version: 2, layers: state.layers }, null, 2)], { type: 'application/json' });
      saveAs(blob, 'picmark-layers.json');
    });

    els.layerLoad.addEventListener('click', () => {
      if (!state.layerEditor) { els.modeHint.textContent = I18n.t('region.needImage'); return; }
      els.layerConfigInput.click();
    });

    els.layerConfigInput.addEventListener('change', (e) => {
      if (!state.layerEditor) return;
      var file = e.target.files[0];
      els.layerConfigInput.value = '';
      if (!file) return;
      var reader = new FileReader();
      reader.onload = (ev) => {
        try {
          var data = JSON.parse(ev.target.result);
          var list = Array.isArray(data) ? data : data.layers;
          if (!Array.isArray(list)) throw new Error('bad format');
          state.layers = list.map(function (l) {
            var base = PMLayers.create(l.type === 'image' ? 'image' : 'text', {});
            return Object.assign(base, l, { id: base.id });
          });
          state.layerEditor.setLayers(state.layers);
          state.layerEditor.activeId = state.layers.length ? state.layers[0].id : null;
          state.layerEditor._pushHistory();
          panelRender();
          renderPreview();
        } catch (err) {
          alert(I18n.t('error.configLoad', { msg: err.message }));
        }
      };
      reader.readAsText(file);
    });
  }

  /* <optgroup> 的 label 不能用 data-i18n：I18n.apply 写 textContent 会把
     里面的 <option> 一起冲掉，所以单独走 label 属性 */
  function applyOptgroupLabels() {
    document.querySelectorAll('[data-i18n-label]').forEach((g) => {
      g.label = I18n.t(g.getAttribute('data-i18n-label'));
    });
  }
  applyOptgroupLabels();
  window.addEventListener('i18n:change', applyOptgroupLabels);

  // ===== Initial state =====
  I18n.apply();
  updatePerfMonitor();
  PMLayerPanel.init({
    listEl: els.layerList,
    configEl: els.layerConfig,
    editor: null,
    getColumns: function () { return parseNameData().columns; },
    getImages: function () { return state.images; },
    onChange: function () { if (state.sourceImage) renderPreview(); },
    onPickWatermark: function (l) { state.pendingTargetLayer = l && l.id; els.watermarkInput.click(); }
  });
  bindLayerToolbar();
  panelRender();
  setTool('select');

  /* 引导：把内部状态与重绘入口交给 onboarding，免得它反查 DOM 猜状态 */
  window.PMGetState = function () { return state; };
  window.PMRenderPreview = renderPreview;
  window.PMPanelRender = panelRender;
  if (window.PMOnboard) window.PMOnboard.init();

  // ===== 明暗主题：localStorage 记忆，未设置时跟随系统 =====
  var rootEl = document.documentElement;
  function isDark() {
    var t = rootEl.getAttribute('data-theme');
    return t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function syncThemeMeta() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark() ? '#1b1b1b' : '#e9e9e9');
  }
  try {
    var savedTheme = localStorage.getItem('picmark-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') rootEl.setAttribute('data-theme', savedTheme);
  } catch (e) { /* 隐私模式等 localStorage 不可用：保持跟随系统 */ }
  syncThemeMeta();
  document.getElementById('themeToggle')?.addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    rootEl.setAttribute('data-theme', next);
    try { localStorage.setItem('picmark-theme', next); } catch (e) { /* 同上 */ }
    syncThemeMeta();
  });

  // ===== 画布缩放（对数滑钮：25% ~ 400%，100% 落在滑轨正中）=====
  var zoomValueEl = document.getElementById('zoomValue');
  var zoomRangeEl = document.getElementById('zoomRange');
  var ZOOM_MIN = 0.25, ZOOM_MAX = 4;
  function sliderToZoom(v) { return ZOOM_MIN * Math.pow(ZOOM_MAX / ZOOM_MIN, v / 100); }
  function zoomToSlider(z) { return 100 * Math.log(z / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN); }
  function setZoom(z, fromSlider) {
    state.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    if (zoomValueEl) zoomValueEl.textContent = Math.round(state.zoom * 100) + '%';
    if (zoomRangeEl && !fromSlider) zoomRangeEl.value = zoomToSlider(state.zoom);
    renderPreview();
  }
  zoomRangeEl?.addEventListener('input', function () { setZoom(sliderToZoom(parseFloat(zoomRangeEl.value)), true); });
  document.getElementById('zoomFit')?.addEventListener('click', function () { setZoom(1); });
  /* Ctrl/⌘ + 滚轮缩放；不带修饰键的滚轮留给页面/画布滚动 */
  els.canvasWrapper?.addEventListener('wheel', function (e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(state.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false });
  setZoom(1);

  // 语言切换后重新渲染预览
  document.querySelector('.lang-toggle')?.addEventListener('click', function () {
    setTimeout(function () {
      if (state.sourceImage) renderPreview();
      panelRender();
    }, 50);
  });

  // ===== 步骤条：点击定位到对应卡片 =====
  var stepBtns = document.querySelectorAll('.step');
  stepBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      stepBtns.forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      var target = document.getElementById(btn.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();
