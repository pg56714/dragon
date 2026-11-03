import { content } from './content.js';
import { THEMES, createDragon } from './dragon.js';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 無痕模式等情況 */ } },
};

let lang = store.get('lang') || 'en'; // 預設英文；按右上角切換後會記住
let theme = THEMES[store.get('theme')] ? store.get('theme') : 'steel';

const t = (v) => (v && typeof v === 'object' && 'zh' in v ? v[lang] : v);
const lookup = (path) => path.split('.').reduce((o, k) => o?.[k], content);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// roadmap 屏：標題，再來一排一張卡片、左右交錯
function roadmap(s) {
  return `
    <div class="roadmap-head"><span class="num">${esc(s.num)}</span><h2 class="big">${esc(t(s.title))}</h2></div>
    <ol class="roadmap">${s.items.map((it, i) => `
      <li class="${i % 2 ? 'right' : 'left'}"><article class="card panel reveal">
        <time>${esc(it.when)}</time><h3>${esc(t(it.title))}</h3><p>${esc(t(it.desc))}</p></article></li>`).join('')}
    </ol>`;
}

// 每個區塊：pose 是這個區塊放哪一段龍（見 dragon.js 的 PIECES），navText 有值就會出現在導覽列
const SECTIONS = [
  {
    id: 'hero', pose: 'heroWave',
    render: (c) => `
      <div class="hero-card card panel">
        <p class="eyebrow">${esc(t(c.hero.eyebrow))}</p>
        <h1>${esc(t(c.hero.title))}</h1>
        <p class="sub">${esc(t(c.hero.sub))}</p>
        <div class="cta">
          <a class="btn primary" href="#s-0"><span>${esc(t(c.hero.ctaPrimary))}</span><i>↓</i></a>
          <a class="btn ghost" href="#forms">${esc(t(c.hero.ctaSecondary))}</a>
        </div>
      </div>`,
  },
  ...content.screens.map((s, i) => ({
    id: `s-${i}`, pose: s.pose, cls: 'screen', navText: t(s.title) ? s.title : null, // 有標題的內容屏才進導覽列
    render: () => (s.pose === 'roadmap' ? roadmap(s) : `
      <span class="num">${esc(s.num)}</span>
      <h2 class="big">${esc(t(s.title))}</h2>
      <p class="lead">${esc(t(s.sub))}</p>`),
  })),
  // 04 姿態：先一屏標題（龍盤成圓環），接著每個姿勢一屏，左上角標名稱
  {
    id: 'forms', pose: 'ring', cls: 'screen', navText: content.forms.title,
    render: (c) => `
      <span class="num">${esc(c.forms.num)}</span>
      <h2 class="big">${esc(t(c.forms.title))}</h2>
      <p class="lead">${esc(t(c.forms.sub))}</p>`,
  },
  ...content.forms.items.map((g, i) => ({
    id: `g-${i}`, pose: g.pose, cls: 'screen gallery',
    render: () => `<p class="gallery-label"><b>${String(i + 1).padStart(2, '0')}</b> ${esc(t(g.name))}</p>`,
  })),
  {
    id: 'contact', pose: 'ribbonArch', tag: 'footer', cls: 'contact', // 結尾，不放進導覽列
    render: (c) => `
      <p class="kicker">${esc(t(c.contact.kicker))}</p>
      <h2>${esc(t(c.contact.title))}</h2>
      <p class="sub">${esc(t(c.contact.sub))}</p>
      <div class="footbar"><span>© ${new Date().getFullYear()} ${esc(t(c.hero.name))}</span><a href="#hero">${esc(t(c.ui.top))} ↑</a></div>`,
  },
];

function render() {
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  document.title = `${t(content.hero.name)} · ${t(content.meta.title)}`;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(lookup(el.dataset.i18n)); });
  document.getElementById('lang').textContent = lang === 'zh' ? 'EN' : '中文';

  const shown = SECTIONS.map((s) => ({ s, html: s.render(content) }));
  document.getElementById('main').innerHTML = shown
    .map(({ s, html }) => { const tag = s.tag || 'section'; return `<${tag} id="${s.id}" class="${s.cls || s.id}"  data-pose="${s.pose || 'section'}">${html}</${tag}>`; })
    .join('');
  document.getElementById('nav-links').innerHTML = shown
    .filter(({ s }) => s.navText)
    .map(({ s }) => `<a href="#${s.id}">${esc(t(s.navText))}</a>`)
    .join('');
  watchActive();

  renderSwatches();
  observe();
  dragon?.attach([...document.querySelectorAll('[data-pose]')]);
}

function renderSwatches() {
  const box = document.getElementById('themes');
  box.setAttribute('aria-label', t(content.ui.theme));
  box.innerHTML = Object.entries(THEMES)
    .map(([key, th]) => `<button class="swatch" type="button" data-theme="${key}" aria-pressed="${key === theme}"
      title="${esc(t(content.ui.themes[key]))}" style="--s1:${th.css[0]};--s2:${th.css[1]}"></button>`)
    .join('');
}

// 導覽列：目前捲到的區塊亮起來
let navIo;
function watchActive() {
  navIo?.disconnect();
  const links = [...document.querySelectorAll('#nav-links a')];
  navIo = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${e.target.id}`));
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  links.forEach((a) => { const el = document.querySelector(a.getAttribute('href')); if (el) navIo.observe(el); });
}

// 進場動畫
let io;
function observe() {
  io?.disconnect();
  io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      e.target.classList.add('in');
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal, .screen').forEach((el) => io.observe(el));
}
let dragon = null;
try {
  dragon = createDragon(document.getElementById('dragon'), theme);
} catch (err) {
  console.warn('WebGL 無法啟動，改用純背景', err);
  document.getElementById('dragon').remove();
}

document.getElementById('lang').addEventListener('click', () => {
  lang = lang === 'zh' ? 'en' : 'zh';
  store.set('lang', lang);
  render();
});

document.getElementById('themes').addEventListener('click', (e) => {
  const key = e.target.closest('.swatch')?.dataset.theme;
  if (!key || key === theme) return;
  theme = key;
  store.set('theme', key);
  document.documentElement.dataset.theme = key;
  renderSwatches();
  dragon?.setTheme(key);
});

document.documentElement.dataset.theme = theme;
render();

// 字型載入後區塊高度可能改變，龍要依新高度重排
document.fonts?.ready.then(() => dragon?.attach([...document.querySelectorAll('[data-pose]')]));
// 樣式表、圖片都載完後再排一次（線上網路慢時，第一次排版量到的高度可能還不對）
window.addEventListener('load', () => dragon?.attach([...document.querySelectorAll('[data-pose]')]));
