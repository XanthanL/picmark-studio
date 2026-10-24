/* ============================================================
   图印工坊 · 自绘下拉组件
   ------------------------------------------------------------
   原生 <select> 的 option 列表无法样式化（尤其暗色下的系统
   高亮很突兀），这里把页面上的 select 全部增强为自绘组件：
     - 原 select 保留在 DOM 里（隐藏），value / change 事件
       与 app.js 的读写零改动；
     - 支持 optgroup（字体列表的分组）；
     - 列表用 position:fixed 定位，避免被 .panel 的
       overflow-y:auto 裁掉；打开时按按钮 rect 计算；
     - MutationObserver 监听 select 的选项变化（预设、数据列
       是动态生成的）与文本变化（i18n.apply 改 option.textContent），
       自动重建列表；
     - 交互：点击开合、点击外部 / Esc 关闭、滚动关闭、
       选中项 scrollIntoView。
   ============================================================ */
(function () {
  'use strict';

  var ARROW = '<svg class="cus-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var instances = [];

  function CustomSelect(select) {
    this.select = select;
    this.select.classList.add('cus-hidden');
    this.select.setAttribute('tabindex', '-1');

    this.root = document.createElement('div');
    this.root.className = 'cus-select';

    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.className = 'cus-btn';
    this.btn.setAttribute('aria-haspopup', 'listbox');

    this.label = document.createElement('span');
    this.label.className = 'cus-label';
    this.btn.appendChild(this.label);

    var arrowWrap = document.createElement('span');
    arrowWrap.innerHTML = ARROW;
    this.btn.appendChild(arrowWrap.firstChild);

    this.list = document.createElement('ul');
    this.list.className = 'cus-list';
    this.list.setAttribute('role', 'listbox');

    this.root.appendChild(this.btn);
    this.root.appendChild(this.list);
    this.select.parentNode.insertBefore(this.root, this.select.nextSibling);

    this.open = false;
    this.rebuild();

    var self = this;
    this.btn.addEventListener('click', function (e) {
      e.stopPropagation();
      self.toggleList();
    });
    this.list.addEventListener('click', function (e) {
      var li = e.target.closest('li[data-value]');
      if (!li) return;
      e.stopPropagation();
      self.select.value = li.getAttribute('data-value');
      self.select.dispatchEvent(new Event('change', { bubbles: true }));
      self.syncLabel();
      self.closeList();
    });
    /* 程序改值（app.js 设 .value）也会触发 change，同步显示 */
    this.select.addEventListener('change', function () { self.syncLabel(); });
    /* 选项或文本被动态修改（预设/数据列/i18n）时重建 */
    this.observer = new MutationObserver(function () { self.rebuild(); });
    this.observer.observe(select, { childList: true, characterData: true, subtree: true });

    instances.push(this);
  }

  CustomSelect.prototype.rebuild = function () {
    var select = this.select;
    var list = this.list;
    list.innerHTML = '';
    var self = this;

    Array.prototype.forEach.call(select.children, function (node) {
      if (node.tagName === 'OPTGROUP') {
        var gi = document.createElement('li');
        gi.className = 'cus-group';
        gi.textContent = node.getAttribute('label') || '';
        list.appendChild(gi);
        Array.prototype.forEach.call(node.children, function (opt) {
          list.appendChild(self.buildItem(opt));
        });
      } else if (node.tagName === 'OPTION') {
        list.appendChild(self.buildItem(node));
      }
    });
    this.syncLabel();
  };

  /* 字体类下拉：每个选项用它自己的字体渲染，选字体时能直接看见字形 */
  CustomSelect.prototype.buildItem = function (opt) {
    var li = document.createElement('li');
    li.textContent = opt.textContent;
    li.setAttribute('data-value', opt.value);
    li.setAttribute('role', 'option');
    if (this.select.hasAttribute('data-font-preview') && opt.value) {
      li.style.fontFamily = opt.value;
    }
    if (opt.selected || opt.value === this.select.value) li.classList.add('is-selected');
    return li;
  };

  CustomSelect.prototype.syncLabel = function () {
    var opt = this.select.options[this.select.selectedIndex];
    this.label.textContent = opt ? opt.textContent : '';
    /* 同步高亮 */
    var val = this.select.value;
    Array.prototype.forEach.call(this.list.children, function (li) {
      if (li.hasAttribute('data-value')) {
        li.classList.toggle('is-selected', li.getAttribute('data-value') === val);
      }
    });
  };

  CustomSelect.prototype.toggleList = function () {
    this.open ? this.closeList() : this.openList();
  };

  CustomSelect.prototype.openList = function () {
    /* 先关掉别的 */
    instances.forEach(function (ins) { if (ins.open) ins.closeList(); });
    this.open = true;
    this.root.classList.add('open');
    this.positionList();
    var sel = this.list.querySelector('li.is-selected') || this.list.querySelector('li[data-value]');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  };

  CustomSelect.prototype.closeList = function () {
    this.open = false;
    this.root.classList.remove('open');
  };

  /* fixed 定位：贴按钮下方，超出视口底部则改到上方 */
  CustomSelect.prototype.positionList = function () {
    var r = this.btn.getBoundingClientRect();
    var list = this.list;
    list.style.visibility = 'hidden';
    list.style.display = 'block';
    var width = Math.max(r.width, 180);
    list.style.left = r.left + 'px';
    list.style.top = (r.bottom + 6) + 'px';
    list.style.width = width + 'px';
    /* 先测量再决定上下 */
    list.style.top = '0px';
    var h = list.offsetHeight;
    var below = r.bottom + 6;
    if (below + h > window.innerHeight - 8 && r.top - h - 6 > 8) {
      list.style.top = (r.top - h - 6) + 'px';
    } else {
      list.style.top = below + 'px';
    }
    list.style.visibility = '';
  };

  /* 全局：点外部 / Esc / 滚动 关闭 */
  document.addEventListener('click', function () {
    instances.forEach(function (ins) { if (ins.open) ins.closeList(); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') instances.forEach(function (ins) { if (ins.open) ins.closeList(); });
  });
  /* capture 才能收到列表自身的 scroll（scroll 不冒泡），
     所以必须排除列表内部的滚动，否则一滑就关、根本看不完 */
  window.addEventListener('scroll', function (e) {
    instances.forEach(function (ins) {
      if (!ins.open) return;
      /* e.target 可能是 window（非 Node），直接给 contains() 会抛 TypeError
         并中断整个 forEach，所以先判 nodeType */
      if (e.target && e.target.nodeType && ins.list.contains(e.target)) return;
      ins.closeList();
    });
  }, true);
  window.addEventListener('resize', function () {
    instances.forEach(function (ins) { if (ins.open) ins.closeList(); });
  });

  function init() {
    document.querySelectorAll('select:not([data-native])').forEach(function (s) {
      if (!s.classList.contains('cus-hidden')) new CustomSelect(s);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
