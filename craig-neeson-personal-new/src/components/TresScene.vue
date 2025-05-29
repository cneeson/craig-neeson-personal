<template>
  <TresPerspectiveCamera :position="cameraPosition" />
  <TresDirectionalLight
    cast-shadow
    :position="[100, 100, -30]"
    :intensity="2"
  />

  <EffectComposerPmndrs>
    <BloomPmndrs
      :radius=".85"
      :intensity="2.0"
      :luminance-threshold="0.1"
      :luminance-smoothing="0.3"
      mipmap-blur
    />
    <!-- <NoisePmndrs
      premultiply
      :blend-function="BlendFunction.SCREEN"
    /> -->
  </EffectComposerPmndrs>
  <TresAxesHelper :scale="2" />
  <Stars
    ref="starsRef"
    :rotation="[0, 0, 0]"
    :radius="50"
    :depth="100"
    :count="15000"
    :size="0.25"
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

  <TresGroup ref="earthRef" :position="[0, -1.1, 9.5]">
    <TresMesh :rotation-y="MathUtils.degToRad(270)" >
      <TresSphereGeometry :args="[1, 64, 64]" />
      <TresMeshStandardMaterial
        :map="earthTexture.map"
        :displacement-map="earthTexture.displacementMap"
        :displacement-scale="0.01"
        :metalness-map="earthTexture.metalnessMap"
        :metalness="1.2"
        :roughness="0.5"
      />
    </TresMesh>

    <TresMesh ref="earthCloudRef">
      <TresSphereGeometry :args="[1.01, 64, 64]" />
      <TresMeshStandardMaterial
        :alpha-map="earthCloudTexture.alphaMap"
        :transparent="true"
        :opacity="0.5"
      />
    </TresMesh>

    <TresMesh>
      <TresSphereGeometry :args="[1.01, 64, 64]" />
      <TresShaderMaterial :transparent="true" opacity="0.5" :vertex-shader="vertexShader" :fragment-shader="fragmentShader" :uniforms="uniforms" />
    </TresMesh>
    
  </TresGroup>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { ref, shallowRef, onMounted, ShallowRef, watchEffect, ComputedRef } from 'vue'
import { RenderLoop, TresInstance, useRenderLoop, useTexture, useTresContext } from '@tresjs/core'
import { Camera, Vector3, Vector2, MathUtils, AdditiveBlending, SubtractiveBlending, MultiplyBlending } from 'three'
import { easeToTarget } from '@/services/three'
import { Stars, Html, Text3D, Outline } from '@tresjs/cientos'
import '@tresjs/leches/styles'
import { gsap, Linear } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import Hero from '../views/hero.vue'  
// @ts-ignore-next-line
import { BloomPmndrs, EffectComposerPmndrs, NoisePmndrs, GodRaysPmndrs } from '@tresjs/post-processing'
// @ts-ignore-next-line
import { BlendFunction } from 'postprocessing'

// Note: texture CANNOT be loaded in the setup script
const earthTexture = await useTexture({
  map: '/textures/earth/diffuse.jpg',
  displacementMap: '/textures/earth/bump.jpg',
  metalnessMap: '/textures/earth/spec.jpg',
});

const earthCloudTexture = await useTexture({
  alphaMap: '/textures/earth/clouds.jpg',
});

const uniforms = {
}

const fragmentShader = `
varying vec3 vNormal;
void main() {
  float intensity = pow( 0.8 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 12.0 );
  gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 ) * intensity;
}
`

const vertexShader = `
varying vec3 vNormal;
void main() {
  vNormal = normalize( normalMatrix * normal );
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`

// const vertexShader = `
// uniform vec2 uAmplitude;
// uniform vec2 uFrequency;
// uniform float uTime;

// varying vec2 vUv;

// void main() {
//     vec4 modelPosition = modelMatrix * vec4(position, 1.0);
//     modelPosition.y += sin(modelPosition.x * uFrequency.x - uTime) * uAmplitude.x;
//     modelPosition.x += cos(modelPosition.y * uFrequency.y - uTime) * uAmplitude.y;

//     vec4 viewPosition = viewMatrix * modelPosition;
//     gl_Position = projectionMatrix * viewPosition;
//     vUv = uv;
// }
// `

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
    earthCloud: ShallowRef<TresInstance>;
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

gsap.registerPlugin(ScrollTrigger,ScrollSmoother);



const { camera } = useTresContext()

const nameHeroRef = ref()
const cameraPosition = ref<Vector3>(new Vector3(0, 1, 10))

const isNameHeroVisible = ref(false);
const earthRef: ShallowRef<TresInstance | null> = shallowRef(null)
const earthCloudRef: ShallowRef<TresInstance | null> = shallowRef(null)
const starsRef: ShallowRef<TresInstance | null> = shallowRef(null)
const starsRef2: ShallowRef<TresInstance | null> = shallowRef(null)
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
    actions: ({ camera, refs: { earth, earthCloud }, renderLoop: { elapsed } }) => {
      // earth.value.rotation.x = scrollPercent.value * 50
      // earth.value.rotation.y = scrollPercent.value * 50
      
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


      // earth.value.rotation.x = scrollPercent.value * 10
      // earth.value.rotation.y = scrollPercent.value * 10

      camera.value.position.z = 10 + (scrollPercent.value * 50);

      // TODO highlight NI on earth
    }
  },
  {
    key: Stage.ViewProjectLocations,
    condition: {
      from: 0.03,
      to: 0.04
    },
    actions: ({ camera, refs: { earth } }) => {
      if (scrollPercent.value > 0.012) {
        heroText.value = HeroText.ProjectLocations;
      } else {
        heroText.value = undefined;
      }

      // earth.value.rotation.x = scrollPercent.value * 10
      // earth.value.rotation.y = scrollPercent.value * 50
    }
  }
]

onLoop((renderLoop) => {
  // Actions that should occur regardless of the current stage
  if (starsRef.value) {
    starsRef.value.instance.rotation.y = renderLoop.elapsed * 0.005
    starsRef.value.instance.rotation.x = renderLoop.elapsed * 0.005
    starsRef2.value.instance.rotation.y = renderLoop.elapsed * 0.003;
    starsRef2.value.instance.rotation.x = renderLoop.elapsed * 0.003;
  }

  if (earthCloudRef.value) {
    earthCloudRef.value.rotation.x = renderLoop.elapsed * 0.01
    earthCloudRef.value.rotation.y = renderLoop.elapsed * 0.01
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
