<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
    name: 'Heading'
});

</script>
<script lang="ts" setup>


defineProps<{
}>();

</script>

<template>
  <h1 class="text1"><slot /></h1>
  <!-- <h1 aria-hidden="true" class="text1 outline-text"><slot /></h1>
  <h1 aria-hidden="true" class="text1 filter-text"><slot /></h1> -->
</template>

<style scoped>
.text1 {
  /* position: absolute; */
  /* top: 0; */
  font-weight: 900;
  font-style: normal;
  font-size: 7vw;

  width: 100%;
  /* transform: translateY(-100%); */
  color: white;
  -webkit-text-stroke-width: 1.5px;
  -webkit-text-stroke-color: white;
  /* z-index: -2; */
  @apply mb-6;
}

.outline-text {
  color: transparent;
  -webkit-text-stroke-width: 1.5px;
  -webkit-text-stroke-color: white;
  z-index: 2;
}

.filter-text {
  mix-blend-mode: screen;
  color: #804691;
  z-index: 2;
}

</style>
