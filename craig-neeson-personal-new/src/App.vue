<script lang="ts">
import { defineComponent, ref } from 'vue';
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import Skills from './views/skills.vue';
import Experience from './views/experience.vue';
import Contact from './views/contact.vue';

export default defineComponent({
  name: 'App',
});
gsap.registerPlugin(ScrollTrigger,ScrollSmoother);

</script>
<script lang="ts" setup>
import TresScene from './components/TresScene.vue';
import FloatingText from './components/floating-text.vue'  
import { TresCanvas } from '@tresjs/core'

const gl = {
  clearColor: '#090118',
  alpha: true,
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
  <div class="flat-plane">
    <Skills />
    <Experience />
    <Contact />
    <div class="text-white">Credits and attributions</div>
  </div>
  <div class="scrollTarget"></div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300..800&display=swap');

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

.flat-plane {
  position: relative;
  z-index: 1000;

  background: rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  @apply m-6;
  margin-top: 8000px;
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
