<template>
  <TresDirectionalLight :position="[100, 100, -30]" :intensity="0.8" />

  <!-- Three parallax layers of stars: near, medium, far -->
  <Stars ref="nearStarsRef" :radius="100" :depth="70" :count="quality.starCounts[0]" :size="0.5" />
  <Stars ref="midStarsRef" :rotation="[1, 1, 1]" :radius="250" :depth="100" :count="quality.starCounts[1]" :size="0.25" />
  <Stars :radius="450" :depth="400" :count="quality.starCounts[2]" :size="0.12" />

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

    <CityMarker ref="homeMarkerRef" :position="[0.23, 0.823, 0.54]" label="Northern Ireland" />

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
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, shallowRef, useTemplateRef } from 'vue';
import { Group, MathUtils, Mesh, PerspectiveCamera, SRGBColorSpace, Vector2 } from 'three'
import { useRenderLoop, useTexture, useTresContext } from '@tresjs/core'
import { Stars, Outline } from '@tresjs/cientos'
// @ts-ignore-next-line
import { BloomPmndrs, EffectComposerPmndrs } from '@tresjs/post-processing'
// @ts-ignore-next-line
import { BlendFunction } from 'postprocessing'
import CityMarker from './city-marker.vue'
import { isMobile, prefersReducedMotion, quality } from '@/services/device';
import { bloomThresholdAt, frameAt, windowOpacity, windows } from '@/scene/choreography';
import { sceneState } from '@/scene/state';
import { clamp01, damp } from '@/services/three';


const europeMarkers: { label: string, position: [number, number, number] }[] = [
  { label: 'UK', position: [0, 0, 0] },
  { label: 'France', position: [0.04, -0.05, 0.04] },
  { label: 'Germany', position: [0.13, -0.02, -0.06] },
  { label: 'Spain', position: [0.03, -0.16, 0.16] },
  { label: 'Italy', position: [0.21, -0.12, 0] },
];

type MarkerInstance = InstanceType<typeof CityMarker>;

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

const { onLoop } = useRenderLoop()

onLoop(({ delta, elapsed }) => {
  const isHidden = sceneState.exit >= 1
  if (isHidden && renderedFinalFrame) return
  renderedFinalFrame = isHidden

  const progress = sceneState.progress
  const cam = camera.value as PerspectiveCamera | undefined
  // Fully portrait framing on phones, partly on squarer screens such as portrait tablets
  const frame = frameAt(progress, cam ? clamp01((1 - cam.aspect) / 0.55) : 0)

  if (cam) {
    parallax.x = damp(parallax.x, pointer.x, 2, delta)
    parallax.y = damp(parallax.y, pointer.y, 2, delta)
    cam.position.x = parallax.x * 0.025
    cam.position.y = -parallax.y * 0.015
    cam.position.z = frame.cameraZ
    cam.rotation.x = frame.cameraRotationX
    cam.rotation.y = frame.cameraRotationY
  }
  if (earthRef.value) earthRef.value.rotation.y = frame.earthRotationY

  // Ambient motion
  if (nearStarsRef.value) nearStarsRef.value.instance.rotation.set(elapsed * 0.005, elapsed * 0.005, 0)
  if (midStarsRef.value) midStarsRef.value.instance.rotation.set(1 + elapsed * 0.003, 1 + elapsed * 0.003, 1)
  if (cloudsRef.value) cloudsRef.value.rotation.y = -elapsed * 0.006

  homeMarkerRef.value?.setOpacity(windowOpacity(progress, windows.northernIreland), 1, elapsed)
  const europeOpacity = windowOpacity(progress, windows.europe)
  europeMarkerRefs.value?.forEach(marker => marker.setOpacity(europeOpacity, 0.6, elapsed))

  if (!isOutlineSized) isOutlineSized = sizeOutline()
  if (bloomRef.value) bloomRef.value.effect.luminanceMaterial.threshold = bloomThresholdAt(progress)

  invalidate()
})
</script>
