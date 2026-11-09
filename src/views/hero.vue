<script lang="ts" setup>
import { onBeforeUnmount, onMounted } from 'vue';
import { gsap } from 'gsap';
import { route, skipIntro } from '@/scene/director';

const name = 'Craig Neeson';
const subtitle = ['Senior', 'Frontend', 'Engineer'];

let context: gsap.Context | undefined;

onMounted(() => {
  context = gsap.context(() => {
    gsap.timeline({ delay: 0.6, defaults: { ease: 'power3.out' } })
      .from('[data-intro="letter"]', { autoAlpha: 0, y: '0.6em', filter: 'blur(12px)', duration: 0.9, stagger: 0.05 })
      .from('[data-intro="rule"]', { autoAlpha: 0, scaleX: 0, duration: 1.6, ease: 'expo.out' }, 0.5)
      .from('[data-intro="word"]', { autoAlpha: 0, filter: 'blur(16px)', duration: 1, stagger: 0.25, ease: 'power1.out' }, 0.8)
      .from('[data-intro="go"]', { autoAlpha: 0, y: 20, duration: 0.8 }, 2)
      .to('[data-intro="go"] img', { y: 8, duration: 0.9, ease: 'sine.inOut', repeat: -1, yoyo: true });
  });
});

onBeforeUnmount(() => context?.revert());
</script>

<template>
  <!-- The title over the planet, until it sets off down to Belfast (by itself after a moment) -->
  <section class="hero" :class="{ 'is-gone': !route.isHeroUp }">
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

    <button type="button" class="go" data-intro="go" @click="skipIntro">
      <span>Let's go</span>
      <img src="images/arrow-down.svg" alt="" />
    </button>
  </section>

  <button v-if="!route.isHeroUp && !route.isIntroDone" type="button" class="skip" @click="skipIntro">Skip ›</button>
</template>

<style lang="scss" scoped>
.hero {
  @apply fixed inset-0 z-30 flex flex-col items-center justify-center text-center px-6;

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

.title {
  @apply text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight;
}

.rule {
  @apply w-full max-w-md my-6 border-0 h-px;

  background: linear-gradient(90deg, transparent, rgba(203, 213, 225, 0.6), transparent);
}

.subtitle {
  @apply text-slate-300 text-2xl md:text-3xl lg:text-4xl flex flex-wrap justify-center gap-x-2;
}

.go {
  @apply absolute bottom-10 inset-x-0 mx-auto w-max flex flex-col gap-2 items-center text-sm uppercase tracking-[0.3em] text-slate-200;

  img {
    @apply w-6 h-6;
  }

  &:hover,
  &:focus-visible {
    @apply text-white;
  }
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
