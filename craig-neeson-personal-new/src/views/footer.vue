<script lang="ts">
import { defineComponent, ref } from 'vue';

export default defineComponent({
    name: 'Footer'
});

export const totalTransitionDuration = 2000;
</script>
<script lang="ts" setup>
import AttributionsModal from '../components/attributions-modal.vue';

const isAttributionsOpen = ref(false);
</script>

<template>
    <footer>
      <h1 class="text-2xl font-extrabold">Craig Neeson</h1>
      <a class="underline cursor-pointer" @click="isAttributionsOpen = true">Attributions</a>
    </footer>
    <AttributionsModal :is-open="isAttributionsOpen" @on-close="isAttributionsOpen = false" />
</template>

<style scoped>
footer {
  @apply text-white flex justify-between items-center p-5 px-7 absolute bottom-0 w-full;
  height: 80px;

  background: rgba(169, 169, 169, 0.2);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(5px);
}

</style>
