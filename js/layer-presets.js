/* ============================================================
   图层预设模板
   ------------------------------------------------------------
   坐标以底图宽高比例（0~1）表示，应用时换算为像素，
   因此同一套预设能套到任意尺寸的底图上。
   预设里的「区域文字图层」默认开启自适应字号。
   ============================================================ */
(function (root) {
  'use strict';

  var PRESETS = [
    {
      name: '工牌胸牌', desc: '姓名居上 + 编号居下',
      regions: [
        { rx: 0.22, ry: 0.12, rw: 0.56, rh: 0.28, config: { name: '姓名', source: 'name', fontWeight: 700, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 120, minFont: 24 } },
        { rx: 0.30, ry: 0.72, rw: 0.40, rh: 0.16, config: { name: '编号', source: 'fixed', fixedText: '编号 0001', fontFamily: 'Courier New, monospace', fontWeight: 400, color: '#9A9388', valign: 'middle', align: 'center', maxFont: 40, minFont: 14 } }
      ]
    },
    {
      name: '荣誉证书', desc: '姓名居中 + 日期右下',
      regions: [
        { rx: 0.15, ry: 0.38, rw: 0.70, rh: 0.22, config: { name: '姓名', source: 'name', fontFamily: 'STKaiti, Kaiti SC, serif', fontWeight: 700, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 100, minFont: 24 } },
        { rx: 0.55, ry: 0.78, rw: 0.35, rh: 0.12, config: { name: '日期', source: 'fixed', fixedText: '二〇二六年', fontFamily: 'STKaiti, Kaiti SC, serif', fontWeight: 400, color: '#1A1A1A', valign: 'middle', align: 'right', maxFont: 36, minFont: 14 } }
      ]
    },
    {
      name: '邀请函', desc: '嘉宾姓名居中',
      regions: [
        { rx: 0.20, ry: 0.40, rw: 0.60, rh: 0.24, config: { name: '嘉宾', source: 'name', fontFamily: 'STKaiti, Kaiti SC, serif', fontWeight: 600, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 90, minFont: 20, letterSpacing: 8 } }
      ]
    },
    {
      name: '签到名牌', desc: '超大姓名 + 单位底部',
      regions: [
        { rx: 0.08, ry: 0.15, rw: 0.84, rh: 0.55, config: { name: '姓名', source: 'name', fontFamily: 'SimHei, Microsoft YaHei, sans-serif', fontWeight: 900, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 260, minFont: 40 } },
        { rx: 0.20, ry: 0.74, rw: 0.60, rh: 0.14, config: { name: '单位', source: 'fixed', fixedText: '单位名称', fontWeight: 400, color: '#9A9388', valign: 'middle', align: 'center', maxFont: 44, minFont: 14 } }
      ]
    },
    {
      name: '贺卡祝福', desc: '称呼居中 + 落款右下',
      regions: [
        { rx: 0.18, ry: 0.30, rw: 0.64, rh: 0.22, config: { name: '称呼', source: 'name', fontFamily: 'STKaiti, Kaiti SC, serif', fontWeight: 500, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 80, minFont: 18 } },
        { rx: 0.50, ry: 0.80, rw: 0.40, rh: 0.12, config: { name: '落款', source: 'fixed', fixedText: '敬上', fontFamily: 'STKaiti, Kaiti SC, serif', fontWeight: 400, color: '#1A1A1A', valign: 'middle', align: 'right', maxFont: 32, minFont: 12 } }
      ]
    },
    {
      name: '简约名片', desc: '姓名左上 + 职务右下',
      regions: [
        { rx: 0.06, ry: 0.10, rw: 0.50, rh: 0.30, config: { name: '姓名', source: 'name', fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif', fontWeight: 700, color: '#1A1A1A', valign: 'middle', align: 'left', maxFont: 80, minFont: 18 } },
        { rx: 0.50, ry: 0.62, rw: 0.44, rh: 0.20, config: { name: '职务', source: 'fixed', fixedText: '职务', fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif', fontWeight: 400, color: '#9A9388', valign: 'middle', align: 'right', maxFont: 36, minFont: 12 } }
      ]
    },
    {
      name: '会议桌牌', desc: '超大姓名居中',
      regions: [
        { rx: 0.25, ry: 0.08, rw: 0.50, rh: 0.84, config: { name: '姓名', source: 'name', fontFamily: 'SimHei, Microsoft YaHei, sans-serif', fontWeight: 900, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 300, minFont: 60 } }
      ]
    },
    {
      name: '毕业证书', desc: '姓名 + 专业 + 年份',
      regions: [
        { rx: 0.20, ry: 0.32, rw: 0.60, rh: 0.16, config: { name: '姓名', source: 'name', fontFamily: 'STKaiti, Kaiti SC, serif', fontWeight: 700, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 72, minFont: 20, letterSpacing: 6 } },
        { rx: 0.25, ry: 0.52, rw: 0.50, rh: 0.10, config: { name: '专业', source: 'fixed', fixedText: '专业名称', fontFamily: 'STKaiti, Kaiti SC, serif', fontWeight: 400, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 32, minFont: 12 } },
        { rx: 0.55, ry: 0.82, rw: 0.35, rh: 0.10, config: { name: '年份', source: 'fixed', fixedText: '二〇二六年', fontFamily: 'STKaiti, Kaiti SC, serif', fontWeight: 400, color: '#1A1A1A', valign: 'middle', align: 'right', maxFont: 28, minFont: 12 } }
      ]
    },
    {
      name: '婚礼席位', desc: '桌号居上 + 姓名居下',
      regions: [
        { rx: 0.30, ry: 0.10, rw: 0.40, rh: 0.30, config: { name: '桌号', source: 'fixed', fixedText: '第 1 桌', fontFamily: 'STKaiti, Kaiti SC, serif', fontWeight: 700, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 80, minFont: 24 } },
        { rx: 0.15, ry: 0.50, rw: 0.70, rh: 0.30, config: { name: '姓名', source: 'name', fontFamily: 'STKaiti, Kaiti SC, serif', fontWeight: 600, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 100, minFont: 24, letterSpacing: 10 } }
      ]
    },
    {
      name: '活动海报', desc: '嘉宾名 + 职位',
      regions: [
        { rx: 0.10, ry: 0.35, rw: 0.80, rh: 0.22, config: { name: '嘉宾', source: 'name', fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif', fontWeight: 800, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 100, minFont: 24 } },
        { rx: 0.25, ry: 0.60, rw: 0.50, rh: 0.12, config: { name: '职位', source: 'fixed', fixedText: '嘉宾职位', fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif', fontWeight: 400, color: '#9A9388', valign: 'middle', align: 'center', maxFont: 36, minFont: 12 } }
      ]
    },
    {
      name: '生日贺卡', desc: '寿星名 + 祝福语',
      regions: [
        { rx: 0.18, ry: 0.20, rw: 0.64, rh: 0.20, config: { name: '寿星', source: 'name', fontFamily: 'STKaiti, Kaiti SC, serif', fontWeight: 700, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 80, minFont: 20 } },
        { rx: 0.15, ry: 0.55, rw: 0.70, rh: 0.18, config: { name: '祝福', source: 'fixed', fixedText: '生日快乐', fontFamily: 'STKaiti, Kaiti SC, serif', fontWeight: 500, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 56, minFont: 16, letterSpacing: 12 } }
      ]
    },
    {
      name: '工位铭牌', desc: '姓名 + 部门',
      regions: [
        { rx: 0.08, ry: 0.15, rw: 0.84, rh: 0.40, config: { name: '姓名', source: 'name', fontWeight: 700, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 120, minFont: 28 } },
        { rx: 0.20, ry: 0.62, rw: 0.60, rh: 0.18, config: { name: '部门', source: 'fixed', fixedText: '部门名称', fontWeight: 400, color: '#9A9388', valign: 'middle', align: 'center', maxFont: 40, minFont: 14 } }
      ]
    },
    {
      name: '考试准考证', desc: '姓名 + 考号 + 考场',
      regions: [
        { rx: 0.30, ry: 0.15, rw: 0.55, rh: 0.16, config: { name: '姓名', source: 'name', fontFamily: 'SimHei, Microsoft YaHei, sans-serif', fontWeight: 700, color: '#1A1A1A', valign: 'middle', align: 'left', maxFont: 48, minFont: 16 } },
        { rx: 0.30, ry: 0.35, rw: 0.55, rh: 0.12, config: { name: '考号', source: 'fixed', fixedText: '考号 000000', fontFamily: 'Courier New, monospace', fontWeight: 500, color: '#1A1A1A', valign: 'middle', align: 'left', maxFont: 28, minFont: 12 } },
        { rx: 0.30, ry: 0.52, rw: 0.55, rh: 0.12, config: { name: '考场', source: 'fixed', fixedText: '考场 第1考场', fontFamily: 'SimHei, Microsoft YaHei, sans-serif', fontWeight: 400, color: '#9A9388', valign: 'middle', align: 'left', maxFont: 26, minFont: 12 } }
      ]
    },
    {
      name: '节日福卡', desc: '福字 + 称呼',
      regions: [
        { rx: 0.30, ry: 0.12, rw: 0.40, rh: 0.22, config: { name: '福', source: 'fixed', fixedText: '福', fontFamily: 'STKaiti, Kaiti SC, serif', fontWeight: 900, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 180, minFont: 60 } },
        { rx: 0.15, ry: 0.60, rw: 0.70, rh: 0.20, config: { name: '称呼', source: 'name', fontFamily: 'STKaiti, Kaiti SC, serif', fontWeight: 600, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 56, minFont: 16, letterSpacing: 8 } }
      ]
    },
    {
      name: '运动号码布', desc: '号码 + 姓名 + 队伍',
      regions: [
        { rx: 0.25, ry: 0.08, rw: 0.50, rh: 0.35, config: { name: '号码', source: 'fixed', fixedText: '001', fontFamily: 'Impact, sans-serif', fontWeight: 900, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 200, minFont: 60 } },
        { rx: 0.10, ry: 0.48, rw: 0.80, rh: 0.20, config: { name: '姓名', source: 'name', fontFamily: 'SimHei, Microsoft YaHei, sans-serif', fontWeight: 700, color: '#1A1A1A', valign: 'middle', align: 'center', maxFont: 72, minFont: 20 } },
        { rx: 0.20, ry: 0.72, rw: 0.60, rh: 0.14, config: { name: '队伍', source: 'fixed', fixedText: '队伍名称', fontWeight: 500, color: '#9A9388', valign: 'middle', align: 'center', maxFont: 36, minFont: 12 } }
      ]
    }
  ];

  root.PMLayerPresets = PRESETS;
})(typeof window !== 'undefined' ? window : this);
