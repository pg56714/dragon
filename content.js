// 網站的所有文字都在這裡。每個欄位有 zh／en 兩種語言，直接改字即可。
// 這是一個介紹這條 3D 龍的展示頁：鱗片、光、製作過程、姿態。

export const content = {
  meta: {
    title: { zh: '即時 3D 鱗片', en: 'Real-time 3D scales' },
  },

  hero: {
    name: { zh: '龍 Dragon', en: 'Dragon' },
    eyebrow: { zh: '', en: '' },
    title: { zh: '龍', en: 'Dragon' },
    sub: { zh: '在瀏覽器裡即時算出來的 3D 鱗片', en: 'Real-time 3D scales, rendered in your browser' },
    ctaPrimary: { zh: '往下看', en: 'Scroll' },
    ctaSecondary: { zh: '看所有姿態', en: 'See every form' },
  },

  // 一屏一個物件。title 有字的會出現在導覽列；title 留空的是分隔帶（只有龍）
  //   frame：龍在兩側　arch：拱門框住字　roadmap：龍蛇行往下、卡片左右交錯　helix2／cross：分隔帶
  screens: [
    {
      pose: 'frame', num: '01',
      title: { zh: '鱗片', en: 'Scales' },
      sub: { zh: '數千片屋瓦形鱗片，從背脊往兩側一片壓一片。', en: 'Thousands of tile-shaped scales, layered from the spine down each side.' },
    },
    { pose: 'helix2', num: '', title: { zh: '', en: '' }, sub: { zh: '', en: '' } },
    {
      pose: 'arch', num: '02',
      title: { zh: '光', en: 'Light' },
      sub: { zh: '沒有一片鱗片是塗上顏色的，所有顏色都來自反射。', en: 'No scale is painted. Every colour you see is a reflection.' },
    },
    {
      pose: 'roadmap', num: '03',
      title: { zh: '製作過程', en: 'How it is made' },
      sub: { zh: '', en: '' },
      items: [
        {
          when: '01', title: { zh: '一條曲線', en: 'A single curve' },
          desc: { zh: '先畫出龍身的走向：一條平滑的 3D 曲線，決定每一段怎麼彎。', en: 'It starts as one smooth 3D curve that decides how the body bends.' },
        },
        {
          when: '02', title: { zh: '鋪上鱗片', en: 'Laying the scales' },
          desc: { zh: '沿著曲線一圈一圈鋪上鱗片，從背脊往兩側疊，排成螺旋。', en: 'Scales are laid ring by ring along the curve, overlapping from the spine and twisting into a spiral.' },
        },
        {
          when: '03', title: { zh: '打光', en: 'Lighting' },
          desc: { zh: '一個看不見的攝影棚：頂上白光、側面暖光、正面藍光，鱗片像鏡子一樣反射。', en: 'An invisible studio: white light above, warm light at the side, blue in front — every scale mirrors it.' },
        },
        {
          when: '04', title: { zh: '讓它動起來', en: 'Bringing it to life' },
          desc: { zh: '每片鱗片在顯示卡上各自翹起，一道一道的波沿著身體往尾巴跑。', en: 'Each scale lifts on the GPU, sending wave after wave down the body.' },
        },
      ],
    },
    { pose: 'cross', num: '', title: { zh: '', en: '' }, sub: { zh: '', en: '' } },
  ],

  // 04 姿態：標題那屏龍盤成圓環；接著同一條龍能擺出的各種姿勢，一屏一個，排在結尾前面
  forms: {
    num: '04',
    title: { zh: '姿態', en: 'Forms' },
    sub: { zh: '同樣的鱗片，可以擺成任何形狀。', en: 'The same scales, in any shape.' },
    items: [
      { pose: 'heroWave', name: { zh: '對稱波浪', en: 'Symmetric wave' } },
      { pose: 'hero', name: { zh: '斜的單螺旋', en: 'Diagonal helix' } },
      { pose: 'helix1', name: { zh: '橫的單螺旋', en: 'Level helix' } },
      { pose: 'helix2', name: { zh: '雙螺旋', en: 'Double helix' } },
      { pose: 'denseW', name: { zh: '很密的螺旋波浪', en: 'Tight coil wave' } },
      { pose: 'bwave', name: { zh: '圓拱密波浪', en: 'Arched wave' } },
      { pose: 'wave', name: { zh: '平緩的波浪', en: 'Gentle wave' } },
      { pose: 'cross', name: { zh: '交叉', en: 'Cross' } },
      { pose: 'frame', name: { zh: '左右括號', en: 'Brackets' } },
      { pose: 'arch', name: { zh: '拱門', en: 'Arch' } },
      { pose: 'ribbonArch', name: { zh: '絲帶拱門', en: 'Ribbon arch' } },
      { pose: 'ribbon', name: { zh: '絲帶圈', en: 'Ribbon loop' } },
      { pose: 'infinity', name: { zh: '無限符號 ∞', en: 'Infinity ∞' } },
      { pose: 'spring', name: { zh: '直立彈簧', en: 'Spring' } },
      { pose: 'peek', name: { zh: '側邊露出一截', en: 'Peek' } },
      { pose: 'footer', name: { zh: '橫穿的一根', en: 'Crossing' } },
    ],
  },

  // 結尾：絲帶拱門
  contact: {
    kicker: { zh: '即時渲染', en: 'Rendered live' },
    title: { zh: 'Three.js · WebGL', en: 'Three.js · WebGL' },
    sub: { zh: '右上角的圓點可以切換配色。', en: 'Switch colour themes with the dots at the top right.' },
  },

  ui: {
    theme: { zh: '配色', en: 'Theme' },
    top: { zh: '回到頂端', en: 'Back to top' },
    themes: {
      steel: { zh: '鋼藍', en: 'Steel' },
      ember: { zh: '熔金', en: 'Ember' },
      jade: { zh: '翡翠', en: 'Jade' },
      aurora: { zh: '極光', en: 'Aurora' },
    },
  },
};
