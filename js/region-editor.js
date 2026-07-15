(function (root) {
  // Region Editor: interactive rectangle regions with adaptive text embedding

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function uid() {
    return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function defaultConfig() {
    return {
      fontFamily: 'Microsoft YaHei, sans-serif',
      fontWeight: 400,
      fontStyle: 'normal',
      color: '#000000',
      opacity: 1,
      alignH: 'center',
      alignV: 'middle',
      lineHeight: 1.2,
      letterSpacing: 0,
      rotation: 0,
      minFontSize: 12,
      maxFontSize: 300,
      autoFit: true,
      useNameList: true,
      fixedText: '',
      ellipsis: false,
    };
  }

  class RegionEditor {
    constructor(options) {
      this.canvas = options.canvas;
      this.ctx = options.ctx;
      this.scale = options.scale || 1;
      this.width = options.width || 0;
      this.height = options.height || 0;
      this.regions = [];
      this.activeId = null;
      this.mode = 'select'; // select | create
      this.history = [];
      this.historyIndex = -1;
      this.drag = null; // { id, handle, startX, startY, orig }
      this.onChange = options.onChange || function () {};
      this.onActiveChange = options.onActiveChange || function () {};
      this._handlers = [];
      this._bindEvents();
    }

    setScale(scale) {
      this.scale = scale;
    }

    setSize(w, h) {
      this.width = w;
      this.height = h;
    }

    // ===== History =====
    _snapshot() {
      return deepClone(this.regions);
    }

    _pushHistory() {
      // remove future history if we are not at the end
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(this._snapshot());
      if (this.history.length > 50) this.history.shift();
      else this.historyIndex++;
    }

    canUndo() {
      return this.historyIndex > 0;
    }

    canRedo() {
      return this.historyIndex < this.history.length - 1;
    }

    undo() {
      if (!this.canUndo()) return;
      this.historyIndex--;
      this.regions = deepClone(this.history[this.historyIndex]);
      this._notify();
    }

    redo() {
      if (!this.canRedo()) return;
      this.historyIndex++;
      this.regions = deepClone(this.history[this.historyIndex]);
      this._notify();
    }

    // ===== Regions =====
    addRegion(rect) {
      const region = {
        id: uid(),
        x: clamp(Math.round(rect.x), 0, this.width),
        y: clamp(Math.round(rect.y), 0, this.height),
        width: clamp(Math.round(rect.width), 10, this.width),
        height: clamp(Math.round(rect.height), 10, this.height),
        config: defaultConfig(),
      };
      this.regions.push(region);
      this.activeId = region.id;
      this._pushHistory();
      this._notify();
      return region;
    }

    deleteRegion(id) {
      this.regions = this.regions.filter((r) => r.id !== id);
      if (this.activeId === id) this.activeId = this.regions[this.regions.length - 1]?.id || null;
      this._pushHistory();
      this._notify();
    }

    updateRegion(id, props) {
      const region = this.regions.find((r) => r.id === id);
      if (!region) return;
      if (props.x !== undefined) region.x = clamp(Math.round(props.x), 0, this.width);
      if (props.y !== undefined) region.y = clamp(Math.round(props.y), 0, this.height);
      if (props.width !== undefined) region.width = clamp(Math.round(props.width), 10, this.width - region.x);
      if (props.height !== undefined) region.height = clamp(Math.round(props.height), 10, this.height - region.y);
      if (props.config) region.config = Object.assign(region.config, props.config);
      this._notify();
    }

    setActive(id) {
      this.activeId = id;
      this.onActiveChange(this.getActiveRegion());
      this.draw();
    }

    getActiveRegion() {
      return this.regions.find((r) => r.id === this.activeId) || null;
    }

    getRegions() {
      return this.regions;
    }

    exportConfig() {
      return JSON.stringify(this.regions, null, 2);
    }

    loadConfig(json) {
      try {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        if (!Array.isArray(data)) return false;
        this.regions = data.map((r) => ({
          id: r.id || uid(),
          x: clamp(r.x || 0, 0, this.width),
          y: clamp(r.y || 0, 0, this.height),
          width: clamp(r.width || 100, 10, this.width),
          height: clamp(r.height || 50, 10, this.height),
          config: Object.assign(defaultConfig(), r.config || {}),
        }));
        this.activeId = this.regions[0]?.id || null;
        this._pushHistory();
        this._notify();
        return true;
      } catch (e) {
        return false;
      }
    }

    _notify() {
      this.onChange(this.regions);
      this.draw();
    }

    // ===== Events =====
    _bindEvents() {
      const down = (e) => this._onPointerDown(e);
      const move = (e) => this._onPointerMove(e);
      const up = (e) => this._onPointerUp(e);

      this.canvas.addEventListener('mousedown', down);
      this.canvas.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      this.canvas.addEventListener('touchstart', down, { passive: false });
      this.canvas.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', up);

      this._handlers = [down, move, up];
    }

    _getPos(e) {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) / this.scale,
        y: (clientY - rect.top) / this.scale,
      };
    }

    _hitTest(x, y) {
      // Check resize handles first, then region body
      const handleSize = 10 / this.scale;
      for (let i = this.regions.length - 1; i >= 0; i--) {
        const r = this.regions[i];
        const right = r.x + r.width;
        const bottom = r.y + r.height;
        if (x >= right - handleSize && x <= right + handleSize && y >= bottom - handleSize && y <= bottom + handleSize) {
          return { id: r.id, handle: 'se' };
        }
      }
      for (let i = this.regions.length - 1; i >= 0; i--) {
        const r = this.regions[i];
        if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
          return { id: r.id, handle: 'move' };
        }
      }
      return null;
    }

    _onPointerDown(e) {
      if (e.touches) e.preventDefault();
      if (!this.width || !this.height) return;
      const pos = this._getPos(e);

      if (this.mode === 'create') {
        this.drag = { type: 'create', startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y };
        return;
      }

      const hit = this._hitTest(pos.x, pos.y);
      if (hit) {
        const region = this.regions.find((r) => r.id === hit.id);
        this.activeId = hit.id;
        this.onActiveChange(region);
        this.drag = {
          type: hit.handle,
          id: hit.id,
          startX: pos.x,
          startY: pos.y,
          orig: { x: region.x, y: region.y, width: region.width, height: region.height },
        };
      } else {
        this.activeId = null;
        this.onActiveChange(null);
      }
      this.draw();
    }

    _onPointerMove(e) {
      if (!this.drag) return;
      if (e.touches) e.preventDefault();
      const pos = this._getPos(e);

      if (this.drag.type === 'create') {
        this.drag.currentX = pos.x;
        this.drag.currentY = pos.y;
        this.draw();
        return;
      }

      const region = this.regions.find((r) => r.id === this.drag.id);
      if (!region) return;
      const dx = pos.x - this.drag.startX;
      const dy = pos.y - this.drag.startY;

      if (this.drag.type === 'move') {
        region.x = clamp(this.drag.orig.x + dx, 0, this.width - region.width);
        region.y = clamp(this.drag.orig.y + dy, 0, this.height - region.height);
      } else if (this.drag.type === 'se') {
        region.width = clamp(this.drag.orig.width + dx, 10, this.width - region.x);
        region.height = clamp(this.drag.orig.height + dy, 10, this.height - region.y);
      }
      this.draw();
    }

    _onPointerUp(e) {
      if (!this.drag) return;
      if (this.drag.type === 'create') {
        const x = Math.min(this.drag.startX, this.drag.currentX);
        const y = Math.min(this.drag.startY, this.drag.currentY);
        const w = Math.abs(this.drag.currentX - this.drag.startX);
        const h = Math.abs(this.drag.currentY - this.drag.startY);
        if (w > 10 && h > 10) {
          this.addRegion({ x, y, width: w, height: h });
        }
        this.setMode('select');
      } else {
        this._pushHistory();
        this.onChange(this.regions);
      }
      this.drag = null;
      this.draw();
    }

    setMode(mode) {
      this.mode = mode;
      this.canvas.style.cursor = mode === 'create' ? 'crosshair' : 'default';
    }

    destroy() {
      // remove event listeners
      this.canvas.removeEventListener('mousedown', this._handlers[0]);
      this.canvas.removeEventListener('mousemove', this._handlers[1]);
      window.removeEventListener('mouseup', this._handlers[2]);
      this.canvas.removeEventListener('touchstart', this._handlers[0]);
      this.canvas.removeEventListener('touchmove', this._handlers[1]);
      window.removeEventListener('touchend', this._handlers[2]);
    }

    // ===== Drawing =====
    draw() {
      // The caller is responsible for drawing the image first; we only draw overlays
      this.regions.forEach((r) => this._drawRegionOverlay(r));
      if (this.drag && this.drag.type === 'create') {
        const x = Math.min(this.drag.startX, this.drag.currentX);
        const y = Math.min(this.drag.startY, this.drag.currentY);
        const w = Math.abs(this.drag.currentX - this.drag.startX);
        const h = Math.abs(this.drag.currentY - this.drag.startY);
        this._drawDraftRect(x, y, w, h);
      }
    }

    _drawRegionOverlay(r) {
      const isActive = r.id === this.activeId;
      const s = this.scale;
      const x = r.x * s;
      const y = r.y * s;
      const w = r.width * s;
      const h = r.height * s;

      this.ctx.save();
      this.ctx.strokeStyle = isActive ? '#C8442C' : '#9A9388';
      this.ctx.lineWidth = isActive ? 2 : 1;
      this.ctx.setLineDash(isActive ? [5, 3] : [3, 3]);
      this.ctx.strokeRect(x, y, w, h);

      // Size label
      this.ctx.fillStyle = isActive ? '#C8442C' : '#9A9388';
      this.ctx.font = '11px "SF Mono", "Courier New", monospace';
      this.ctx.setLineDash([]);
      const label = `${r.width}×${r.height}`;
      this.ctx.fillText(label, x + 4, y - 4);

      // Resize handle
      if (isActive) {
        this.ctx.fillStyle = '#C8442C';
        this.ctx.fillRect(x + w - 6, y + h - 6, 12, 12);
      }
      this.ctx.restore();
    }

    _drawDraftRect(x, y, w, h) {
      const s = this.scale;
      this.ctx.save();
      this.ctx.strokeStyle = '#C8442C';
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([5, 3]);
      this.ctx.strokeRect(x * s, y * s, w * s, h * s);
      this.ctx.restore();
    }

    // ===== Text fitting =====
    fitAndRender(ctx, text, region) {
      const cfg = region.config;
      const c = ctx;
      c.save();

      // Prepare font string
      const family = cfg.fontFamily;
      const style = cfg.fontStyle;
      const weight = cfg.fontWeight;
      const color = cfg.color;
      const alpha = Math.round(cfg.opacity * 255).toString(16).padStart(2, '0');
      c.fillStyle = color + alpha;
      c.textBaseline = 'top';

      // Compute adaptive font size
      let fontSize = cfg.autoFit ? this._computeFontSize(c, text, region, family, style, weight, cfg) : cfg.maxFontSize;
      fontSize = clamp(fontSize, cfg.minFontSize, cfg.maxFontSize);

      // Compute letter spacing based on character count for Chinese names
      const charCount = Array.from(text).length;
      let letterSpacing = cfg.letterSpacing;
      if (cfg.autoFit && charCount >= 2 && charCount <= 4 && region.width > region.height * 1.5) {
        // Wider region, distribute chars evenly
        c.font = `${style} ${weight} ${fontSize}px ${family}`;
        const measured = c.measureText(text).width;
        const available = region.width - 10;
        if (measured < available) {
          const extra = (available - measured) / Math.max(1, charCount - 1);
          if (charCount === 2) letterSpacing += extra * 0.8;
          else if (charCount === 3) letterSpacing += extra * 0.5;
          else if (charCount === 4) letterSpacing += extra * 0.3;
        }
      }

      // Wrap text
      c.font = `${style} ${weight} ${fontSize}px ${family}`;
      const lines = this._wrapText(c, text, region.width - 10, letterSpacing);

      if (cfg.ellipsis && lines.length === 0) {
        // Not enough space, draw ellipsis
        c.fillText('…', region.x + 5, region.y + 5);
        c.restore();
        return;
      }

      // Line height
      const lineHeightPx = fontSize * cfg.lineHeight;
      const totalHeight = lines.length * lineHeightPx;

      // Vertical alignment
      let startY = region.y + 5;
      if (cfg.alignV === 'middle') startY = region.y + (region.height - totalHeight) / 2;
      else if (cfg.alignV === 'bottom') startY = region.y + region.height - totalHeight - 5;

      // Rotation center
      const cx = region.x + region.width / 2;
      const cy = region.y + region.height / 2;

      c.save();
      c.translate(cx, cy);
      c.rotate((cfg.rotation * Math.PI) / 180);
      c.translate(-cx, -cy);

      lines.forEach((line, idx) => {
        const y = startY + idx * lineHeightPx;
        const lineWidth = this._measureLine(c, line, letterSpacing);
        let x = region.x + 5;
        if (cfg.alignH === 'center') x = region.x + (region.width - lineWidth) / 2;
        else if (cfg.alignH === 'right') x = region.x + region.width - lineWidth - 5;

        this._drawLine(c, line, x, y, letterSpacing);
      });

      c.restore();
      c.restore();
    }

    _computeFontSize(c, text, region, family, style, weight, cfg) {
      const availableW = Math.max(10, region.width - 10);
      const availableH = Math.max(10, region.height - 10);
      const chars = Array.from(text);
      let low = cfg.minFontSize;
      let high = cfg.maxFontSize;
      let best = low;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        c.font = `${style} ${weight} ${mid}px ${family}`;
        const lines = this._wrapText(c, text, availableW, cfg.letterSpacing);
        const lineHeightPx = mid * cfg.lineHeight;
        const totalH = lines.length * lineHeightPx;
        const maxLineW = lines.reduce((max, line) => Math.max(max, this._measureLine(c, line, cfg.letterSpacing)), 0);

        if (totalH <= availableH && maxLineW <= availableW) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return best;
    }

    _wrapText(c, text, maxWidth, letterSpacing) {
      const chars = Array.from(text);
      if (chars.length === 0) return [];
      const lines = [];
      let current = '';

      for (const ch of chars) {
        const test = current + ch;
        const w = this._measureLine(c, test, letterSpacing);
        if (w > maxWidth && current.length > 0) {
          lines.push(current);
          current = ch;
        } else {
          current = test;
        }
      }
      if (current.length > 0) lines.push(current);
      return lines;
    }

    _measureLine(c, text, letterSpacing) {
      const w = c.measureText(text).width;
      const chars = Array.from(text).length;
      return w + Math.max(0, chars - 1) * letterSpacing;
    }

    _drawLine(c, text, x, y, letterSpacing) {
      if (letterSpacing === 0) {
        c.fillText(text, x, y);
        return;
      }
      let cursorX = x;
      for (const ch of Array.from(text)) {
        c.fillText(ch, cursorX, y);
        cursorX += c.measureText(ch).width + letterSpacing;
      }
    }
  }

  root.RegionEditor = RegionEditor;
})(typeof window !== 'undefined' ? window : this);
