(function () {
  // 状态
  const state = {
    image: null,          // 原始 Image 对象
    scale: 1,             // 预览缩放比例
    offsetX: 0,
    offsetY: 0,
    customFontFace: null,
    mode: 'position',     // 'position' | 'pick'
  };

  // DOM
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
    fontInput: document.getElementById('fontInput'),
    fontName: document.getElementById('fontName'),
    namesInput: document.getElementById('namesInput'),
    namesFileInput: document.getElementById('namesFileInput'),
    generateBtn: document.getElementById('generateBtn'),
    progressBox: document.getElementById('progressBox'),
    progressBar: document.getElementById('progressBar'),
    progressBarFill: document.getElementById('progressBarFill'),
    progressText: document.getElementById('progressText'),
    previewList: document.getElementById('previewList'),
    modeBtns: document.querySelectorAll('.mode-btn'),
    modeHint: document.getElementById('modeHint'),
    pickedColor: document.getElementById('pickedColor'),
    colorValue: document.getElementById('colorValue'),
    dropZone: document.getElementById('dropZone'),
  };

  const ctx = els.canvas.getContext('2d');

  // 上传底图
  function loadTemplate(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        state.image = img;
        els.imageInfo.textContent = `${file.name} · ${img.width} × ${img.height}`;
        renderPreview();
        updateGenerateBtn();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  els.templateInput.addEventListener('change', (e) => {
    loadTemplate(e.target.files[0]);
  });

  // 拖拽上传
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

  // 渲染预览
  function renderPreview() {
    const img = state.image;
    if (!img) return;

    const wrapperW = els.canvasWrapper.clientWidth;
    const scale = wrapperW / img.width;
    state.scale = scale;
    const canvasW = Math.floor(img.width * scale);
    const canvasH = Math.floor(img.height * scale);

    els.canvas.width = canvasW;
    els.canvas.height = canvasH;
    ctx.drawImage(img, 0, 0, canvasW, canvasH);

    // 重新定位 marker
    updateMarker();
  }

  // 窗口变化时重绘
  window.addEventListener('resize', () => {
    renderPreview();
  });

  // 模式切换
  els.modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      els.modeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (state.mode === 'pick') {
        els.modeHint.textContent = '点击图片任意位置，即可提取该位置颜色并应用到文字';
        els.canvas.classList.add('pick-mode');
      } else {
        els.modeHint.textContent = '点击图片，竖线位置即为文字左对齐起始位置';
        els.canvas.classList.remove('pick-mode');
      }
    });
  });

  // 点击画布：定位或取色
  els.canvas.addEventListener('click', (e) => {
    if (!state.image) return;
    const rect = els.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const origX = Math.round(x / state.scale);
    const origY = Math.round(y / state.scale);

    if (state.mode === 'pick') {
      pickColor(x, y);
    } else {
      els.posX.value = origX;
      els.posY.value = origY;
      updateMarker();
    }
  });

  // 从图片取色
  function pickColor(canvasX, canvasY) {
    const ix = Math.max(0, Math.min(Math.round(canvasX), els.canvas.width - 1));
    const iy = Math.max(0, Math.min(Math.round(canvasY), els.canvas.height - 1));
    const pixel = ctx.getImageData(ix, iy, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    els.fontColor.value = hex;
    updateMarker();
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

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

  function updateMarker() {
    if (!state.image) return;
    const x = parseInt(els.posX.value, 10) * state.scale;
    const y = parseInt(els.posY.value, 10) * state.scale;
    const fontSize = parseInt(els.fontSize.value, 10);
    const color = els.fontColor.value;
    const fontFamily = getFontFamily();
    const fontWeight = validateFontWeight();

    els.marker.style.display = 'block';
    els.marker.style.left = x + 'px';
    els.marker.style.top = y + 'px';
    els.marker.style.fontSize = Math.max(12, fontSize * state.scale) + 'px';
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

  // 自定义字体
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
        els.fontName.textContent = `已加载: ${file.name}`;
      } catch (err) {
        alert('字体加载失败: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  });

  // 名单文件上传
  els.namesFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      if (file.name.toLowerCase().endsWith('.csv')) {
        // 简单 CSV：取第一列
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
    const hasImage = !!state.image;
    const hasNames = els.namesInput.value.trim().length > 0;
    els.generateBtn.disabled = !(hasImage && hasNames);
  }

  // 获取字体
  function getFontFamily() {
    const val = els.fontFamily.value;
    if (val === 'custom') return state.customFontFace || 'sans-serif';
    return val;
  }

  // 解析颜色
  function hexToRgb(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    return `rgb(${r},${g},${b})`;
  }

  // 生成单张图片
  function generateOne(name) {
    return new Promise((resolve) => {
      const img = state.image;
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const c = canvas.getContext('2d');

      // 绘制底图
      c.drawImage(img, 0, 0);

      // 文字参数
      const fontSize = parseInt(els.fontSize.value, 10);
      const color = hexToRgb(els.fontColor.value);
      const align = els.textAlign.value;
      const maxWidth = parseInt(els.maxWidth.value, 10) || 0;
      const fontFamily = getFontFamily();
      const fontWeight = validateFontWeight();
      const posX = parseInt(els.posX.value, 10);
      const posY = parseInt(els.posY.value, 10);

      c.fillStyle = color;
      c.textBaseline = 'top';

      let currentSize = fontSize;
      c.font = `${fontWeight} ${currentSize}px ${fontFamily}`;

      // 自动缩放字号
      if (maxWidth > 0) {
        while (c.measureText(name).width > maxWidth && currentSize > 12) {
          currentSize -= 2;
          c.font = `${fontWeight} ${currentSize}px ${fontFamily}`;
        }
      }

      const textWidth = c.measureText(name).width;
      let x = posX;
      if (align === 'center') {
        x -= textWidth / 2;
      } else if (align === 'right') {
        x -= textWidth;
      }

      c.fillText(name, x, posY);
      resolve(canvas);
    });
  }

  // 批量生成
  els.generateBtn.addEventListener('click', async () => {
    const names = els.namesInput.value
      .split(/\r?\n/)
      .map((n) => n.trim())
      .filter(Boolean);

    if (names.length === 0) return;

    // 确保自定义字体已可用
    if (state.customFontFace) {
      await document.fonts.ready;
    }

    els.progressBox.style.display = 'flex';
    els.previewList.innerHTML = '';
    els.generateBtn.disabled = true;

    const zip = new JSZip();
    const total = names.length;

    for (let i = 0; i < total; i++) {
      const name = names[i];
      const canvas = await generateOne(name);
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      const safeName = name.replace(/[\\/:*?"<>|]/g, '_');
      zip.file(`${safeName}.png`, base64, { base64: true });

      // 预览前几张
      if (i < 9) {
        const thumb = document.createElement('img');
        thumb.src = dataUrl;
        thumb.alt = name;
        els.previewList.appendChild(thumb);
      }

      const pct = Math.round(((i + 1) / total) * 100);
      els.progressBarFill.style.width = pct + '%';
      els.progressText.textContent = pct + '%';
    }

    // 打包下载，文件名带时间戳确保唯一
    const content = await zip.generateAsync({ type: 'blob' });
    const timestamp = formatTimestamp(new Date());
    saveAs(content, `图印工坊_批量生成_${timestamp}.zip`);

    els.generateBtn.disabled = false;
    els.generateBtn.textContent = '重新生成并下载';
  });
})();
