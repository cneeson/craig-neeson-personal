<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { TresCanvas } from '@tresjs/core'
import { differenceInYears } from 'date-fns';
import PlanetScene from './components/PlanetScene.vue';
import Hero from './views/hero.vue'
import Skills from './views/skills.vue';
import Experience from './views/experience.vue';
import Contact from './views/contact.vue';
import Footer from './views/footer.vue';
import { isMobile, prefersReducedMotion, quality } from './services/device';
import { windows } from './scene/choreography';
import { sceneState } from './scene/state';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
// Mobile browsers resize the viewport as the address bar shows/hides; recalculating
// every trigger mid-scroll is what causes jank there.
ScrollTrigger.config({ ignoreMobileResize: true });

const yearsExperience = differenceInYears(new Date(), new Date('2017-06-01'));

const gl = {
  clearColor: '#090118',
  powerPreference: 'high-performance' as const,
  // The effect composer renders to its own target, so canvas MSAA would be wasted
  antialias: false,
}

const isSceneReady = ref(false);
let context: gsap.Context | undefined;

onMounted(() => {
  context = gsap.context(() => {
    // Native scrolling is smoother than any JS smoothing on touch devices
    if (!isMobile && !prefersReducedMotion) {
      ScrollSmoother.create({
        wrapper: '#smooth-wrapper',
        content: '#smooth-content',
        smooth: 1.5,
      });
    }

    const scrub = prefersReducedMotion ? true : 1;

    // --- The 3D journey: one timeline, 0 → 1 across the scene track ---
    const journey = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: '.scene-track', start: 'top top', end: 'bottom bottom', scrub },
    });

    journey.to(sceneState, { progress: 1, duration: 1 }, 0);

    const [, heroEnd] = windows.hero;
    journey.to('.hero-content', { autoAlpha: 0, filter: 'blur(16px)', y: -40, duration: heroEnd }, 0);

    const caption = (selector: string, [start, end]: readonly [number, number]) => {
      const fade = 0.04;
      journey
        .fromTo(selector,
          { autoAlpha: 0, y: 24, filter: 'blur(12px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: fade, ease: 'power1.out' }, start)
        .to(selector,
          { autoAlpha: 0, y: -24, filter: 'blur(12px)', duration: fade, ease: 'power1.in' }, end - fade);
    };
    caption('[data-caption="home"]', windows.northernIreland);
    caption('[data-caption="europe"]', windows.europe);

    // --- Hand-off: the planet blurs into a backdrop as the content arrives ---
    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: '.content', start: 'top bottom', end: 'top 15%', scrub },
    })
      .to(sceneState, { exit: 1, duration: 1 }, 0)
      .to('.scene', { filter: `blur(${quality.canvasBlur}px)`, opacity: 0.75, yPercent: -20, duration: 1 }, 0);

    gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach(element => {
      gsap.from(element, {
        autoAlpha: 0,
        y: 40,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: { trigger: element, start: 'top 88%', once: true },
      });
    });
  });
});

onBeforeUnmount(() => context?.revert());
</script>

<template>
  <div class="scene" :class="{ 'is-ready': isSceneReady }">
    <TresCanvas v-bind="gl" :dpr="quality.dpr" render-mode="on-demand">
      <Suspense @resolve="isSceneReady = true">
        <PlanetScene />
      </Suspense>
    </TresCanvas>
  </div>

  <div class="captions" aria-live="polite">
    <p class="caption" data-caption="home">
      <span class="block mb-3">Hi, I'm <strong>Craig.</strong> 👋</span>
      I'm a frontend developer based in <strong>Northern&nbsp;Ireland.</strong>
    </p>
    <p class="caption" data-caption="europe">
      For <strong>{{ yearsExperience }} years</strong> I've worked with companies across
      <strong>Ireland, Europe</strong> and the <strong>US</strong> to deliver
      <strong>delightful user experiences.</strong>
    </p>
  </div>

  <div id="smooth-wrapper">
    <div id="smooth-content">
      <section class="scene-track">
        <Hero />
      </section>

      <main class="content">
        <Skills data-reveal />
        <Experience />
        <Contact data-reveal />
      </main>

      <Footer />
    </div>
  </div>
</template>

<style lang="scss">
html, body {
  width: 100%;
  background: #090118;
  overflow-x: hidden;
}

#app {
  font-family: 'Funnel Display', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: white;
}

::selection {
  background: rgba(136, 184, 242, 0.35);
}

.scene {
  position: fixed;
  inset: 0;
  // lvh: sized for the largest mobile viewport so the canvas never resizes (and
  // reallocates its render targets) as the address bar shows and hides
  height: 100vh;
  height: 100lvh;
  z-index: 0;
  opacity: 0;
  transition: opacity 1.2s ease;
  will-change: transform, filter;

  &.is-ready {
    opacity: 1;
  }
}

.captions {
  @apply fixed inset-x-0 bottom-0 z-10 px-6 pb-12 lg:pb-20 pointer-events-none grid justify-items-center;
}

.caption {
  @apply text-xl leading-relaxed md:text-3xl lg:text-4xl lg:leading-snug max-w-[34ch];

  // All captions share one grid cell so they cross-fade in place
  grid-area: 1 / 1;

  visibility: hidden;
  text-wrap: balance;
  text-shadow: 0 2px 24px rgba(9, 1, 24, 0.85);

  strong {
    font-weight: 700;
  }
}

#smooth-wrapper {
  position: relative;
  z-index: 20;
}

.scene-track {
  height: 600vh;
}

.content {
  @apply mx-auto max-w-6xl px-5 md:px-8 flex flex-col gap-40 lg:gap-56 pb-40;

  // Starts just as the planet reveal finishes, so the hand-off overlaps the last beat
  margin-top: -40vh;
}
</style>
