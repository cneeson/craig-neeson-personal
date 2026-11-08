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
    </EffectComposerPmndrs>
  </Suspense>

  <!-- Everything to do with the planet, hidden while flying over Belfast -->
  <TresGroup ref="planetRef">
    <TresDirectionalLight :position="[100, 100, -30]" :intensity="0.8" />

    <!-- Three parallax layers of stars: near, medium, far -->
    <Stars ref="nearStarsRef" :radius="100" :depth="70" :count="quality.starCounts[0]" :size="0.5" />
    <Stars ref="midStarsRef" :rotation="[1, 1, 1]" :radius="250" :depth="100" :count="quality.starCounts[1]" :size="0.25" />
    <Stars :radius="450" :depth="400" :count="quality.starCounts[2]" :size="0.12" />

    <TresGroup ref="earthRef" :position="EARTH_POSITION">
      <TresMesh :rotation-y="EARTH_MESH_ROTATION">
        <TresSphereGeometry :args="[1, quality.sphereSegments, quality.sphereSegments]" />
        <TresMeshStandardMaterial
          :map="earthTextures.map"
          :bump-map="earthTextures.displacementMap"
          :bump-scale="0.3"
        />
        <Outline ref="outlineRef" :thickness="7" :opacity="0.01" color="#88b8f2" />
      </TresMesh>

      <TresMesh ref="cloudsRef">
        <TresSphereGeometry :args="[1.01, quality.sphereSegments, quality.sphereSegments]" />
        <TresMeshBasicMaterial
          :alpha-map="earthTextures.alphaMap"
          :transparent="true"
          :opacity="0.2"
          :depth-write="false"
        />
      </TresMesh>

      <!-- Northern Ireland picked out from orbit, and the arcs out from Belfast after the city -->
      <primitive :object="highlight.object" />
      <primitive :object="arcs.object" />
    </TresGroup>

    <TresGroup :position="[-18, -11, -30]">
      <TresMesh>
        <TresSphereGeometry :args="[0.5, 16, 16]" />
        <TresMeshBasicMaterial color="orange" :transparent="true" :opacity="0.1" />
      </TresMesh>
      <TresPointLight :position="[2, 5, 0]" color="orange" :intensity="2500" :distance="50" :decay="0.5" />
    </TresGroup>

    <TresPointLight :position="[25, -5, -30]" color="#5198ed" :intensity="1000" :distance="80" :decay="1" />
  </TresGroup>

  <BelfastPhoto v-if="isCityMounted && cityMode === 'photo'" @failed="useNightCity" />
  <BelfastCity v-if="isCityMounted && cityMode === 'night'" />
  <CloudVeil ref="veilRef" />
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, ref, shallowRef } from 'vue';
import {
  Group, MathUtils, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Quaternion, SRGBColorSpace, Vector2, Vector3,
} from 'three'
import { useRenderLoop, useTexture, useTresContext } from '@tresjs/core'
import { Stars, Outline } from '@tresjs/cientos'
// @ts-ignore-next-line
import { BloomPmndrs, EffectComposerPmndrs } from '@tresjs/post-processing'
// @ts-ignore-next-line
import { BlendFunction } from 'postprocessing'
import BelfastCity from './belfast-city.vue'
import BelfastPhoto from './belfast-photo.vue'
import CloudVeil from './cloud-veil.vue'
import { isMobile, prefersReducedMotion, quality } from '@/services/device';
import {
  approachAt, bloomThresholdAt, diveAt, flightProgressAt, frameAt, highlightAt, isInBelfast, reachAt, veilAt, windows,
} from '@/scene/choreography';
import { sceneState } from '@/scene/state';
import { updateOverlays } from '@/scene/overlay';
import { createHighlight } from '@/scene/planet/highlight';
import { createArcs } from '@/scene/planet/arcs';
import { EARTH_MESH_ROTATION, EARTH_POSITION, onEarth, PLACES } from '@/scene/planet/geo';
import { patchClouds } from '@/scene/planet/clouds';
import { cityFovAt, FLIGHT_ENDS, flightAt } from '@/scene/belfast/flight';
import { city } from '@/scene/belfast/mode';
import { clamp01, damp, lerp, smoothstep } from '@/services/three';


// Where Belfast sits on the (unrotated) earth, which the camera dives towards
const HOME_MARKER = onEarth(PLACES.belfast.lat, PLACES.belfast.lon).multiplyScalar(1.01)
const UP = new Vector3(0, 1, 0)

// The glide from orbit follows a great circle through the marker, heading this far east of north (radians)
const APPROACH_BEARING = MathUtils.degToRad(25)
const HOME_UP = HOME_MARKER.clone().normalize()
// Along the great circle at the marker
const HOME_AHEAD = (() => {
  const north = UP.clone().addScaledVector(HOME_UP, -HOME_UP.y).normalize()
  const east = new Vector3().crossVectors(north, HOME_UP)
  return north.multiplyScalar(Math.cos(APPROACH_BEARING)).addScaledVector(east, Math.sin(APPROACH_BEARING))
})()

// Field of view and near plane: narrow over the planet, wider (more so on portrait screens) over the city
const PLANET_LENS = { fov: 35, near: 0.01 }
const CITY_NEAR = 0.3

// Where the climb out of the clouds starts: just above the planet's clouds (the marker sits on them), a little
// behind the marker. `ratio` sets the easing: about √ratio of the distance is left halfway through.
const CLIMB = { height: 0.008, behind: 0.012, ratio: 0.12 }

export default defineComponent({
  name: 'PlanetScene',
});
</script>

<script lang="ts" setup>
const { camera, invalidate, sizes } = useTresContext()

// A touch of parallax from the pointer on desktop, so the scene stays alive while at rest.
// Registered before the await below, while the component instance is still active for the cleanup.
const pointer = { x: 0, y: 0 }
const parallax = { x: 0, y: 0 }
const trackPointer = (event: PointerEvent) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = (event.clientY / window.innerHeight) * 2 - 1
}
if (!isMobile && !prefersReducedMotion) window.addEventListener('pointermove', trackPointer, { passive: true })
onBeforeUnmount(() => window.removeEventListener('pointermove', trackPointer))

const textureDir = `${process.env.BASE_URL}${quality.textureDir}`
// useTexture only accepts its own fixed keys, hence the bump map travelling as `displacementMap`
const earthTextures = await useTexture({
  map: `${textureDir}diffuse.jpg`,
  displacementMap: `${textureDir}spec-inverted.jpg`,
  alphaMap: `${textureDir}clouds.jpg`,
});
earthTextures.map.colorSpace = SRGBColorSpace;

const earthRef = shallowRef<Group>()
const cloudsRef = shallowRef<Mesh>()
const nearStarsRef = shallowRef<{ instance: Group }>()
const midStarsRef = shallowRef<{ instance: Group }>()
const bloomRef = shallowRef<{ effect?: { luminanceMaterial: { threshold: number } } }>()
const outlineRef = shallowRef<{ instance: Group }>()
const planetRef = shallowRef<Group>()
const veilRef = shallowRef<{ update(amount: number, travel: number, aspect: number): void }>()

const highlight = createHighlight()
const arcs = createArcs()
// Where the clouds part, over the middle of Northern Ireland
const NORTHERN_IRELAND = onEarth(PLACES.northernIreland.lat, PLACES.northernIreland.lon)
const clouds = patchClouds()
const cloudCentre = new Vector3()
onBeforeUnmount(() => {
  highlight.dispose()
  arcs.dispose()
})

// The scene is fully hidden behind the content once the exit transition completes, so
// rendering stops there. One extra frame is drawn on the way out so the final blurred
// backdrop matches where the camera ended up.
let renderedFinalFrame = false

// cientos' Outline sizes its rim in pixels but only learns the canvas size from later resizes,
// starting at 1×1. When the scene mounts after the canvas has settled (slower connections) the
// rim balloons to cover the whole screen, hiding the stars, so seed it with the real size once.
let isOutlineSized = false
const sizeOutline = () => {
  const rim = outlineRef.value?.instance.children[0] as (Mesh & { material: { size: Vector2 } }) | undefined
  if (!rim) return false
  rim.material.size.set(sizes.width.value, sizes.height.value)
  return true
}

// Belfast loads in the background once the planet is up: by day from Google's tiles, or the night city
const isCityMounted = ref(false)
setTimeout(() => (isCityMounted.value = true), 1500)
const cityMode = ref(city.mode)
const useNightCity = () => {
  city.mode = 'night'
  cityMode.value = 'night'
}

const setLens = (cam: PerspectiveCamera, fov: number, near: number) => {
  if (cam.fov === fov && cam.near === near) return
  cam.fov = fov
  cam.near = near
  cam.updateProjectionMatrix()
}

// Eases from 0 to 1 once the city has loaded, so if the clouds were holding for it they clear gently
let cityReveal = 0
const cityTarget = new Vector3()
const marker = new Vector3()
const surfaceUp = new Vector3()
const north = new Vector3()
const east = new Vector3()
const heading = new Vector3()
const approach = new Vector3()
const lookTarget = new Vector3()
const lookMatrix = new Matrix4()
const lookQuaternion = new Quaternion()

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
 * The glide from orbit down to Northern Ireland and into the clouds (see approachAt), looking north over the
 * horizon the whole way, then turning to the way the flight over the city starts out looking.
 */
const glideFromOrbit = (cam: PerspectiveCamera, earthRotationY: number, progress: number) => {
  const { arc, height, aim: aimAbove, turn } = approachAt(progress)
  const angle = MathUtils.degToRad(arc)
  surfaceUp.copy(HOME_UP).multiplyScalar(Math.cos(angle)).addScaledVector(HOME_AHEAD, Math.sin(angle))
    .applyAxisAngle(UP, earthRotationY)
  // `north` is along the great circle here, which aim() turns from
  north.copy(HOME_UP).multiplyScalar(-Math.sin(angle)).addScaledVector(HOME_AHEAD, Math.cos(angle))
    .applyAxisAngle(UP, earthRotationY)
  cam.position.copy(EARTH_POSITION).addScaledVector(surfaceUp, 1 + height)
  const horizon = Math.acos(1 / (1 + height))
  aim(cam, turn * (FLIGHT_ENDS.start.heading - APPROACH_BEARING), MathUtils.degToRad(aimAbove) - horizon)
  cam.quaternion.copy(lookQuaternion)
}

/**
 * Climbs from the clouds over Northern Ireland back out to the planet's framing by `dive` (1 → 0). It starts
 * from where the flight over the city finishes, so it carries on backwards and upwards, the way the flight
 * was going, out to the view of Europe.
 */
const climbFromHome = (cam: PerspectiveCamera, earthRotationY: number, dive: number) => {
  marker.copy(HOME_MARKER).applyAxisAngle(UP, earthRotationY).add(EARTH_POSITION)
  surfaceUp.copy(marker).sub(EARTH_POSITION).normalize()
  north.copy(UP).addScaledVector(surfaceUp, -surfaceUp.y).normalize()
  const look = FLIGHT_ENDS.end
  aim(cam, look.heading, look.pitch)
  approach.copy(marker).addScaledVector(surfaceUp, CLIMB.height).addScaledVector(heading, -CLIMB.behind)
  // Closing a constant fraction of the remaining distance with each step, like a steady climb
  cam.position.lerp(approach, (1 - CLIMB.ratio ** dive) / (1 - CLIMB.ratio))
  aim(cam, look.heading, look.pitch)
  // Tilted over the horizon until well clear of the clouds
  cam.quaternion.slerp(lookQuaternion, smoothstep(clamp01(dive / 0.75)))
}

const { onLoop } = useRenderLoop()

onLoop(({ delta, elapsed }) => {
  const isHidden = sceneState.exit >= 1
  if (isHidden && renderedFinalFrame) return
  renderedFinalFrame = isHidden

  const progress = sceneState.progress
  const cam = camera.value as PerspectiveCamera | undefined
  if (!cam) return
  // Fully portrait framing on phones, partly on squarer screens such as portrait tablets
  const portrait = clamp01((1 - cam.aspect) / 0.55)
  parallax.x = damp(parallax.x, pointer.x, 2, delta)
  parallax.y = damp(parallax.y, pointer.y, 2, delta)

  // The clouds hide the switch between the planet and the city, and stay put if the city is still loading
  const isOverBelfast = isInBelfast(progress)
  const isInCity = isOverBelfast && sceneState.cityReady
  cityReveal = sceneState.cityReady ? damp(cityReveal, 1, 3, delta) : 0
  const veil = isOverBelfast ? Math.max(veilAt(progress), 1 - cityReveal) : veilAt(progress)
  if (planetRef.value) planetRef.value.visible = !isInCity

  if (isInCity) {
    const flight = flightProgressAt(progress)
    flightAt(flight, cam.position, cityTarget)
    cam.lookAt(cityTarget)
    cam.rotateY(-parallax.x * 0.04)
    cam.rotateX(-parallax.y * 0.025)
    setLens(cam, cityFovAt(flight, cam.aspect), CITY_NEAR)
  } else {
    const frame = frameAt(progress, portrait)
    if (progress < windows.belfast[1]) {
      glideFromOrbit(cam, frame.earthRotationY, progress)
      cam.rotateY(-parallax.x * 0.02)
      cam.rotateX(-parallax.y * 0.012)
    } else {
      cam.position.set(parallax.x * 0.025, -parallax.y * 0.015, frame.cameraZ)
      cam.rotation.set(frame.cameraRotationX, frame.cameraRotationY, 0)
      const dive = diveAt(progress)
      if (dive > 0) climbFromHome(cam, frame.earthRotationY, dive)
    }
    setLens(cam, PLANET_LENS.fov, PLANET_LENS.near)
    if (earthRef.value) earthRef.value.rotation.y = frame.earthRotationY
    sceneState.earthRotationY = frame.earthRotationY

    // Ambient motion
    if (nearStarsRef.value) nearStarsRef.value.instance.rotation.set(elapsed * 0.005, elapsed * 0.005, 0)
    if (midStarsRef.value) midStarsRef.value.instance.rotation.set(1 + elapsed * 0.003, 1 + elapsed * 0.003, 1)
    const cloudSpin = -elapsed * 0.006
    if (cloudsRef.value) {
      cloudsRef.value.rotation.y = cloudSpin
      clouds.attach(cloudsRef.value.material as MeshBasicMaterial)
    }

    // Northern Ireland: thick cloud over it, parting, then its outline traced and scanned
    const { cover, hole, draw, fill, scan, opacity } = highlightAt(progress)
    // The clouds turn on their own, so where they part is found in their own frame
    cloudCentre.copy(NORTHERN_IRELAND).applyAxisAngle(UP, -cloudSpin)
    clouds.update(cloudCentre, cover, hole)
    highlight.update(draw, fill, scan, opacity)
    const reach = reachAt(progress)
    arcs.update(reach.amount, reach.opacity)
    if (!isOutlineSized) isOutlineSized = sizeOutline()
  }

  // Scrolling streams the clouds past, and they drift a little on their own
  veilRef.value?.update(veil, progress * 24 + elapsed * 0.03, cam.aspect)
  if (bloomRef.value?.effect) bloomRef.value.effect.luminanceMaterial.threshold = bloomThresholdAt(progress, city.mode === 'photo')
  updateOverlays(cam, progress, elapsed)

  invalidate()
})
</script>
