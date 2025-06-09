<template>
  <TresPerspectiveCamera :position="cameraPosition" :near="0.01" :aspect="2" :fov="35" />
  <TresDirectionalLight
    cast-shadow
    :position="[100, 100, -30]"
    :intensity="1.2"
  />

  <Stars
    ref="starsRef"
    :rotation="[0, 0, 0]"
    :radius="100"
    :depth="100"
    :count="20000"
    :size="0.15"
    color="red"
    :size-attenuation="true"
  />

  <Stars
    ref="starsRef2"
    :rotation="[1, 1, 1]"
    :radius="100"
    :depth="50"
    :count="2000"
    :size="0.25"
    :size-attenuation="true"
  />
  <!-- <ScreenSpace :depth="0.5">
    <Suspense>
      <Text3D
        v-if="text"
        :text="text"
        font="/fonts/Funnel_Display.json"
        :size="0.01"
        :height="0.005"
        :bevel-enabled=false
        need-updates
      >
        <TresMeshBasicMaterial />
      </Text3D>
    </Suspense>
  </ScreenSpace> -->
  
  <Html
      ref="nameHeroRef"
      center
      :position="[0, 1, 9]"
      :scale="[1, 1, 1]"
    >
      <Hero :is-visible="isNameHeroVisible" />
  </Html>

  <!-- <TresGridHelper :args="[10, 10]" :position="[0, -1.1, 9.5]" /> -->

  <Suspense>
    <EffectComposerPmndrs>
      <BloomPmndrs
        :radius="0.85"
        :intensity="5.0"
        :luminance-threshold="0.1"
        :luminance-smoothing="0.3"
        mipmap-blur
      />
      <NoisePmndrs
        premultiply
        :blend-function="BlendFunction.SCREEN"
      />
    </EffectComposerPmndrs>
  </Suspense>

  <TresGroup ref="earthRef" :position="[0, -1.1, 9.5]">
    <TresMesh :rotation-y="MathUtils.degToRad(310)" receive-shadow cast-shadow>
      <TresSphereGeometry :args="[1, 1000, 1000]" />
      <TresMeshStandardMaterial
        :map="earthTexture.map"
        :displacement-map="earthTexture.displacementMap"
        :displacement-bias="0"
        :displacement-scale="0.009"
        :metalness-map="earthTexture.metalnessMap"
        :roughness="1"
        :metalness="0.5"
      />
    </TresMesh>

    <TresMesh ref="earthOceanRef" :rotation-y="MathUtils.degToRad(275)" receive-shadow cast-shadow>
      <TresSphereGeometry :args="[1.0035, 1000, 1000]" />
      <TresMeshPhongMaterial
        color="#2e677a"
        :bump-map="earthOceanTexture.displacementMap"
        :bump-scale="0.1"
        :shininess="10"
        :blending="NormalBlending"
      />
    </TresMesh>

    <TresMesh ref="earthCloudRef">
      <TresSphereGeometry :args="[1.018, 32, 32]" />
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

  <Suspense>
    <GLTFModel ref="issRef" path="/models/iss/scene.gltf" draco :position="[-0.005, -0.05, 12]" :rotation-y="MathUtils.degToRad(20)" :rotation-x="MathUtils.degToRad(15)"  :scale="0.01" />
  </Suspense>

  <TresGroup :position="[0, -0.024, 12.4]">
    <Suspense>
      <Text3D
        ref="textRef"
        text="I have been fortunate enough to build products 
        for a range of global industries including:"
        font="/fonts/Funnel_Display.json"
        :size="0.005"
        :height="0.005"
        :bevel-enabled=false
        :look-at="camera?.position"
        :curve-segments="100"
      >
        <TresMeshNormalMaterial />
      </Text3D>
    </Suspense>
  </TresGroup>

  <TresGroup :position="[-0.02, -0.024, 12.9]"> 
    <TresMesh ref="industryHealthcare" :position="[0, 0.02, -0.001]"> 
      <TresSphereGeometry :args="[0.005, 16, 16]" />
      <TresMeshNormalMaterial  />
    </TresMesh>
    <Suspense>
      <Text3D
        text="Healthcare"
        font="/fonts/Funnel_Display.json"
        :size="0.005"
        :height="0.005"
        :bevel-enabled=false
        :look-at="camera?.position"
      >
        <TresMeshNormalMaterial />
      </Text3D>
    </Suspense>
  </TresGroup>

  <TresGroup ref="sunRef" :position="[-20, -10, -30]">
    <TresMesh :rotation-y="MathUtils.degToRad(270)">
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
import { defineComponent, nextTick } from 'vue';
import { ref, shallowRef, onMounted, ShallowRef, watchEffect } from 'vue'
import { TresInstance, useRenderLoop, useTexture, useTresContext } from '@tresjs/core'
import { Vector3, MathUtils, MultiplyBlending, Color, AdditiveBlending, NormalBlending } from 'three'
import { Stars, Html, ScreenSpace, Text3D, GLTFModel, MouseParallax } from '@tresjs/cientos'
import '@tresjs/leches/styles'
import { gsap, Linear } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import Hero from '../views/hero.vue'  
import { stages } from './stages';
// @ts-ignore-next-line
import { BlendFunction } from 'postprocessing'
// @ts-ignore-next-line
import { BloomPmndrs, EffectComposerPmndrs, Lensflare, NoisePmndrs } from '@tresjs/post-processing'

// Note: textures CANNOT be loaded in the setup script
const earthTexture = await useTexture({
  map: '/textures/earth/diffuse.jpg',
  displacementMap: '/textures/earth/spec-inverted.jpg',
  metalnessMap: '/textures/earth/spec.jpg',
});

const earthOceanTexture = await useTexture({
  displacementMap: '/textures/earth/water-bump.jpg',
});

const earthCloudTexture = await useTexture({
  alphaMap: '/textures/earth/clouds.jpg',
});

enum HeroText {
  RoleAndLocation = 'I am a frontend developer based in Northern Ireland',
  ProjectLocations = 'I have worked on projects serving customers in NI, Europe and the US',
}

export default defineComponent({
  name: 'TresScene',
});
</script>

<script lang="ts" setup>

gsap.registerPlugin(ScrollTrigger,ScrollSmoother);

const { camera } = useTresContext()

const nameHeroRef = ref()
const textRef = ref()
const londonHighlightRef = ref<TresInstance | null>(null)
const parisHighlightRef = ref<TresInstance | null>(null)
const berlinHighlightRef = ref<TresInstance | null>(null)
const madridHighlightRef = ref<TresInstance | null>(null)
const romeHighlightRef = ref<TresInstance | null>(null)
const cameraPosition = ref<Vector3>(new Vector3(0, 1, 10))
const issRef = ref<TresInstance | null>(null)

const text = defineModel<string>('text', { required: true });

const isNameHeroVisible = ref(false);
const earthRef: ShallowRef<TresInstance | null> = shallowRef(null)
const earthCloudRef: ShallowRef<TresInstance | null> = shallowRef(null)
const earthOceanRef: ShallowRef<TresInstance | null> = shallowRef(null)
const niHighlightRef: ShallowRef<TresInstance | null> = shallowRef(null)
const sunRef: ShallowRef<TresInstance | null> = shallowRef(null)
const starsRef: ShallowRef<TresInstance | null> = shallowRef(null)
const starsRef2: ShallowRef<TresInstance | null> = shallowRef(null)

const scrollPercent = ref(0);

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
      scrollPercent.value = tubePerc.percent;
    }
  });
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
    earthCloudRef.value.rotation.x = -(renderLoop.elapsed * 0.005)
  }

  // Actions related to the current stage
  const currentStage = stages.find(stage => scrollPercent.value >= stage.condition.from && scrollPercent.value <= stage.condition.to);

  if (earthRef.value && camera.value && nameHeroRef.value.instance && sunRef.value) {
    currentStage?.actions({ 
      renderLoop,
      camera,
      refs: { 
        text,
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
      scrollPercent
    });
  }
})

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.stage-selector {

}
</style>
