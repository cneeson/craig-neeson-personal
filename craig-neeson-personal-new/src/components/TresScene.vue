<template>
  <TresPerspectiveCamera :position="cameraPosition" />
  <TresDirectionalLight
    cast-shadow
    :position="[1, 1, 10]"
    :intensity=".5"
  />

  <Stars
    ref="starsRef"
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

export enum Stage {
  FocusEarth = 'focus-earth',
  ScrollToEarth = 'scroll-to-earth',
  IntroduceNI = 'introduce-ni',
  ViewProjectLocations = 'view-project-locations'
}

interface StageActionOptions {
  renderLoop: RenderLoop;
  camera: ComputedRef<Camera>;
  refs: {
    earth: ShallowRef<TresInstance>;
    stars: ShallowRef<TresInstance>;
    nameHero: ShallowRef<TresInstance>;
  }
}

interface StageConfiguration {
  key: Stage,
  condition: {
    from: number,
    to: number
  },
  actions: (options: StageActionOptions) => void
}

enum HeroText {
  RoleAndLocation = 'I am a frontend developer based in Northern Ireland',
  ProjectLocations = 'I have worked on projects serving customers in NI, Europe and the US',
}

export default defineComponent({
  name: 'TresScene',
});
</script>

<script lang="ts" setup>
import { Camera, Vector3 } from 'three'
import { easeToTarget } from '@/services/three'
import { Stars, Html, Text3D } from '@tresjs/cientos'
import { RenderLoop, TresInstance, useRenderLoop, useTexture, useTresContext } from '@tresjs/core'
import { ref, shallowRef, onMounted, ShallowRef, watchEffect, ComputedRef } from 'vue'
import '@tresjs/leches/styles'
import { gsap, Linear } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import Hero from '../views/hero.vue'  

gsap.registerPlugin(ScrollTrigger,ScrollSmoother);

const earthTexture = await useTexture({
  map: '/textures/earth/diffuse_map.jpg',
})

const { camera } = useTresContext()

const nameHeroRef = ref()
const cameraPosition = ref<Vector3>(new Vector3(0, 1, 10))

const isNameHeroVisible = ref(false);
const earthRef: ShallowRef<TresInstance | null> = shallowRef(null)
const starsRef: ShallowRef<TresInstance | null> = shallowRef(null)
const heroText = ref<HeroText | undefined>(undefined);

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

const stages: StageConfiguration[] = [
  {
    key: Stage.FocusEarth,
    condition: {
      from: 0,
      to: 0.001
    },
    actions: ({ renderLoop: { elapsed }, camera }) => {
      isNameHeroVisible.value = true;

      if (camera.value.position.y > 0.001) {
        const options = {
          target: 0,
          elapsed,
          factor: 0.2
        };
        camera.value.position.y = easeToTarget({
          current: camera.value.position.y,
          ...options,
        });
        nameHeroRef.value.instance.position.y = easeToTarget({
          current: nameHeroRef.value.instance.position.y,
          ...options,
        });
      }
    }
  },
  {
    key: Stage.ScrollToEarth,
    condition: {
      from: 0.001,
      to: 0.015
    },
    actions: ({ camera, refs: { earth } }) => {
      earth.value.rotation.x = scrollPercent.value * 50
      earth.value.rotation.y = scrollPercent.value * 50

      camera.value.rotation.x = -scrollPercent.value * 25;
      camera.value.position.z = 10 + (scrollPercent.value * 50);

      isNameHeroVisible.value = scrollPercent.value < 0.0001
      heroText.value = undefined;
    }
  },
  {
    key: Stage.IntroduceNI,
    condition: {
      from: 0.015,
      to: 0.03
    },
    actions: ({ camera, refs: { earth } }) => {
      heroText.value = HeroText.RoleAndLocation;

      // TODO highlight NI on earth
    }
  },
  {
    key: Stage.ViewProjectLocations,
    condition: {
      from: 0.03,
      to: 0.05
    },
    actions: ({ camera, refs: { earth } }) => {
      if (scrollPercent.value > 0.012) {
        heroText.value = HeroText.ProjectLocations;
      } else {
        heroText.value = undefined;
      }

      earth.value.rotation.x = scrollPercent.value * 50
      earth.value.rotation.y = scrollPercent.value * 10

      camera.value.position.z = 10 + (scrollPercent.value * 50);
    }
  }
]

onLoop((renderLoop) => {
  const currentStage = stages.find(stage => scrollPercent.value >= stage.condition.from && scrollPercent.value <= stage.condition.to);

  if (earthRef.value && camera.value && nameHeroRef.value.instance) {
    currentStage?.actions({ 
      renderLoop,
      camera,
      refs: { 
        earth: earthRef, 
        stars: starsRef, 
        nameHero: nameHeroRef 
      } 
    });
  }
})

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.stage-selector {

}
</style>
