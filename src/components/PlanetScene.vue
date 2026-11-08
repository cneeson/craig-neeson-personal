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

    <TresGroup ref="earthRef" :position="[0, -1.1, 9.5]">
      <TresMesh :rotation-y="MathUtils.degToRad(300)">
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

      <CityMarker ref="homeMarkerRef" :position="[0.23, 0.823, 0.54]" label="Belfast" />

      <TresGroup :position="[0.3, 0.8, 0.54]">
        <CityMarker
          v-for="city in europeMarkers"
          :key="city.label"
          ref="europeMarkerRefs"
          :position="city.position"
          :label="city.label"
        />
      </TresGroup>
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
import { defineComponent, onBeforeUnmount, ref, shallowRef, useTemplateRef } from 'vue';
import { Group, MathUtils, Matrix4, Mesh, PerspectiveCamera, Quaternion, SRGBColorSpace, Vector2, Vector3 } from 'three'
import { useRenderLoop, useTexture, useTresContext } from '@tresjs/core'
import { Stars, Outline } from '@tresjs/cientos'
// @ts-ignore-next-line
import { BloomPmndrs, EffectComposerPmndrs } from '@tresjs/post-processing'
// @ts-ignore-next-line
import { BlendFunction } from 'postprocessing'
import CityMarker from './city-marker.vue'
import BelfastCity from './belfast-city.vue'
import BelfastPhoto from './belfast-photo.vue'
import CloudVeil from './cloud-veil.vue'
import { isMobile, prefersReducedMotion, quality } from '@/services/device';
import {
  bloomThresholdAt, diveAt, flightProgressAt, frameAt, isInBelfast, veilAt, windowOpacity, windows,
} from '@/scene/choreography';
import { sceneState } from '@/scene/state';
import { cityFovFor, flightAt, HEADING } from '@/scene/belfast/flight';
import { city } from '@/scene/belfast/mode';
import { clamp01, damp, lerp, smoothstep } from '@/services/three';


const europeMarkers: { label: string, position: [number, number, number] }[] = [
  { label: 'UK', position: [0, 0, 0] },
  { label: 'France', position: [0.04, -0.05, 0.04] },
  { label: 'Germany', position: [0.13, -0.02, -0.06] },
  { label: 'Spain', position: [0.03, -0.16, 0.16] },
  { label: 'Italy', position: [0.21, -0.12, 0] },
];

type MarkerInstance = InstanceType<typeof CityMarker>;

// Where the Northern Ireland marker sits on the (unrotated) earth, which the camera dives towards
const EARTH_POSITION = new Vector3(0, -1.1, 9.5)
const HOME_MARKER = new Vector3(0.23, 0.823, 0.54)
const UP = new Vector3(0, 1, 0)

// Field of view and near plane: narrow over the planet, wider (more so on portrait screens) over the city
const PLANET_LENS = { fov: 35, near: 0.01 }
const CITY_NEAR = 0.3

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
const bloomRef = shallowRef<{ effect: { luminanceMaterial: { threshold: number } } }>()
const outlineRef = shallowRef<{ instance: Group }>()
const planetRef = shallowRef<Group>()
const veilRef = shallowRef<{ update(amount: number, travel: number, aspect: number): void }>()
const homeMarkerRef = useTemplateRef<MarkerInstance>('homeMarkerRef')
const europeMarkerRefs = useTemplateRef<MarkerInstance[]>('europeMarkerRefs')

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

/**
 * Flies the camera down towards the Northern Ireland marker by `dive` (0 → 1), heading the way the flight
 * over the city goes. It ends up looking down along that heading with the horizon level, just as the
 * camera over the city starts: behind the marker on the way in, and ahead of it on the way out (where the
 * flight finished), so the climb back out never retraces the way in.
 */
const diveTowardsHome = (cam: PerspectiveCamera, earthRotationY: number, dive: number, isLeaving: boolean) => {
  marker.copy(HOME_MARKER).applyAxisAngle(UP, earthRotationY).add(EARTH_POSITION)
  surfaceUp.copy(marker).sub(EARTH_POSITION).normalize()
  north.copy(UP).addScaledVector(surfaceUp, -surfaceUp.y).normalize()
  east.crossVectors(north, surfaceUp)
  heading.copy(north).multiplyScalar(Math.cos(HEADING)).addScaledVector(east, Math.sin(HEADING))
  // Above the marker, looking down along the heading at the same angle as the ends of the flight (38.7°)
  approach.copy(marker).addScaledVector(surfaceUp, 0.02).addScaledVector(heading, isLeaving ? 0.025 : -0.025)
  cam.position.lerp(approach, dive)
  lookTarget.copy(approach).addScaledVector(surfaceUp, -0.02).addScaledVector(heading, 0.025)
  lookMatrix.lookAt(cam.position, lookTarget, surfaceUp)
  lookQuaternion.setFromRotationMatrix(lookMatrix)
  cam.quaternion.slerp(lookQuaternion, smoothstep(clamp01(dive * 2.5)))
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
    flightAt(flightProgressAt(progress), cam.position, cityTarget)
    cam.lookAt(cityTarget)
    cam.rotateY(-parallax.x * 0.04)
    cam.rotateX(-parallax.y * 0.025)
    setLens(cam, cityFovFor(cam.aspect), CITY_NEAR)
  } else {
    const frame = frameAt(progress, portrait)
    cam.position.set(parallax.x * 0.025, -parallax.y * 0.015, frame.cameraZ)
    cam.rotation.set(frame.cameraRotationX, frame.cameraRotationY, 0)
    const dive = diveAt(progress)
    if (dive > 0) diveTowardsHome(cam, frame.earthRotationY, dive, progress > windows.belfast[1])
    setLens(cam, PLANET_LENS.fov, PLANET_LENS.near)
    if (earthRef.value) earthRef.value.rotation.y = frame.earthRotationY

    // Ambient motion
    if (nearStarsRef.value) nearStarsRef.value.instance.rotation.set(elapsed * 0.005, elapsed * 0.005, 0)
    if (midStarsRef.value) midStarsRef.value.instance.rotation.set(1 + elapsed * 0.003, 1 + elapsed * 0.003, 1)
    if (cloudsRef.value) cloudsRef.value.rotation.y = -elapsed * 0.006

    homeMarkerRef.value?.setOpacity(windowOpacity(progress, windows.northernIreland), 1, elapsed)
    const europeOpacity = windowOpacity(progress, windows.europe)
    europeMarkerRefs.value?.forEach(europeMarker => europeMarker.setOpacity(europeOpacity, 0.6, elapsed))
    if (!isOutlineSized) isOutlineSized = sizeOutline()
  }

  // Scrolling streams the clouds past, and they drift a little on their own
  veilRef.value?.update(veil, progress * 24 + elapsed * 0.03, cam.aspect)
  if (bloomRef.value) bloomRef.value.effect.luminanceMaterial.threshold = bloomThresholdAt(progress, city.mode === 'photo')

  invalidate()
})
</script>
