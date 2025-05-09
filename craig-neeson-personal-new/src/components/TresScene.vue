<template>
    <TresPerspectiveCamera :position="cameraPosition" />
    <TresDirectionalLight
      cast-shadow
      :position="[1, 1, 10]"
      :intensity=".5"
    />

    <ScrollControls v-if="stage === Stage.ScrollToEarth" v-model="scrollToEarthProgress" :distance="0" :pages="1" />
    <ScrollControls v-if="stage === Stage.ScrollAroundEarth" v-model="scrollAroundEarthProgress" :distance="0" :pages="1" />

    <Stars
      :rotation="[0, 0, 0]"
      :radius="50"
      :depth="100"
      :count="20000"
      :size="0.3"
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
      <Text3D
        v-if="isLocationHeroVisible"
        text="I am a frontend developer based in Northern Ireland"
        :position="[0, 0, 9]"
        font="/fonts/Funnel_Display.json"
        :size="0.04"
        :height="0.01"
        :bevel-enabled=false
      >
        <TresMeshStandardMaterial />
      </Text3D>
    </Suspense>

    <Suspense>
      <Text3D
        v-if="isProjectLocationsHeroVisible"
        text="I have worked on projects serving customers in NI, Europe and the US"
        :position="[0, 0, 9]"
        font="/fonts/Funnel_Display.json"
        :size="0.04"
        :height="0.01"
        :bevel-enabled=false
      >
        <TresMeshStandardMaterial />
      </Text3D>
    </Suspense>

    <TresMesh ref="earthRef" receive-shadow :position="[0, -1.1, 9.5]">
      <TresSphereGeometry :args="[1, 32, 32]" />
      <TresMeshStandardMaterial
        :map="earthTexture.map"
      />
    </TresMesh>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { Euler, Vector3 } from 'three'
import { useControls } from '@tresjs/leches'
import LocationHero from './LocationHero.vue'

export enum Stage {
  Loading = 'loading',
  FocusEarth = 'focus-earth',
  ScrollToEarth = 'scroll-to-earth',
  ScrollAroundEarth = 'scroll-around-earth'
}

export default defineComponent({
  name: 'TresScene',
});
</script>

<script lang="ts" setup>
import { Box, Stars, OrbitControls, Html, FBXModel, ScrollControls, Text3D } from '@tresjs/cientos'
import { GodRaysPmndrs, EffectComposerPmndrs } from '@tresjs/post-processing'
import { TresCanvas, TresInstance, useLoop, useRenderLoop, useTexture, useTresContext } from '@tresjs/core'
import { ref, shallowRef, onMounted, useTemplateRef, ShallowRef } from 'vue'
import Hero, { totalTransitionDuration as totalHeroTransitionDuration } from '../views/hero.vue'  
import Earth from './Earth.vue'
import '@tresjs/leches/styles'

const earthTexture = await useTexture({
  map: '/textures/earth/diffuse_map.jpg',
})

const { camera } = useTresContext()

const stage = ref<Stage>(Stage.Loading)
const nameHeroRef = ref()
const cameraPosition = ref<Vector3>(new Vector3(0, 1, 10))

const isNameHeroVisible = ref(false);
const isLocationHeroVisible = ref(false);
const isProjectLocationsHeroVisible = ref(false);

const earthRef: ShallowRef<TresInstance | null> = shallowRef(null)
  
const scrollToEarthProgress = ref(0)
const scrollAroundEarthProgress = ref(0);

useControls('fpsgraph')

onMounted(() => {
  isNameHeroVisible.value = true;

  setTimeout(() => {
    stage.value = Stage.FocusEarth
  }, totalHeroTransitionDuration + 1000)
});

const { onBeforeRender } = useLoop()
const { onLoop } = useRenderLoop();

onLoop(({ elapsed }) => {
  switch (stage.value) {
    case Stage.Loading:
      break;
    case Stage.FocusEarth: {
      isNameHeroVisible.value = true;

      if (nameHeroRef.value.instance && camera.value && camera.value.position.y > 0) {
        // TODO need to lerp
        // TODO need to tilt slightly too
        camera.value.position.y = camera.value.position.y - (elapsed * 0.001);
        nameHeroRef.value.instance.position.y = nameHeroRef.value.instance.position.y - (elapsed * 0.001)
      } else {
        stage.value = Stage.ScrollToEarth
      }
      break;
    }
    case Stage.ScrollToEarth: {
      if (earthRef.value && camera.value) {
        earthRef.value.rotation.x = scrollToEarthProgress.value * 1.1
        earthRef.value.rotation.y = scrollToEarthProgress.value * 1.1

        camera.value.rotation.x = -scrollToEarthProgress.value * 0.25;
        camera.value.position.z = 10 + (scrollToEarthProgress.value * 0.5);

        isNameHeroVisible.value = scrollToEarthProgress.value < 0.5
        isLocationHeroVisible.value = scrollToEarthProgress.value > 0.8;
      }

      if (scrollToEarthProgress.value === 1) {
        stage.value = Stage.ScrollAroundEarth
      }
      break;
    }
    case Stage.ScrollAroundEarth: {
      if (earthRef.value && camera.value) {
        // TODO highlight NI when scroll at 0
        // TODO hide locationHero
        // TODO show projectLocationsHero
        // TODO need to allow transition back to previous stage

        // TODO instead of having two different text elements instead just reuse the same one and change the text
        // isLocationHeroVisible.value = scrollAroundEarthProgress.value < 0.15;
        isProjectLocationsHeroVisible.value = scrollAroundEarthProgress.value > 0.2;

        // TODO need to marry up the last rotation before switching from ScrollAroundEarth stage
        earthRef.value.rotation.x = scrollAroundEarthProgress.value * 1.1
        earthRef.value.rotation.y = scrollAroundEarthProgress.value * 1.1
      }

      break;
    }
  }
})

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.stage-selector {

}
</style>
