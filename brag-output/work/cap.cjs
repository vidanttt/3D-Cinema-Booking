// Captures the real CINÉ app in use, frame by frame on a virtual clock.
// Usage: node cap.cjs [segment ...]   (default: all)
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const FPS = 30
const DT = 1000 / FPS
const W = 1920
const H = 1080
const OUT = path.join(__dirname, 'cap')

// Seats, chosen from the 19:40 session's free seats.
const PAIR = ['F9', 'F8'] // F8 picked last, so it is the one previewed
const DECOY = 'F7' // taken: hover shows the "Taken" tooltip
const FAR_FRONT = 'A3' // front row, far left
const FAR_BACK = 'K13' // back row, far right
const HOOK_SEAT = 'A7' // front row, centre

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

;(async () => {
  const only = process.argv.slice(2)
  const browser = await chromium.launch({
    channel: 'chromium', // full Chromium, new headless: ~15x faster with WebGL + backdrop blur
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  page.setDefaultTimeout(180000)
  page.on('pageerror', (e) => console.log('pageerror', e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('console', m.text())
  })
  await page.addInitScript({ content: fs.readFileSync(path.join(__dirname, 'vclock.js'), 'utf8') })
  await page.goto('http://localhost:5173')
  await page.evaluate(() => document.fonts.ready)

  const step = (n = 1) => page.evaluate(([n, dt]) => { for (let i = 0; i < n; i++) window.__step(dt) }, [n, DT])
  const rect = (sel) =>
    page.evaluate((sel) => {
      const r = document.querySelector(sel)?.getBoundingClientRect()
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null
    }, sel)

  // A drawn cursor, since headless Chromium has none.
  await page.evaluate(() => {
    const c = document.createElement('div')
    c.id = 'brag-cursor'
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform;filter:drop-shadow(0 4px 10px rgba(0,0,0,.55))'
    c.innerHTML =
      '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M4 2.5 L4 19.5 L8.6 15.4 L11.6 22 L14.6 20.7 L11.7 14.2 L18 14.2 Z" fill="#fff" stroke="#0a0a0c" stroke-width="1.4" stroke-linejoin="round"/></svg>'
    document.body.appendChild(c)
  })
  let cursor = { x: W + 60, y: H * 0.7 }
  const placeCursor = async (x, y) => {
    cursor = { x, y }
    await page.evaluate(([x, y]) => {
      document.getElementById('brag-cursor').style.transform = `translate(${x - 6}px, ${y - 3}px)`
    }, [x, y])
    await page.mouse.move(x, y)
  }
  const click = async () => {
    await page.mouse.down()
    await page.mouse.up()
  }

  // Let the page entrance finish and the hall warm up.
  await placeCursor(W + 60, H * 0.7)
  await step(150)
  await page.waitForTimeout(500)

  const shoot = async (seg, i) => {
    const dir = path.join(OUT, seg)
    fs.mkdirSync(dir, { recursive: true })
    await page.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 93 })
  }
  const want = (seg) => !only.length || only.includes(seg)

  /** Records `count` frames. `plan(i)` returns { to:[x,y]|null, click:bool } for each frame. */
  async function record(seg, count, plan) {
    const t0 = Date.now()
    for (let i = 0; i < count; i++) {
      const p = plan(i) || {}
      if (p.to) await placeCursor(p.to[0], p.to[1])
      if (p.click) await click()
      if (p.after) await p.after()
      if (want(seg)) await shoot(seg, i)
      await step(1)
      if (i % 10 === 0) console.log(seg, i, '/', count, ((Date.now() - t0) / 1000).toFixed(0) + 's')
    }
    console.log('done', seg, ((Date.now() - t0) / 1000).toFixed(0) + 's')
  }

  /** Cursor path through keyframes [[frame, [x,y]], ...]; eased between them. */
  const path2 = (keys) => (i) => {
    for (let k = 0; k < keys.length - 1; k++) {
      const [fa, a] = keys[k]
      const [fb, b] = keys[k + 1]
      if (i >= fa && i <= fb) {
        const t = fb === fa ? 1 : ease((i - fa) / (fb - fa))
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
      }
    }
    return keys[keys.length - 1][1]
  }

  /* ---------- 1. MAP: hover a taken seat, pick a pair, head for the button ---------- */
  const decoy = await rect(`[data-seat-id="${DECOY}"]`)
  const s1 = await rect(`[data-seat-id="${PAIR[0]}"]`)
  const s2 = await rect(`[data-seat-id="${PAIR[1]}"]`)
  const start = [1500, 1010]
  let button = null
  const mapPath = path2([
    [0, start],
    [11, [decoy.x, decoy.y]],
    [15, [decoy.x, decoy.y]],
    [22, [s1.x, s1.y]],
    [30, [s1.x, s1.y]],
    [34, [s2.x, s2.y]],
  ])
  await record('map', 72, (i) => {
    if (i <= 34) return { to: mapPath(i), click: i === 24 || i === 36 }
    if (i === 36) return { to: [s2.x, s2.y], click: true }
    if (i === 40) {
      return {
        after: async () => {
          button = await rect('#dock button.btn-accent')
        },
      }
    }
    if (i > 40 && button) {
      const t = ease(Math.min(1, (i - 40) / 24))
      return { to: [s2.x + (button.x + 30 - s2.x) * t, s2.y + (button.y - s2.y) * t] }
    }
    return {}
  })

  /* ---------- 2. SHOCK: click "See your view" — the map opens into the hall ---------- */
  const away = [W + 80, H + 40]
  const from = { ...cursor }
  await record('shock', 144, (i) => {
    if (i === 0) return { click: true }
    if (i >= 10 && i <= 50) {
      const t = ease((i - 10) / 40)
      return { to: [from.x + (away[0] - from.x) * t, from.y + (away[1] - from.y) * t] }
    }
    return {}
  })

  /* ---------- 3/4. Jump seats from the mini map ---------- */
  async function jump(seg, seat, count) {
    const dot = await rect(`#seat-panel svg [data-id="${seat}"]`)
    if (!dot) throw new Error('no mini-map dot for ' + seat)
    await placeCursor(dot.x, dot.y)
    const at = { ...cursor }
    await record(seg, count, (i) => {
      if (i === 0) return { click: true }
      if (i >= 8 && i <= 40) {
        const t = ease((i - 8) / 32)
        return { to: [at.x + (away[0] - at.x) * t, at.y + (away[1] - at.y) * t] }
      }
      return {}
    })
  }
  await jump('front', FAR_FRONT, 96)
  await jump('back', FAR_BACK, 66)

  /* ---------- 5. HOOK footage: front row, centre, settled ---------- */
  {
    const dot = await rect(`#seat-panel svg [data-id="${HOOK_SEAT}"]`)
    await placeCursor(dot.x, dot.y)
    await click()
    await placeCursor(...away)
    await step(55)
    await record('hook', 80, () => ({}))
  }

  /* ---------- back to the pair, then book ---------- */
  {
    const dot = await rect(`#seat-panel svg [data-id="${PAIR[1]}"]`)
    await placeCursor(dot.x, dot.y)
    await click()
    await placeCursor(...away)
    await step(60)
  }
  const confirm = await rect('#seat-panel button.btn-accent')
  await placeCursor(confirm.x + 40, confirm.y + 4)
  const atConfirm = { ...cursor }
  await record('book', 150, (i) => {
    if (i === 0) return { click: true }
    if (i >= 14 && i <= 50) {
      const t = ease((i - 14) / 36)
      return { to: [atConfirm.x + (away[0] - atConfirm.x) * t, atConfirm.y + (away[1] - atConfirm.y) * t] }
    }
    return {}
  })

  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ PAIR, DECOY, FAR_FRONT, FAR_BACK, HOOK_SEAT }, null, 2))
  console.log('ALL DONE')
  await browser.close()
})().catch((e) => {
  console.error('FAILED', e)
  process.exit(1)
})
