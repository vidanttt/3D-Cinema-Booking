import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import gsap from 'gsap'
import type { CameraPose } from '../data/pov'
import { HALL, ROWS, SCREEN_CENTRE_Y, SEATS } from '../data/seats'
import type { Seat } from '../types'

const COLOR = {
  velvet: new THREE.Color('#8c1322'),
  recliner: new THREE.Color('#5a1420'),
  prime: new THREE.Color('#9a1626'),
  selected: new THREE.Color('#8fe866'),
  active: new THREE.Color('#b4ff8a'),
}

interface Rig {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  fov: number
  /** Vertical lens shift, as a fraction of the viewport (lifts the picture above a bottom sheet). */
  shift: number
}

export interface FlyOptions {
  duration?: number
  ease?: string
}

function canvasTexture(size: [number, number], draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = size[0]
  canvas.height = size[1]
  const ctx = canvas.getContext('2d')
  if (ctx) draw(ctx, size[0], size[1])
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Vertical acoustic ribbing for walls and curtains. */
function ribTexture(base: string, dark: string) {
  const texture = canvasTexture([256, 64], (ctx, w, h) => {
    const ribs = 16
    for (let i = 0; i < ribs; i++) {
      const g = ctx.createLinearGradient((i * w) / ribs, 0, ((i + 1) * w) / ribs, 0)
      g.addColorStop(0, dark)
      g.addColorStop(0.45, base)
      g.addColorStop(1, dark)
      ctx.fillStyle = g
      ctx.fillRect((i * w) / ribs, 0, w / ribs + 1, h)
    }
  })
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  return texture
}

function glowTexture() {
  return canvasTexture([256, 256], (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.32)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
}

/**
 * A real-time model of the hall. The camera can be placed at the exact eye
 * position of any seat, which is what makes every preview unique.
 */
export class Auditorium {
  readonly renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80)
  private rig: Rig = { position: new THREE.Vector3(0, 20, 11), quaternion: new THREE.Quaternion(), fov: 50, shift: 0 }
  private size = { w: 1, h: 1 }
  private applied = { fov: 0, shift: -1 }
  private velvet!: THREE.InstancedMesh
  private frames!: THREE.InstancedMesh
  private people!: THREE.InstancedMesh
  private screenLight!: THREE.RectAreaLight
  private seatGlow!: THREE.PointLight
  private screenTexture: THREE.Texture | null = null
  private disposables: { dispose(): void }[] = []
  private raf = 0
  private running = false
  private startedAt = performance.now()
  private pointer = new THREE.Vector2()
  private pointerEased = new THREE.Vector2()
  private flight: gsap.core.Tween | null = null
  /** 0 = locked (during flights / overhead), 1 = full idle drift and parallax. */
  private life = { value: 0 }
  private reducedMotion: boolean
  private seatIndex = new Map<string, number>()

  constructor(
    private canvas: HTMLCanvasElement,
    stillUrl: string,
    opts: { reducedMotion: boolean; onReady: () => void },
  ) {
    this.reducedMotion = opts.reducedMotion
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.18
    this.scene.background = new THREE.Color('#040405')
    this.scene.fog = new THREE.FogExp2('#050506', 0.016)

    RectAreaLightUniformsLib.init()
    this.buildRoom()
    this.buildSeats()
    this.buildLights()
    this.buildScreen(stillUrl, opts.onReady)
    this.resize()
  }

  /* ---------- construction ---------- */

  private track<T extends { dispose(): void }>(item: T): T {
    this.disposables.push(item)
    return item
  }

  private buildRoom() {
    const { halfWidth, depth, height } = HALL
    const carpet = this.track(new THREE.MeshStandardMaterial({ color: '#0d0a0c', roughness: 0.62, metalness: 0.05 }))
    const floor = new THREE.Mesh(this.track(new THREE.PlaneGeometry(halfWidth * 2, depth + 2)), carpet)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, 0, depth / 2 - 1)
    this.scene.add(floor)

    // Stadium risers, one step per row.
    const stepMat = this.track(new THREE.MeshStandardMaterial({ color: '#0b090b', roughness: 0.85 }))
    const stripMat = this.track(new THREE.MeshBasicMaterial({ color: '#ffb46b' }))
    const stripGeo = this.track(new THREE.BoxGeometry(0.5, 0.02, 0.02))
    const aisleX = (8 * HALL.seatPitch) / 2 + HALL.aisle / 2
    ROWS.forEach((_, r) => {
      if (r === 0) return
      const front = HALL.firstRowZ + r * HALL.rowPitch - 0.75
      const h = r * HALL.riser
      const step = new THREE.Mesh(this.track(new THREE.BoxGeometry(halfWidth * 2, h, depth - front)), stepMat)
      step.position.set(0, h / 2, front + (depth - front) / 2)
      this.scene.add(step)
      for (const side of [-1, 1]) {
        const strip = new THREE.Mesh(stripGeo, stripMat)
        strip.position.set(side * aisleX, h - 0.04, front - 0.012)
        this.scene.add(strip)
      }
    })

    // Ribbed side walls, back wall, ceiling.
    const wallTex = this.track(ribTexture('#17141a', '#08070a'))
    wallTex.repeat.set(7, 1)
    const wallMat = this.track(new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9, side: THREE.DoubleSide }))
    const wallGeo = this.track(new THREE.PlaneGeometry(depth + 2, height))
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(wallGeo, wallMat)
      wall.rotation.y = (-side * Math.PI) / 2
      wall.position.set(side * halfWidth, height / 2, depth / 2 - 1)
      this.scene.add(wall)
    }
    const plain = this.track(new THREE.MeshStandardMaterial({ color: '#070608', roughness: 1, side: THREE.DoubleSide }))
    const back = new THREE.Mesh(this.track(new THREE.PlaneGeometry(halfWidth * 2, height)), plain)
    back.position.set(0, height / 2, depth)
    back.rotation.y = Math.PI
    this.scene.add(back)
    const front = new THREE.Mesh(this.track(new THREE.PlaneGeometry(halfWidth * 2, height)), plain)
    front.position.set(0, height / 2, -0.6)
    this.scene.add(front)

    // Warm wall washers: a soft amber pool behind a slim fitting.
    const glow = this.track(glowTexture())
    const washMat = this.track(
      new THREE.MeshBasicMaterial({
        map: glow,
        color: '#ff9a4d',
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    )
    const washGeo = this.track(new THREE.PlaneGeometry(2.2, 5.2))
    const fittingGeo = this.track(new THREE.BoxGeometry(0.05, 0.7, 0.08))
    const fittingMat = this.track(new THREE.MeshBasicMaterial({ color: '#ffc58f' }))
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const z = 3.2 + i * 3.6
        const y = 3.1 + i * 0.42
        const wash = new THREE.Mesh(washGeo, washMat)
        wash.rotation.y = (-side * Math.PI) / 2
        wash.position.set(side * (halfWidth - 0.03), y, z)
        this.scene.add(wash)
        const fitting = new THREE.Mesh(fittingGeo, fittingMat)
        fitting.position.set(side * (halfWidth - 0.06), y, z)
        this.scene.add(fitting)
      }
    }

    // Burgundy curtains flanking the screen.
    const curtainTex = this.track(ribTexture('#4a1522', '#12060a'))
    curtainTex.repeat.set(1.4, 1)
    const curtainMat = this.track(new THREE.MeshStandardMaterial({ map: curtainTex, roughness: 0.95 }))
    const curtainW = halfWidth - HALL.screenWidth / 2 - 0.15
    for (const side of [-1, 1]) {
      const curtain = new THREE.Mesh(this.track(new THREE.PlaneGeometry(curtainW, height)), curtainMat)
      curtain.position.set(side * (HALL.screenWidth / 2 + 0.15 + curtainW / 2), height / 2, -0.25)
      this.scene.add(curtain)
    }
  }

  private buildSeats() {
    // Chair faces -z (toward the screen); origin on the floor beneath it.
    const back = new RoundedBoxGeometry(0.54, 0.8, 0.13, 4, 0.06)
    back.rotateX(0.15)
    back.translate(0, 0.8, 0.25)
    const cushion = new RoundedBoxGeometry(0.5, 0.14, 0.48, 4, 0.06)
    cushion.rotateX(0.06)
    cushion.translate(0, 0.46, -0.02)
    const velvetGeo = this.track(mergeGeometries([back, cushion]))
    back.dispose()
    cushion.dispose()

    const armL = new THREE.BoxGeometry(0.06, 0.26, 0.5)
    armL.translate(-0.305, 0.52, 0.0)
    const armR = armL.clone().translate(0.61, 0, 0)
    const base = new THREE.BoxGeometry(0.46, 0.38, 0.36)
    base.translate(0, 0.2, 0.04)
    const frameGeo = this.track(mergeGeometries([armL, armR, base]))
    armL.dispose()
    armR.dispose()
    base.dispose()

    const velvetMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        roughness: 0.82,
        sheen: 1,
        sheenRoughness: 0.45,
        sheenColor: new THREE.Color('#ff5a6e'),
      }),
    )
    const frameMat = this.track(new THREE.MeshStandardMaterial({ color: '#0c0a0c', roughness: 0.55, metalness: 0.2 }))

    this.velvet = new THREE.InstancedMesh(velvetGeo, velvetMat, SEATS.length)
    this.frames = new THREE.InstancedMesh(frameGeo, frameMat, SEATS.length)

    // Seated silhouettes for taken seats.
    const head = new THREE.SphereGeometry(0.105, 14, 12)
    head.translate(0, 1.2, 0.06)
    const torso = new THREE.CapsuleGeometry(0.19, 0.3, 4, 10)
    torso.scale(1.15, 1, 0.62)
    torso.translate(0, 0.8, 0.1)
    const personGeo = this.track(mergeGeometries([head, torso]))
    head.dispose()
    torso.dispose()
    const personMat = this.track(new THREE.MeshStandardMaterial({ color: '#131116', roughness: 0.9 }))
    this.people = new THREE.InstancedMesh(personGeo, personMat, SEATS.length)
    this.people.count = 0

    const m = new THREE.Object3D()
    SEATS.forEach((seat, i) => {
      this.seatIndex.set(seat.id, i)
      this.placeSeat(m, seat)
      this.velvet.setMatrixAt(i, m.matrix)
      this.frames.setMatrixAt(i, m.matrix)
      this.velvet.setColorAt(i, COLOR.velvet)
    })
    this.velvet.frustumCulled = this.frames.frustumCulled = this.people.frustumCulled = false
    this.scene.add(this.velvet, this.frames, this.people)
  }

  private placeSeat(m: THREE.Object3D, seat: Seat) {
    const s = seat.category === 'recliner' ? 1.06 : 1
    m.position.set(seat.xPosition, seat.rowIndex * HALL.riser, seat.zPosition)
    m.rotation.set(0, seat.facing, 0)
    m.scale.set(s, s, s)
    m.updateMatrix()
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight('#2a3a55', '#0a0506', 0.5))
    // Dim house light from the projection booth, so the velvet reads from behind.
    const house = new THREE.DirectionalLight('#ffd0a8', 0.85)
    house.position.set(2, 13, 26)
    house.target.position.set(0, 0, 6)
    this.scene.add(house, house.target)

    this.screenLight = new THREE.RectAreaLight('#9fc0ff', 7, HALL.screenWidth, HALL.screenHeight)
    this.screenLight.position.set(0, SCREEN_CENTRE_Y, 0.05)
    this.screenLight.lookAt(0, SCREEN_CENTRE_Y, 10)
    this.scene.add(this.screenLight)

    this.seatGlow = new THREE.PointLight('#a4f27a', 0, 4.5, 1.6)
    this.scene.add(this.seatGlow)
  }

  private buildScreen(url: string, onReady: () => void) {
    const { screenWidth: w, screenHeight: h } = HALL
    const mask = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(w + 0.5, h + 0.5)),
      this.track(new THREE.MeshBasicMaterial({ color: '#000000' })),
    )
    mask.position.set(0, SCREEN_CENTRE_Y, -0.08)
    this.scene.add(mask)

    const halo = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(w * 1.9, h * 2.6)),
      this.track(
        new THREE.MeshBasicMaterial({
          map: this.track(glowTexture()),
          color: '#3f66b8',
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      ),
    )
    halo.position.set(0, SCREEN_CENTRE_Y, -0.2)
    this.scene.add(halo)

    const material = this.track(new THREE.MeshBasicMaterial({ color: '#000000', toneMapped: false, fog: false }))
    const screen = new THREE.Mesh(this.track(new THREE.PlaneGeometry(w, h)), material)
    screen.position.set(0, SCREEN_CENTRE_Y, 0)
    this.scene.add(screen)

    new THREE.TextureLoader().load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
        // Centre-crop the still to the 2.39:1 screen.
        const image = texture.image as { width: number; height: number }
        const crop = image.width / image.height / (w / h)
        texture.repeat.set(1, crop)
        texture.offset.set(0, (1 - crop) / 2)
        this.screenTexture = this.track(texture)
        material.map = texture
        material.color.set('#ffffff')
        material.needsUpdate = true
        this.renderOnce()
        onReady()
      },
      undefined,
      () => onReady(),
    )
  }

  /* ---------- state ---------- */

  setSeatStates(selected: readonly string[], activeId: string | null, occupied: ReadonlySet<string>) {
    const picked = new Set(selected)
    const m = new THREE.Object3D()
    let people = 0
    SEATS.forEach((seat, i) => {
      const color =
        seat.id === activeId
          ? COLOR.active
          : picked.has(seat.id)
            ? COLOR.selected
            : seat.category === 'recliner'
              ? COLOR.recliner
              : seat.category === 'prime'
                ? COLOR.prime
                : COLOR.velvet
      this.velvet.setColorAt(i, color)
      if (occupied.has(seat.id)) {
        this.placeSeat(m, seat)
        this.people.setMatrixAt(people++, m.matrix)
      }
    })
    this.people.count = people
    this.people.instanceMatrix.needsUpdate = true
    if (this.velvet.instanceColor) this.velvet.instanceColor.needsUpdate = true
    if (activeId) {
      const seat = SEATS[this.seatIndex.get(activeId) ?? 0]
      this.seatGlow.position.set(seat.xPosition, seat.rowIndex * HALL.riser + 1.7, seat.zPosition - 0.2)
    }
    this.renderOnce()
  }

  /* ---------- camera ---------- */

  get aspect() {
    return this.camera.aspect
  }

  private solve(pose: CameraPose): Rig {
    const helper = new THREE.Object3D()
    helper.up.set(...pose.up)
    helper.position.set(...pose.position)
    // Object3D.lookAt points +z at the target; cameras look down -z.
    const mat = new THREE.Matrix4().lookAt(helper.position, new THREE.Vector3(...pose.target), helper.up)
    return {
      position: helper.position.clone(),
      quaternion: new THREE.Quaternion().setFromRotationMatrix(mat),
      fov: pose.fov,
      shift: pose.shift ?? 0,
    }
  }

  jumpTo(pose: CameraPose) {
    this.flight?.kill()
    const next = this.solve(pose)
    this.rig.position.copy(next.position)
    this.rig.quaternion.copy(next.quaternion)
    this.rig.fov = next.fov
    this.rig.shift = next.shift
    this.renderOnce()
  }

  /** Returns a tween that can be placed on a timeline. */
  flyTo(pose: CameraPose, { duration = 1.6, ease = 'power3.inOut' }: FlyOptions = {}): gsap.core.Tween {
    const to = this.solve(pose)
    const from: Rig = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), fov: 50, shift: 0 }
    const state = { p: 0 }
    let airborne = false
    this.flight?.kill()
    const tween = gsap.to(state, {
      p: 1,
      duration: this.reducedMotion ? 0.01 : duration,
      ease,
      onUpdate: () => {
        // Take off from wherever the camera is on the first frame of the flight.
        if (!airborne) {
          airborne = true
          from.position.copy(this.rig.position)
          from.quaternion.copy(this.rig.quaternion)
          from.fov = this.rig.fov
          from.shift = this.rig.shift
        }
        this.rig.position.lerpVectors(from.position, to.position, state.p)
        this.rig.quaternion.slerpQuaternions(from.quaternion, to.quaternion, state.p)
        this.rig.fov = from.fov + (to.fov - from.fov) * state.p
        this.rig.shift = from.shift + (to.shift - from.shift) * state.p
        if (!this.running) this.renderOnce()
      },
    })
    this.flight = tween
    return tween
  }

  /** Tweenable handles for timelines. */
  get lifeTarget() {
    return this.life
  }
  get glowTarget() {
    return this.seatGlow
  }

  setPointer(x: number, y: number) {
    this.pointer.set(x, y)
  }

  /* ---------- loop ---------- */

  private applyCamera(t: number) {
    const life = this.reducedMotion ? 0 : this.life.value
    this.pointerEased.lerp(this.pointer, 0.045)
    this.camera.position.copy(this.rig.position)
    this.camera.quaternion.copy(this.rig.quaternion)
    if (life > 0) {
      // Breathing, a slow push toward the screen, and a head-turn parallax.
      this.camera.position.x += this.pointerEased.x * 0.1 * life
      this.camera.position.y += (Math.sin(t * 0.55) * 0.012 + this.pointerEased.y * 0.04) * life
      this.camera.position.z -= (0.1 + Math.sin(t * 0.18) * 0.1) * life
      this.camera.rotateY(-this.pointerEased.x * 0.05 * life)
      this.camera.rotateX(this.pointerEased.y * 0.03 * life)
    }
    if (this.applied.fov !== this.rig.fov || this.applied.shift !== this.rig.shift) {
      this.applied.fov = this.camera.fov = this.rig.fov
      this.applied.shift = this.rig.shift
      const { w, h } = this.size
      if (this.rig.shift) this.camera.setViewOffset(w, h, 0, h * this.rig.shift, w, h)
      else this.camera.clearViewOffset()
      this.camera.updateProjectionMatrix()
    }
  }

  private frame = () => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.frame)
    const t = this.elapsed()
    if (!this.reducedMotion) {
      // Projector flicker and a slow drift across the frame.
      this.screenLight.intensity = 7 * (1 + Math.sin(t * 1.7) * 0.05 + Math.sin(t * 4.3) * 0.025)
      if (this.screenTexture) {
        const crop = this.screenTexture.repeat.y
        const zoom = 0.955 + Math.sin(t * 0.07) * 0.03
        this.screenTexture.repeat.x = zoom
        this.screenTexture.offset.x = (1 - zoom) / 2 + Math.sin(t * 0.05) * 0.012
        this.screenTexture.offset.y = (1 - crop) / 2
      }
    }
    this.applyCamera(t)
    this.renderer.render(this.scene, this.camera)
  }

  private elapsed() {
    return (performance.now() - this.startedAt) / 1000
  }

  renderOnce() {
    if (this.running) return
    this.applyCamera(this.elapsed())
    this.renderer.render(this.scene, this.camera)
  }

  start() {
    if (this.running) return
    this.running = true
    this.raf = requestAnimationFrame(this.frame)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.size = { w, h }
    this.camera.aspect = w / h
    this.applied.shift = -1
    this.renderOnce()
  }

  dispose() {
    this.stop()
    this.flight?.kill()
    gsap.killTweensOf(this.life)
    gsap.killTweensOf(this.seatGlow)
    this.velvet.dispose()
    this.frames.dispose()
    this.people.dispose()
    this.disposables.forEach((d) => d.dispose())
    this.renderer.dispose()
  }
}
