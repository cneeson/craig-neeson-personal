<script setup lang="ts">
// TEMP: slows the descent to Belfast so each part of it can be checked. Remove before shipping.
import { ref, watchEffect } from 'vue';
import gsap from 'gsap';
import { route } from '@/scene/director';

const KEY = 'debug-slow-mo';
const rates = [1, 0.5, 0.25, 0.1];
const rate = ref(Number(localStorage.getItem(KEY)) || 1);
const replay = () => window.location.reload();

// Only from Enter until the city, so the title still writes in at its own pace
watchEffect(() => {
  localStorage.setItem(KEY, String(rate.value));
  const isDescending = !route.isHeroUp && !route.isIntroDone;
  gsap.globalTimeline.timeScale(isDescending ? rate.value : 1);
});
</script>

<template>
  <div class="debug-slow-mo">
    <span>Descent</span>
    <button v-for="r in rates" :key="r" type="button" :class="{ 'is-on': rate === r }" @click="rate = r">
      {{ r === 1 ? '1×' : `${r}×` }}
    </button>
    <button type="button" @click="replay">Replay ↻</button>
  </div>
</template>

<style lang="scss" scoped>
.debug-slow-mo {
  position: fixed;
  left: 50%;
  bottom: 16px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  transform: translateX(-50%);
  border-radius: 10px;
  background: rgba(9, 1, 24, 0.75);
  color: #f4efe6;
  font: 500 12px/1 'Satoshi', sans-serif;
  backdrop-filter: blur(6px);

  span {
    margin-right: 4px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.7;
  }

  button {
    padding: 5px 8px;
    border-radius: 6px;

    &.is-on {
      background: #f4efe6;
      color: #090118;
    }
  }
}
</style>
