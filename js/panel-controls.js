/* ============================================================
   图印工坊 · 面板控件联动
   ------------------------------------------------------------
   把「手打数字」换成「拖拽 / 点选」，同时保持与 app.js 零耦合：
   新控件只负责写入原生控件的 value 并派发它原本监听的事件
   （fontSize:'input' / textAlign:'change' / fontColor:'input'），
   因此重绘与字重检测等既有逻辑全部照跑。
   ============================================================ */
(function () {
  'use strict';

  function boot() {
    /* —— 字号：滑块 ↔ 数值框 —— */
    var fontSize = document.getElementById('fontSize');
    var fontSizeRange = document.getElementById('fontSizeRange');
    if (fontSize && fontSizeRange) {
      fontSizeRange.addEventListener('input', function () {
        fontSize.value = fontSizeRange.value;
        fontSize.dispatchEvent(new Event('input', { bubbles: true }));
      });
      fontSize.addEventListener('input', function () {
        var v = parseInt(fontSize.value, 10);
        if (!isNaN(v)) fontSizeRange.value = v;
      });
      fontSizeRange.value = fontSize.value || 60;
    }

    /* —— 对齐：图标按钮组 ↔ #textAlign —— */
    var alignGroup = document.getElementById('alignGroup');
    var textAlign = document.getElementById('textAlign');
    if (alignGroup && textAlign) {
      function syncAlign() {
        alignGroup.querySelectorAll('.seg').forEach(function (b) {
          var on = b.getAttribute('data-align') === textAlign.value;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }
      alignGroup.addEventListener('click', function (e) {
        var btn = e.target.closest('.seg');
        if (!btn) return;
        textAlign.value = btn.getAttribute('data-align');
        textAlign.dispatchEvent(new Event('change', { bubbles: true }));
        syncAlign();
      });
      textAlign.addEventListener('change', syncAlign);
      syncAlign();
    }

    /* —— 字重：药丸按钮组 ↔ #fontWeight —— */
    var weightGroup = document.getElementById('weightGroup');
    var fontWeight = document.getElementById('fontWeight');
    if (weightGroup && fontWeight) {
      function syncWeight() {
        weightGroup.querySelectorAll('.pill').forEach(function (b) {
          var on = b.getAttribute('data-weight') === fontWeight.value;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }
      weightGroup.addEventListener('click', function (e) {
        var btn = e.target.closest('.pill');
        if (!btn) return;
        fontWeight.value = btn.getAttribute('data-weight');
        fontWeight.dispatchEvent(new Event('change', { bubbles: true }));
        syncWeight();
      });
      fontWeight.addEventListener('change', syncWeight);
      syncWeight();
    }

    /* —— 斜体 / 下划线：图标按钮 ↔ 隐藏 checkbox —— */
    [['styleGroup', 'seg', 'data-style', { italic: 'textItalic', underline: 'textUnderline' }]].forEach(function (cfg) {
      var group = document.getElementById(cfg[0]);
      if (!group) return;
      var map = cfg[3];
      function sync() {
        group.querySelectorAll('.' + cfg[1]).forEach(function (b) {
          var id = map[b.getAttribute(cfg[2])];
          var box = document.getElementById(id);
          var on = !!(box && box.checked);
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }
      group.addEventListener('click', function (e) {
        var btn = e.target.closest('.' + cfg[1]);
        if (!btn) return;
        var box = document.getElementById(map[btn.getAttribute(cfg[2])]);
        if (!box) return;
        box.checked = !box.checked;
        box.dispatchEvent(new Event('change', { bubbles: true }));
        sync();
      });
      Object.keys(map).forEach(function (k) {
        var box = document.getElementById(map[k]);
        if (box) box.addEventListener('change', sync);
      });
      sync();
    });

    /* —— 字间距 / 描边宽度 / 投影模糊：滑块 ↔ 数值框 —— */
    [['letterSpacingRange', 'textLetterSpacing'],
      ['strokeWidthRange', 'strokeWidth'],
      ['shadowBlurRange', 'shadowBlur']].forEach(function (pair) {
      var range = document.getElementById(pair[0]);
      var num = document.getElementById(pair[1]);
      if (!range || !num) return;
      range.addEventListener('input', function () {
        num.value = range.value;
        num.dispatchEvent(new Event('input', { bubbles: true }));
      });
      num.addEventListener('input', function () {
        var v = parseInt(num.value, 10);
        if (!isNaN(v)) range.value = v;
      });
      range.value = num.value;
    });

    /* —— 颜色：预设色板 ↔ #fontColor —— */
    var swatches = document.getElementById('colorSwatches');
    var fontColor = document.getElementById('fontColor');
    if (swatches && fontColor) {
      function syncColor() {
        var cur = (fontColor.value || '').toUpperCase();
        swatches.querySelectorAll('.swatch').forEach(function (b) {
          var on = (b.getAttribute('data-color') || '').toUpperCase() === cur;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }
      swatches.addEventListener('click', function (e) {
        var btn = e.target.closest('.swatch');
        if (!btn) return;
        fontColor.value = btn.getAttribute('data-color');
        /* 取色模式下会同步色卡，这里只管文字色与重绘 */
        fontColor.dispatchEvent(new Event('input', { bubbles: true }));
        syncColor();
      });
      fontColor.addEventListener('input', syncColor);
      syncColor();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
