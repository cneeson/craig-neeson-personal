<template>
  <TresPerspectiveCamera :position="cameraPosition" />
  <TresDirectionalLight
    cast-shadow
    :position="[100, 100, -30]"
    :intensity="1.2"
  />

  <Stars
    ref="starsRef"
    :rotation="[0, 0, 0]"
    :radius="50"
    :depth="100"
    :count="15000"
    :size="0.25"
    color="red"
    :size-attenuation="true"
  />

  <Stars
    ref="starsRef2"
    :rotation="[1, 1, 1]"
    :radius="50"
    :depth="50"
    :count="2000"
    :size="0.35"
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
    <!-- <Text3D
      v-if="heroText"
      :text="heroText"
      :position="[0, 0, 9]"
      font="/fonts/Funnel_Display.json"
      :size="0.04"
      :height="0.01"
      :bevel-enabled=false
      center
      need-updates
    >
      <TresMeshStandardMaterial />
    </Text3D> -->
  </Suspense>

  <TresGridHelper :args="[10, 10]" :position="[0, -1.1, 9.5]" />

  <Suspense>
      <EffectComposerPmndrs>
        <BloomPmndrs
          :radius="0.85"
          :intensity="5.0"
          :luminance-threshold="0.1"
          :luminance-smoothing="0.3"
          mipmap-blur
        />
      </EffectComposerPmndrs>
    </Suspense>

  <TresGroup ref="earthRef" :position="[0, -1.1, 9.5]">
    <TresMesh :rotation-y="MathUtils.degToRad(270)" receive-shadow cast-shadow>
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
      <TresSphereGeometry :args="[1.015, 64, 64]" />
      <TresMeshBasicMaterial
        :alpha-map="earthCloudTexture.alphaMap"
        :transparent="true"
        :opacity="0.2"
      />
    </TresMesh> 
  </TresGroup>

  <TresGroup :position="[-20, -10, -30]">
    <TresMesh ref="sunRef" :rotation-y="MathUtils.degToRad(270)">
      <TresSphereGeometry :args="[.25, 16, 16]" />
      <TresMeshStandardMaterial
        :metalness="0"
        :roughness="1"
        color="orange"
      />
    </TresMesh>
  </TresGroup>

  <TresPointLight
    :position="[-18, -5, -30]"
    color="orange"
    cast-shadow
    :intensity="10000"
    :decay="1"
  />

  <TresPointLight
    :position="[25, -5, -30]"
    color="#5198ed"
    cast-shadow
    :angle="1"
    :intensity="1000"
    :decay="1"
  />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { ref, shallowRef, onMounted, ShallowRef, watchEffect } from 'vue'
import { TresInstance, useRenderLoop, useTexture, useTresContext } from '@tresjs/core'
import { Vector3, MathUtils, MultiplyBlending, Color, AdditiveBlending, NormalBlending } from 'three'
import { Stars, Html } from '@tresjs/cientos'
import '@tresjs/leches/styles'
import { gsap, Linear } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import Hero from '../views/hero.vue'  
import { stages } from './stages';

// @ts-ignore-next-line
import { BloomPmndrs, EffectComposerPmndrs, Lensflare } from '@tresjs/post-processing'

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
const cameraPosition = ref<Vector3>(new Vector3(0, 1, 10))

const isNameHeroVisible = ref(false);
const earthRef: ShallowRef<TresInstance | null> = shallowRef(null)
const earthCloudRef: ShallowRef<TresInstance | null> = shallowRef(null)
const earthOceanRef: ShallowRef<TresInstance | null> = shallowRef(null)
const sunRef: ShallowRef<TresInstance | null> = shallowRef(null)
const starsRef: ShallowRef<TresInstance | null> = shallowRef(null)
const starsRef2: ShallowRef<TresInstance | null> = shallowRef(null)
// const heroText = ref<HeroText | undefined>(undefined);

onMounted(() => {
  isNameHeroVisible.value = true;
});

const scrollPercent = ref(0);

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

  if (earthRef.value && camera.value && nameHeroRef.value.instance) {
    currentStage?.actions({ 
      renderLoop,
      camera,
      refs: { 
        earth: earthRef, 
        earthCloud: earthCloudRef,
        stars: starsRef, 
        nameHero: nameHeroRef,
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
