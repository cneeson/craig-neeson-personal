<script lang="ts">
import { defineComponent, onMounted, ref, watchEffect } from 'vue';
import { gsap } from "gsap";
import { Observer } from 'gsap/Observer';
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import Skills from './views/skills.vue';
import Experience from './views/experience.vue';
import Contact from './views/contact.vue';
import Footer from './views/footer.vue';
import Hero from './views/hero.vue'  

export default defineComponent({
  name: 'App',
});
gsap.registerPlugin(ScrollTrigger,ScrollSmoother,Observer);

</script>
<script lang="ts" setup>
import TresScene from './components/TresScene.vue';
import FloatingText from './components/floating-text.vue'  
import { TresCanvas } from '@tresjs/core'

const gl = {
  clearColor: '#090118',
  alpha: true,
  shadows: true,
  powerPreference: "high-performance",
  stencil: true
}

onMounted(() => {
  ScrollSmoother.create({
    wrapper: "#smooth-wrapper",
    content: "#smooth-content",
    smooth: 1.5,
    effects: false,
    normalizeScroll: true,
  });
  let sections = gsap.utils.toArray(".section1, .section3");

  sections.forEach(section => {
    gsap.to(section, {
      x: 0,
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

    <p class="floating-text lg:max-w-[600px]" data-floating-text="1">
        <span class="block mb-4">Hi, I'm <span class="font-bold">Craig.</span> 👋</span>
        I am a frontend developer based in <span class="font-bold">Northern Ireland.</span>
    </p>
    <p class="floating-text max-w-[100vw] lg:max-w-[60vw]" data-floating-text="2">
      For <span class="font-bold">8 years</span> I have worked with
      companies across <span class="font-bold">Ireland, Europe</span> and the <span class="font-bold">US</span> to deliver <span class="font-bold">awesome user-experiences.</span>
    </p>
  </div>
  <TresCanvas class="canvas" v-bind="gl">
    <Suspense>
      <TresScene v-model:text="text" />
    </Suspense>
  </TresCanvas>
  <div id="smooth-wrapper">
    <div id="smooth-content">
      <Hero :is-visible="true" class="hero" />
      
      <div class="flat-plane">
        <div class="gutter">
          <Skills class="mb-8 section1" />
          <Experience />
          <Contact class="section3" /> 
        </div>
        <Footer />
      </div>
    </div>
  </div>
  <div class="scrollTarget"></div>
</template>

<style lang="scss">@import url('https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300..800&display=swap');

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

.hero {
  z-index: 2;
}

.scrollTarget {
  display: none;
  position: absolute;
  height: 5000vh;
  width: 100px;
  top: 0;
  z-index: 0;
}

.canvas {
  position: fixed !important;
  width: 100%;
  height:130vh;
  top: 0;
  left: 0;
  z-index: 1;
}

.flat-plane {
  padding-top: 7600px;
  padding-bottom: 17rem;
}

.gutter {
  @apply mx-auto max-w-6xl;
}

.text-overlay {
  color: white;
  font-size: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;

  @apply px-4 pb-9 justify-end lg:justify-center;

  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 50vh;
  z-index: 2;
}

.section1, .section3 {
  @apply p-4;
}

.section1, .section3 {
  opacity: 0;
  transform: translateX(-40px);
}

.floating-text {
  @apply text-xl lg:text-4xl text-white mx-auto;

  line-height: 1.5;

  // transform: translateX(35vw);
  // transform-origin: left center;

  // position: absolute;
  // right: 0;

  display: none;
  opacity: 0;
  filter: blur(40px);
}
</style>
