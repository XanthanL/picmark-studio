(function (root) {
  var translations = {
    'zh-CN': {
      // Hero
      'app.title': '图印工坊 · PicMark Studio',
      'hero.kicker': '— PICMARK STUDIO',
      'hero.title': '图印\n工坊',
      'hero.desc': '上传底图，标记文字位置，导入名单，一键生成批量个性化图片。',
      'hero.scenes': '应用场景',
      'scene.1': '工牌 · 胸牌印制',
      'scene.2': '证书 · 奖状生成',
      'scene.3': '活动签到名牌',
      'scene.4': '个性化邀请函',
      'scene.5': '团建纪念图',
      'scene.6': '贺卡 · 名片',

      // Section 01
      'sec.01.title': '底图与文字',
      'drop.title': '点击或拖拽图片至此',
      'drop.sub': 'JPG · PNG · WEBP',
      'label.quality': '输出质量',
      'quality.original': '原图尺寸',
      'quality.high': '高清（最大边 2048）',
      'quality.medium': '标准（最大边 1280）',
      'quality.low': '快速（最大边 800）',
      'divider.typography': '文字样式',
      'divider.position': '定位与区域',
      'label.fontSize': '字号',
      'label.color': '颜色',
      'label.align': '对齐',
      'align.left': '左对齐',
      'align.center': '居中',
      'align.right': '右对齐',
      'label.maxWidth': '最大宽度',
      'label.fontWeight': '字重',
      'label.fontFamily': '字体',
      'label.uploadFont': '上传字体文件',
      'mode.position': '定位',
      'mode.pick': '取色',
      'mode.region': '区域',
      'colorBadge.title': '当前文字颜色',
      'modeHint.position': '点击图片，"定位位置"文字即为最终文字左对齐起始位置的实时预览',
      'modeHint.pick': '点击图片任意位置，即可提取该位置颜色并应用到文字',
      'modeHint.region': '拖拽绘制矩形区域，文字将自动适配区域大小；点击已有区域可选中并调整',
      'modeHint.preset': '已套用「{name}」预设，拖拽区域可微调位置',
      'modeHint.create': '在图片上拖拽绘制一个矩形区域',
      'marker.text': '定位位置',

      // Region config
      'region.preset': '套用预设…',
      'region.create': '新建区域',
      'region.delete': '删除',
      'region.undo': '撤销',
      'region.redo': '重做',
      'region.save': '保存配置',
      'region.load': '加载配置',
      'region.needImage': '请先上传底图，再使用区域功能',
      'label.textSource': '文本内容',
      'textSource.name': '从名单读取',
      'textSource.fixed': '固定文本',
      'label.dataColumn': '数据列',
      'dataColumn.default': '默认列',
      'label.fixedText': '固定文本',
      'label.regionFont': '字体',
      'label.regionColor': '颜色',
      'label.opacity': '不透明度',
      'label.rotation': '旋转',
      'label.alignH': '水平对齐',
      'label.alignV': '垂直对齐',
      'alignV.top': '顶部',
      'alignV.middle': '居中',
      'alignV.bottom': '底部',
      'label.fontStyle': '样式',
      'fontStyle.normal': '常规',
      'fontStyle.italic': '斜体',
      'label.lineHeight': '行高',
      'label.letterSpacing': '字间距',
      'label.minFont': '最小字号',
      'label.maxFont': '最大字号',
      'label.autoFit': '自动适配字号',
      'label.regionFixedText': '固定文本',
      'placeholder.fixedText': '输入固定文字',

      // Section 02
      'sec.02.title': '导入名单',
      'names.hint': '每行一个名字；也可上传 CSV 文件（首行为表头，逗号分隔），多列数据可分别填充不同区域',
      'names.placeholder': '张三\n李四\n王五',
      'names.upload': '上传名单文件',

      // Section 03
      'sec.03.title': '批量生成',
      'perf.outputSize': '输出尺寸',
      'perf.mode': '处理模式',
      'perf.memory': '内存占用',
      'generate.btn': '开始生成并下载',
      'generate.btn.again': '重新生成并下载',

      // Footer
      'footer.title': '图印工坊 · 批量图片制作',

      // Dynamic
      'region.label': '区域',
      'region.fixed': '固定',
      'preview.text': '预览文字',
      'font.loaded': '已加载: {name}',
      'font.loadFail': '字体加载失败: {msg}',
      'confirm.memory': '预计内存占用较大（约 {mb} MB），建议降低输出质量或减少名单数量。是否继续？',
      'lang.toggle': 'EN',
      'perf.mode.worker': 'Worker 异步',
      'perf.mode.main': '主线程分帧',
      'perf.memoryWarning': '内存占用较高，建议降低输出质量或减少名单数量',
      'error.imageProcess': '图片处理失败: {msg}',
      'error.generate': '生成失败: {msg}',
      'error.imageLoad': '图片加载失败',
      'quality.label.original': '原图',
      'quality.label.high': '高清',
      'quality.label.medium': '标准',
      'quality.label.low': '快速',
      'imageInfo.template': '{name} · 原图 {ow} × {oh} · 输出 {w} × {h} · {q}',
      'weight.100': '极细',
      'weight.200': '特细',
      'weight.300': '细',
      'weight.400': '常规偏细',
      'weight.500': '常规',
      'weight.600': '半粗',
      'weight.700': '粗',
      'weight.800': '特粗',
      'weight.900': '黑',
      'weight.hint': '提示：当前字体可能没有 {value} 字重，浏览器会近似到最接近的可用字重。如需精确控制，可上传可变字体文件。',
      'generate.complete': '生成完成，耗时 {sec} 秒',
      'generate.zipName': 'picmark批量生成_{timestamp}',
    },

    'en': {
      // Hero
      'app.title': 'PicMark Studio',
      'hero.kicker': '— PICMARK STUDIO',
      'hero.title': 'PicMark\nStudio',
      'hero.desc': 'Upload a template, mark text positions, import a name list, and batch-generate personalized images in one click.',
      'hero.scenes': 'Use Cases',
      'scene.1': 'Badge · Card Printing',
      'scene.2': 'Certificate · Award',
      'scene.3': 'Event Name Badges',
      'scene.4': 'Personalized Invitations',
      'scene.5': 'Team Souvenir Images',
      'scene.6': 'Greeting Cards · Business Cards',

      // Section 01
      'sec.01.title': 'Template & Text',
      'drop.title': 'Click or drag image here',
      'drop.sub': 'JPG · PNG · WEBP',
      'label.quality': 'Output Quality',
      'quality.original': 'Original Size',
      'quality.high': 'HD (max 2048px)',
      'quality.medium': 'Standard (max 1280px)',
      'quality.low': 'Fast (max 800px)',
      'divider.typography': 'Typography',
      'divider.position': 'Position & Regions',
      'label.fontSize': 'Font Size',
      'label.color': 'Color',
      'label.align': 'Align',
      'align.left': 'Left',
      'align.center': 'Center',
      'align.right': 'Right',
      'label.maxWidth': 'Max Width',
      'label.fontWeight': 'Font Weight',
      'label.fontFamily': 'Font Family',
      'label.uploadFont': 'Upload Font File',
      'mode.position': 'Position',
      'mode.pick': 'Pick Color',
      'mode.region': 'Region',
      'colorBadge.title': 'Current text color',
      'modeHint.position': 'Click on the image. The "Position" text previews the left-aligned start position.',
      'modeHint.pick': 'Click anywhere on the image to pick a color and apply it to the text.',
      'modeHint.region': 'Drag to draw a rectangle region. Text auto-fits the region. Click a region to select and adjust.',
      'modeHint.preset': 'Applied preset "{name}". Drag regions to fine-tune positions.',
      'modeHint.create': 'Drag on the image to draw a rectangular region.',
      'marker.text': 'Position',

      // Region config
      'region.preset': 'Apply Preset…',
      'region.create': 'New Region',
      'region.delete': 'Delete',
      'region.undo': 'Undo',
      'region.redo': 'Redo',
      'region.save': 'Save Config',
      'region.load': 'Load Config',
      'region.needImage': 'Please upload a template image first to use regions.',
      'label.textSource': 'Text Source',
      'textSource.name': 'From Name List',
      'textSource.fixed': 'Fixed Text',
      'label.dataColumn': 'Data Column',
      'dataColumn.default': 'Default Column',
      'label.fixedText': 'Fixed Text',
      'label.regionFont': 'Font',
      'label.regionColor': 'Color',
      'label.opacity': 'Opacity',
      'label.rotation': 'Rotation',
      'label.alignH': 'Horizontal Align',
      'label.alignV': 'Vertical Align',
      'alignV.top': 'Top',
      'alignV.middle': 'Middle',
      'alignV.bottom': 'Bottom',
      'label.fontStyle': 'Style',
      'fontStyle.normal': 'Normal',
      'fontStyle.italic': 'Italic',
      'label.lineHeight': 'Line Height',
      'label.letterSpacing': 'Letter Spacing',
      'label.minFont': 'Min Font Size',
      'label.maxFont': 'Max Font Size',
      'label.autoFit': 'Auto-fit Font Size',
      'label.regionFixedText': 'Fixed Text',
      'placeholder.fixedText': 'Enter fixed text',

      // Section 02
      'sec.02.title': 'Import Name List',
      'names.hint': 'One name per line; or upload a CSV file (first row as header, comma-separated). Multiple columns can fill different regions.',
      'names.placeholder': 'John\nJane\nBob',
      'names.upload': 'Upload Name File',

      // Section 03
      'sec.03.title': 'Batch Generate',
      'perf.outputSize': 'Output Size',
      'perf.mode': 'Processing Mode',
      'perf.memory': 'Memory Usage',
      'generate.btn': 'Generate & Download',
      'generate.btn.again': 'Regenerate & Download',

      // Footer
      'footer.title': 'PicMark Studio · Batch Image Maker',

      // Dynamic
      'region.label': 'Region',
      'region.fixed': 'Fixed',
      'preview.text': 'Preview',
      'font.loaded': 'Loaded: {name}',
      'font.loadFail': 'Font load failed: {msg}',
      'confirm.memory': 'High memory usage estimated (~{mb} MB). Consider lowering output quality or reducing the list size. Continue?',
      'lang.toggle': '中文',
      'perf.mode.worker': 'Worker Async',
      'perf.mode.main': 'Main Thread Batch',
      'perf.memoryWarning': 'High memory usage. Consider lowering quality or reducing list size.',
      'error.imageProcess': 'Image processing failed: {msg}',
      'error.generate': 'Generation failed: {msg}',
      'error.imageLoad': 'Image load failed',
      'quality.label.original': 'Original',
      'quality.label.high': 'HD',
      'quality.label.medium': 'Standard',
      'quality.label.low': 'Fast',
      'imageInfo.template': '{name} · Source {ow} × {oh} · Output {w} × {h} · {q}',
      'weight.100': 'Ultra Light',
      'weight.200': 'Extra Light',
      'weight.300': 'Light',
      'weight.400': 'Light Regular',
      'weight.500': 'Regular',
      'weight.600': 'Medium',
      'weight.700': 'Bold',
      'weight.800': 'Extra Bold',
      'weight.900': 'Black',
      'weight.hint': 'Note: this font may not have weight {value}. The browser will approximate to the nearest available weight. Upload a variable font for precise control.',
      'generate.complete': 'Done in {sec}s',
      'generate.zipName': 'picmark_batch_{timestamp}',
    }
  };

  var currentLang = 'zh-CN';

  var I18n = {
    t: function (key, params) {
      var str = (translations[currentLang] && translations[currentLang][key]) || key;
      if (params) {
        Object.keys(params).forEach(function (k) {
          str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
        });
      }
      return str;
    },

    getLang: function () { return currentLang; },

    setLang: function (lang) {
      if (!translations[lang]) return;
      currentLang = lang;
      this.apply();
      document.documentElement.lang = lang === 'zh-CN' ? 'zh-CN' : 'en';
    },

    toggle: function () {
      this.setLang(currentLang === 'zh-CN' ? 'en' : 'zh-CN');
    },

    apply: function () {
      var els = document.querySelectorAll('[data-i18n]');
      els.forEach(function (el) {
        var key = el.getAttribute('data-i18n');
        var str = (translations[currentLang] && translations[currentLang][key]) || key;
        el.textContent = str;
      });
      var elsHtml = document.querySelectorAll('[data-i18n-html]');
      elsHtml.forEach(function (el) {
        var key = el.getAttribute('data-i18n-html');
        var str = (translations[currentLang] && translations[currentLang][key]) || key;
        el.innerHTML = str.replace(/\n/g, '<br>');
      });
      var elsPlaceholder = document.querySelectorAll('[data-i18n-placeholder]');
      elsPlaceholder.forEach(function (el) {
        var key = el.getAttribute('data-i18n-placeholder');
        var str = (translations[currentLang] && translations[currentLang][key]) || key;
        el.placeholder = str.replace(/\\n/g, '\n');
      });
      var elsTitle = document.querySelectorAll('[data-i18n-title]');
      elsTitle.forEach(function (el) {
        var key = el.getAttribute('data-i18n-title');
        var str = (translations[currentLang] && translations[currentLang][key]) || key;
        el.title = str;
      });
      document.title = this.t('app.title');
    }
  };

  root.I18n = I18n;
})(typeof window !== 'undefined' ? window : this);
