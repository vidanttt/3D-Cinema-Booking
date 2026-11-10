// Every frame is a pure function of its index: renderFrame(f) sets the whole
// stage for frame f and resolves once its images are decoded.
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource/instrument-serif/400-italic.css'

const FPS = 30
const B = 12 // frames per beat at 150 BPM
const TOTAL = 56 * B

const $ = (id) => document.getElementById(id)
const footA = $('footA')
const footB = $('footB')
const fill = $('fill')
const caption = $('caption')
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))
const easeOut3 = (t) => 1 - Math.pow(1 - t, 3)
const pad = (n) => String(n).padStart(4, '0')

/* ---------------- scene table (frames) ---------------- */
const S = {
  hook: [0, 6 * B],
  brand: [6 * B, 8 * B],
  map: [8 * B, 14 * B],
  shock: [14 * B, 26 * B],
  front: [26 * B, 34 * B],
  back: [34 * B, 38 * B],
  book: [38 * B, 46 * B],
  outro: [46 * B, TOTAL],
}
const inScene = (f, k) => f >= S[k][0] && f < S[k][1]

// Hits: [frame, flash strength, shake px]
const HITS = [
  [0, 0.9, 16],
  [3 * B, 0.55, 12],
  [6 * B, 1.0, 18],
  [14 * B, 0.8, 16],
  [26 * B, 0.45, 9],
  [34 * B, 0.45, 9],
  [40 * B, 0.3, 8],
  [46 * B, 0.85, 12],
]

// Hook crop: front row looking up at the screen.
const HOOK_VIEW = { s0: 1.25, s1: 1.32, cx: 960, cy: 438 }

/* ---------------- captions ---------------- */
// Each caption: [start, end, size, top, lines]
const CAPTIONS = [
  [0, 3 * B, 176, 400, ['Booked <em>row A?</em>']],
  [3 * B, 6 * B, 176, 330, ['Enjoy the', '<em>neck pain.</em>']],
  [21 * B, 26 * B, 150, 330, ["That's your", '<em>actual view.</em>']],
  [26 * B, 34 * B, 134, 330, ['Every seat gets', '<em>its own camera.</em>']],
  [35 * B, 38 * B, 150, 330, ['Back row:', '<em>full picture.</em>']],
]

let currentCaption = null
function renderCaption(f) {
  const c = CAPTIONS.find(([a, b]) => f >= a && f < b)
  if (c !== currentCaption) {
    currentCaption = c
    caption.innerHTML = c ? c[4].map((l) => `<span class="line">${l}</span>`).join('') : ''
    if (c) {
      caption.style.top = c[3] + 'px'
      caption.querySelectorAll('.line').forEach((el) => (el.style.fontSize = c[2] + 'px'))
    }
  }
  $('band').style.opacity = c ? '1' : '0'
  if (!c) return
  caption.querySelectorAll('.line').forEach((el, i) => slam(el, f - c[0] - i * 2))
}

/** Slam-in: big + blurred → settled in 5 frames. */
function slam(el, df, from = 0.26, frames = 5) {
  if (df < 0) {
    el.style.opacity = '0'
    return
  }
  const p = clamp(df / frames)
  const e = easeOutExpo(p)
  el.style.opacity = String(clamp(p * 3))
  el.style.transform = `scale(${1 + from * (1 - e)})`
  el.style.filter = p < 1 ? `blur(${(10 * (1 - e)).toFixed(2)}px)` : 'none'
}

/* ---------------- footage ---------------- */
async function setImg(el, src) {
  if (!src) {
    el.style.visibility = 'hidden'
    return
  }
  el.style.visibility = 'visible'
  if (el.dataset.src === src) return
  el.dataset.src = src
  el.src = src
  await el.decode()
}

const view = (el, s, cx, cy) => {
  el.style.transform = `translate(${(960 - cx * s).toFixed(2)}px, ${(540 - cy * s).toFixed(2)}px) scale(${s.toFixed(5)})`
}

const MAP_A = [1.3, 1000, 535]
const MAP_B = [1.0, 960, 540]
function mapView(f) {
  // f: frames since the map scene started (may run into the shock scene)
  if (f < 30) {
    const t = f / 30
    return [lerp(MAP_A[0], MAP_A[0] + 0.03, t), MAP_A[1], MAP_A[2]]
  }
  const t = easeInOut(clamp((f - 30) / 30))
  return [lerp(MAP_A[0] + 0.03, MAP_B[0], t), lerp(MAP_A[1], MAP_B[1], t), lerp(MAP_A[2], MAP_B[2], t)]
}

function shakeAt(f) {
  let x = 0
  let y = 0
  for (const [h, , amp] of HITS) {
    const d = f - h
    if (d < 0 || d > 14) continue
    const k = amp * Math.exp(-d / 3.2)
    x += k * Math.sin(d * 2.7 + h)
    y += k * Math.cos(d * 3.4 + h * 0.7)
  }
  return [x, y]
}

function flashAt(f) {
  let v = 0
  for (const [h, st] of HITS) {
    const d = f - h
    if (d < 0 || d > 5) continue
    v = Math.max(v, st * Math.pow(1 - d / 5, 2))
  }
  return v
}

/* ---------------- frame ---------------- */
export async function renderFrame(f) {
  const loads = []
  let a = null
  let fillSrc = null
  let bSrc = null
  let bOpacity = 0
  footA.style.filter = 'none'
  $('glow').style.opacity = '0'
  $('brand').style.opacity = '0'
  $('outro').style.opacity = '0'
  $('side').style.opacity = '0'

  if (inScene(f, 'hook')) {
    a = `../cap/hook/${pad(Math.min(79, f + 4))}.jpg`
    const t = f / S.hook[1]
    view(footA, lerp(HOOK_VIEW.s0, HOOK_VIEW.s1, t), HOOK_VIEW.cx, HOOK_VIEW.cy)
    footA.style.filter = 'brightness(0.82) saturate(1.12)'
  } else if (inScene(f, 'brand')) {
    $('glow').style.opacity = '0.22'
    const brand = $('brand')
    brand.style.opacity = '1'
    const df = f - S.brand[0]
    const wm = brand.firstElementChild
    slam(wm, df, 0.4, 6)
    if (df >= 6) wm.style.transform = `scale(${1 + 0.035 * ((df - 6) / 18)})`
  } else if (inScene(f, 'map')) {
    const df = f - S.map[0]
    a = `../cap/map/${pad(df)}.jpg`
    view(footA, ...mapView(df))
    fillSrc = a
  } else if (inScene(f, 'shock')) {
    const df = f - S.shock[0]
    a = `../cap/shock/${pad(df)}.jpg`
    const from = mapView(72)
    const t = easeOutExpo(clamp(df / 34))
    const punch = 1 + 0.05 * Math.exp(-df / 4)
    view(footA, lerp(from[0], 1, t) * punch, lerp(from[1], 960, t), lerp(from[2], 540, t))
  } else if (inScene(f, 'front')) {
    const df = f - S.front[0]
    a = `../cap/front/${pad(df)}.jpg`
    view(footA, 1 + 0.04 * Math.exp(-df / 4), 960, 540)
  } else if (inScene(f, 'back')) {
    const df = f - S.back[0]
    a = `../cap/back/${pad(18 + df)}.jpg`
    view(footA, 1 + 0.04 * Math.exp(-df / 4), 960, 540)
  } else if (inScene(f, 'book')) {
    const s = f - S.book[0]
    const cap = s < 12 ? 18 + s : 33 + (s - 12) * 1.4
    const i = Math.floor(cap)
    const frac = cap - i
    a = `../cap/book/${pad(Math.min(149, i))}.jpg`
    if (frac > 0.01 && i < 149) {
      bSrc = `../cap/book/${pad(i + 1)}.jpg`
      bOpacity = frac
    }
    const z = 1 + 0.03 * easeInOut(clamp(s / 96))
    view(footA, z, 960, 540)
    view(footB, z, 960, 540)
    const side = $('side')
    const ds = f - 40 * B
    if (ds >= 0) {
      side.style.opacity = '1'
      slam(side.firstElementChild, ds, 0.3, 5)
    }
  } else if (inScene(f, 'outro')) {
    const df = f - S.outro[0]
    $('glow').style.opacity = '0.3'
    const outro = $('outro')
    outro.style.opacity = '1'
    slam(outro.querySelector('.wordmark'), df, 0.35, 6)
    slam($('tag1'), df - 3)
    slam($('tag2'), df - 6)
    const u = clamp((df - 12) / 10)
    const url = $('url')
    url.style.opacity = String(easeOut3(u))
    url.style.transform = `translateY(${(1 - easeOut3(u)) * 24}px)`
  }

  loads.push(setImg(fill, fillSrc))
  loads.push(setImg(footA, a))
  loads.push(setImg(footB, bSrc))
  footB.style.opacity = String(bOpacity)

  renderCaption(f)

  const [sx, sy] = shakeAt(f)
  $('shake').style.transform = `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px)`
  $('flash').style.opacity = flashAt(f).toFixed(3)
  // Grain moves every frame (deterministic).
  $('grain').style.backgroundPosition = `${(f * 137) % 512}px ${(f * 251) % 512}px`
  // Last few frames dip to black.
  $('black').style.opacity = String(clamp((f - (TOTAL - 9)) / 8))

  await Promise.all(loads)
}

$('side').innerHTML = '<span class="line" style="font-size:132px">Booked<em>.</em></span>'

window.TOTAL = TOTAL
window.renderFrame = renderFrame
window.compReady = Promise.all([
  document.fonts.load('820 100px "Geist Variable"'),
  document.fonts.load('600 100px "Geist Variable"'),
  document.fonts.load('400 30px "Geist Mono Variable"'),
  document.fonts.load('italic 400 30px "Instrument Serif"'),
]).then(() => document.fonts.ready)
