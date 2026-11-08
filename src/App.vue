<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { TresCanvas } from '@tresjs/core'
import { differenceInYears } from 'date-fns';
import PlanetScene from './components/PlanetScene.vue';
import CityAttribution from './components/city-attribution.vue';
import JourneyNav from './components/journey-nav.vue';
import PlanetHud from './components/planet-hud.vue';
import CitySigns from './components/city-signs.vue';
import Hero from './views/hero.vue'
import Skills from './views/skills.vue';
import Experience from './views/experience.vue';
import Contact from './views/contact.vue';
import Footer from './views/footer.vue';
import { isMobile, prefersReducedMotion, quality } from './services/device';
import { chapterAt, chapters, isInBelfast, letterboxAt, settleAt, windowOpacity, windows } from './scene/choreography';
import { createCaption } from './scene/captions';
import { sceneState } from './scene/state';
import { camera } from './scene/camera';

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
const activeChapter = ref(0);

const scrollToY = (y: number) => {
  const smoother = ScrollSmoother.get();
  if (smoother) smoother.scrollTo(y, true);
  else window.scrollTo({ top: y, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
};

/** Scrolls to a chapter of the journey (see choreography), or on to the content. */
const navigate = (target: number | 'content') => {
  const track = document.querySelector('.scene-track') as HTMLElement;
  const content = document.querySelector('.content') as HTMLElement;
  scrollToY(target === 'content'
    ? content.offsetTop - innerHeight * 0.1
    : chapters[target].at * (track.offsetHeight - innerHeight));
};

let isTouching = false;
const onTouchStart = () => (isTouching = true);
const onTouchEnd = () => (isTouching = false);

let context: gsap.Context | undefined;

onMounted(() => {
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });

  context = gsap.context(() => {
    // Native scrolling is smoother than any JS smoothing on touch devices
    if (!isMobile && !prefersReducedMotion) {
      ScrollSmoother.create({
        wrapper: '#smooth-wrapper',
        content: '#smooth-content',
        smooth: 1.5,
      });
    }

    // Catch-up smoothing between the scroll position and the scene. ScrollSmoother already smooths desktop
    // scrolling, so it needs little on top. On touch screens the scene stays with the finger, as the page
    // does: any more lag and the same swipe moves it by more or less depending on how fast it was
    const scrub = prefersReducedMotion ? true : isMobile ? 0.1 : 0.6;

    // Captions are shown while their beat is mostly in view, in step with the markers
    // (each is named after its beat in `windows`)
    const captions = gsap.utils.toArray<HTMLElement>('[data-caption]').map(element => ({
      window: windows[element.dataset.caption as keyof typeof windows],
      ...createCaption(element),
    }));
    // Captions over the (bright, busy) city get a shade behind them
    const captionsElement = document.querySelector('.captions') as HTMLElement;
    const letterbox = document.querySelector('.letterbox') as HTMLElement;
    const syncToJourney = (progress: number) => {
      captionsElement.classList.toggle('is-over-city', isInBelfast(progress));
      letterbox.style.setProperty('--amount', String(letterboxAt(progress)));
      captions.forEach(caption => (windowOpacity(progress, caption.window) > 0.5 ? caption.show() : caption.hide()));
      activeChapter.value = chapterAt(progress);
    };

    // Coming to rest while a caption is fading in eases it fully into view (see settleAt). Not
    // ScrollTrigger's own `snap`: alongside ScrollSmoother that stops the page following jumps
    // upwards. Nor its `scrollEnd` event, which doesn't always fire once smoothing finishes.
    // Desktop only: on touch screens the page moving by itself after a swipe feels like it's fighting the finger.
    const settle = gsap.delayedCall(0.25, () => {
      const trigger = journey.scrollTrigger;
      if (isTouching || !trigger?.isActive) return;
      const target = settleAt(trigger.progress, trigger.direction);
      if (target !== trigger.progress) scrollToY(trigger.start + target * (trigger.end - trigger.start));
    }).pause();

    // --- The 3D journey: one timeline, 0 → 1 across the scene track ---
    const journey = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: () => syncToJourney(journey.progress()),
      scrollTrigger: {
        trigger: '.scene-track',
        start: 'top top',
        end: 'bottom bottom',
        scrub,
        // Restarted on every scroll, so it only runs once scrolling (and smoothing) has stopped
        onUpdate: () => prefersReducedMotion || isMobile || settle.restart(true),
      },
    });

    journey.to(sceneState, { progress: 1, duration: 1 }, 0);

    const [, heroEnd] = windows.hero;
    journey.to('.hero-content', { autoAlpha: 0, filter: 'blur(16px)', y: -40, duration: heroEnd }, 0);

    // --- Hand-off: the planet blurs into a backdrop as the content arrives ---
    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: '.content', start: 'top bottom', end: 'top 15%', scrub },
    })
      .to(sceneState, { exit: 1, duration: 1 }, 0)
      .to('.scene', { filter: `blur(${quality.canvasBlur}px)`, opacity: 0.75, yPercent: -20, duration: 1 }, 0)
      .to('.journey-nav', { autoAlpha: 0, duration: 0.4 }, 0);

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

onBeforeUnmount(() => {
  window.removeEventListener('touchstart', onTouchStart);
  window.removeEventListener('touchend', onTouchEnd);
  window.removeEventListener('touchcancel', onTouchEnd);
  context?.revert();
});
</script>

<template>
  <div class="scene" :class="{ 'is-ready': isSceneReady }">
    <TresCanvas v-bind="gl" :camera="camera" :dpr="quality.dpr" render-mode="on-demand">
      <Suspense @resolve="isSceneReady = true">
        <PlanetScene />
      </Suspense>
    </TresCanvas>
  </div>

  <div class="letterbox" aria-hidden="true" />
  <PlanetHud />
  <CitySigns />
  <CityAttribution />
  <JourneyNav :active="activeChapter" :ready="isSceneReady" @navigate="navigate" />

  <!-- v-once: the captions are split into words for their entrance, so Vue mustn't re-render them -->
  <div v-once class="captions" aria-live="polite">
    <p class="caption is-long" data-caption="belfastIntro">
      <span class="block mb-3">Hi, I'm <strong>Craig.</strong> 👋</span>
      For <strong>{{ yearsExperience }} years</strong> I've been building the interfaces that bring ideas to life,
      and help people get the most out of the products they use.
    </p>
    <p class="caption is-long" data-caption="craft">
      My craft is <strong>UI:</strong> scalable component systems, accessible interactions, and motion that
      gives a product its character.
    </p>
    <p class="caption" data-caption="rewind">
      <span aria-hidden="true">⏪</span> <strong>Rewind.</strong> Let me walk you through how I got here.
    </p>
    <p class="caption" data-caption="reach">
      Built in <strong>Belfast,</strong> shipped with teams across <strong>Ireland, Europe</strong> and the
      <strong>US.</strong>
    </p>
    <p class="caption" data-caption="reveal">
      Let's build <strong>something together.</strong>
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

.letterbox {
  --amount: 0;
  // Bars cropping the view to 2.39:1, less on narrow (portrait) screens
  --bar: min(calc((100vh - 100vw / 2.39) / 2), 11vh);
  position: fixed;
  inset: 0;
  z-index: 5;
  pointer-events: none;

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset-inline: 0;
    height: max(var(--bar), 7vh);
    background: #04010b;
    transform: scaleY(var(--amount));
  }

  &::before {
    top: 0;
    transform-origin: top;
  }

  &::after {
    bottom: 0;
    transform-origin: bottom;
  }
}

.captions {
  @apply fixed inset-x-0 bottom-0 z-10 px-6 pb-12 lg:pb-20 pointer-events-none grid justify-items-center;
}

.captions::before {
  content: '';
  position: absolute;
  inset: -10rem 0 0;
  z-index: -1;
  background: linear-gradient(to top, rgba(9, 1, 24, 0.6), rgba(9, 1, 24, 0.25) 55%, transparent);
  opacity: 0;
  transition: opacity 0.8s ease;
}

.captions.is-over-city::before {
  opacity: 1;
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

  .word {
    display: inline-block;
  }

  &.is-long {
    @apply text-lg md:text-2xl lg:text-3xl max-w-[40ch];
  }
}

#smooth-wrapper {
  position: relative;
  z-index: 20;
}

// Each beat gets roughly a screen of scrolling (about 0.044 of the journey), so captions stay up long
// enough to read, and the walk through Belfast gets most of it
.scene-track {
  height: 2370vh;
}

.content {
  @apply mx-auto max-w-6xl px-5 md:px-8 flex flex-col gap-40 lg:gap-56 pb-40;

  // Starts arriving just as the planet reveal finishes (windows.reveal), so the hand-off
  // follows straight on from it
  margin-top: -45vh;
}
</style>
