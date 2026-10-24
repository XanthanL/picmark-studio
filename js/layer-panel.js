/* ============================================================
   图层面板：列表 + 选中项配置
   ------------------------------------------------------------
   配置区按图层类型动态生成（文字锚点 / 文字区域 / PNG 水印），
   字段直接写回图层对象，再交给画布编辑器重绘——不经过任何
   「全局样式」中转，因此改哪个图层就只影响哪个图层。
   ============================================================ */
(function (root) {
  'use strict';

  var opts = null;

  function t(key, fallback) {
    var s = root.I18n && root.I18n.t ? root.I18n.t(key) : key;
    return s === key && fallback ? fallback : s;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* 一行字段：label.field > span + control */
  function field(labelText, control) {
    var wrap = el('label', 'field');
    wrap.appendChild(el('span', null, labelText));
    wrap.appendChild(control);
    return wrap;
  }

  function num(value, min, max, step, onInput, onCommit) {
    var i = document.createElement('input');
    i.type = 'number';
    i.value = value;
    if (min != null) i.min = min;
    if (max != null) i.max = max;
    if (step != null) i.step = step;
    i.addEventListener('input', function () { onInput(parseFloat(i.value)); });
    if (onCommit) i.addEventListener('change', function () { onCommit(parseFloat(i.value)); });
    return i;
  }

  function range(value, min, max, step, onInput, onCommit) {
    var r = document.createElement('input');
    r.type = 'range';
    r.value = value;
    r.min = min; r.max = max; r.step = step;
    r.addEventListener('input', function () { onInput(parseFloat(r.value)); });
    if (onCommit) r.addEventListener('change', function () { onCommit(parseFloat(r.value)); });
    return r;
  }

  /* 滑杆 + 数字框成对出现，与工具条里的字号 / 字间距一致 */
  function sliderRow(value, min, max, step, onInput, onCommit) {
    var row = el('span', 'slider-row');
    var r = range(value, min, max, step, function (v) { n.value = v; onInput(v); }, onCommit);
    var n = num(value, min, max, step, function (v) { r.value = v; onInput(v); }, onCommit);
    row.appendChild(r);
    row.appendChild(n);
    return row;
  }

  function select(options, value, onChange) {
    var s = document.createElement('select');
    options.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o.value;
      op.textContent = o.label;
      s.appendChild(op);
    });
    s.value = value;
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }

  /* 分段控件：用文字标签的轻量版，避免为主面板再造一套 SVG 图标 */
  function seg(options, value, onChange) {
    var g = el('div', 'seg-group seg-text');
    options.forEach(function (o) {
      var b = el('button', 'seg' + (o.value === value ? ' is-active' : ''), o.label);
      b.type = 'button';
      b.addEventListener('click', function () {
        g.querySelectorAll('.seg').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        onChange(o.value);
      });
      g.appendChild(b);
    });
    return g;
  }

  function switchRow(labelText, checked, onChange) {
    var wrap = el('div', 'fx-item');
    var box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'fx-check';
    box.hidden = true;
    box.checked = !!checked;
    var lab = el('label', 'switch');
    var track = el('span', 'switch-track');
    track.appendChild(el('span', 'switch-knob'));
    lab.appendChild(track);
    lab.appendChild(el('span', 'switch-label', labelText));
    lab.addEventListener('click', function (e) {
      e.preventDefault();
      box.checked = !box.checked;
      onChange(box.checked);
    });
    wrap.appendChild(box);
    wrap.appendChild(lab);
    return wrap;
  }

  function colorInput(value, onInput) {
    var p = el('span', 'picker');
    var i = document.createElement('input');
    i.type = 'color';
    i.value = value;
    i.addEventListener('input', function () { onInput(i.value); });
    p.appendChild(i);
    return p;
  }

  function checkRow(labelText, checked, onChange) {
    var wrap = el('label', 'field field-inline');
    var i = document.createElement('input');
    i.type = 'checkbox';
    i.checked = !!checked;
    i.addEventListener('change', function () { onChange(i.checked); });
    wrap.appendChild(i);
    wrap.appendChild(el('span', null, labelText));
    return wrap;
  }

  function section(title) {
    var s = el('div', 'layer-section');
    s.appendChild(el('div', 'layer-section-title', title));
    return s;
  }

  function row(/* children */) {
    var r = el('div', 'form-row');
    Array.prototype.forEach.call(arguments, function (c) { r.appendChild(c); });
    return r;
  }

  /* ===== 列表 ===== */
  function renderList() {
    var listEl = opts.listEl;
    listEl.innerHTML = '';
    var layers = opts.editor ? opts.editor.getLayers() : [];
    var activeId = opts.editor ? opts.editor.activeId : null;

    // 列表自上而下 = 图层自上层到下层（绘制顺序是数组顺序，越后越上）
    for (var i = layers.length - 1; i >= 0; i--) {
      (function (l) {
        var item = el('div', 'layer-item' + (l.id === activeId ? ' active' : '') + (l.visible === false ? ' is-hidden' : ''));
        var badge = el('span', 'layer-badge', l.type === 'image' ? 'PNG' : (l.mode === 'region' ? '框' : 'T'));
        var name = el('span', 'layer-name', l.name || (l.type === 'image' ? t('layer.watermark', '水印') : t('layer.text', '文字')));
        var meta = el('span', 'layer-meta', l.type === 'image'
          ? Math.round(l.w) + '×' + Math.round(l.h)
          : (l.mode === 'region' ? Math.round(l.w) + '×' + Math.round(l.h) : (l.fontSize || 60) + 'px'));
        var eye = el('button', 'layer-eye', l.visible === false ? '◌' : '●');
        eye.type = 'button';
        eye.title = t('layer.toggleVisible', '显示 / 隐藏');
        eye.addEventListener('click', function (e) {
          e.stopPropagation();
          l.visible = l.visible === false;
          opts.editor._pushHistory();
          opts.onChange();
        });
        item.appendChild(badge);
        item.appendChild(name);
        item.appendChild(meta);
        item.appendChild(eye);
        item.addEventListener('click', function () { opts.editor.setActive(l.id); });
        listEl.appendChild(item);
      })(layers[i]);
    }

    if (!layers.length) {
      listEl.appendChild(el('p', 'layer-empty', t('layer.empty', '还没有图层。用上方「文字 / 区域 / 水印」工具在画布上添加。')));
    }
  }

  /* ===== 配置区 ===== */
  function renderConfig() {
    var cfg = opts.configEl;
    cfg.innerHTML = '';
    var l = opts.editor ? opts.editor.active() : null;
    if (!l) {
      cfg.appendChild(el('p', 'layer-empty', t('layer.noSelection', '选中一个图层后可在此调整参数。')));
      return;
    }

    var commit = function () { opts.editor._pushHistory(); };
    var set = function (k, v, noCommit) {
      l[k] = v;
      if (!noCommit) commit();
      opts.onChange();
    };

    /* —— 通用：名称 / 位置 / 尺寸 / 旋转 / 不透明度 —— */
    var common = section(t('layer.section.common', '通用'));
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = l.name || '';
    nameInput.addEventListener('input', function () { set('name', nameInput.value); });
    common.appendChild(field(t('layer.name', '名称'), nameInput));

    var isPoint = l.type === 'text' && l.mode !== 'region';
    common.appendChild(row(
      field(t('layer.x', 'X'), num(Math.round(l.x), null, null, 1, function (v) { set('x', v, true); }, commit)),
      field(t('layer.y', 'Y'), num(Math.round(l.y), null, null, 1, function (v) { set('y', v, true); }, commit))
    ));
    if (!isPoint) {
      common.appendChild(row(
        field(t('layer.w', '宽'), num(Math.round(l.w), 8, null, 1, function (v) { set('w', v, true); }, commit)),
        field(t('layer.h', '高'), num(Math.round(l.h), 8, null, 1, function (v) { set('h', v, true); }, commit))
      ));
    }

    common.appendChild(row(
      field(t('layer.rotation', '旋转'), sliderRow(Math.round(l.rotation || 0), 0, 360, 1, function (v) { set('rotation', v, true); }, commit)),
      field(t('layer.opacity', '不透明度'), sliderRow(l.opacity == null ? 1 : l.opacity, 0, 1, 0.05, function (v) { set('opacity', v, true); }, commit))
    ));
    cfg.appendChild(common);

    if (l.type === 'image') {
      /* —— PNG 水印 —— */
      var img = section(t('layer.section.image', '水印图片'));
      var pick = el('button', 'secondary-btn', t('layer.pickImage', '选择 PNG 图片…'));
      pick.type = 'button';
      pick.addEventListener('click', function () { opts.onPickWatermark(l); });
      img.appendChild(row(pick));
      img.appendChild(row(field(t('layer.fit', '适应方式'), select([
        { value: 'contain', label: t('layer.fit.contain', '完整放入') },
        { value: 'cover', label: t('layer.fit.cover', '填满裁剪') },
        { value: 'stretch', label: t('layer.fit.stretch', '拉伸铺满') }
      ], l.fit, function (v) { set('fit', v); }))));
      img.appendChild(row(
        checkRow(t('layer.flipH', '水平翻转'), !!l.flipH, function (v) { set('flipH', v); }),
        checkRow(t('layer.flipV', '垂直翻转'), !!l.flipV, function (v) { set('flipV', v); })
      ));
      cfg.appendChild(img);
      return;
    }

    /* —— 文字：内容 —— */
    var content = section(t('layer.section.content', '内容'));
    content.appendChild(row(field(t('layer.source', '来源'), select([
      { value: 'name', label: t('textSource.name', '从名单读取') },
      { value: 'fixed', label: t('textSource.fixed', '固定文本') }
    ], l.source, function (v) { set('source', v); }))));

    if (l.source === 'name') {
      var cols = opts.getColumns();
      content.appendChild(row(field(t('label.dataColumn', '数据列'), select(
        cols.map(function (c) { return { value: c, label: c }; }),
        l.column || cols[0], function (v) { set('column', v); }))));
    } else {
      var fixed = document.createElement('input');
      fixed.type = 'text';
      fixed.value = l.fixedText || '';
      fixed.addEventListener('input', function () { set('fixedText', fixed.value, true); });
      fixed.addEventListener('change', commit);
      content.appendChild(row(field(t('label.regionFixedText', '固定文本'), fixed)));
    }
    cfg.appendChild(content);

    /* —— 文字：排版 —— */
    var layout = section(t('group.layout', '排版'));
    layout.appendChild(row(field(t('label.align', '水平对齐'), seg([
      { value: 'left', label: t('align.left', '左') },
      { value: 'center', label: t('align.center', '中') },
      { value: 'right', label: t('align.right', '右') }
    ], l.align, function (v) { set('align', v); }))));

    if (!isPoint) {
      layout.appendChild(row(field(t('label.alignV', '垂直对齐'), seg([
        { value: 'top', label: t('alignV.top', '上') },
        { value: 'middle', label: t('alignV.middle', '中') },
        { value: 'bottom', label: t('alignV.bottom', '下') }
      ], l.valign, function (v) { set('valign', v); }))));

      layout.appendChild(row(
        checkRow(t('label.autoFit', '自动适配字号'), !!l.autoFit, function (v) { set('autoFit', v); }),
        field(t('label.lineHeight', '行高'), num(l.lineHeight || 1.2, 0.5, 3, 0.1, function (v) { set('lineHeight', v, true); }, commit))
      ));
      layout.appendChild(row(
        field(t('label.minFont', '最小字号'), num(l.minFont || 12, 8, 200, 1, function (v) { set('minFont', v, true); }, commit)),
        field(t('label.maxFont', '最大字号'), num(l.maxFont || 300, 12, 500, 1, function (v) { set('maxFont', v, true); }, commit))
      ));
      if (!l.autoFit) {
        layout.appendChild(row(field(t('label.fontSize', '字号'), sliderRow(l.fontSize || 60, 12, 400, 1, function (v) { set('fontSize', v, true); }, commit))));
      }
    } else {
      layout.appendChild(row(
        field(t('label.fontSize', '字号'), sliderRow(l.fontSize || 60, 12, 400, 1, function (v) { set('fontSize', v, true); }, commit)),
        field(t('label.maxWidth', '最大宽度'), num(l.maxWidth || 0, 0, null, 10, function (v) { set('maxWidth', v, true); }, commit))
      ));
    }
    layout.appendChild(row(field(t('label.letterSpacing', '字间距'), sliderRow(l.letterSpacing || 0, -10, 100, 1, function (v) { set('letterSpacing', v, true); }, commit))));
    cfg.appendChild(layout);

    /* —— 文字：字体 —— */
    var type = section(t('group.type', '字体'));
    type.appendChild(row(field(t('label.fontFamily', '字体'), makeFontSelect(l))));
    type.appendChild(row(field(t('label.fontWeight', '字重'), select(
      [100, 200, 300, 400, 500, 600, 700, 800, 900].map(function (w) { return { value: String(w), label: String(w) }; }),
      String(l.fontWeight || 400), function (v) { set('fontWeight', parseInt(v, 10)); }))));
    type.appendChild(row(
      checkRow(t('style.italic', '斜体'), !!l.italic, function (v) { set('italic', v); }),
      checkRow(t('style.underline', '下划线'), !!l.underline, function (v) { set('underline', v); })
    ));
    type.appendChild(row(field(t('label.color', '颜色'), colorInput(l.color || '#111111', function (v) { set('color', v, true); }))));
    cfg.appendChild(type);

    /* —— 文字：特效 —— */
    var fx = section(t('group.fx', '特效'));
    fx.appendChild(switchRow(t('fx.stroke', '描边'), !!l.stroke, function (v) { set('stroke', v); renderConfig(); }));
    if (l.stroke) {
      fx.appendChild(row(
        field(t('fx.strokeWidth', '描边粗细'), sliderRow(l.strokeWidth || 3, 1, 20, 1, function (v) { set('strokeWidth', v, true); }, commit)),
        field(t('fx.strokeColor', '描边颜色'), colorInput(l.strokeColor || '#FFFFFF', function (v) { set('strokeColor', v, true); }))
      ));
    }
    fx.appendChild(switchRow(t('fx.shadow', '投影'), !!l.shadow, function (v) { set('shadow', v); renderConfig(); }));
    if (l.shadow) {
      fx.appendChild(row(field(t('fx.shadowBlur', '模糊'), sliderRow(l.shadowBlur || 12, 2, 60, 1, function (v) { set('shadowBlur', v, true); }, commit))));
    }
    cfg.appendChild(fx);
  }

  /* 字体下拉直接复用顶栏那一套选项，避免两处维护字体清单 */
  function makeFontSelect(layer) {
    var s = document.createElement('select');
    var src = document.getElementById('fontFamily');
    if (src) {
      Array.prototype.forEach.call(src.querySelectorAll('optgroup'), function (g) {
        var og = document.createElement('optgroup');
        og.label = g.label;
        Array.prototype.forEach.call(g.querySelectorAll('option'), function (o) {
          var op = document.createElement('option');
          op.value = o.value;
          op.textContent = o.textContent;
          og.appendChild(op);
        });
        s.appendChild(og);
      });
    } else {
      ['Microsoft YaHei, sans-serif', 'SimHei, Microsoft YaHei, sans-serif', 'SimSun, Songti SC, serif', 'KaiTi, Kaiti SC, serif', 'Arial, sans-serif'].forEach(function (f) {
        var op = document.createElement('option');
        op.value = f; op.textContent = f.split(',')[0];
        s.appendChild(op);
      });
    }
    s.value = layer.fontFamily;
    s.addEventListener('change', function () {
      layer.fontFamily = s.value;
      opts.editor._pushHistory();
      opts.onChange();
    });
    return s;
  }

  root.PMLayerPanel = {
    init: function (o) { opts = o; },
    setEditor: function (ed) { if (opts) opts.editor = ed; },
    render: function () { renderList(); renderConfig(); },
    renderList: renderList,
    renderConfig: renderConfig
  };
})(typeof window !== 'undefined' ? window : this);
