<script lang="ts" setup>
import { landmarks } from '@/scene/belfast/geo';
import { labelElements } from '@/scene/belfast/labels';
</script>

<template>
  <div class="city-labels" aria-hidden="true">
    <div
      v-for="(landmark, index) in landmarks"
      :key="landmark.name"
      :ref="element => (labelElements[index] = element as HTMLElement | null)"
      class="city-label"
    >
      <span class="name">{{ landmark.name }}</span>
      <span class="stem" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.city-labels {
  @apply fixed inset-0 z-10 pointer-events-none overflow-hidden;
}

// Positioned by the render loop (see PlanetScene): the bottom of the stem sits on the landmark
.city-label {
  @apply absolute left-0 top-0 flex flex-col items-center;

  opacity: 0;
  will-change: transform, opacity;

  .name {
    @apply whitespace-nowrap rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] text-white;

    background: rgba(9, 1, 24, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }

  .stem {
    @apply block w-px h-10;

    background: linear-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0));
  }
}
</style>
