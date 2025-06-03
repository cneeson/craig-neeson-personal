<script lang="ts">
import { defineComponent, ref } from 'vue';
import { CineonToneMapping, LinearToneMapping, SRGBColorSpace } from 'three';

export default defineComponent({
  name: 'App',
});
</script>
<script lang="ts" setup>
import TresScene from './components/TresScene.vue';
import { TresCanvas } from '@tresjs/core'

const gl = {
  clearColor: '#090118',
  alpha: true,
  // outputColorSpace: SRGBColorSpace,
  // toneMapping: LinearToneMapping,
  shadows: true,
  powerPreference: "high-performance"
}

</script>

<template>
  <TresCanvas class="canvas" v-bind="gl">
    <Suspense>
      <TresScene/>
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
</style>
