// 鱗片龍（照 butane.dev 的做法）：每個區塊各有自己的一段龍，跟著頁面一起捲走，形狀不變。
//   heroWave 首頁：對稱的螺旋波浪，一直繞中軸轉（hero 是斜的單螺旋，放在姿態總覽）
//   bwave   butane 首頁那種一個一個圓拱的密波浪（分隔帶）
//   arch    彎成拱門框住標題（butane contact）
//   frame   左右各一截身體，像括號一樣框住標題
//   wave    一道平緩的波從標題下方橫過去
//   ribbon  繞一個大圈、兩頭在下方交叉的絲帶
//   ribbonArch 絲帶彎成的拱門（頁尾）
//   helix2  兩條身體互相纏繞的雙螺旋（分隔帶，捲過時橫移）
//   cross   兩條身體斜斜交叉（分隔帶，捲過時往反方向橫移）
//   roadmap 每排卡片橫過一段身體，在畫面邊緣圓圓地轉彎往下（butane roadmap，製作過程）
//   peek    從右側露出的一截身體
//   footer  橫穿頁尾標題後面的身體（butane 每頁頁尾）
// 螺旋類的身體會繞中軸轉（spin）；鱗片：一道接一道「鱗片豎起來」的波不停往尾巴跑，每片鱗片也各自輕輕顫動，
// 再加上環境光輕微擺動讓反光流動。這些都在 GPU 上算，一打開頁面就在動。
// 顏色全部來自反射：頂上白光、往下一條橘光帶、正面大片藍光、後方輪廓光。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// css：導覽列色票；cool／cool2：主光（大片）與輪廓光；warm：橘光帶；tint：鱗片本身的金屬色
export const THEMES = {
  steel: { css: ['#4f8dff', '#ff7a2a'], bg: '#020408', cool: '#2a63ff', cool2: '#4fd2ff', warm: '#ff5a12', tint: '#eef3fb' },
  ember: { css: ['#ffb547', '#ff4a1c'], bg: '#060403', cool: '#ff7a10', cool2: '#ffd37a', warm: '#ff2a10', tint: '#fff0d8' },
  jade: { css: ['#4ff0b0', '#e8c060'], bg: '#020605', cool: '#0cc884', cool2: '#7dffd6', warm: '#f0b030', tint: '#ecfff6' },
  aurora: { css: ['#2fe4ff', '#c060ff'], bg: '#040312', cool: '#6a35ff', cool2: '#2fe4ff', warm: '#ff2fae', tint: '#f3eeff' },
};

const FOV = 38;
const CAM_Z = 10;
const HALF_H = CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const VH = 2 * HALF_H; // 一個視窗高，換成世界座標的長度
const TAU = Math.PI * 2;
const TWIST = 0.35; // 鱗片排列沿身體每單位長度轉多少（弧度），讓一排排鱗片像擰過的繩子一樣螺旋

// 鱗片的動態：base 是平常翹起的角度；波每隔 spacing 一道、每秒走 speed、寬 width、多翹 lift；
// flutter 是每片鱗片各自的微顫幅度（設 0：不要一閃一閃）；jitter 是每片固定的角度誤差
const RIPPLE = { base: 0.42, speed: 2.4, spacing: 7, width: 0.85, lift: 0.5, flutter: 0, jitter: 0.15 };
// 螺旋色帶：沿身體繞的色帶，用主題的暖色。stripes 是一圈有幾條、pitch 是每單位長度多繞幾圈（弧度）
const SPIRAL = { stripes: 2, pitch: 0.45, strength: 0.75 };

// ---- 每個區塊的形狀（左右對稱）----
// fn(s, asp, hv) 回傳 [x, y, z]；x 以螢幕半寬為單位（-1 左緣、1 右緣），
// y 是「從區塊頂端往下幾個視窗高」，z 是世界座標；hv 是區塊高度（幾個視窗高）。
// r 是身體半徑（視窗高的比例）；ext 是頭尾往畫面外延伸多長；
// clip 為 true 時，超出區塊的部分會被裁掉（像 butane 的 overflow: hidden），depth 是裁切線換算用的大約深度
const sweep = (side) => ({
  r: 0.09, ext: 0.4, clip: true,
  fn(s) {
    const th = THREE.MathUtils.degToRad(70 + s * 220);
    return [side * (1.32 + 0.72 * Math.cos(th)), 0.5 - 0.33 * Math.sin(th), -0.6 + Math.sin(s * Math.PI)]; // 整段收在區塊內（連鱗片翹起來也不碰到上下緣），從側邊進出
  },
});
// 上下直立的姿勢：頭尾各接一段水平往畫面左右外面走，整條收在區塊上下緣之內，不會被切平
const sideExit = (fn, n = 40) => (asp, hv, el, t = 0) => {
  const pts = Array.from({ length: n }, (_, i) => fn(i / (n - 1), asp, hv, el, t));
  // 端點已經靠邊就往那一邊出去，不然順著前進方向出去
  const side = (p, q) => (Math.abs(p[0]) > 0.2 ? Math.sign(p[0]) : Math.sign(p[0] - q[0]) || 1);
  const a = pts[0], z = pts[n - 1];
  return [[side(a, pts[1]) * 1.6, a[1], a[2]], ...pts, [side(z, pts[n - 2]) * 1.6, z[1], z[2]]];
};
// 蛇行：一排一排橫過畫面，排與排之間在 x = ±c 處用正圓轉彎往下；第一排從左邊畫面外進來、最後一排從畫面外出去。
// 前後深度：橫的那段中間往前鼓、轉彎處往後退，接頭處都是平的（斜率 0），才不會有折痕
function snake(rows, top, rowH, asp, c) {
  const R = (rowH / 2) * (2 / Math.max(asp, 0.6)); // 轉彎半徑（螢幕半寬），正圓
  const pts = [];
  let dir = 1; // 1：往右走
  for (let k = 0; k < rows; k++) {
    const y = top + (k + 0.5) * rowH;
    const from = k === 0 ? -1.5 : -dir * c, to = k === rows - 1 ? dir * 1.5 : dir * c;
    const n = Math.round(Math.abs(to - from) * 8); // c = 0 時中間的排長度是 0，直接接下一個彎（重複的點會讓曲線打結）
    for (let i = k === 0 ? 0 : 1; i <= n; i++) {
      const u = i / n;
      pts.push([from + (to - from) * u, y, 0.35 * Math.sin(u * Math.PI) ** 2]);
    }
    if (k === rows - 1) break;
    for (let i = 1; i < 16; i++) { // 轉彎往下一排
      const th = -Math.PI / 2 + (i / 16) * Math.PI;
      pts.push([dir * (c + R * Math.cos(th)), y + rowH / 2 + (rowH / 2) * Math.sin(th), -0.5 * Math.cos(th) ** 2]);
    }
    dir = -dir;
  }
  return pts;
}

const PIECES = {
  // 首屏：單螺旋從左上斜斜穿到右下（跟下面左下→右上的雙螺旋分隔帶方向相反），標題的玻璃卡片疊在上面
  hero: [{
    r: 0.07, ext: 0.4, points: 40, spin: true,
    fn(s, asp, hv, el, t = 0) {
      const phi = (s - 0.5) * TAU * 1.6 + t * 0.9;
      return [1.3 * (2 * s - 1), 0.22 + 0.68 * s + 0.13 * Math.sin(phi), 0.9 * Math.cos(phi)];
    },
  }],
  // （備用）首屏的對稱密波浪：把 app.js 裡首頁的 pose 改成 'heroWave' 就換回來。butane 首頁那種一個一個圓拱的密波浪，橫過畫面下半部；標題的玻璃卡片在上方，下緣輕輕壓在龍身上
  // spin：整條像螺絲一樣繞著自己的中軸一直轉（每一格重排鱗片，背脊永遠朝後，不會露出接縫）；parallax：跟著游標微微轉向
  heroWave: [{
    r: 0.07, ext: 0.4, points: 48, spin: true, parallax: true,
    fn(s, asp, hv, el, t = 0) {
      const phi = (s - 0.5) * TAU * (asp < 1 ? 2 : 3) + t * 0.9;
      const bob = 0.025 * Math.sin(t * 0.7); // 整條上下緩緩浮動
      return [1.3 * (2 * s - 1) + 0.05 * Math.sin(phi), 0.72 + bob + 0.15 * Math.cos(phi), 0.95 * Math.sin(phi)];
    },
  }],
  // butane 首頁那種密波浪：一個一個圓拱（上面寬、下面窄），全寬橫在分隔帶中間，捲過時緩緩橫移
  bwave: [{
    r: 0.06, ext: 0.4, clip: true, drift: 0.35, points: 48, spin: true,
    fn(s, asp, hv, el, t = 0) {
      const phi = (s - 0.5) * TAU * (asp < 1 ? 2 : 3) + t * 0.8;
      return [1.3 * (2 * s - 1) + 0.05 * Math.cos(phi), hv / 2 + 0.15 * Math.sin(phi), 0.7 * Math.cos(phi)];
    },
  }],
  // butane contact：拱門框住標題，像 Ω：兩腳落到下方後往左右彎出畫面，不碰到區塊下緣，不會被切平
  arch: [{
    r: 0.085, ext: 0.3, clip: true, depth: -0.2,
    path() {
      const top = Array.from({ length: 17 }, (_, i) => {
        const a = Math.PI - (i / 16) * Math.PI;
        return [0.95 * Math.cos(a), 0.56 - 0.46 * Math.sin(a), 0.5 * Math.sin(a) - 0.3];
      });
      const foot = [[-1.6, 0.84, -0.6], [-1.2, 0.82, -0.55], [-1.0, 0.72, -0.45]];
      return [...foot, ...top, ...foot.slice().reverse().map(([x, y, z]) => [-x, y, z])];
    },
  }],
  frame: [sweep(-1), sweep(1)],
  wave: [{
    r: 0.075, ext: 0.4, clip: true, spin: true,
    fn(s, asp, hv, el, t = 0) {
      const phi = (s - 0.5) * TAU * 1.5 + t * 0.7;
      return [1.3 * (2 * s - 1), 0.8 + 0.08 * Math.cos(phi), -0.4 + 0.5 * Math.cos(phi)];
    },
  }],
  // 絲帶拱門：拱門的形狀，兩腳在下方一前一後交錯著出去（放在頁尾）
  ribbonArch: [{
    r: 0.075, ext: 0.45, clip: true,
    fn(s, asp) {
      const a = THREE.MathUtils.degToRad(-30 + s * 240), R = 0.42;
      return [(R * 2 * Math.cos(a)) / asp * 1.25, 0.66 - R * Math.sin(a) * 1.15, 0.8 - 1.6 * s]; // 拱門頂在畫面上方約兩成，字放在拱門正中
    },
  }],
  // 絲帶：身體從左下進來，繞一個大圈，從右下出去，兩頭在下方交叉（一前一後）
  ribbon: [{
    r: 0.075, ext: 0.45, clip: true,
    fn(s, asp) {
      const a = THREE.MathUtils.degToRad(-60 + s * 300), R = 0.3;
      return [(R * 2 * Math.cos(a)) / asp, 0.47 - R * Math.sin(a), 0.8 - 1.6 * s];
    },
  }],
  // 雙螺旋：兩條身體互相纏繞著橫過畫面，像 DNA
  // 雙螺旋（分隔帶）：從左下斜斜往右上穿過這一條帶子，捲過時整條緩緩往一邊滑（drift）
  helix2: [0, Math.PI].map((ph) => ({
    r: 0.06, ext: 0.4, clip: true, drift: 0.35, points: 40, spin: true,
    fn(s, asp, hv, el, t = 0) {
      const phi = (s - 0.5) * TAU * 1.6 + ph + t * 0.9;
      return [1.3 * (2 * s - 1), hv * (0.74 - 0.48 * s) + 0.15 * Math.sin(phi), 0.9 * Math.cos(phi)]; // 從左下斜到右上
    },
  })),
  // 交叉：兩條身體從上方兩角斜斜交叉而過，一前一後
  // 交叉（分隔帶）：兩條身體從畫面左右外側斜斜交叉而過，整個 X 收在帶子裡；捲過時往另一邊滑
  cross: [-1, 1].map((side) => ({
    r: 0.065, ext: 0.4, clip: true, drift: -0.35, spin: true,
    fn(s, asp, hv, el, t = 0) {
      return [side * (1.4 - 2.8 * s), hv * (0.12 + 0.76 * s) + 0.03 * Math.sin(s * TAU), side * 0.6 * Math.sin(s * Math.PI) + 0.35 * Math.sin(t * 0.8 + side) * Math.sin(s * Math.PI)]; // 兩條在深度上一前一後慢慢擺
    },
  })),
  // butane roadmap：每一排卡片的高度有一段身體橫過去，排跟排之間在畫面邊緣圓圓地轉彎往下；
  // 從第一排的畫面外進來、最後一排從畫面外出去，第一張卡片上面、最後一張下面都沒有身體。
  // 卡片的位置從網頁上量：.roadmap 清單的頂端、每一排的高度
  roadmap: [{
    r: 0.07, ext: 0.3, clip: true,
    path(asp, hv, el) {
      const list = el.querySelector('.roadmap'), vh = window.innerHeight;
      const rows = list ? list.children.length : 4;
      const top = list ? list.offsetTop / vh : 0.4;
      const rowH = list && list.children[0] ? list.children[0].offsetHeight / vh : 0.42;
      const R = (rowH / 2) * (2 / Math.max(asp, 0.6));
      return snake(rows, top, rowH, asp, Math.max(0.3, 1 - 0.6 * R)); // 轉彎圓心靠畫面邊緣：外側一部分伸出畫面
    },
  }],
  // ---- 以下是給姿勢總覽看的其他擺法 ----
  // 橫的單螺旋，置中
  helix1: [{
    r: 0.065, ext: 0.4, clip: true, points: 40, spin: true,
    fn(s, asp, hv, el, t = 0) {
      const phi = (s - 0.5) * TAU * 1.6 + t * 0.9;
      return [1.3 * (2 * s - 1), 0.5 + 0.15 * Math.sin(phi), 0.9 * Math.cos(phi)];
    },
  }],
  // 很密的螺旋波浪（一開始首頁那種 W），置中
  denseW: [{
    r: 0.06, ext: 0.5, clip: true, points: 48, spin: true,
    fn(s, asp, hv, el, t = 0) {
      const phi = s * TAU * (asp < 1 ? 2 : 3.2) + 1.6 + t * 0.8;
      return [1.3 * (2 * s - 1) + 0.06 * Math.cos(phi), 0.5 + 0.2 * Math.sin(phi), 0.9 * Math.cos(phi)];
    },
  }],
  // 無限符號 ∞，頭尾相接，交叉處一前一後
  infinity: [{
    r: 0.065, closed: true, clip: true,
    path(asp) {
      const w = Math.min(0.62, 0.78 / Math.max(asp, 0.6)) * 1.1;
      return Array.from({ length: 64 }, (_, i) => { const t = (i / 64) * TAU; return [w * Math.cos(t), 0.5 + 0.2 * Math.sin(2 * t), 1.1 * Math.sin(t)]; });
    },
  }],
  // 圓環：頭尾相接的一圈，稍微往後傾，看得出立體
  ring: [{
    r: 0.065, closed: true, clip: true,
    path(asp) {
      const R = 0.3;
      return Array.from({ length: 48 }, (_, i) => { const t = (i / 48) * TAU; return [(R * 2 * Math.cos(t)) / asp, 0.5 + R * 0.75 * Math.sin(t), 1.4 * Math.sin(t)]; });
    },
  }],
  // 直立的彈簧：一圈一圈往下繞，上下都出畫面
  spring: [{
    r: 0.06, ext: 0.3, clip: true, // 不旋轉：頭尾往哪一邊出去會跟著翻，看起來會跳
    path: sideExit((s, asp, hv, el, t = 0) => {
      const a = s * TAU * 3 + Math.PI / 2; // 頭尾剛好在正中間、橫著走的位置，接到畫面外不會急轉
      return [(0.32 * Math.cos(a)) / Math.max(asp, 0.8) * 1.6, 0.16 + 0.68 * s, 1.2 * Math.sin(a)];
    }),
  }],
  // 大 S：從上方中間往下畫一個大 S
  peek: [sweep(1)],
  footer: [{
    r: 0.06, ext: 0.5,
    fn(s) {
      return [1.3 * (2 * s - 1), 0.62 + 0.04 * Math.cos((s - 0.5) * TAU), -0.6 + 0.4 * Math.cos((s - 0.5) * Math.PI)];
    },
  }],
};

// 攝影棚環境：依方向算顏色的天空球，用來產生反射貼圖
const envMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    cool: { value: new THREE.Color() },
    cool2: { value: new THREE.Color() },
    warm: { value: new THREE.Color() },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform vec3 cool, cool2, warm;
    varying vec3 vDir;
    float lobe(vec3 d, vec3 axis, float a, float b) { return smoothstep(a, b, dot(d, normalize(axis))); }
    void main() {
      vec3 d = normalize(vDir);
      vec3 c = vec3(0.003);
      c += cool * 1.6 * pow(max(dot(d, normalize(vec3(-0.35, 0.5, 0.8))), 0.0), 3.0);  // 大片主光
      c += cool * 0.35 * lobe(d, vec3(0.2, 0.9, -0.3), 0.4, 0.95);                      // 頂部漫光
      c += cool2 * 1.8 * lobe(d, vec3(-0.85, 0.15, -0.5), 0.45, 0.95);                 // 後方輪廓光（寬而柔，直立的身體才不會閃）
      c += warm * 5.5 * lobe(d, vec3(0.45, -0.75, 0.45), 0.35, 0.9);                   // 下側暖光
      c += warm * 0.9 * lobe(d, vec3(0.9, 0.0, -0.2), 0.55, 0.95);                    // 右側暖光（寬而柔）
      c += vec3(4.5) * smoothstep(0.12, 0.0, abs(d.y - 0.6)) * smoothstep(-0.1, 0.5, d.z); // 頂上一條白光（寬而柔，不會縮成一個個閃的小亮點）
      c += vec3(1.2) * lobe(d, vec3(-0.1, 0.75, 0.65), 0.6, 0.97);                    // 前上方白色漫光
      gl_FragColor = vec4(c, 1.0);
    }`,
});

function makeEnv(renderer, theme) {
  envMaterial.uniforms.cool.value.set(theme.cool);
  envMaterial.uniforms.cool2.value.set(theme.cool2);
  envMaterial.uniforms.warm.value.set(theme.warm);
  const scene = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), envMaterial);
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0);
  pmrem.dispose();
  sky.geometry.dispose();
  return rt;
}

// 鱗片：屋瓦形，前端平直（藏在上一片底下），後端是半圓弧，中間拱起。
// 平躺在 XZ 平面、面朝 +Y；圓弧朝 +X，長 1.3、寬 1.2
function scaleGeometry(nu, nv) {
  const pos = [], col = [], idx = [];
  const halfWidth = (u) => (u < 0.45 ? 0.6 : 0.6 * Math.sqrt(Math.max(0, 1 - ((u - 0.45) / 0.55) ** 2)));
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    for (let j = 0; j <= nv; j++) {
      const v = (j / nv) * 2 - 1;
      pos.push(u * 1.3, 0.14 * (1 - v * v) * Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5), v * halfWidth(u));
      const k = 0.3 + 0.7 * THREE.MathUtils.smoothstep(u, 0.05, 0.75); // 根部壓在上一片底下，比較暗
      col.push(k, k, k);
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + nv + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.translate(-0.4, 0, 0); // 樞紐往裡挪：鱗片往背脊那側多長一截，兩側鱗片在背脊上互相蓋住，不會留縫
  return g;
}

// 鱗片的動態寫在頂點著色器裡：每片鱗片的頂點繞自己的前緣再多翹 liftA，
// liftA = 經過的波 + 自己的微顫 + 固定的角度誤差 + 游標撥動 + 捲動加速。CPU 只在建立時寫一次矩陣，之後每一格只更新這些 uniform。
//   uFlow   波走到哪裡（捲得越快走得越快）
//   uMouse  游標在世界座標的位置；uMouseE 游標剛動過的能量（停下來就慢慢消失）
//   uBoost  捲動速度（0～1），捲得快鱗片整片翹高
//   uSpan   揭幕的波要掃多寬（螢幕半寬）；uRevT（每段各自）這段開始揭幕後過了幾秒
// 片段著色器：還沒揭幕的鱗片是暗的；一道高光（vSweep）定期從頭掃到尾
const uTime = { value: 0 }, uFlow = { value: 0 }, uMouse = { value: new THREE.Vector3(0, 0, 0) };
const uMouseE = { value: 0 }, uBoost = { value: 0 }, uSpan = { value: 5 };
const REVEAL = 1.4; // 揭幕的波從畫面中間掃到兩邊要幾秒
const f = (v) => v.toFixed(4);
function addMotion(mat, uRevT) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime, uFlow, uMouse, uMouseE, uBoost, uSpan, uRevT });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uFlow, uMouseE, uBoost, uSpan, uRevT;
        uniform vec3 uMouse;
        attribute float aArc;
        attribute float aPhase;
        varying float vRev, vSweep;
        float scaleLift() {
          float d = mod(aArc - uFlow * ${f(RIPPLE.speed)}, ${f(RIPPLE.spacing)}) - ${f(RIPPLE.spacing / 2)};
          return ${f(RIPPLE.lift)} * exp(-(d * d) / ${f(RIPPLE.width * RIPPLE.width)})
               + ${f(RIPPLE.flutter)} * sin(uTime * 1.7 + aPhase * 6.2831)
               + (aPhase - 0.5) * ${f(RIPPLE.jitter)};
        }
        vec3 liftRotate(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z); }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vec4 ip = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); // 這片鱗片在世界座標的位置
        // 揭幕：一道波從畫面中線往左右掃開，掃過的鱗片從平貼翻起來
        float front = uRevT / ${f(REVEAL)} * uSpan;
        vRev = smoothstep(0.0, 1.2, front - abs(ip.x) + aPhase * 0.3);
        // 游標：附近的鱗片翹起來，再往外一圈圈漣漪
        float md = length(ip.xy - uMouse.xy);
        float hover = uMouseE * (0.85 * exp(-md * md / 1.3) + 0.3 * sin(md * 3.5 - uTime * 9.0) * exp(-md * 0.8));
        float liftA = scaleLift() + hover + uBoost * 0.4;
        liftA = mix(-${f(RIPPLE.base)}, liftA, vRev); // 還沒揭幕：整片貼平
        // 高光：每隔幾秒一道從頭掃到尾
        float sp = mod(uTime * 7.0, 80.0) - 8.0;
        vSweep = exp(-(aArc - sp) * (aArc - sp) / 1.2);
        objectNormal = liftRotate(objectNormal, liftA);`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed = liftRotate(transformed, liftA);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n        varying float vRev, vSweep;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= mix(0.1, 1.0, vRev);')
      .replace('#include <opaque_fragment>', '  outgoingLight *= 1.0 + vSweep * 1.3 * vRev;\n#include <opaque_fragment>');
  };
  return mat;
}

export function createDragon(canvas, themeKey) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('no webgl');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 解析度高一點，小鱗片的高光比較不會鋸齒閃爍
  renderer.toneMapping = THREE.NeutralToneMapping; // ACES 會把藍色推成紫色

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  let theme = THEMES[themeKey];
  let envRT = makeEnv(renderer, theme);
  scene.environment = envRT.texture;
  const bg = new THREE.Color(theme.bg), targetBg = new THREE.Color(theme.bg);
  // 背景：很深的藍黑漸層，畫面中下方帶一圈淡淡的主色光暈（龍像浮在光裡），四周更暗
  function makeBackground(th) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const g = cv.getContext('2d');
    const base = new THREE.Color(th.bg), glow = base.clone().lerp(new THREE.Color(th.cool), 0.05), mid = base.clone().lerp(new THREE.Color(th.cool), 0.02);
    g.fillStyle = '#' + base.getHexString();
    g.fillRect(0, 0, 512, 512);
    let grd = g.createRadialGradient(256, 300, 0, 256, 300, 330);
    grd.addColorStop(0, '#' + glow.getHexString());
    grd.addColorStop(0.5, '#' + mid.getHexString());
    grd.addColorStop(1, '#' + base.getHexString());
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const tint = new THREE.Color(theme.tint), targetTint = new THREE.Color(theme.tint);
  scene.background = makeBackground(theme);
  scene.fog = new THREE.Fog(bg, 9.5, 19);

  const mobile = Math.min(window.innerWidth, window.innerHeight) < 600;
  const PER = mobile ? 16 : 22; // 身體每圈鱗片數
  const MAX_R = mobile ? 400 : 720; // 一段身體最多幾圈鱗片；長的姿勢（彈簧、roadmap）不夠會尾巴沒鋪到
  const scaleGeo = scaleGeometry(mobile ? 8 : 10, mobile ? 4 : 6);
  const coreGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
  renderer.localClippingEnabled = true;

  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mobile ? 2 : 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.1, 0.3, 0.95));
  composer.addPass(new OutputPass());

  let aspect = 1, halfW = HALF_H;
  let pieces = [];
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    aspect = w / h;
    halfW = HALF_H * aspect;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    pieces.forEach((p) => p.build());
  }

  // 寫一片鱗片的矩陣：基底 T（鱗片圓弧指的方向）／n（朝外）／T×n，繞前緣翹起 tilt，再等比縮放
  const M = new THREE.Matrix4(), e = M.elements, Zv = new THREE.Vector3();
  function setScale(mesh, idx, px, py, pz, T, n, tilt, size) {
    Zv.crossVectors(T, n);
    const c = Math.cos(tilt) * size, s = Math.sin(tilt) * size;
    e[0] = T.x * c + n.x * s; e[1] = T.y * c + n.y * s; e[2] = T.z * c + n.z * s; e[3] = 0;
    e[4] = n.x * c - T.x * s; e[5] = n.y * c - T.y * s; e[6] = n.z * c - T.z * s; e[7] = 0;
    e[8] = Zv.x * size; e[9] = Zv.y * size; e[10] = Zv.z * size; e[11] = 0;
    e[12] = px; e[13] = py; e[14] = pz; e[15] = 1;
    mesh.setMatrixAt(idx, M);
  }

  // ---- 一段身體 ----
  function makePiece(def, el) {
    const group = new THREE.Group();
    const planes = def.clip ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)] : [];
    const rev = { value: 0 }; // 這段開始揭幕後過了幾秒（第一次捲進畫面時開始算）
    const scaleMat = addMotion(new THREE.MeshStandardMaterial({
      color: 0xffffff, metalness: 1, roughness: 0.22, envMapIntensity: 0.95, vertexColors: true, // 粗糙度高一點：高光不會縮成一個個閃爍的小亮點
      side: THREE.DoubleSide, clippingPlanes: planes,
    }), rev);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000, clippingPlanes: planes });

    // 每段各自一份鱗片幾何，掛上每片在身體上的位置（aArc，波用）和相位（aPhase，微顫與角度誤差用）。
    // 能放幾圈鱗片依身體長度決定：螢幕變寬、身體變長時重新配置，尾巴才不會鋪不到
    let geo, arcAttr, coins, core, shade, band, cap = 0, count = 0;
    function alloc(n) {
      if (coins) { group.remove(coins, core); geo.dispose(); coins.dispose(); core.dispose(); }
      cap = n;
      geo = scaleGeo.clone();
      arcAttr = new THREE.InstancedBufferAttribute(new Float32Array(cap * PER), 1);
      geo.setAttribute('aArc', arcAttr);
      geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(Float32Array.from({ length: cap * PER }, Math.random), 1));
      coins = new THREE.InstancedMesh(geo, scaleMat, cap * PER);
      coins.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * PER * 3), 3);
      core = new THREE.InstancedMesh(coreGeo, coreMat, cap);
      for (const im of [coins, core]) { im.frustumCulled = false; group.add(im); }
      shade = Float32Array.from({ length: cap * PER }, () => 0.55 + 0.45 * Math.pow(Math.random(), 0.6));
      band = new Float32Array(cap * PER); // 每片在螺旋色帶上的位置（0：本色，1：暖色）
    }

    let lastCount = -1;
    function build(t = 0, quick = false) {
      const hv = el.offsetHeight / window.innerHeight;
      const raw = def.path ? def.path(aspect, hv, el, t)
        : Array.from({ length: def.points || 28 }, (_, i) => def.fn(i / ((def.points || 28) - 1), aspect, hv, el, t));
      const pts = raw.map(([x, y, z]) => new THREE.Vector3(x * halfW, -y * VH, z));
      const n = pts.length;
      let curve;
      if (def.closed) {
        curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal'); // 頭尾相接的環，沒有斷口
      } else {
        // 頭尾沿著身體方向延伸到畫面外，看不到斷口
        const ext = def.ext * VH;
        const head = pts[0].clone().add(pts[0].clone().sub(pts[1]).normalize().multiplyScalar(ext));
        const tail = pts[n - 1].clone().add(pts[n - 1].clone().sub(pts[n - 2]).normalize().multiplyScalar(ext));
        curve = new THREE.CatmullRomCurve3([head, ...pts, tail], false, 'centripetal');
      }
      curve.arcLengthDivisions = 800;
      const L = curve.getLength();
      const r = def.r * VH * (aspect < 0.8 ? 0.75 : 1);
      let gap = ((TAU * r) / PER) * 0.7;
      const size = ((TAU * r) / PER) * 0.95;
      let rings = Math.min(MAX_R * 3, Math.floor(L / gap));
      // 頭尾相接的形狀：圈數取偶數、剛好鋪滿一圈，鱗片的螺旋、色帶、波都調成繞一圈剛好接回起點，接口才不會有一圈痕
      let tw = TWIST, pitch = SPIRAL.pitch, arcK = 1;
      if (def.closed) {
        rings = Math.max(2, Math.round(L / gap));
        if (rings % 2) rings++;
        gap = L / rings;
        const step = TAU / PER, k = Math.round((L * TWIST) / step);
        tw = (k * step) / L;
        const m2 = Math.round((L * SPIRAL.pitch + SPIRAL.stripes * k * step) / TAU);
        pitch = (m2 * TAU - SPIRAL.stripes * k * step) / L;
        arcK = (Math.max(1, Math.round(L / RIPPLE.spacing)) * RIPPLE.spacing) / L;
      }
      if (rings > cap) alloc(Math.ceil(rings * 1.15));
      const P = new THREE.Vector3(), T = new THREE.Vector3(), Nr = new THREE.Vector3(), B = new THREE.Vector3(), rad = new THREE.Vector3();
      const back = new THREE.Vector3(), flank = new THREE.Vector3(), dir = new THREE.Vector3();
      const prevT = new THREE.Vector3(), K = new THREE.Vector3(); // K：彎曲的方向和程度（指向彎的內側）
      const cand = new THREE.Vector3();
      const sc = new THREE.Matrix4(), m = new THREE.Matrix4();
      curve.getTangentAt(0, T);
      // 第一圈前面那一點的切線（封閉的形狀要繞回終點），第一圈的彎曲才算得對
      curve.getTangentAt(def.closed ? 1 - (0.5 * gap) / L : 0, prevT);
      Nr.set(0, 0, 1).cross(T).normalize();
      if (Nr.lengthSq() < 0.5) Nr.set(0, 1, 0);
      for (let i = 0; i < rings; i++) {
        const arc = (i + 0.5) * gap;
        curve.getPointAt(arc / L, P);
        curve.getTangentAt(arc / L, T);
        K.subVectors(T, prevT).divideScalar(gap);
        prevT.copy(T);
        Nr.addScaledVector(T, -Nr.dot(T)).normalize();
        B.crossVectors(T, Nr);
        m.makeBasis(B, T, Nr);
        sc.makeScale(r * 0.82, gap * 2.2, r * 0.82);
        core.setMatrixAt(i, m.multiply(sc).setPosition(P));
        // 背脊盡量朝背面（遠離鏡頭）：兩側鱗片分開的那條線藏在後面，轉彎處不會炸開。
        // 但身體正對鏡頭走的地方「朝後」幾乎跟身體同方向，會突然翻轉出一圈痕；那裡改成順著前一圈的方向接過去
        cand.set(0, 0, -1).addScaledVector(T, T.z);
        const cl = cand.length();
        if (i === 0) back.copy(cl > 1e-4 ? cand.divideScalar(cl) : Nr);
        else {
          back.addScaledVector(T, -back.dot(T)).normalize();
          if (cl > 1e-4) back.lerp(cand.divideScalar(cl), THREE.MathUtils.smoothstep(cl, 0.25, 0.7)).addScaledVector(T, -back.dot(T)).normalize();
        }
        flank.crossVectors(T, back);
        for (let j = 0; j < PER; j++) {
          const ang = ((j + (i % 2) * 0.5) / PER) * TAU + arc * tw; // 從背脊量起的角度，加上螺旋
          const ca = Math.cos(ang), sa = Math.sin(ang);
          rad.copy(back).multiplyScalar(ca).addScaledVector(flank, sa);
          // 鱗片照 butane：從背脊往兩側、往腹部一片壓一片（像屋瓦從屋脊往下排）
          const sgn = sa >= 0 ? 1 : -1;
          dir.copy(back).multiplyScalar(-sa * sgn).addScaledVector(flank, ca * sgn);
          // 兩側的鱗片在背脊和腹部那條線上方向相反，會擠成一條折痕；越靠近那條線，鱗片越轉向順著身體，左右就平順地接起來
          const toLine = 1 - THREE.MathUtils.smoothstep(Math.abs(sa), 0.03, 0.3);
          if (toLine > 0) dir.lerp(T, toLine).normalize();
          const idx = i * PER + j;
          // 轉彎時內側的表面比較短、外側比較長：鱗片跟著縮放，內側才不會擠成一條折痕、外側不會裂開
          const bend = THREE.MathUtils.clamp(1 - r * K.dot(rad), 0.35, 1.6);
          setScale(coins, idx, P.x + rad.x * r * 0.93, P.y + rad.y * r * 0.93, P.z + rad.z * r * 0.93, dir, rad, RIPPLE.base, size * bend);
          arcAttr.array[idx] = arc * arcK;
          const w = Math.sin(SPIRAL.stripes * ang + arc * pitch);
          band[idx] = THREE.MathUtils.smoothstep(w, 0.15, 0.65);
        }
      }
      count = rings * PER;
      core.count = rings;
      coins.count = count;
      core.instanceMatrix.needsUpdate = true;
      coins.instanceMatrix.needsUpdate = true;
      arcAttr.needsUpdate = true;
      if (!quick || count !== lastCount) recolor(); // 旋轉時每格重排，顏色只在鱗片數變了才重算
      lastCount = count;
    }

    const warmTint = new THREE.Color(), c = new THREE.Color();
    function recolor() {
      warmTint.set(theme.warm).lerp(tint, 0.25);
      for (let i = 0; i < count; i++) {
        c.copy(tint).lerp(warmTint, band[i] * SPIRAL.strength).multiplyScalar(shade[i]);
        coins.instanceColor.setXYZ(i, c.r, c.g, c.b);
      }
      coins.instanceColor.needsUpdate = true;
    }

    return {
      group, planes, build, recolor, rev, revealAt: null, parallax: def.parallax,
      update: def.spin ? (t) => build(t, true) : null,
      depthK: (CAM_Z - (def.depth || 0)) / CAM_Z, // 裁切線依物件深度換算，才會剛好對齊區塊邊界
      drift: def.drift || 0, // 捲過時整條橫移的量（區塊從畫面中間每移動一個視窗高，橫移幾個螢幕半寬）
      dispose() { geo.dispose(); coins.dispose(); core.dispose(); scaleMat.dispose(); coreMat.dispose(); },
    };
  }

  // 依區塊建立各自的一段龍。els 是帶 data-pose 的區塊元素，pose 沒有對應形狀的區塊不放龍
  function attach(els) {
    pieces.forEach((p) => { scene.remove(p.group); p.dispose(); });
    pieces = [];
    for (const el of els) {
      for (const def of PIECES[el.dataset.pose] || []) {
        const p = makePiece(def, el);
        p.el = el;
        scene.add(p.group);
        pieces.push(p);
        p.build();
      }
    }
  }

  resize();
  window.addEventListener('resize', resize);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 游標（手機是手指）：記下在畫面上的位置，移動越多能量越高
  const mouse = new THREE.Vector2(0, 0), mouseT = new THREE.Vector2(0, 0);
  let lastPX = null, lastPY = null;
  window.addEventListener('pointermove', (e) => {
    mouseT.set((e.clientX / window.innerWidth) * 2 - 1, 1 - (e.clientY / window.innerHeight) * 2);
    if (lastPX != null) uMouseE.value = Math.min(1, uMouseE.value + Math.hypot(e.clientX - lastPX, e.clientY - lastPY) / 120);
    lastPX = e.clientX; lastPY = e.clientY;
  }, { passive: true });
  let lastScroll = window.scrollY;
  const clock = new THREE.Clock();
  let time = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt * (reduced ? 0.15 : 1);
    uTime.value = time;
    // 捲動越快：波跑得越快、鱗片翹越高；停下來慢慢回復
    const sv = Math.abs(window.scrollY - lastScroll) / Math.max(dt, 1e-3) / window.innerHeight;
    lastScroll = window.scrollY;
    const bt = reduced ? 0 : Math.min(1, sv / 2.5);
    uBoost.value += (bt - uBoost.value) * (1 - Math.exp(-dt * (bt > uBoost.value ? 8 : 1.5)));
    uFlow.value += dt * (reduced ? 0.15 : 1 + uBoost.value * 2.5);
    mouse.lerp(mouseT, 1 - Math.exp(-dt * 10));
    uMouse.value.set(mouse.x * halfW, mouse.y * HALF_H, 0);
    uMouseE.value *= Math.exp(-dt * 1.2);
    if (reduced) uMouseE.value = 0;
    uSpan.value = halfW + 1;

    const ck = 1 - Math.exp(-dt * 3);
    bg.lerp(targetBg, ck);
    scene.fog.color.copy(bg);
    if (!tint.equals(targetTint)) {
      tint.lerp(targetTint, ck);
      if (Math.abs(tint.r - targetTint.r) + Math.abs(tint.g - targetTint.g) + Math.abs(tint.b - targetTint.b) < 0.002) tint.copy(targetTint);
      pieces.forEach((p) => p.recolor());
    }
    scene.environmentRotation.y = Math.sin(time * 0.11) * 0.35; // 環境光慢慢擺，反光在鱗片上緩緩流動

    // 每段龍跟著自己的區塊捲動；不在畫面附近的不畫
    const vh = window.innerHeight;
    for (const p of pieces) {
      const rect = p.el.getBoundingClientRect();
      const visible = rect.top < vh * 1.4 && rect.bottom > -vh * 0.4;
      p.group.visible = visible;
      if (!visible) continue;
      // 第一次真正捲進畫面時開始揭幕
      if (p.revealAt == null && rect.top < vh * 0.8 && rect.bottom > vh * 0.2) p.revealAt = time;
      p.rev.value = reduced ? 99 : p.revealAt == null ? 0 : time - p.revealAt;
      const top = HALF_H - (rect.top / vh) * VH;
      p.group.position.y = top;
      p.update?.(time);
      // 跟著游標微微轉向，看得出立體
      if (p.parallax) { p.group.rotation.y = mouse.x * 0.14; p.group.rotation.x = -mouse.y * 0.06; }
      // 分隔帶：區塊經過畫面中間時，整條龍跟著緩緩橫移（形狀不變）
      if (p.drift) p.group.position.x = p.drift * (((rect.top + rect.bottom) / 2 - vh / 2) / vh) * halfW;
      if (p.planes.length) {
        const bottom = HALF_H - (rect.bottom / vh) * VH;
        p.planes[0].constant = top * p.depthK;     // 只留 y <= 區塊頂
        p.planes[1].constant = -bottom * p.depthK; // 只留 y >= 區塊底
      }
    }

    composer.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    attach,
    setTheme(key) {
      theme = THEMES[key];
      targetBg.set(theme.bg);
      scene.background.dispose();
      scene.background = makeBackground(theme);
      targetTint.set(theme.tint);
      const old = envRT;
      envRT = makeEnv(renderer, theme);
      scene.environment = envRT.texture;
      old.dispose();
      pieces.forEach((p) => p.recolor()); // 螺旋色帶跟著換成新主題的暖色
    },
  };
}
