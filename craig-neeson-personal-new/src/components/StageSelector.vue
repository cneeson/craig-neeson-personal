<template>
  <div class="stage-selector">
    <button class="prev" @click="emit('prev')">Prev</button>
    <slot></slot>
    <div class="right flex gap-4">
      <p>{{ stage }}</p>
      <button class="next" @click="emit('next')">Next</button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'StageSelector',
});
</script>

<script lang="ts" setup>
defineProps<{
    stage: string,
}>();

const emit = defineEmits(['next', 'prev']);

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.stage-selector {

  p {
    @apply text-slate-50;

    z-index: 1;
  }

  button {
    @apply bg-purple-200 p-3;
    z-index: 1;
  }

  .prev {
    @apply absolute left-5 bottom-5;
  }

  .right {
    @apply absolute right-5 bottom-5 items-center;
  }
}
</style>
