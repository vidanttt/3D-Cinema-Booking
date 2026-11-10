// Virtual time for frame-exact capture. Nothing time-based runs until the
// capture script calls __step(ms): requestAnimationFrame callbacks, timeouts,
// performance.now() and Date.now() all follow the virtual clock, so every
// captured frame is a pure function of time.
(() => {
  const realPerf = performance.now.bind(performance)
  const realDate = Date.now
  const base = realPerf()
  const baseDate = realDate()
  let vt = 0
  let frames = []
  let timers = []
  let nextId = 1
  const cancelledFrames = new Set()

  performance.now = () => base + vt
  Date.now = () => baseDate + vt

  window.requestAnimationFrame = (cb) => {
    const id = nextId++
    frames.push([id, cb])
    return id
  }
  window.cancelAnimationFrame = (id) => cancelledFrames.add(id)

  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = nextId++
    if (typeof fn === 'function') timers.push({ id, due: vt + Math.max(0, +ms || 0), fn, args })
    return id
  }
  window.clearTimeout = (id) => {
    timers = timers.filter((t) => t.id !== id)
  }

  const runTimers = () => {
    for (let guard = 0; guard < 1000; guard++) {
      const due = timers.filter((t) => t.due <= vt).sort((a, b) => a.due - b.due)
      if (!due.length) return
      const t = due[0]
      timers = timers.filter((x) => x !== t)
      try {
        t.fn(...t.args)
      } catch (e) {
        console.error('timer error', e && e.message)
      }
    }
  }

  window.__step = (ms) => {
    vt += ms
    runTimers()
    const run = frames
    frames = []
    for (const [id, cb] of run) {
      if (cancelledFrames.has(id)) continue
      try {
        cb(base + vt)
      } catch (e) {
        console.error('raf error', e && e.message)
      }
    }
    cancelledFrames.clear()
    return vt
  }
  window.__vt = () => vt
})()
