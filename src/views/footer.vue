<script lang="ts" setup>
import { ref } from 'vue';
import AttributionsModal from '../components/attributions-modal.vue';

const isAttributionsOpen = ref(false);
</script>

<template>
  <footer>
    <p class="text-xl font-extrabold">Craig Neeson</p>
    <button class="underline underline-offset-4 text-slate-200 hover:text-white" @click="isAttributionsOpen = true">Attributions</button>
  </footer>
  <AttributionsModal :is-open="isAttributionsOpen" @close="isAttributionsOpen = false" />
</template>

<style lang="scss" scoped>
footer {
  @apply flex justify-between items-center px-6 md:px-8 py-6;

  background: rgba(169, 169, 169, 0.1);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
</style>
