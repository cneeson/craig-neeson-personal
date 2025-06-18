<template>
  <TresPerspectiveCamera :position="cameraPosition" :near="0.01" :aspect="2" :fov="35" />
  <TresDirectionalLight
    cast-shadow
    :position="[100, 100, -30]"
    :intensity=".8"
  />

  <!-- <TresMesh :position="[0, 1, -1000]" > 
    <TresPlaneGeometry :args="[1500, 1500]" />
    <TresMeshBasicMaterial
      :map="skyBoxTexture.map"
      :transparent="true"
      :opacity="0.05"
    />
  </TresMesh> -->

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
    :radius="100"
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
  
  <Html
      ref="nameHeroRef"
      center
      :position="[0, 1, 9]"
      :scale="[1, 1, 1]"
    >
      <Hero :is-visible="isNameHeroVisible" />
  </Html>

  <Suspense>
    <EffectComposerPmndrs>
      <BloomPmndrs
        :radius="0.01"
        :intensity="8.0"
        :luminance-threshold="0.1"
        :luminance-smoothing="0.3"
        :blend-function="BlendFunction.ADD"
        mipmap-blur
      />
      <SMAAPmndrs v-bind="{  preset: SMAAPreset.MEDIUM}" />
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
    <TresMesh :rotation-y="MathUtils.degToRad(310)" receive-shadow cast-shadow>
      <TresSphereGeometry :args="[1, 100, 100]" />
      <TresMeshStandardMaterial
        :map="earthTexture.map"
        :bump-map="earthTexture.displacementMap"
        :bump-scale="1"
        :metalness-map="earthTexture.metalnessMap"
        :roughness="1"
        :metalness="0.5"
      />
      <Outline :thickness="7" :opacity="0.01" color="#88b8f2" />
    </TresMesh>

    <TresMesh ref="earthCloudRef">
      <TresSphereGeometry :args="[1.01, 150, 150]" />
      <TresMeshBasicMaterial
        :alpha-map="earthCloudTexture.alphaMap"
        :transparent="true"
        :opacity="0.2"
      />
    </TresMesh>

    <TresPointLight
      ref="niHighlightRef"
      :position="[0.32, 0.81, 0.5]"
      color="white"
      cast-shadow
      :intensity="0"
      :decay="2"
    />

    <TresMesh ref="londonHighlightRef" :position="[0.4, 0.79, 0.49]" :visible="false"> 
      <TresSphereGeometry :args="[0.005, 16, 16]" />
      <TresMeshPhongMaterial color="purple"  />
    </TresMesh>

    <TresMesh ref="parisHighlightRef" :position="[0.48, 0.75, 0.49]" :visible="false"> 
      <TresSphereGeometry :args="[0.005, 16, 16]" />
      <TresMeshPhongMaterial color="purple"  />
    </TresMesh>

    <TresMesh ref="berlinHighlightRef" :position="[0.48, 0.8, 0.41]" :visible="false"> 
      <TresSphereGeometry :args="[0.005, 16, 16]" />
      <TresMeshPhongMaterial color="purple"  />
    </TresMesh>

    <TresMesh ref="madridHighlightRef" :position="[0.45, 0.65, 0.65]" :visible="false"> 
      <TresSphereGeometry :args="[0.005, 16, 16]" />
      <TresMeshPhongMaterial color="purple"  />
    </TresMesh>

     <TresMesh ref="romeHighlightRef" :position="[0.59, 0.68, 0.46]" :visible="false"> 
      <TresSphereGeometry :args="[0.005, 16, 16]" />
      <TresMeshPhongMaterial color="purple"  />
    </TresMesh>
  </TresGroup>

  <TresGroup ref="sunRef" :position="[-20, -11, -30]">
    <TresMesh :rotation-y="MathUtils.degToRad(270)" ref="godRaysRef">
      <TresSphereGeometry :args="[.5, 16, 16]" />
      <TresMeshStandardMaterial
        :metalness="0"
        :roughness="1"
        color="orange"
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
import { computed, defineComponent, nextTick } from 'vue';
import { ref, shallowRef, onMounted, ShallowRef, watchEffect } from 'vue'
import { TresInstance, useRenderLoop, useTexture, useTresContext } from '@tresjs/core'
import { Vector3, MathUtils, NormalBlending } from 'three'
import { Stars, Html, Outline } from '@tresjs/cientos'
import '@tresjs/leches/styles'
import { gsap, Linear } from "gsap";
import Hero from '../views/hero.vue'  
import { stages } from './stages';
// @ts-ignore-next-line
import { BloomPmndrs, EffectComposerPmndrs, BarrelBlurPmndrs, GodRaysPmndrs, SMAAPmndrs } from '@tresjs/post-processing'
// @ts-ignore-next-line
import { SMAAPreset, BlendFunction } from 'postprocessing'

// Note: textures CANNOT be loaded in the setup script
const earthTexture = await useTexture({
  map: '/textures/earth/diffuse.jpg',
  displacementMap: '/textures/earth/spec-inverted.jpg',
  metalnessMap: '/textures/earth/spec.jpg',
});

const skyBoxTexture = await useTexture({
  map: '/skybox/nebula.jpg',
});

const earthOceanTexture = await useTexture({
  displacementMap: '/textures/earth/water-bump.jpg',
});

const earthCloudTexture = await useTexture({
  alphaMap: '/textures/earth/clouds.jpg',
});

export default defineComponent({
  name: 'TresScene',
});
</script>

<script lang="ts" setup>

const { camera } = useTresContext()

const nameHeroRef = ref()
const earthGeometryRef = ref()
const earthOceanGeometryRef = ref()
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
const earthOceanRef: ShallowRef<TresInstance | null> = shallowRef(null)
const niHighlightRef: ShallowRef<TresInstance | null> = shallowRef(null)
const sunRef: ShallowRef<TresInstance | null> = shallowRef(null)
const starsRef: ShallowRef<TresInstance | null> = shallowRef(null)
const starsRef2: ShallowRef<TresInstance | null> = shallowRef(null)

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
      markers: {color: "white"}
    }
  })

  timeline.to(tubePerc, {
    percent: .96,
    ease: Linear.easeNone,
    duration: 10,
    onUpdate: function() {
      console.log(tubePerc.percent)
      scrollPercent.value = tubePerc.percent;
    }
  });

  timeline.add("fadeCanvas", 0.9)
    .to('canvas', {duration: 1.5, y: '-100vh'}, "fadeCanvas")
    .to('canvas', {duration: 1.5, filter: 'blur(40px)'}, "fadeCanvas");

    timeline.to('text1', {
    x: '100vh',
    duration: 1,
    ease: Linear.easeNone,
  })
})

const isLowPoly = computed(() => {
  console.log(scrollPercent.value > 0.086)
  return scrollPercent.value > 0.86;
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

  if (earthRef.value && camera.value && nameHeroRef.value.instance && sunRef.value) {
    currentStage?.actions({ 
      scrollPercent,
      renderLoop,
      camera,
      refs: { 
        text,
        fadeFactor,
        earth: earthRef, 
        sun: sunRef,
        earthCloud: earthCloudRef,
        stars: starsRef, 
        niHighlight: niHighlightRef,
        nameHero: nameHeroRef,
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
