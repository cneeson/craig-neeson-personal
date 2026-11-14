<script lang="ts" setup>
import { attribution } from '@/scene/belfast/attribution';

const logo = `${process.env.BASE_URL}belfast/google-logo.png`;
</script>

<template>
  <!-- Shown by belfast-photo.vue while the photorealistic tiles are on screen -->
  <div :ref="element => (attribution.element = element as HTMLElement | null)" class="city-attribution">
    <img :src="logo" alt="Google" width="66" height="26">
    <span :ref="element => (attribution.text = element as HTMLElement | null)" class="text" />
  </div>
</template>

<style lang="scss" scoped>
.city-attribution {
  @apply fixed z-[31] flex items-center gap-2 pointer-events-none;

  // Clear of the panels: along the top on phones, bottom right on wider screens
  left: 0.75rem;
  top: calc(env(safe-area-inset-top) + 0.5rem);

  @media (min-width: 768px) {
    left: auto;
    top: auto;
    right: 0.75rem;
    bottom: calc(var(--chrome-bottom) + 0.5rem);
    flex-direction: row-reverse;
    text-align: right;
  }

  opacity: 0;
  transition: opacity 0.4s ease;

  img {
    @apply h-[18px] w-auto;

    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
  }

  .text {
    @apply text-[10px] leading-tight text-white/90;

    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  }
}
</style>
