<script lang="ts" setup>
defineProps<{
  icon: string;
}>();
</script>

<template>
  <li class="skill-item">
    <img :src="icon" alt="" class="w-7 h-7 lg:w-9 lg:h-9" loading="lazy">
    <span><slot /></span>
  </li>
</template>

<style lang="scss" scoped>
.skill-item {
  @apply flex items-center gap-4 text-lg lg:text-xl;
}
</style>
