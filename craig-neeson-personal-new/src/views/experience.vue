<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
    name: 'Experience'
});

export const totalTransitionDuration = 2000;
</script>
<script lang="ts" setup>
import SkillItem from './skill-item.vue'
import Divider from '../components/divider.vue';

const props = defineProps<{
}>();

</script>

<template>
    <div class="experience" data-speed="0.8">
      <div class="left">
        <h2>Experience</h2>
        <p>
          TODO
        </p>
      </div>
    </div>
</template>

<style scoped>
.experience {
  @apply flex justify-around gap-12 items-center;
  margin-bottom: 14.5rem;
}

h2 {
  @apply text-3xl mb-6 text-white;
}

.left {
  max-width: 600px;

  p {
    @apply text-white ml-4 text-lg;
  }
}

.right {
  @apply flex-1 flex flex-col gap-5 flex-wrap max-h-[300px];
}
</style>
