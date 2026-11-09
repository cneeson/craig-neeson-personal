<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import { TresCanvas } from '@tresjs/core'
import PlanetScene from './components/PlanetScene.vue';
import CityAttribution from './components/city-attribution.vue';
import PlanetHud from './components/planet-hud.vue';
import CitySigns from './components/city-signs.vue';
import SkillSigns from './components/skill-signs.vue';
import SiteMenu from './components/site-menu.vue';
import HomePanel from './components/home-panel.vue';
import AboutPanel from './components/about-panel.vue';
import ExperienceTimeline from './components/experience-timeline.vue';
import SkillsPanel from './components/skills-panel.vue';
import ContactPanel from './components/contact-panel.vue';
import Hero from './views/hero.vue'
import { quality } from './services/device';
import { startNavigation } from './services/navigation';
import { cityState, route } from './scene/director';
import { onOverlayFrame } from './scene/overlay';
import { camera } from './scene/camera';

const gl = {
  clearColor: '#090118',
  powerPreference: 'high-performance' as const,
  // The effect composer renders to its own target, so canvas MSAA would be wasted
  antialias: false,
}

const letterbox = ref<HTMLElement>();

// The mode, for styles that depend on it (such as how much of the bottom of the screen is taken)
watchEffect(() => {
  document.documentElement.dataset.mode = route.mode;
});

let stopNavigation: (() => void) | undefined;
let stopLetterbox: (() => void) | undefined;

onMounted(() => {
  stopNavigation = startNavigation();
  let amount = -1;
  stopLetterbox = onOverlayFrame(() => {
    if (cityState.letterbox === amount) return;
    amount = cityState.letterbox;
    letterbox.value?.style.setProperty('--amount', String(amount));
  });
});

onBeforeUnmount(() => {
  stopNavigation?.();
  stopLetterbox?.();
});
</script>

<template>
  <!-- Faded in once the planet's ready to come up (its textures uploaded, so it doesn't stall as it does) -->
  <div class="scene" :class="{ 'is-ready': route.isPlanetUp }">
    <TresCanvas v-bind="gl" :camera="camera" :dpr="quality.dpr" render-mode="on-demand">
      <Suspense>
        <PlanetScene />
      </Suspense>
    </TresCanvas>
  </div>

  <SkillSigns />
  <div ref="letterbox" class="letterbox" aria-hidden="true" />
  <PlanetHud />
  <CitySigns />
  <CityAttribution />

  <Hero />
  <main>
    <HomePanel />
    <AboutPanel />
    <ExperienceTimeline />
    <SkillsPanel />
    <ContactPanel />
  </main>
  <SiteMenu />
</template>

<style lang="scss">
:root {
  // How much of the bottom of the screen the menu takes (on phones), and that plus the timeline (in Experience)
  --menu-bottom: 0px;
  --chrome-bottom: var(--menu-bottom);

  @media (max-width: 767px) {
    --menu-bottom: calc(58px + env(safe-area-inset-bottom));
  }
}

html[data-mode='experience'] {
  --chrome-bottom: calc(var(--menu-bottom) + 76px);
}

// The scene is the whole site: nothing scrolls, apart from the panels that need to
html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
  background: #090118;
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
  touch-action: none;

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

// --- Shared by the mode panels ---

.panel-card {
  @apply fixed z-30 p-5 lg:p-7 rounded-2xl;

  left: 1rem;
  right: 1rem;
  bottom: calc(var(--menu-bottom) + 1rem);
  max-height: calc(100dvh - var(--menu-bottom) - 2rem);
  overflow-y: auto;
  background: rgba(9, 1, 24, 0.72);
  border: 1px solid rgba(136, 184, 242, 0.28);
  box-shadow: 0 10px 40px rgba(9, 1, 24, 0.5), 0 0 30px rgba(136, 184, 242, 0.12);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  opacity: 0;
  visibility: hidden;
  transform: translateY(16px);
  transition: opacity 0.5s ease, transform 0.5s ease, visibility 0s linear 0.5s;

  &.is-shown {
    opacity: 1;
    visibility: visible;
    transform: none;
    transition: opacity 0.6s ease 0.15s, transform 0.6s ease 0.15s;
  }

  @media (min-width: 768px) {
    left: 2rem;
    right: auto;
    bottom: 2rem;
    width: 28rem;
  }

  @media (min-width: 1024px) {
    left: 3rem;
    bottom: 3rem;
    width: 32rem;
  }

  .eyebrow {
    @apply font-mono text-[11px] tracking-[0.18em] uppercase text-[#88b8f2];
  }

  .controls {
    @apply mt-5 flex items-center gap-3;
  }

  .dots {
    @apply flex gap-2 mr-auto;

    button {
      @apply block w-2.5 h-2.5 rounded-full transition;

      background: rgba(255, 255, 255, 0.3);

      &[aria-current] {
        background: #88b8f2;
        box-shadow: 0 0 10px rgba(136, 184, 242, 0.7);
      }
    }
  }
}

.pill-button {
  @apply px-5 py-2.5 rounded-full text-sm lg:text-base font-semibold text-white transition;

  background: linear-gradient(135deg, #2a237a, #191752);
  border: 1px solid rgba(136, 184, 242, 0.5);
  box-shadow: 0 0 18px rgba(136, 184, 242, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15);

  &:hover,
  &:focus-visible {
    box-shadow: 0 0 28px rgba(136, 184, 242, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
}

.text-button {
  @apply px-2 py-2 text-sm lg:text-base text-white/75 underline-offset-4 transition;

  &:hover,
  &:focus-visible {
    @apply text-white underline;
  }
}
</style>
