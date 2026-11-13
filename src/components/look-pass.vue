<script setup lang="ts">
import { reactive } from 'vue';
// @ts-ignore-next-line
import { useEffectPmndrs } from '@tresjs/post-processing';
import { LookEffect } from '@/scene/look';

/** The grade, the sun's rays and the speed blur (see LookEffect), as a pass in the effect composer it's put in. */
const { effect } = useEffectPmndrs(() => new LookEffect(), reactive({}));
defineExpose({ effect });
</script>

<template>
  <!-- Nothing to show: it's only a pass -->
  <slot />
</template>
