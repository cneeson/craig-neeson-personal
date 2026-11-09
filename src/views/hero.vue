<script lang="ts" setup>
import { onBeforeUnmount, onMounted, watch } from 'vue';
import { gsap } from 'gsap';
import { route, skipIntro } from '@/scene/director';

const name = 'Craig Neeson';
const subtitle = ['Senior', 'Frontend', 'Engineer'];

let context: gsap.Context | undefined;
let fallback: number | undefined;

/** The title writes in as the day comes round the planet (see entranceAt), once it's risen into view. */
const writeIn = (delay: number) => {
  if (context) return;
  context = gsap.context(() => {
    gsap.timeline({ delay, defaults: { ease: 'power3.out' } })
      .fromTo('[data-intro="letter"]', { autoAlpha: 0, y: '0.6em', filter: 'blur(12px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.9, stagger: 0.05 })
      .fromTo('[data-intro="rule"]', { autoAlpha: 0, scaleX: 0 }, { autoAlpha: 1, scaleX: 1, duration: 1.6, ease: 'expo.out' }, 0.5)
      .fromTo('[data-intro="word"]', { autoAlpha: 0, filter: 'blur(16px)' },
        { autoAlpha: 1, filter: 'blur(0px)', duration: 1, stagger: 0.25, ease: 'power1.out' }, 0.8)
      .fromTo('[data-intro="enter"]', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 1.6);
  });
};

onMounted(() => {
  // Hidden until then (the planet's textures may take a while), but not for long if the planet never comes up.
  // So the tweens all go to set values, rather than from them to these.
  gsap.set('[data-intro]', { autoAlpha: 0 });
  watch(() => route.isPlanetUp, isUp => isUp && writeIn(2.4), { immediate: true });
  fallback = window.setTimeout(() => writeIn(0), 8000);
});

onBeforeUnmount(() => {
  window.clearTimeout(fallback);
  context?.revert();
});
</script>

<template>
  <!-- The title beside the planet, until Enter sets off down to Belfast -->
  <section class="hero" :class="{ 'is-gone': !route.isHeroUp }">
    <div class="intro">
      <h1 class="title" :aria-label="name">
        <span
          v-for="(letter, index) in name"
          :key="index"
          class="inline-block whitespace-pre"
          aria-hidden="true"
          data-intro="letter"
        >{{ letter }}</span>
      </h1>
      <hr class="rule" data-intro="rule">
      <p class="subtitle">
        <span v-for="word in subtitle" :key="word" class="inline-block" data-intro="word">{{ word }}</span>
      </p>

      <button type="button" class="pill-button enter" data-intro="enter" @click="skipIntro">Enter</button>
    </div>
  </section>

  <button v-if="!route.isHeroUp && !route.isIntroDone" type="button" class="skip" @click="skipIntro">Skip ›</button>
</template>

<style lang="scss" scoped>
.hero {
  // Beside the planet: to its left on wide screens, above it on portrait ones
  @apply fixed inset-0 z-30 flex items-start justify-center text-center px-6 pt-[12vh];

  @media (min-aspect-ratio: 1/1) {
    @apply items-center justify-start text-left pt-0 pl-[7vw];
  }

  transition: opacity 1.2s ease, filter 1.2s ease, transform 1.2s ease, visibility 0s linear 0s;

  &.is-gone {
    opacity: 0;
    filter: blur(16px);
    transform: translateY(-40px);
    visibility: hidden;
    pointer-events: none;
    transition: opacity 1.2s ease, filter 1.2s ease, transform 1.2s ease, visibility 0s linear 1.2s;
  }
}

.intro {
  @apply flex flex-col items-center;

  @media (min-aspect-ratio: 1/1) {
    @apply items-start;
  }
}

.title {
  @apply text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight;
}

.rule {
  @apply w-full max-w-md my-6 border-0 h-px;

  background: linear-gradient(90deg, transparent, rgba(203, 213, 225, 0.6), transparent);

  @media (min-aspect-ratio: 1/1) {
    background: linear-gradient(90deg, rgba(203, 213, 225, 0.6), transparent);
    transform-origin: left;
  }
}

.subtitle {
  @apply text-slate-300 text-2xl md:text-3xl lg:text-4xl flex flex-wrap justify-center gap-x-2;

  @media (min-aspect-ratio: 1/1) {
    @apply justify-start;
  }
}

.enter {
  @apply mt-10 px-10 py-3 text-lg tracking-wide;
}

.skip {
  @apply fixed right-5 bottom-5 z-30 px-4 py-2 rounded-full text-sm text-white/75;

  background: rgba(9, 1, 24, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.15);

  &:hover,
  &:focus-visible {
    @apply text-white;
  }
}
</style>
