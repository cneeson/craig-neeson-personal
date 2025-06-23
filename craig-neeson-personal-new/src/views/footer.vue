<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
    name: 'Footer'
});

export const totalTransitionDuration = 2000;
</script>
<script lang="ts" setup>
import SkillItem from './skill-item.vue'
import Divider from '../components/divider.vue';
import Heading from './heading.vue';

const props = defineProps<{
}>();

</script>

<template>
    <footer>
      <h1 class="text-2xl font-extrabold">Craig Neeson</h1>
      <a href="#" class="underline">Attributions</a>
    </footer>
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
