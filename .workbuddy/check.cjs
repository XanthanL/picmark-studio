const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const i18n = fs.readFileSync('js/i18n.js', 'utf8');

// 1. i18n keys
const keys = new Set();
for (const m of html.matchAll(/data-i18n(?:-title|-placeholder|-html)?="([^"]+)"/g)) keys.add(m[1]);
const missing = [...keys].filter(k => !(i18n.includes(`'${k}'`) || i18n.includes(`"${k}"`) || i18n.includes(`${k}:`)));
console.log('html i18n keys:', keys.size);
console.log('missing i18n:', JSON.stringify(missing));

// 2. tag balance
const stack = [];
const voids = new Set(['meta', 'link', 'br', 'hr', 'img', 'input', 'source', 'path', 'circle', 'rect', 'area', 'base', 'col', 'embed', 'track', 'wbr']);
const bad = [];
for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>/g)) {
  const close = m[1] === '/', tag = m[2].toLowerCase(), self = m[4] === '/';
  if (voids.has(tag) || self) continue;
  if (!close) stack.push(tag);
  else { const t = stack.pop(); if (t !== tag) bad.push('close ' + tag + ' but open ' + t); }
}
console.log('unclosed:', JSON.stringify(stack));
console.log('mismatch:', JSON.stringify(bad.slice(0, 10)));

// 3. ids referenced by js must exist in html
const jsIds = new Set();
for (const f of ['js/app.js', 'js/panel-controls.js', 'js/custom-select.js', 'js/layer-editor.js', 'js/layer-panel.js', 'js/onboarding.js']) {
  const src = fs.readFileSync(f, 'utf8');
  /* onboarding.js 用 byId() 包装，两种写法都要扫 */
  for (const m of src.matchAll(/(?:getElementById|byId)\(['"]([A-Za-z0-9_-]+)['"]\)/g)) jsIds.add(m[1]);
}
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const noId = [...jsIds].filter(i => !htmlIds.has(i));
console.log('js ids:', jsIds.size, 'missing in html:', JSON.stringify(noId));

// 4. els.X 必须在 els 对象里有定义（否则运行时才炸）
const appSrc = fs.readFileSync('js/app.js', 'utf8');
const elsBlock = appSrc.slice(appSrc.indexOf('const els = {'), appSrc.indexOf('\n  };', appSrc.indexOf('const els = {')));
const elsKeys = new Set([...elsBlock.matchAll(/^\s{4}([A-Za-z0-9_]+):/gm)].map(m => m[1]));
const used = new Set([...appSrc.matchAll(/\bels\.([A-Za-z0-9_]+)/g)].map(m => m[1]));
const badEls = [...used].filter(k => !elsKeys.has(k));
console.log('els keys:', elsKeys.size, 'used:', used.size, 'undefined els.*:', JSON.stringify(badEls));
