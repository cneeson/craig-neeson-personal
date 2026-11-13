<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { isInBelfast } from '@/scene/choreography';
import { route } from '@/scene/director';
import { sceneState } from '@/scene/state';

/**
 * Shown while the clouds hold for the city to load (opening on a stop, or arriving before the tiles have): a little
 * planet with a moon going round it, and a line owning up to it all. Read from the plain scene state, so checked a
 * few times a second rather than reactively; and only after a moment, so it doesn't flash up when the city's quick.
 */
const SHOW_AFTER = 0.6;
/**
 * Given up on after this long (s), just after the city does (MAX_WAIT in photo-city.ts): without it (no key, or the
 * tiles failing) the clouds stay, but this goes.
 */
const GIVE_UP_AFTER = 21;

const asides = [
  'Fetching Belfast, one roof at a time',
  'Warming up the shaders',
  'Asking the clouds to part',
  'Putting the cranes back up',
  'Teaching the cars to keep left',
];

const isShown = ref(false);
const aside = ref(0);
let waitingFor = 0;
let timer: number | undefined;
let asideTimer: number | undefined;

const check = () => {
  const isWaiting = route.isIntroDone && !route.isHeroUp && isInBelfast(sceneState.progress) && !sceneState.cityReady;
  waitingFor = isWaiting ? waitingFor + 0.2 : 0;
  isShown.value = waitingFor > SHOW_AFTER && waitingFor < GIVE_UP_AFTER;
};

onMounted(() => {
  timer = window.setInterval(check, 200);
  asideTimer = window.setInterval(() => {
    if (isShown.value) aside.value = (aside.value + 1) % asides.length;
  }, 2600);
});

onBeforeUnmount(() => {
  window.clearInterval(timer);
  window.clearInterval(asideTimer);
});
</script>

<template>
  <Transition name="loading">
    <div v-if="isShown" class="city-loading" role="status">
      <span class="spinner" aria-hidden="true"><span class="planet" /><span class="moon" /></span>
      <p class="message">Loading a completely over-engineered CV website</p>
      <Transition name="aside" mode="out-in">
        <p :key="aside" class="aside">{{ asides[aside] }}…</p>
      </Transition>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
@use "sass:math";

$ink: #f4efe6;

.city-loading {
  @apply fixed inset-x-0 z-30 flex flex-col items-center px-6 text-center pointer-events-none;

  top: 38%;
  color: $ink;
  text-shadow: 0 1px 14px rgba(9, 1, 24, 0.55);
}

// A little planet, lit from the top right, with a moon gliding round it on a tilted ellipse: in front along the
// bottom, behind along the top
.spinner {
  position: relative;
  isolation: isolate;
  width: 34px;
  height: 34px;
  margin-bottom: 18px;
}

.planet {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: 50%;
  background: radial-gradient(circle at 65% 32%, #9fd0ff 0%, #3f7bd1 45%, #142a5e 100%);
  box-shadow: 0 0 18px rgba(120, 180, 255, 0.45), inset -4px -3px 8px rgba(9, 1, 24, 0.45);
}

.moon {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff 0%, #f4c9a8 55%, #c98a6a 100%);
  box-shadow: 0 0 6px rgba(255, 214, 180, 0.7);
  animation: orbit 3.2s linear infinite;
}

// Many steps round the ellipse, so the path's a smooth curve rather than straight lines between a few points
@keyframes orbit {
  @for $step from 0 through 48 {
    $angle: calc(360deg * $step / 48);
    #{percentage(calc($step / 48))} {
      transform: translate(math.cos($angle) * 27px, math.sin($angle) * 7px + math.cos($angle) * -3px) scale(0.85 + math.sin($angle) * 0.2);
      z-index: if(math.sin($angle) > 0, 2, 0);
    }
  }
}

.message {
  @apply text-lg lg:text-xl;

  font-family: 'Fraunces', Georgia, serif;
  font-variation-settings: 'opsz' 144, 'wght' 500;
}

.aside {
  @apply mt-1.5 text-sm;

  color: rgba($ink, 0.7);
}

.loading-enter-active,
.loading-leave-active {
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.loading-enter-from,
.loading-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.aside-enter-active,
.aside-leave-active {
  transition: opacity 0.3s ease;
}

.aside-enter-from,
.aside-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .moon {
    animation: none;
  }

  .moon {
    transform: translate(26px, 4px);
  }
}
</style>
