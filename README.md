# Dragon

Real-time 3D dragon scales, rendered in the browser with Three.js / WebGL.

**Live:** https://pg56714.github.io/dragon/

Thousands of roof-tile scales are laid along a curve, layered from the spine down each side, and lit by an invisible studio, so every colour you see is a reflection. The scales keep lifting in waves that run down the body.

## What's on the page

- **Hero**: a symmetric helix that keeps spinning around its own axis and leans toward the cursor.
- **01 Scales / 02 Light**: the body frames the title as brackets, then as an arch.
- **03 How it is made**: four steps, with the body running behind the cards and turning at the screen edges.
- **04 Forms**: a gallery of 16 poses built from the same scales.
- **Ending**: a ribbon arch.

Interactions:

- Each section's scales start flat and flip up when the section first scrolls into view.
- Moving the cursor (or a finger) over the body lifts nearby scales and sends out ripples.
- A highlight sweeps from head to tail every few seconds.
- Scrolling faster makes the scales lift higher and the waves run faster.
- Four colour themes (dots at the top right) and English / 中文 (English by default).

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page skeleton, fonts, and the Three.js import map (loaded from jsDelivr). |
| `content.js` | All text, in both languages. Edit this to change wording. |
| `app.js` | Builds the sections from `content.js`, plus the nav, language and theme switching. |
| `dragon.js` | The 3D scene: the poses (`PIECES`), scale geometry, lighting, and the shader motion. |
| `styles.css` | Layout and typography. |

Each section has a `data-pose`, and `dragon.js` draws the matching piece of body behind it, scrolling with the page.

## Run locally

No build step. Serve the folder with any static server, for example:

```bash
python -m http.server 5317
```

Then open http://localhost:5317. Opening `index.html` directly from disk will not work, because ES modules need to be served over HTTP.

## Deploy

The site is served by GitHub Pages from the `main` branch root. Pushing to `main` updates it within a minute or two.

---

## 中文說明

在瀏覽器裡即時算出來的 3D 龍鱗片（Three.js / WebGL）。

- 首頁是一條一直繞中軸轉、會跟著游標轉向的螺旋。
- 往下依序是鱗片、光、製作過程，最後是 16 種姿態的總覽。
- 每段第一次捲進畫面時，鱗片從平貼翻起來。
- 游標經過會撥起鱗片，泛出漣漪。
- 每隔幾秒有一道高光從頭掃到尾。
- 捲動越快，鱗片翹得越高。
- 右上角可以切換四種配色和中英文，預設英文。

文字都在 `content.js`，龍的形狀和動態在 `dragon.js`。本機預覽要用靜態伺服器（例如上面的 `python -m http.server`），直接雙擊 `index.html` 打不開。
