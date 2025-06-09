<script lang="ts">
import { defineComponent, ref } from 'vue';
import { CineonToneMapping, LinearToneMapping, SRGBColorSpace } from 'three';

export default defineComponent({
  name: 'App',
});
</script>
<script lang="ts" setup>
import TresScene from './components/TresScene.vue';
import FloatingText from './components/floating-text.vue'  
import { TresCanvas } from '@tresjs/core'

const gl = {
  clearColor: '#090118',
  alpha: true,
  // outputColorSpace: SRGBColorSpace,
  // toneMapping: LinearToneMapping,
  shadows: true,
  powerPreference: "high-performance"
}

const text = ref(undefined);

</script>

<template>
  <div class="text-overlay">
    <FloatingText v-if="text" :text="text" />
  </div>
  <TresCanvas class="canvas" v-bind="gl">
    <Suspense>
      <TresScene v-model:text="text" />
  </Suspense>
  </TresCanvas>
  <div class="scrollTarget"></div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300..800&display=swap');

.hero {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
}

html, body {
  height: 100%;
  width: 100%;
}

#app {
  font-family: Funnel Display, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  height: 100vh;
  width: 100%;
}

.scrollTarget {
  position: absolute;
  height: 5000vh;
  width: 100px;
  top: 0;
  z-index: 0;
}

.canvas {
  position: fixed !important;
  width: 100%;
  height:100vh;
  top: 0;
  left: 0;
  z-index: 1;
}

.text-overlay {
  color: white;
  font-size: 2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 2rem;

  p {
    max-width: 80%;
  }

  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 50vh;
  z-index: 2;
}
</style>
