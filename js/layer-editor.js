/* ============================================================
   图印工坊 · 画布图层编辑器
   ------------------------------------------------------------
   取代旧的 region-editor。改动要点：
   · 一套交互同时服务文字图层（锚点 / 区域）与 PNG 水印图层
   · 8 向缩放手柄 + 独立旋转手柄（旧版只有右下角一个，且不能旋转）
   · 命中测试用「显示缩放」viewScale，绘制用「位图缩放」drawScale
     ——放大到 200% 时两者不同，混用会让框画得下却点不中（旧版的硬伤）
   · 缩放支持旋转框：把指针变换到图层本地坐标再改包围盒
   · 撤销 / 重做基于整份图层数组快照
   ============================================================ */
(function (root) {
  'use strict';

  function uid(p) {
    return (p || 'L') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function rad(deg) { return (deg || 0) * Math.PI / 180; }

  var HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  var MIN_SIZE = 8;

  class LayerEditor {
    constructor(options) {
      this.canvas = options.canvas;
      this.ctx = options.ctx;
      this.layers = options.layers || [];
      this.activeId = null;

      this.width = options.width || 0;      // 图像宽（work image px）
      this.height = options.height || 0;
      this.drawScale = options.drawScale || 1;   // 画布位图 / 图像
      this.viewScale = options.viewScale || this.drawScale; // 屏幕显示 / 图像

      this.mode = 'select';                 // select | create-region | create-image
      this.history = [];
      this.historyIndex = -1;

      this.onChange = options.onChange || function () {};
      this.onSelect = options.onSelect || function () {};
      this.onBackground = options.onBackground || function () {};
      this.onCreate = options.onCreate || function () {};

      this.drag = null;
      this._bound = [];
      this._bind();
      this._pushHistory();
    }

    /* ===== 状态 ===== */
    setLayers(layers) { this.layers = layers; }
    getLayers() { return this.layers; }
    setScale(drawScale, viewScale) {
      this.drawScale = drawScale || 1;
      this.viewScale = viewScale || this.drawScale;
    }
    setSize(w, h) { this.width = w; this.height = h; }
    setMode(mode) {
      this.mode = mode;
      /* pick 是「只取色、不操作图层」的模式，光标交给 CSS 的 .pick-mode */
      if (mode === 'pick') { this.canvas.style.cursor = ''; return; }
      this.canvas.style.cursor = mode === 'select' ? 'default' : 'crosshair';
    }
    getMode() { return this.mode; }

    active() { return this.layers.find((l) => l.id === this.activeId) || null; }

    setActive(id) {
      this.activeId = id;
      this.onSelect(this.active());
      this.draw();
    }

    /* ===== 历史 ===== */
    _snapshot() { return JSON.parse(JSON.stringify(this.layers)); }

    _pushHistory() {
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(this._snapshot());
      if (this.history.length > 60) this.history.shift();
      else this.historyIndex++;
    }

    canUndo() { return this.historyIndex > 0; }
    canRedo() { return this.historyIndex < this.history.length - 1; }

    undo() {
      if (!this.canUndo()) return;
      this.historyIndex--;
      this.layers = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      if (!this.layers.some((l) => l.id === this.activeId)) this.activeId = null;
      this._notify();
    }

    redo() {
      if (!this.canRedo()) return;
      this.historyIndex++;
      this.layers = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      if (!this.layers.some((l) => l.id === this.activeId)) this.activeId = null;
      this._notify();
    }

    _notify() {
      this.onChange(this.layers);
      this.draw();
    }

    /* ===== 图层操作 ===== */
    addLayer(layer) {
      layer.id = layer.id || uid(layer.type === 'image' ? 'IMG' : 'TXT');
      this.layers.push(layer);
      this.activeId = layer.id;
      this._pushHistory();
      this._notify();
      this.onSelect(layer);
      return layer;
    }

    updateActive(props, commit) {
      const l = this.active();
      if (!l) return;
      Object.keys(props).forEach((k) => { l[k] = props[k]; });
      if (commit) this._pushHistory();
      this._notify();
    }

    deleteActive() {
      const l = this.active();
      if (!l) return;
      this.layers = this.layers.filter((x) => x.id !== l.id);
      this.activeId = this.layers.length ? this.layers[this.layers.length - 1].id : null;
      this._pushHistory();
      this._notify();
      this.onSelect(this.active());
    }

    duplicateActive() {
      const l = this.active();
      if (!l) return;
      const copy = JSON.parse(JSON.stringify(l));
      copy.id = uid(copy.type === 'image' ? 'IMG' : 'TXT');
      copy.x = clamp(copy.x + 16, 0, this.width);
      copy.y = clamp(copy.y + 16, 0, this.height);
      /* 复制件必须改名：列表里两个同名图层没法分辨 */
      var suffix = (window.I18n && window.I18n.t) ? window.I18n.t('layer.copySuffix', '副本') : 'copy';
      copy.name = (l.name || '') + ' · ' + suffix;
      const idx = this.layers.findIndex((x) => x.id === l.id);
      this.layers.splice(idx + 1, 0, copy);
      this.activeId = copy.id;
      this._pushHistory();
      this._notify();
      this.onSelect(copy);
    }

    moveLayer(id, dir) {
      const idx = this.layers.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const next = idx + dir;
      if (next < 0 || next >= this.layers.length) return;
      const tmp = this.layers[idx];
      this.layers[idx] = this.layers[next];
      this.layers[next] = tmp;
      this._pushHistory();
      this._notify();
    }

    /* ===== 几何 ===== */
    centerOf(l) { return { cx: l.x + l.w / 2, cy: l.y + l.h / 2 }; }

    /* 锚点文字没有 w/h 意义，用测量值算出一个可点的包围盒 */
    boxOf(l) {
      if (l.type === 'image' || l.mode === 'region') {
        return { x: l.x, y: l.y, w: l.w, h: l.h };
      }
      const c = this.ctx;
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.font = (l.italic ? 'italic ' : '') + (l.fontWeight || 400) + ' ' + (l.fontSize || 60) + 'px ' + l.fontFamily;
      const lines = String(l.fixedText && l.source === 'fixed' ? l.fixedText : '示例文本').split('\n');
      let w = 0;
      lines.forEach((ln) => { w = Math.max(w, c.measureText(ln).width); });
      c.restore();
      const h = lines.length * (l.fontSize || 60) * (l.lineHeight || 1.2);
      const bw = Math.max(w, 24);
      let x = l.x;
      if (l.align === 'center') x = l.x - bw / 2;
      else if (l.align === 'right') x = l.x - bw;
      return { x: x, y: l.y, w: bw, h: Math.max(h, 12) };
    }

    /* 指针 → 图像坐标（用 viewScale：屏幕像素 / 图像像素） */
    _pos(e) {
      const rect = this.canvas.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: (cx - rect.left) / this.viewScale, y: (cy - rect.top) / this.viewScale, sx: cx, sy: cy };
    }

    /* 句柄在屏幕上的命中半径换算回图像坐标 */
    _hitRadius() { return 9 / Math.max(0.0001, this.viewScale); }

    _toLocal(p, l) {
      const c = this.centerOf(l);
      const a = rad(-(l.rotation || 0));
      const dx = p.x - c.cx;
      const dy = p.y - c.cy;
      return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
    }

    _toGlobal(v, l) {
      const a = rad(l.rotation || 0);
      return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) };
    }

    _hitTest(p) {
      const r = this._hitRadius();
      // 命中顺序：从上层往下
      for (let i = this.layers.length - 1; i >= 0; i--) {
        const l = this.layers[i];
        if (l.visible === false) continue;
        if (l.id !== this.activeId) continue;

        const c = this.centerOf(l);
        const hw = l.w / 2;
        const hh = l.h / 2;

        // 旋转手柄：上边中点再往外 24 屏幕像素
        const off = 24 / Math.max(0.0001, this.viewScale);
        const rot = { x: c.cx, y: c.cy - hh - off };
        const rp = this._toGlobal({ x: rot.x - c.cx, y: rot.y - c.cy }, l);
        const rx = c.cx + rp.x;
        const ry = c.cy + rp.y;
        if (Math.abs(p.x - rx) <= r && Math.abs(p.y - ry) <= r) return { id: l.id, handle: 'rotate' };

        const lp = this._toLocal(p, l); // 相对中心的本地坐标
        const isPointText = l.type === 'text' && l.mode !== 'region';
        const handles = isPointText ? ['se'] : HANDLES;
        for (const h of handles) {
          let hx = 0, hy = 0;
          if (h.indexOf('w') >= 0) hx = -hw;
          if (h.indexOf('e') >= 0) hx = hw;
          if (h.indexOf('n') >= 0) hy = -hh;
          if (h.indexOf('s') >= 0) hy = hh;
          if (Math.abs(lp.x - hx) <= r && Math.abs(lp.y - hy) <= r) return { id: l.id, handle: h };
        }
      }

      // 本体：变换到图层本地坐标做矩形包含判断
      for (let i = this.layers.length - 1; i >= 0; i--) {
        const l = this.layers[i];
        if (l.visible === false) continue;
        const box = this.boxOf(l);
        const c = { cx: box.x + box.w / 2, cy: box.y + box.h / 2 };
        const lp = this._toLocal(p, { x: box.x, y: box.y, w: box.w, h: box.h, rotation: l.rotation });
        if (Math.abs(lp.x) <= box.w / 2 && Math.abs(lp.y) <= box.h / 2) return { id: l.id, handle: 'move' };
      }
      return null;
    }

    /* ===== 事件 ===== */
    _bind() {
      const down = (e) => this._onDown(e);
      const move = (e) => this._onMove(e);
      const up = (e) => this._onUp(e);
      const key = (e) => this._onKey(e);

      this.canvas.addEventListener('mousedown', down);
      this.canvas.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      this.canvas.addEventListener('touchstart', down, { passive: false });
      this.canvas.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', up);
      window.addEventListener('keydown', key);

      this._bound = [down, move, up, key];
    }

    _onKey(e) {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      const l = this.active();
      if (!l) return;
      const step = e.shiftKey ? 10 : 1;
      let handled = true;
      if (e.key === 'ArrowLeft') l.x -= step;
      else if (e.key === 'ArrowRight') l.x += step;
      else if (e.key === 'ArrowUp') l.y -= step;
      else if (e.key === 'ArrowDown') l.y += step;
      else if (e.key === 'Delete' || e.key === 'Backspace') { this.deleteActive(); return; }
      else handled = false;
      if (handled) {
        e.preventDefault();
        this._pushHistory();
        this._notify();
      }
    }

    _onDown(e) {
      if (!this.width || !this.height) return;
      /* 取色模式：完全不接管指针，交给外层的取色逻辑 */
      if (this.mode === 'pick') return;
      if (e.touches) e.preventDefault();
      const p = this._pos(e);

      if (this.mode === 'create-region' || this.mode === 'create-image') {
        this.drag = { type: 'create', startX: p.x, startY: p.y, curX: p.x, curY: p.y };
        this.draw();
        return;
      }

      const hit = this._hitTest(p);
      if (hit) {
        const l = this.layers.find((x) => x.id === hit.id);
        if (this.activeId !== hit.id) {
          this.activeId = hit.id;
          this.onSelect(l);
        }
        this.drag = {
          type: hit.handle,
          id: hit.id,
          start: p,
          orig: JSON.parse(JSON.stringify({ x: l.x, y: l.y, w: l.w, h: l.h, rotation: l.rotation, fontSize: l.fontSize })),
          shift: !!(e.shiftKey)
        };
        this.draw();
      } else {
        this.onBackground(p);
      }
    }

    _onMove(e) {
      if (!this.drag) return;
      if (e.touches) e.preventDefault();
      const p = this._pos(e);

      if (this.drag.type === 'create') {
        this.drag.curX = p.x;
        this.drag.curY = p.y;
        this.draw();
        return;
      }

      const l = this.layers.find((x) => x.id === this.drag.id);
      if (!l) return;
      const o = this.drag.orig;
      const isPointText = l.type === 'text' && l.mode !== 'region';

      if (this.drag.type === 'move') {
        l.x = clamp(o.x + (p.x - this.drag.start.x), -o.w, this.width);
        l.y = clamp(o.y + (p.y - this.drag.start.y), -o.h, this.height);
      } else if (this.drag.type === 'rotate') {
        const c = { cx: o.x + o.w / 2, cy: o.y + o.h / 2 };
        let deg = Math.atan2(p.y - c.cy, p.x - c.cx) * 180 / Math.PI + 90;
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        l.rotation = Math.round(((deg % 360) + 360) % 360);
      } else if (isPointText && this.drag.type === 'se') {
        // 锚点文字：右下角手柄改字号
        const d = (p.x - this.drag.start.x) + (p.y - this.drag.start.y);
        l.fontSize = clamp(Math.round(o.fontSize + d * 0.5), 8, 800);
      } else {
        // 带旋转的缩放：在本地坐标里改包围盒，再把中心位移转回全局
        const base = { x: o.x, y: o.y, w: o.w, h: o.h, rotation: o.rotation };
        const lp0 = this._toLocal(this.drag.start, base);
        const lp1 = this._toLocal(p, base);
        let l0 = -o.w / 2, r0 = o.w / 2, t0 = -o.h / 2, b0 = o.h / 2;
        const h = this.drag.type;
        if (h.indexOf('w') >= 0) l0 = lp1.x;
        if (h.indexOf('e') >= 0) r0 = lp1.x;
        if (h.indexOf('n') >= 0) t0 = lp1.y;
        if (h.indexOf('s') >= 0) b0 = lp1.y;

        let nw = Math.abs(r0 - l0);
        let nh = Math.abs(b0 - t0);
        if (nw < MIN_SIZE) { nw = MIN_SIZE; }
        if (nh < MIN_SIZE) { nh = MIN_SIZE; }
        const localCenter = { x: (l0 + r0) / 2, y: (t0 + b0) / 2 };
        const globalDelta = this._toGlobal(localCenter, base);
        const ocx = o.x + o.w / 2;
        const ocy = o.y + o.h / 2;
        l.w = Math.round(nw);
        l.h = Math.round(nh);
        l.x = Math.round(ocx + globalDelta.x - nw / 2);
        l.y = Math.round(ocy + globalDelta.y - nh / 2);
      }
      this.draw();
    }

    _onUp() {
      if (!this.drag) return;
      if (this.drag.type === 'create') {
        const x = Math.min(this.drag.startX, this.drag.curX);
        const y = Math.min(this.drag.startY, this.drag.curY);
        const w = Math.abs(this.drag.curX - this.drag.startX);
        const h = Math.abs(this.drag.curY - this.drag.startY);
        if (w > 12 && h > 12) {
          this.onCreate({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
        } else {
          /* 只是点了一下没拖框：交给调用方按默认尺寸放置 */
          this.onCreate({ x: Math.round(this.drag.startX), y: Math.round(this.drag.startY), w: 0, h: 0 });
        }
        /* 不自动退出创建模式：连续画多个框是常见操作，
           是否结束由外层工具条决定（点「选择」才退出） */
      } else {
        this._pushHistory();
        this.onChange(this.layers);
      }
      this.drag = null;
      this.draw();
    }

    destroy() {
      this.canvas.removeEventListener('mousedown', this._bound[0]);
      this.canvas.removeEventListener('mousemove', this._bound[1]);
      window.removeEventListener('mouseup', this._bound[2]);
      this.canvas.removeEventListener('touchstart', this._bound[0]);
      this.canvas.removeEventListener('touchmove', this._bound[1]);
      window.removeEventListener('touchend', this._bound[2]);
      window.removeEventListener('keydown', this._bound[3]);
    }

    /* ===== 绘制覆盖层（画在位图坐标上，用 drawScale）===== */
    draw() {
      const s = this.drawScale;
      const c = this.ctx;
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);

      this.layers.forEach((l) => {
        if (l.visible === false) return;
        const isActive = l.id === this.activeId;
        const box = this.boxOf(l);
        const cx = (box.x + box.w / 2) * s;
        const cy = (box.y + box.h / 2) * s;
        const hw = (box.w / 2) * s;
        const hh = (box.h / 2) * s;
        const rot = rad(l.rotation || 0);

        c.save();
        c.translate(cx, cy);
        c.rotate(rot);

        // 双描边：白底黑线，任何底图上都看得见
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(255,255,255,0.85)';
        c.setLineDash([]);
        c.strokeRect(-hw, -hh, hw * 2, hh * 2);
        c.lineWidth = isActive ? 1.6 : 1;
        c.strokeStyle = isActive ? '#111111' : 'rgba(120,120,120,0.9)';
        c.setLineDash(isActive ? [6, 4] : [4, 4]);
        c.strokeRect(-hw, -hh, hw * 2, hh * 2);
        c.setLineDash([]);

        if (isActive) {
          const isPoint = l.type === 'text' && l.mode !== 'region';
          const hs = 4;
          const list = isPoint ? [[hw, hh]] : HANDLES.map((h) => {
            let hx = 0, hy = 0;
            if (h.indexOf('w') >= 0) hx = -hw;
            if (h.indexOf('e') >= 0) hx = hw;
            if (h.indexOf('n') >= 0) hy = -hh;
            if (h.indexOf('s') >= 0) hy = hh;
            return [hx, hy];
          });
          list.forEach((pt) => {
            c.fillStyle = '#ffffff';
            c.strokeStyle = '#111111';
            c.lineWidth = 1.2;
            c.beginPath();
            c.rect(pt[0] - hs, pt[1] - hs, hs * 2, hs * 2);
            c.fill();
            c.stroke();
          });

          // 旋转手柄：上边中点上方 24px，用一条引线连到框
          const off = 24;
          c.strokeStyle = 'rgba(255,255,255,0.9)';
          c.lineWidth = 3;
          c.beginPath(); c.moveTo(0, -hh); c.lineTo(0, -hh - off); c.stroke();
          c.strokeStyle = '#111111';
          c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(0, -hh); c.lineTo(0, -hh - off); c.stroke();
          c.beginPath();
          c.arc(0, -hh - off, 5, 0, Math.PI * 2);
          c.fillStyle = '#ffffff';
          c.fill();
          c.stroke();
        }
        c.restore();

        if (isActive) {
          // 名称标签：不随旋转，画在框左上角
          const lx = Math.min(box.x * s, this.width * s - 8);
          const ly = Math.max(10, box.y * s - 6);
          const label = (l.name || (l.type === 'image' ? '水印' : '文字')) + ' · ' + Math.round(l.w) + '×' + Math.round(l.h) + (l.rotation ? ' · ' + Math.round(l.rotation) + '°' : '');
          c.font = '11px "Microsoft YaHei", sans-serif';
          const tw = c.measureText(label).width;
          c.fillStyle = 'rgba(17,17,17,0.86)';
          c.fillRect(lx, ly - 14, tw + 10, 16);
          c.fillStyle = '#ffffff';
          c.fillText(label, lx + 5, ly - 2);
        }
      });

      if (this.drag && this.drag.type === 'create') {
        const x = Math.min(this.drag.startX, this.drag.curX) * s;
        const y = Math.min(this.drag.startY, this.drag.curY) * s;
        const w = Math.abs(this.drag.curX - this.drag.startX) * s;
        const h = Math.abs(this.drag.curY - this.drag.startY) * s;
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(255,255,255,0.85)';
        c.strokeRect(x, y, w, h);
        c.lineWidth = 1.4;
        c.strokeStyle = '#111111';
        c.setLineDash([6, 4]);
        c.strokeRect(x, y, w, h);
        c.setLineDash([]);
      }

      c.restore();
    }
  }

  root.LayerEditor = LayerEditor;
})(typeof window !== 'undefined' ? window : this);
