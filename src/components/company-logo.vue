<template>
  <span
    role="img"
    :aria-label="stop.name"
    class="company-logo"
    :style="{ ...logoSize(stop.logo, size), maskImage: `url(${logoUrl(stop.logo)})`, WebkitMaskImage: `url(${logoUrl(stop.logo)})` }"
  />
</template>

<script lang="ts" setup>
import { logoSize, logoUrl, type Stop } from '@/data/journey';

/** A company's logo in the text colour, sized to look about as big as the others (see `logoSize`). */
withDefaults(defineProps<{
  stop: Stop
  /** The height of a 3:1 logo (px). */
  size?: number
}>(), { size: 28 });
</script>

<style lang="scss" scoped>
.company-logo {
  display: block;
  background-color: currentColor;
  mask-repeat: no-repeat;
  mask-position: left center;
  mask-size: contain;
}
</style>
