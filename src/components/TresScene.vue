<template>
  <TresPerspectiveCamera :position="cameraPosition" :near="0.01" :aspect="2" :fov="35" />
  <TresDirectionalLight
    cast-shadow
    :position="[100, 100, -30]"
    :intensity=".8"
  />

  <!-- Near -->
  <Stars
    ref="starsRef"
    :rotation="[0, 0, 0]"
    :radius="100"
    :depth="70"
    :count="500"
    :size=".5"
    :size-attenuation="true"
  />

  <!-- Medium -->
  <Stars
    ref="starsRef2"
    :rotation="[1, 1, 1]"
    :radius="250"
    :depth="100"
    :count="3000"
    :size="0.25"
    :size-attenuation="true"
  />

  <Stars
    :rotation="[0, 0, 0]"
    :radius="1000"
    :depth="1000"
    :count="50000"
    :size="0.05"
    :size-attenuation="true"
  />

  <Suspense>
    <EffectComposerPmndrs>
      <BloomPmndrs
        :radius="0.01"
        :intensity="8.0"
        :luminance-threshold="isLowBloom ? 0.3 : .9"
        :luminance-smoothing="0.3"
        :blend-function="BlendFunction.ADD"
        mipmap-blur
      />
      <GodRaysPmndrs
          v-bind="{
            opacity: 1,
            exposure: .6,
            resolutionScale: 0.5
          }"
          :lightSource="godRaysRef"
        />
    </EffectComposerPmndrs>
  </Suspense>

  <TresGroup ref="earthRef" :position="[0, -1.1, 9.5]">
    <TresMesh :rotation-y="MathUtils.degToRad(300)" receive-shadow cast-shadow>
      <TresSphereGeometry :args="[1, 100, 100]" />
      <TresMeshStandardMaterial
        :map="earthTexture.map"
        :bump-map="earthTexture.displacementMap"
        :bump-scale="1"
      />
      <Outline :thickness="7" :opacity="0.01" color="#88b8f2" />
    </TresMesh>

    <TresMesh ref="earthCloudRef">
      <TresSphereGeometry :args="[1.01, 100, 100]" />
      <TresMeshBasicMaterial
        :alpha-map="earthCloudTexture.alphaMap"
        :transparent="true"
        :opacity="0.2"
      />
    </TresMesh>
    <CityMarker ref="niHighlightRef" :position="[0.23, .823, 0.54]" label="Northern Ireland" />

    <TresGroup :position="[0.3, 0.8, 0.54]" >
      <CityMarker ref="londonHighlightRef" :position="[0, 0, 0]" label="UK" />
      <CityMarker ref="parisHighlightRef" :position="[0.04, -0.05, 0.04]" label="France" />
      <CityMarker ref="berlinHighlightRef" :position="[0.13, -0.02, -0.06]" label="Germany" />
      <CityMarker ref="madridHighlightRef" :position="[0.03, -0.16, 0.16]" label="Spain" />
      <CityMarker ref="romeHighlightRef" :position="[0.21, -0.12, 0]" label="Italy" />
    </TresGroup>
  </TresGroup>

  <TresGroup ref="sunRef" :position="[-18, -11, -30]">
    <TresMesh :rotation-y="MathUtils.degToRad(270)" ref="godRaysRef">
      <TresSphereGeometry :args="[.5, 16, 16]" />
      <TresMeshStandardMaterial
        :metalness="0"
        :roughness="1"
        color="orange"
        :transparent="true"
        :opacity="0.1"
      />
    </TresMesh>
    <TresPointLight
      :position="[2, 5, 0]"
      color="orange"
      cast-shadow
      :intensity="2500"
      :distance="50"
      :decay="0.5"
    />
  </TresGroup>

  <TresPointLight
    :position="[25, -5, -30]"
    color="#5198ed"
    cast-shadow
    :angle="1"
    :intensity="1000"
    :distance="80"
    :decay="1"
  />
</template>

<script lang="ts">
import { defineComponent, nextTick, useTemplateRef } from 'vue';
import { ref, shallowRef, onMounted, ShallowRef, watchEffect } from 'vue'
import { TresInstance, useRenderLoop, useTexture, useTresContext } from '@tresjs/core'
import { Vector3, MathUtils } from 'three'
import { Stars, Outline } from '@tresjs/cientos'
import '@tresjs/leches/styles'
import { gsap, Linear } from "gsap";
import { stages } from './stages';
// @ts-ignore-next-line
import { BloomPmndrs, EffectComposerPmndrs, GodRaysPmndrs } from '@tresjs/post-processing'
// @ts-ignore-next-line
import { BlendFunction } from 'postprocessing'
import CityMarker from './city-marker.vue'

// Note: textures CANNOT be loaded in the setup script
const earthTexture = await useTexture({
  map: `${process.env.BASE_URL}textures/earth/diffuse.jpg`,
  displacementMap: `${process.env.BASE_URL}textures/earth/spec-inverted.jpg`,
});

const earthCloudTexture = await useTexture({
  alphaMap: `${process.env.BASE_URL}textures/earth/clouds.jpg`,
});

export default defineComponent({
  name: 'TresScene',
});
</script>

<script lang="ts" setup>

const { camera } = useTresContext()

const londonHighlightRef = ref<TresInstance | null>(null)
const parisHighlightRef = ref<TresInstance | null>(null)
const berlinHighlightRef = ref<TresInstance | null>(null)
const madridHighlightRef = ref<TresInstance | null>(null)
const romeHighlightRef = ref<TresInstance | null>(null)
const cameraPosition = ref<Vector3>(new Vector3(0, 1, 10))

const text = defineModel<string>('text', { required: true });

const isNameHeroVisible = ref(false);
const earthRef: ShallowRef<TresInstance | null> = shallowRef(null)
const godRaysRef: ShallowRef<TresInstance | null> = shallowRef(null)
const earthCloudRef: ShallowRef<TresInstance | null> = shallowRef(null)
const niHighlightRef: ShallowRef<TresInstance | null> = useTemplateRef('niHighlightRef')
const sunRef: ShallowRef<TresInstance | null> = shallowRef(null)
const starsRef: ShallowRef<TresInstance | null> = shallowRef(null)
const starsRef2: ShallowRef<TresInstance | null> = shallowRef(null)
const isLowBloom: ShallowRef<boolean> = shallowRef(true)

const scrollPercent = ref(0);
const fadeFactor = ref(0);

onMounted(() => {
  nextTick(() => {
    // Always reset scroll position
    window.scrollTo(0,0);
  })

  isNameHeroVisible.value = true;
});

watchEffect(() => {
  var tubePerc = {
    percent: 0
  }

  const timeline = gsap.timeline({
    scrollTrigger: {
      trigger: ".scrollTarget",
      start: "top top",
      end: "bottom 100%",
      scrub: 2,
    }
  })

  timeline.to(tubePerc, {
    percent: .96,
    ease: Linear.easeNone,
    duration: 10,
    onUpdate: function() {
      const speedFactor = 0.6;
      scrollPercent.value = tubePerc.percent * speedFactor;
    },
    yoyo: true,
  });

  timeline.add("fadeHero", 0.001)
    .to('.hero-content', {duration: 0.05, filter: 'blur(40px)'}, "fadeHero")
    .to('.hero-content', {duration: 0.05, opacity: 0}, "fadeHero");

  const hideTween = { duration: 0.03, filter: 'blur(40px)', opacity: 0, display: 'none' };
  const showTween = { duration: 0.03, filter: 'blur(0px)', opacity: 1, display: 'block' };

  timeline.add("startNI", 0.245)
    .fromTo('[data-floating-text="1"]', hideTween, showTween, "startNI")
  timeline.add("endNi", 0.34)
    .fromTo('[data-floating-text="1"]', showTween, hideTween, "endNi")

  timeline.add("startProjects", 0.49)
    .fromTo('[data-floating-text="2"]', hideTween, showTween, "startProjects")
  timeline.add("endProjects", 0.7)
    .fromTo('[data-floating-text="2"]', showTween, hideTween, "endProjects")

  timeline.add("fadeCanvas", 1.1)
    .to('canvas', {duration: 1.5, filter: 'blur(40px)'}, "fadeCanvas");

  timeline.add("moveCanvas", 1.5)
    .to('canvas', {duration: 4, y: '-50vh', }, "moveCanvas")
})

const { onLoop } = useRenderLoop();

onLoop((renderLoop) => {
  // Actions that should occur regardless of the current stage
  if (starsRef.value) {
    starsRef.value.instance.rotation.y = renderLoop.elapsed * 0.005
    starsRef.value.instance.rotation.x = renderLoop.elapsed * 0.005
    if (starsRef2.value) {
      starsRef2.value.instance.rotation.y = renderLoop.elapsed * 0.003;
      starsRef2.value.instance.rotation.x = renderLoop.elapsed * 0.003;
    }
  }

  if (earthCloudRef.value) {
    earthCloudRef.value.rotation.y = -(renderLoop.elapsed * 0.005)
    earthCloudRef.value.rotation.x = 90 + -(renderLoop.elapsed * 0.005)
  }

  // Actions related to the current stage
  const currentStage = stages.find(stage => scrollPercent.value >= stage.condition.from && scrollPercent.value <= stage.condition.to);

  if (earthRef.value && camera.value && sunRef.value) {
    currentStage?.actions({ 
      scrollPercent,
      renderLoop,
      camera,
      refs: { 
        isLowBloom,
        text,
        fadeFactor,
        earth: earthRef, 
        sun: sunRef,
        earthCloud: earthCloudRef,
        stars: starsRef, 
        niMarker: niHighlightRef,
        cityRefs: {
          london: londonHighlightRef,
          paris: parisHighlightRef,
          berlin: berlinHighlightRef,
          madrid: madridHighlightRef,
          rome: romeHighlightRef,
        },
        isNameHeroVisible: isNameHeroVisible,
      },
    });
  }
})
</script>
