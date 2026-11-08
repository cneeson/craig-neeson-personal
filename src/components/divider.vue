<template>
  <div class="divider" aria-hidden="true" />
</template>

<style lang="scss" scoped>
.divider {
  @apply w-px self-stretch rounded-full;

  background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.8) 20%, rgba(255, 255, 255, 0.8) 80%, transparent);
  box-shadow: 0 0 18px 2px rgba(136, 184, 242, 0.45);
}
</style>
