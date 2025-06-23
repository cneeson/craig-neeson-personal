<script lang="ts">
import { defineComponent, onMounted } from 'vue';
import { gsap } from "gsap";

export default defineComponent({
    name: 'Heading'
});

</script>
<script lang="ts" setup>


defineProps<{
}>();

</script>

<template>
  <h1><slot /></h1>
</template>

<style scoped>
h1 {
  font-weight: 900;
  @apply text-4xl md:text-5xl lg:text-7xl;
  color: white;
  @apply mb-6;
}

</style>
