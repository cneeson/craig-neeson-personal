<script setup lang="ts">
import { computed } from 'vue';
import { route } from '@/scene/director';
import { navigate } from '@/services/navigation';
import ActionLink from './action-link.vue';
import { isMobile } from '@/services/device';

/** Home, hovering over Belfast: who this is, and where to go from here. */
const isShown = computed(() => route.isIntroDone && route.mode === 'home');
</script>

<template>
  <section class="home panel-card" :class="{ 'is-shown': isShown }" aria-label="Welcome">
    <p class="eyebrow">Belfast · Northern Ireland</p>
    <h2 class="name">Craig <i>Neeson</i></h2>
    <p class="role">Senior Frontend Engineer, building interfaces in Vue, React and TypeScript.</p>
    <div class="controls">
      <ActionLink @click="navigate('about')">Take the tour</ActionLink>
      <button type="button" class="text-button" @click="navigate('experience')">My experience</button>
    </div>
    <p class="hint">{{ isMobile ? 'Swipe' : 'Scroll or use the arrow keys' }} to move on</p>
  </section>
</template>

<style lang="scss" scoped>
.name {
  @apply text-3xl lg:text-4xl mt-1;

  font-variation-settings: 'opsz' 144, 'wght' 700;

  // The surname set apart, as in the title
  i {
    font-variation-settings: 'opsz' 144, 'wght' 300;
  }
}

.role {
  @apply mt-2 text-base lg:text-lg text-white/85 leading-snug;
}

.hint {
  @apply mt-4 text-xs text-white/55;
}
</style>
