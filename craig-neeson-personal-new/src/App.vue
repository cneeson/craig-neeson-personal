<script lang="ts">
import { defineComponent, onMounted, ref, watchEffect } from 'vue';
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

onMounted(() => {
  ScrollSmoother.create({
    wrapper: "#smooth-wrapper",
    content: "#smooth-content",
    smooth: 1.5,
    effects: false,
    normalizeScroll: true,
  });
  let sections = gsap.utils.toArray(".section1, .section2, .section3");

  sections.forEach(section => {
    gsap.to(section, {
      x: 40,
      opacity: 1,
      ease: "power2.inOut",
      scrollTrigger: {
        trigger: section,
        start: 'top 90%',
        toggleActions: 'play reverse play reverse',
        markers: true
      }
    });
  });
});

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
  <div id="smooth-wrapper">
    <div id="smooth-content">
      <div class="flat-plane">
        <Skills class="mb-5 section1" />
        <Experience class="mb-5 section2"/>
        <Contact class="mb-5 section3" /> 
      </div>
    </div>
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

#smooth-wrapper {
  z-index: 1000;
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
  @apply mx-auto max-w-6xl;

  padding-top: 7600px;
  padding-bottom: 800px;
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

.section1, .section2, .section3 {
  opacity: 0;
}
</style>
