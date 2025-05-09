<template>
     <TresCanvas preset="realistic" :tone-mapping="NoToneMapping">
      <Stars
        :rotation="[0, yRotation, 0]"
        :radius="50"
        :depth="50"
        :count="15000"
        :size="0.3"
        :size-attenuation="true"
      />
      <TresPerspectiveCamera :position="[0, 0, 10]"  />
      <OrbitControls
        :enable-pan="false"
        :enable-rotate="false"
        :max-polar-angle="90"
      />
        <Html
          center
          transform
          :distance-factor="1"
          :position="[0, 0, 0.65]"
          :scale="[2, 2, 2]"
        >
          <Hero />
        </Html>
        <Suspense>
          <TresMesh receive-shadow>
            <TresSphereGeometry :args="[1, 32, 32]" />
            <!-- <TresMeshStandardMaterial
              :map="earthTexture.map"
            /> -->
            <TresShaderMaterial />
          </TresMesh>
        </Suspense>
        <!-- <Suspense>
          <TresMesh receive-shadow>
            <TresSphereGeometry :args="[1, 32, 32]" />
            <TresMeshStandardMaterial
              :map="earthTexture2.map"
              :transparent="true"
              :opacity="0.5"
            />
          </TresMesh>
        </Suspense> -->
        <!-- <TresDirectionalLight
          cast-shadow
          :position="[1, 1, -10]"
          :intensity="1"
        /> -->

        <TresMesh ref="sphereMeshRef" :position="[2, 1, -10]">
          <TresSphereGeometry :args="[0.5, 32, 32]" />
          <TresMeshBasicMaterial color="#FFDDAA" :transparent="true" />
        </TresMesh>

        <Suspense>
          <EffectComposerPmndrs>
            <GodRaysPmndrs
              v-bind="effectProps"
              :lightSource="sphereMeshRef"
            />
          </EffectComposerPmndrs>
        </Suspense>
        <TresGridHelper />
    </TresCanvas>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'TresScene',
});
</script>

<script lang="ts" setup>
import { Box, Stars, OrbitControls, Html, FBXModel } from '@tresjs/cientos'
import { GodRaysPmndrs, EffectComposerPmndrs } from '@tresjs/post-processing'
import { TresCanvas, useTexture } from '@tresjs/core'
import { ref, shallowRef } from 'vue'
import Hero from '../views/hero.vue'
import '@tresjs/leches/styles'
import { NoToneMapping } from 'three';

const effectProps = {
  opacity: .8,
  exposure: .8,
  resolutionScale: 0.65
}

const sphereMeshRef = ref(null)

const earthTexture = await useTexture({
  map: '/textures/earth/diffuse_map.jpg',

})

const earthTexture2 = await useTexture({
  map: '/textures/earth/clouds.jpg',
})
const yRotation = shallowRef(0)
// useRenderLoop().onLoop(({ delta }) => {
//   yRotation.value += 0.02 * delta
// })
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.stage-selector {

}
</style>
