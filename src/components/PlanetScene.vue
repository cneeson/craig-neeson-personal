<template>
  <Suspense>
    <EffectComposerPmndrs disable-normal-pass>
      <BloomPmndrs
        ref="bloomRef"
        :radius="0.01"
        :intensity="4"
        :luminance-threshold="0.3"
        :luminance-smoothing="0.5"
        :blend-function="BlendFunction.ADD"
        mipmap-blur
      />
      <!-- After the bloom, so it doesn't smear the stars -->
      <SMAAPmndrs />
      <!-- Last, so the grain isn't smoothed away -->
      <FilmGrain ref="grainRef" />
    </EffectComposerPmndrs>
  </Suspense>

  <!-- Everything to do with the planet, hidden while flying over Belfast -->
  <TresGroup ref="planetRef">
    <TresDirectionalLight ref="sunRef" :position="[100, 100, -30]" :intensity="0.8" />

    <!-- A faint nebula behind the stars -->
    <primitive :object="nebula.mesh" />

    <!-- The stars, in three layers by brightness: the faint mass, then fewer brighter, then the brightest few -->
    <primitive v-for="layer in starLayers" :key="layer.points.uuid" :object="layer.points" />
    <primitive :object="shootingStar.mesh" />

    <TresGroup ref="earthRef" :position="EARTH_POSITION">
      <TresMesh :rotation-y="EARTH_MESH_ROTATION" :material="earth.material">
        <TresSphereGeometry :args="[1, quality.sphereSegments, quality.sphereSegments]" />
      </TresMesh>

      <TresMesh ref="cloudsRef">
        <TresSphereGeometry :args="[1.01, quality.sphereSegments, quality.sphereSegments]" />
        <TresMeshBasicMaterial
          :alpha-map="cloudsMap"
          :transparent="true"
          :opacity="0.2"
          :depth-write="false"
        />
      </TresMesh>

      <!-- A thinner deck of cloud over Belfast, which the camera comes down through after the sign -->
      <primitive :object="cloudDeck.object" />

      <TresMesh :material="atmosphereMaterial">
        <TresSphereGeometry :args="[ATMOSPHERE_RADIUS, quality.sphereSegments, quality.sphereSegments]" />
      </TresMesh>

      <!-- Northern Ireland picked out from orbit, and the arcs out from Belfast after the city -->
      <primitive :object="highlight.object" />
      <primitive :object="arcs.object" />
    </TresGroup>

    <!-- Belfast named on the way down, hung on the camera's path (in the scene, not the earth group) -->
    <primitive :object="belfastSign.object" />

    <TresPointLight ref="fillRef" :position="[25, -5, -30]" color="#5198ed" :intensity="FILL_LIGHT" :distance="80" :decay="1" />
  </TresGroup>

  <BelfastPhoto v-if="isCityMounted && !hasCityFailed" @failed="hasCityFailed = true" />
  <primitive :object="parisArc.object" />
  <CloudVeil ref="veilRef" />
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import {
  DirectionalLight, Group, MathUtils, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, PointLight, Quaternion, SRGBColorSpace, TextureLoader, Vector3,
  WebGLRenderer,
} from 'three'
import { useLoop, useTres } from '@tresjs/core'
// @ts-ignore-next-line
import { BloomPmndrs, EffectComposerPmndrs, SMAAPmndrs } from '@tresjs/post-processing'
// @ts-ignore-next-line
import { BlendFunction } from 'postprocessing'
import BelfastPhoto from './belfast-photo.vue'
import CloudVeil from './cloud-veil.vue'
import FilmGrain from './film-grain.vue'
import { isMobile, prefersReducedMotion, quality } from '@/services/device';
import {
  approachAt, bloomThresholdAt, diveAt, ENTRANCE_DURATION, entranceAt, RISEN, frameAt, highlightAt, isInBelfast, reachAt,
  deckAt, SIGN_PASS, signAt, veilAt, windows,
} from '@/scene/choreography';
import { cameraNudge } from '@/scene/camera-nudge'
import { cityPoseAt, cityState, firstShot, playEntrance, route, tickDirector } from '@/scene/director';
import { CITY_ENDS, cityFov, placeCamera, poseOf } from '@/scene/shots';
import { sceneState } from '@/scene/state';
import { updateOverlays } from '@/scene/overlay';
import { createHighlight } from '@/scene/planet/highlight';
import { createArcs } from '@/scene/planet/arcs';
import { createBelfastSign } from '@/scene/planet/belfast-sign';
import { createCloudDeck } from '@/scene/planet/cloud-deck';
import { EARTH_MESH_ROTATION, EARTH_POSITION, onEarth, PLACES } from '@/scene/planet/geo';
import { patchClouds } from '@/scene/planet/clouds';
import { createNebula } from '@/scene/planet/nebula';
import { createStarLayer, type StarLayer } from '@/scene/planet/starfield';
import { createShootingStar } from '@/scene/planet/shooting-star';
import { warmShaders } from '@/scene/warm';
import { createParisArc } from '@/scene/belfast/paris-arc';
import { ATMOSPHERE_RADIUS, createAtmosphereMaterial, createEarthMaterial, SUN_DIRECTION } from '@/scene/earth';
import { clamp01, damp, lerp, smoothstep } from '@/services/three';


// Where Belfast sits on the (unrotated) earth, which the camera dives towards
const HOME_MARKER = onEarth(PLACES.belfast.lat, PLACES.belfast.lon).multiplyScalar(1.01)
const UP = new Vector3(0, 1, 0)

// The descent from orbit follows a great circle through the marker, heading this far east of north (radians)
const APPROACH_BEARING = MathUtils.degToRad(25)
const HOME_UP = HOME_MARKER.clone().normalize()
// Along the great circle at the marker
const HOME_AHEAD = (() => {
  const north = UP.clone().addScaledVector(HOME_UP, -HOME_UP.y).normalize()
  const east = new Vector3().crossVectors(north, HOME_UP)
  return north.multiplyScalar(Math.cos(APPROACH_BEARING)).addScaledVector(east, Math.sin(APPROACH_BEARING))
})()

// Field of view and near plane: narrow over the planet (widening on the way down; see glideFov), wider (more so on
// portrait screens) over the city
const PLANET_LENS = { fov: 35, near: 0.01 }
// The furthest below level the glide looks (radians), and where it has tilted up to by the end of the descent
const MAX_DOWN = MathUtils.degToRad(80)
const SETTLED_DOWN = MathUtils.degToRad(30)
const PITCH_KNEE = 0.15
const CITY_NEAR = 0.3
// The lens on the way down. As the camera sets off it widens with how far it's closed in, so the planet grows only
// slowly while the stars stretch out past it (a dolly zoom; `hold` is how much of the planet's growth it takes out,
// up to `widen` degrees). Then nearer the clouds (`time`, 0 → 1) it widens on to the city's lens, so the ground rushes
// out to the edges, and there's no jump in the lens behind the clouds.
const VERTIGO = { hold: 0.6, widen: 9 }
const RUSH_FROM = 0.55
/** The tangent of the planet's angular radius from `height` (earth radii) above it. */
const planetSize = (height: number) => 1 / Math.sqrt((1 + height) ** 2 - 1)
const glideFov = (height: number, start: number, time: number, arrival: number) => {
  const held = 2 * MathUtils.radToDeg(Math.atan(Math.tan(MathUtils.degToRad(PLANET_LENS.fov / 2))
    * (planetSize(height) / planetSize(start)) ** VERTIGO.hold))
  // Easing off as it nears its widest, rather than stopping dead there
  const vertigo = PLANET_LENS.fov + VERTIGO.widen * (1 - Math.exp(-(held - PLANET_LENS.fov) / VERTIGO.widen))
  return lerp(vertigo, arrival, smoothstep(clamp01((time - RUSH_FROM) / (1 - RUSH_FROM))))
}

// Where the climb out of the clouds starts: just above the planet's clouds (the marker sits on them), a little
// behind the marker. `ratio` sets the easing: about √ratio of the distance is left halfway through.
const CLIMB = { height: 0.008, behind: 0.012, ratio: 0.12 }

// The blue fill light, at full strength
const FILL_LIGHT = 1000
/** How far the planet turns into place as it rises (radians). */
const ENTRANCE_SPIN = 0.3
// The entrance's flourishes, by its progress (0 → 1 over ENTRANCE_DURATION):
// - the sun reaching the planet's edge as the light comes round (it comes to rest side on), a flare along the rim
//   nearest it, peaking `at`, over about `width` either side;
// - the camera starting banked (radians), levelling out as the planet rises;
// - the stars fading in, the faintest first ([from, to] for each layer);
// - once it's settled, a slow sway round the planet, `angle` (radians) either way over `period` (s).
const GLINT = { at: 0.6, width: 0.06 }
const ROLL = MathUtils.degToRad(4)
const STARS_IN = [[0, 0.12], [0.06, 0.22], [0.12, 0.32]]
// The grain and vignette (GrainEffect), out over the planet and over the city
const GRAIN = { planet: { amount: 0.022, vignette: 0.4 }, city: { amount: 0.01, vignette: 0.12 } }
const DRIFT = { angle: MathUtils.degToRad(2.5), period: 40 }

export default defineComponent({
  name: 'PlanetScene',
});
</script>

<script lang="ts" setup>
const { camera, invalidate, scene } = useTres()
const renderer = useTres().renderer as WebGLRenderer

const textureDir = `${process.env.BASE_URL}${quality.textureDir}`
const textureLoader = new TextureLoader()
const [dayMap, bumpMap, cloudsMap, lightsMap] = await Promise.all(
  ['diffuse.jpg', 'spec-inverted.jpg', 'clouds.jpg', 'night-lights.jpg'].map(file => textureLoader.loadAsync(`${textureDir}${file}`)),
);
dayMap.colorSpace = SRGBColorSpace;
lightsMap.colorSpace = SRGBColorSpace;
const earth = createEarthMaterial({ map: dayMap, bumpMap, lightsMap });
const atmosphereMaterial = createAtmosphereMaterial(EARTH_POSITION);

const earthRef = shallowRef<Group>()
const cloudsRef = shallowRef<Mesh>()
const bloomRef = shallowRef<{ effect?: { luminanceMaterial: { threshold: number } } }>()
const planetRef = shallowRef<Group>()
const sunRef = shallowRef<DirectionalLight>()
const fillRef = shallowRef<PointLight>()
const grainRef = shallowRef<{ effect?: { uniforms: Map<string, { value: number }> } }>()
const veilRef = shallowRef<{ update(amount: number, travel: number, aspect: number): void }>()

const highlight = createHighlight()
const arcs = createArcs()
const belfastSign = createBelfastSign()
const cloudDeck = createCloudDeck(HOME_MARKER, {
  segments: quality.sphereSegments, slices: isMobile ? 8 : 14, size: isMobile ? 1024 : 2048,
})
const signPoint = new Vector3()
const parisArc = createParisArc()
// Where the clouds part, over the middle of Northern Ireland
const NORTHERN_IRELAND = onEarth(PLACES.northernIreland.lat, PLACES.northernIreland.lon)
const clouds = patchClouds()
const cloudCentre = new Vector3()
const nebula = createNebula(renderer, isMobile ? 1024 : 2048)
// Faintest first, as they fade in in that order (STARS_IN)
const starLayers = [
  { count: quality.starCounts[2], brightness: [0.16, 0.4], size: [1.6, 2.3], band: 0.75 },
  { count: quality.starCounts[1], brightness: [0.25, 0.7], size: [1.8, 2.6], band: 0.4 },
  { count: quality.starCounts[0], brightness: [0.5, 2], size: [2.2, 3.4] },
].map(layer => createStarLayer(layer as StarLayer, renderer.getPixelRatio()))
const shootingStar = createShootingStar(renderer)
onBeforeUnmount(() => {
  highlight.dispose()
  arcs.dispose()
  belfastSign.dispose()
  cloudDeck.dispose()
  parisArc.dispose()
  nebula.dispose()
  starLayers.forEach(layer => layer.dispose())
  shootingStar.dispose()
})

// Belfast loads in the background from Google's tiles once the planet has risen into view (if there's a key in the
// build), as setting it up takes long enough to stall a frame; at once if the site opened straight onto a stop, as
// there's no entrance to spoil. If they can't load, it's dropped and the clouds stay over the flight.
const isCityMounted = ref(false)
if (process.env.VUE_APP_GOOGLE_MAPS_API_KEY) {
  const stop = watch(() => route.isPlanetUp, isUp => {
    if (!isUp) return
    stop()
    setTimeout(() => (isCityMounted.value = true), route.isHeroUp ? ENTRANCE_DURATION * RISEN * 1000 : 0)
  })
}
const hasCityFailed = ref(false)

const setLens = (cam: PerspectiveCamera, fov: number, near: number) => {
  if (cam.fov === fov && cam.near === near) return
  cam.fov = fov
  cam.near = near
  cam.updateProjectionMatrix()
}

// Eases from 0 to 1 once the city has loaded, so if the clouds were holding for it they clear gently
let cityReveal = 0
const marker = new Vector3()
const surfaceUp = new Vector3()
const north = new Vector3()
const east = new Vector3()
const heading = new Vector3()
const approach = new Vector3()
const lookTarget = new Vector3()
const lookMatrix = new Matrix4()
const lookQuaternion = new Quaternion()
const overviewQuaternion = new Quaternion()
const offsetQuaternion = new Quaternion()
const trueNorth = new Vector3()
const X_AXIS = new Vector3(1, 0, 0)

/** Points `heading` `turn` radians east of `north`, and the camera along it, `pitch` radians above level. */
const aim = (cam: PerspectiveCamera, turn: number, pitch: number) => {
  east.crossVectors(north, surfaceUp)
  heading.copy(north).multiplyScalar(Math.cos(turn)).addScaledVector(east, Math.sin(turn))
  lookTarget.copy(cam.position)
    .addScaledVector(heading, Math.cos(pitch))
    .addScaledVector(surfaceUp, Math.sin(pitch))
  lookMatrix.lookAt(cam.position, lookTarget, surfaceUp)
  lookQuaternion.setFromRotationMatrix(lookMatrix)
}

/**
 * The descent from the whole planet down to Northern Ireland and into the clouds (see approachAt): looking at the
 * middle of the planet to start with, framed beside the title (to the right on wide screens, lower down on portrait
 * ones), then at Belfast, and at the end on over the horizon the way the first shot over the city looks.
 */
const glideFromOrbit = (cam: PerspectiveCamera, earthRotationY: number, progress: number, portrait: number) => {
  const { arc, height, aim: aimAbove, overview, turn, time } = approachAt(progress, portrait)
  const angle = MathUtils.degToRad(arc)
  surfaceUp.copy(HOME_UP).multiplyScalar(Math.cos(angle)).addScaledVector(HOME_AHEAD, Math.sin(angle))
    .applyAxisAngle(UP, earthRotationY)
  // `north` is along the great circle here, which aim() turns from
  north.copy(HOME_UP).multiplyScalar(-Math.sin(angle)).addScaledVector(HOME_AHEAD, Math.cos(angle))
    .applyAxisAngle(UP, earthRotationY)
  cam.position.copy(EARTH_POSITION).addScaledVector(surfaceUp, 1 + height)
  const horizon = Math.acos(1 / (1 + height))
  const arrival = poseOf(firstShot(), 0, performance.now() / 1000)
  const start = approachAt(0, portrait).height
  setLens(cam, glideFov(height, start, time, cityFov(arrival.zoom, cam.aspect)), PLANET_LENS.near)
  const first = turn > 0 ? MathUtils.degToRad(arrival.heading) : 0
  // Far out, looking at the horizon would be past straight down, where it'd flip right over. So it tilts up from
  // steeply down from the moment it sets off, and eases onto the horizon once it's close (the smooth larger of the
  // two, so it never tips back)
  const ahead = MathUtils.degToRad(aimAbove) - horizon
  const steep = lerp(-MAX_DOWN, -SETTLED_DOWN, time ** 1.5)
  aim(cam, turn * (first - APPROACH_BEARING), (ahead + steep + Math.hypot(ahead - steep, PITCH_KNEE)) / 2)
  // Belfast in the middle of the frame on the way down (always ahead, so it's never straight down), coming round to
  // that look as the clouds close in
  marker.copy(HOME_MARKER).applyAxisAngle(UP, earthRotationY).add(EARTH_POSITION)
  lookMatrix.lookAt(cam.position, marker, surfaceUp)
  cam.quaternion.setFromRotationMatrix(lookMatrix).slerp(lookQuaternion, smoothstep(clamp01((time - 0.65) / 0.35)))
  if (overview <= 0) return

  // The planet's middle, with its north up, turned off to the side of the title
  trueNorth.copy(UP).addScaledVector(surfaceUp, -surfaceUp.y).normalize()
  lookMatrix.lookAt(cam.position, EARTH_POSITION, trueNorth)
  overviewQuaternion.setFromRotationMatrix(lookMatrix)
  const halfWidth = Math.atan(Math.tan(MathUtils.degToRad(cam.fov / 2)) * cam.aspect)
  offsetQuaternion.setFromAxisAngle(UP, halfWidth * 0.42 * (1 - portrait))
  overviewQuaternion.multiply(offsetQuaternion)
  offsetQuaternion.setFromAxisAngle(X_AXIS, MathUtils.degToRad(cam.fov / 2) * 0.32 * portrait)
  overviewQuaternion.multiply(offsetQuaternion)
  cam.quaternion.slerp(overviewQuaternion, overview)
}

/**
 * Climbs from the clouds over Northern Ireland back out to the planet's framing by `dive` (1 → 0). It sets off
 * the way the camera climbs away from the city (CITY_ENDS), backwards and upwards, out to the view of Europe.
 */
const climbFromHome = (cam: PerspectiveCamera, earthRotationY: number, dive: number) => {
  marker.copy(HOME_MARKER).applyAxisAngle(UP, earthRotationY).add(EARTH_POSITION)
  surfaceUp.copy(marker).sub(EARTH_POSITION).normalize()
  north.copy(UP).addScaledVector(surfaceUp, -surfaceUp.y).normalize()
  const look = CITY_ENDS.end
  aim(cam, look.heading, look.pitch)
  approach.copy(marker).addScaledVector(surfaceUp, CLIMB.height).addScaledVector(heading, -CLIMB.behind)
  // Closing a constant fraction of the remaining distance with each step, like a steady climb
  cam.position.lerp(approach, (1 - CLIMB.ratio ** dive) / (1 - CLIMB.ratio))
  aim(cam, look.heading, look.pitch)
  // Tilted over the horizon until well clear of the clouds
  cam.quaternion.slerp(lookQuaternion, smoothstep(clamp01(dive / 0.75)))
}

// The sun (unseen): how far beyond the planet it is, and how far inside the limb it's kept (radians, as the camera sees
// it), so it's always behind the planet, lighting its edge
const SUN = { distance: 60, inside: 0.035 }
// Where the light on the planet's day side rests, and where it comes round from in the planet's entrance
const SUN_REST = SUN_DIRECTION.clone()
const sunPosition = new Vector3()
const towardsSun = new Vector3()
const toPlanet = new Vector3()
const cameraRight = new Vector3()
const cameraUp = new Vector3()
const offset = new Vector3()
const sunTurn = new Quaternion()
const sunTurned = new Quaternion()

/**
 * Keeps the sun behind the planet as the camera sees it, just inside its upper left limb (higher up on portrait
 * screens, where the planet's as wide as the screen), so it lights that edge from behind.
 */
const placeSun = (cam: PerspectiveCamera, portrait: number) => {
  toPlanet.subVectors(EARTH_POSITION, cam.position)
  const distance = toPlanet.length()
  const angle = Math.max(Math.asin(Math.min(1, 1 / distance)) - SUN.inside, 0)
  toPlanet.normalize()
  cameraRight.set(1, 0, 0).applyQuaternion(cam.quaternion)
  cameraUp.set(0, 1, 0).applyQuaternion(cam.quaternion)
  offset.copy(cameraRight).multiplyScalar(lerp(-0.8, -0.55, portrait)).addScaledVector(cameraUp, lerp(0.6, 0.85, portrait))
  offset.addScaledVector(toPlanet, -offset.dot(toPlanet)).normalize()
  sunPosition.copy(cam.position)
    .addScaledVector(toPlanet, Math.cos(angle) * (distance + SUN.distance))
    .addScaledVector(offset, Math.sin(angle) * (distance + SUN.distance))
  towardsSun.subVectors(sunPosition, EARTH_POSITION).normalize()
}

/**
 * The planet's entrance (see entranceAt): the camera starts lifted, so the planet is below the frame and rises into
 * it, its night side towards the camera with the sun behind it. As it does, the light on the planet comes round from
 * behind it to where it rests, sweeping the day across the disc (the city lights and the air's colours follow it, as
 * they're worked out from it), and the planet turns the last little way into place, on its axis the way it spins.
 * Returns how far round the light's come, and how far the planet has still to turn (radians).
 */
const revealPlanet = (cam: PerspectiveCamera, entrance: number) => {
  const { rise, sunrise } = entranceAt(entrance)
  if (rise < 1) {
    cam.translateY((1 - rise) * 3.4)
    cam.translateZ((1 - rise) * 1.5)
    cam.rotateZ((1 - rise) * ROLL)
  }
  return { sunrise, spin: (1 - rise) * -ENTRANCE_SPIN }
}

const driftTurn = new Quaternion()
const toCamera = new Vector3()
// The way to the rim nearest the sun, as the camera sees it
const glintDirection = new Vector3()
atmosphereMaterial.uniforms.uGlintDirection.value = glintDirection
/**
 * Sways the camera slowly round the planet once the entrance has settled (by `amount`, 0 → 1), turning with it so the
 * planet stays framed beside the title: the planet turns a little under it, and the stars and nebula slide past.
 */
const driftCamera = (cam: PerspectiveCamera, amount: number, elapsed: number) => {
  if (amount <= 0) return
  driftTurn.setFromAxisAngle(UP, DRIFT.angle * Math.sin((elapsed * Math.PI * 2) / DRIFT.period) * amount)
  cam.position.sub(EARTH_POSITION).applyQuaternion(driftTurn).add(EARTH_POSITION)
  cam.quaternion.premultiply(driftTurn)
}

/** Lights the planet from the sun (see placeSun), as far round to where it rests as `sunrise` (0 → 1). */
const lightPlanet = (sunrise: number) => {
  sunTurn.setFromUnitVectors(towardsSun, SUN_REST)
  SUN_DIRECTION.copy(towardsSun).applyQuaternion(sunTurned.identity().slerp(sunTurn, sunrise))
  sunRef.value?.position.copy(SUN_DIRECTION).multiplyScalar(145)
  if (fillRef.value) fillRef.value.intensity = FILL_LIGHT * lerp(0.12, 1, sunrise)
}

/**
 * Uploads the planet's textures and compiles its shaders before it comes into view. It's culled while it's below the
 * frame, so otherwise they'd go up on the first frame it's drawn, half way through its entrance, and stall it.
 */
let warmUp: Promise<void> | undefined
let isWarm = false
const warmPlanet = (cam: PerspectiveCamera) => {
  warmUp ??= (async () => {
    for (const texture of [dayMap, bumpMap, cloudsMap, lightsMap]) {
      renderer.initTexture(texture)
    }
    // The cloud deck over Belfast, with the sun as it is on the way down
    cloudDeck.bake(renderer, frameAt(windows.belfast[0], 0).earthRotationY)
    await warmShaders(renderer, scene.value, cam)
  })().catch(() => undefined).then(() => { isWarm = true })
}

const { onBeforeRender } = useLoop()

onBeforeRender(({ delta, elapsed }) => {
  tickDirector(delta)
  const progress = sceneState.progress
  const cam = camera.value as PerspectiveCamera | undefined
  if (!cam) return
  if (isWarm) playEntrance()
  else warmPlanet(cam)
  // Fully portrait framing on phones, partly on squarer screens such as portrait tablets
  const portrait = clamp01((1 - cam.aspect) / 0.55)

  // The clouds hide the switch between the planet and the city, and stay put if the city is still loading
  const isOverBelfast = isInBelfast(progress)
  const isInCity = isOverBelfast && sceneState.cityReady
  cityReveal = sceneState.cityReady ? damp(cityReveal, 1, 3, delta) : 0
  const veil = isOverBelfast ? Math.max(veilAt(progress), 1 - cityReveal) : veilAt(progress)
  if (planetRef.value) planetRef.value.visible = !isInCity
  parisArc.update(cityState.paris.draw, cityState.paris.opacity, isInCity)

  if (isInCity) {
    placeCamera(cam, cameraNudge.pose ?? cityPoseAt(), cam.aspect)
    setLens(cam, cam.fov, CITY_NEAR)
  } else {
    const frame = frameAt(progress, portrait)
    if (progress < windows.belfast[1]) {
      glideFromOrbit(cam, frame.earthRotationY, progress, portrait)
      // Swaying once the planet's up, and steadied again as the camera sets off
      if (!prefersReducedMotion) {
        const settled = smoothstep(clamp01((sceneState.entrance - RISEN) / (1 - RISEN)))
        driftCamera(cam, settled * (1 - smoothstep(clamp01(approachAt(progress).time / 0.3))), elapsed)
      }
    } else {
      setLens(cam, PLANET_LENS.fov, PLANET_LENS.near)
      cam.position.set(0, 0, frame.cameraZ)
      cam.rotation.set(frame.cameraRotationX, frame.cameraRotationY, 0)
      const dive = diveAt(progress)
      if (dive > 0) climbFromHome(cam, frame.earthRotationY, dive)
    }
    const { sunrise, spin } = revealPlanet(cam, sceneState.entrance)
    placeSun(cam, portrait)
    lightPlanet(sunrise)
    nebula.mesh.position.copy(cam.position)
    if (earthRef.value) earthRef.value.rotation.y = frame.earthRotationY + spin
    sceneState.earthRotationY = frame.earthRotationY + spin

    // The sun clearing the planet's edge as the light comes round, and the stars coming out, the faintest first
    const { entrance } = sceneState
    toCamera.subVectors(cam.position, EARTH_POSITION).normalize()
    const facing = SUN_DIRECTION.dot(toCamera)
    glintDirection.copy(SUN_DIRECTION).addScaledVector(toCamera, -facing).normalize()
    atmosphereMaterial.uniforms.uGlint.value = Math.exp(-(((entrance - GLINT.at) / GLINT.width) ** 2))
    starLayers.forEach(({ points, material }, i) => {
      const [from, to] = STARS_IN[i]
      material.uniforms.uOpacity.value = smoothstep(clamp01((entrance - from) / (to - from)))
      material.uniforms.uTime.value = elapsed
      points.position.copy(cam.position)
    })
    // Only once the stars are all out, and not in the clouds
    shootingStar.update(cam, delta, !prefersReducedMotion && entrance >= 1 && veil < 0.05)

    // Ambient motion
    const cloudSpin = -elapsed * 0.006
    if (cloudsRef.value) {
      cloudsRef.value.rotation.y = cloudSpin
      clouds.attach(cloudsRef.value.material as MeshBasicMaterial)
    }

    // Northern Ireland: cleared and outlined as the planet rises, then tinted and scanned on the way down
    const { cover, hole, draw, fill, scan, dim, opacity } = highlightAt(progress, sceneState.entrance, sceneState.traced)
    // The clouds turn on their own, so where they part is found in their own frame
    cloudCentre.copy(NORTHERN_IRELAND).applyAxisAngle(UP, -cloudSpin)
    clouds.update(cloudCentre, cover, hole)
    highlight.update(draw, fill, scan, opacity, dim)
    const reach = reachAt(progress)
    arcs.update(reach.amount, reach.opacity)
    // Belfast's sign, over Belfast and as far ahead as where the glide will be as it passes it, so it comes up as if
    // the camera were flying at it
    const { arc, height } = approachAt(SIGN_PASS, portrait)
    const angle = MathUtils.degToRad(arc)
    signPoint.copy(HOME_UP).multiplyScalar(Math.cos(angle)).addScaledVector(HOME_AHEAD, Math.sin(angle))
      .multiplyScalar(1 + height).applyAxisAngle(UP, frame.earthRotationY).add(EARTH_POSITION)
    const signDistance = cam.position.distanceTo(signPoint)
    signPoint.copy(HOME_MARKER).applyAxisAngle(UP, frame.earthRotationY).add(EARTH_POSITION)
    const sign = signAt(progress)
    belfastSign.update(cam, signPoint, signDistance, sign.enter, sign.opacity)
    cloudDeck.update(deckAt(progress), cam.position.distanceTo(EARTH_POSITION), elapsed)
  }

  // The journey streams the clouds past, and they drift a little on their own
  veilRef.value?.update(veil, progress * 24 + elapsed * 0.03, cam.aspect)
  if (bloomRef.value?.effect) bloomRef.value.effect.luminanceMaterial.threshold = bloomThresholdAt(progress)
  const grain = grainRef.value?.effect?.uniforms
  if (grain) {
    const { amount, vignette } = isInCity ? GRAIN.city : GRAIN.planet
    grain.get('amount')!.value = amount
    grain.get('vignette')!.value = vignette
  }
  updateOverlays(cam, progress, elapsed)

  invalidate()
})
</script>
