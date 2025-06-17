<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
    name: 'Skills'
});

export const totalTransitionDuration = 2000;
</script>
<script lang="ts" setup>


defineProps<{
  icon: string;
}>();

</script>

<template>
    <div class="skill-item">
      <img :src="icon" class="w-9 h-9">
      <p class="text-white"><slot /></p>
    </div>
</template>

<style scoped>
.skill-item {
  @apply flex gap-4;

  p {
    @apply text-xl;
  }
}
</style>
