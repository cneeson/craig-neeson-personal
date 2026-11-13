<script setup lang="ts">
import { reactive } from 'vue';
// @ts-ignore-next-line
import { useEffectPmndrs } from '@tresjs/post-processing';
import { GrainEffect } from '@/scene/grain';

/** The grain and vignette (see GrainEffect), as a pass in the effect composer it's put in. */
const { effect } = useEffectPmndrs(() => new GrainEffect(), reactive({}));
defineExpose({ effect });
</script>

<template>
  <!-- Nothing to show: it's only a pass -->
  <slot />
</template>
